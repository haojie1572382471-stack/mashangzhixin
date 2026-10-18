#pragma once
#include <algorithm>
#include <bcrypt.h>
#include <chrono>
#include <ctime>
#include <filesystem>
#include <fstream>
#include <httplib.h>
#include <iterator>
#include <map>
#include <mutex>
#include <sstream>
#include <stdexcept>
#include <vector>
#include <windows.h>
#include <winrt/Windows.Data.Json.h>
#include <winrt/Windows.Foundation.Collections.h>

namespace mashangzhixin {
// Local Windows demo: persistent password hashes, revocable 12-hour sessions.
// Public deployment additionally requires HTTPS and Secure cookies.
class AuthStore {
    using JObject = winrt::Windows::Data::Json::JsonObject;
    using JValue = winrt::Windows::Data::Json::JsonValue;
    struct Account {
        std::string id, name, salt, hash;
    };
    struct Session {
        std::string id, name;
        std::time_t expires;
    };
    std::map<std::string, Account> accounts_;
    std::map<std::string, Session> sessions_;
    std::map<std::string, std::pair<std::time_t, int>> limits_;
    std::mutex mutex_;
    std::filesystem::path path_;
    static std::string hex(const unsigned char *bytes, size_t n) {
        const char *digits = "0123456789abcdef";
        std::string out;
        for (size_t i = 0; i < n; ++i) {
            out += digits[bytes[i] >> 4];
            out += digits[bytes[i] & 15];
        }
        return out;
    }
    static std::string random(size_t n) {
        std::vector<unsigned char> bytes(n);
        if (BCryptGenRandom(nullptr, bytes.data(), static_cast<ULONG>(n),
                            BCRYPT_USE_SYSTEM_PREFERRED_RNG) < 0)
            throw std::runtime_error("Random unavailable");
        return hex(bytes.data(), n);
    }
    static std::string derive(const std::string &password, const std::string &salt) {
        BCRYPT_ALG_HANDLE alg{};
        unsigned char out[32];
        if (BCryptOpenAlgorithmProvider(&alg, BCRYPT_SHA256_ALGORITHM, nullptr,
                                        BCRYPT_ALG_HANDLE_HMAC_FLAG) < 0)
            throw std::runtime_error("Hash unavailable");
        auto result = BCryptDeriveKeyPBKDF2(
            alg, (PUCHAR)password.data(), static_cast<ULONG>(password.size()), (PUCHAR)salt.data(),
            static_cast<ULONG>(salt.size()), 600000, out, sizeof(out), 0);
        BCryptCloseAlgorithmProvider(alg, 0);
        if (result < 0)
            throw std::runtime_error("Hash failed");
        return hex(out, sizeof(out));
    }
    static bool equal(const std::string &a, const std::string &b) {
        unsigned diff = static_cast<unsigned>(a.size() ^ b.size());
        for (size_t i = 0; i < a.size() && i < b.size(); ++i)
            diff |= a[i] ^ b[i];
        return diff == 0;
    }
    bool save() {
        try {
            JObject root;
            winrt::Windows::Data::Json::JsonArray items;
            root.Insert(L"version", JValue::CreateNumberValue(1));
            for (const auto &[name, a] : accounts_) {
                JObject o;
                for (const auto &[key, val] : std::vector<std::pair<std::wstring, std::string>>{
                         {L"id", a.id}, {L"name", a.name}, {L"salt", a.salt}, {L"hash", a.hash}})
                    o.Insert(key, JValue::CreateStringValue(winrt::to_hstring(val)));
                items.Append(o);
            }
            root.Insert(L"items", items);
            auto data = winrt::to_string(root.Stringify());
            std::filesystem::create_directories(path_.parent_path());
            auto temp = path_;
            temp += L".tmp";
            HANDLE f = CreateFileW(temp.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS,
                                   FILE_ATTRIBUTE_NORMAL, nullptr);
            if (f == INVALID_HANDLE_VALUE)
                return false;
            DWORD written = 0;
            bool ok =
                WriteFile(f, data.data(), static_cast<DWORD>(data.size()), &written, nullptr) &&
                written == data.size();
            if (ok)
                ok = FlushFileBuffers(f);
            CloseHandle(f);
            if (!ok)
                return false;
            return MoveFileExW(temp.c_str(), path_.c_str(),
                               MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH) != FALSE;
        } catch (...) {
            return false;
        }
    }
    static std::string cookie(const httplib::Request &req) {
        std::istringstream in(req.get_header_value("Cookie"));
        std::string part;
        while (std::getline(in, part, ';')) {
            auto i = part.find_first_not_of(' ');
            if (i != std::string::npos && part.compare(i, 12, "mzx_session=") == 0)
                return part.substr(i + 12);
        }
        return {};
    }

  public:
    struct Identity {
        std::string id = "guest", name = "guest";
        bool valid = true;
    };
    explicit AuthStore(std::filesystem::path p) : path_(std::move(p)) {}
    bool load() {
        try {
            if (!std::filesystem::exists(path_))
                return true;
            std::ifstream f(path_, std::ios::binary);
            std::string s((std::istreambuf_iterator<char>(f)), {});
            auto root = JObject::Parse(winrt::to_hstring(s));
            if (root.GetNamedNumber(L"version") != 1)
                return false;
            for (auto v : root.GetNamedArray(L"items")) {
                auto o = v.GetObject();
                Account a{winrt::to_string(o.GetNamedString(L"id")),
                          winrt::to_string(o.GetNamedString(L"name")),
                          winrt::to_string(o.GetNamedString(L"salt")),
                          winrt::to_string(o.GetNamedString(L"hash"))};
                if (a.id.size() != 34 || a.salt.size() != 32 || a.hash.size() != 64 ||
                    !valid_name(a.name) || accounts_.contains(a.name))
                    return false;
                accounts_[a.name] = a;
            }
            return true;
        } catch (...) {
            return false;
        }
    }
    static bool valid_name(const std::string &n) {
        return !n.empty() && n.size() <= 64 && n != "guest" && n.front() != ' ' &&
               n.back() != ' ' &&
               std::none_of(n.begin(), n.end(), [](unsigned char c) { return c < 32 || c == 127; });
    }
    static void reply(httplib::Response &res, int status, const std::string &message) {
        res.status = status;
        JObject o;
        o.Insert(L"status", JValue::CreateStringValue(status < 400 ? L"ok" : L"error"));
        o.Insert(L"message", JValue::CreateStringValue(winrt::to_hstring(message)));
        res.set_content(winrt::to_string(o.Stringify()), "application/json; charset=utf-8");
    }
    Identity identity(const httplib::Request &req) {
        std::lock_guard lock(mutex_);
        auto token = cookie(req);
        if (token.empty())
            return {};
        auto it = sessions_.find(token);
        if (it == sessions_.end() || it->second.expires <= std::time(nullptr)) {
            if (it != sessions_.end())
                sessions_.erase(it);
            return {"guest", "guest", false};
        }
        return {it->second.id, it->second.name, true};
    }
    void info(const Identity &who, httplib::Response &res) {
        JObject o;
        o.Insert(L"status", JValue::CreateStringValue(L"ok"));
        o.Insert(L"username", JValue::CreateStringValue(winrt::to_hstring(who.name)));
        o.Insert(L"authenticated", JValue::CreateBooleanValue(who.id != "guest"));
        res.set_content(winrt::to_string(o.Stringify()), "application/json; charset=utf-8");
    }
    void login(const httplib::Request &req, httplib::Response &res, bool registration) {
        try {
            auto obj = JObject::Parse(winrt::to_hstring(req.body));
            auto name = winrt::to_string(obj.GetNamedString(L"username"));
            auto password = winrt::to_string(obj.GetNamedString(L"password"));
            if (!valid_name(name) || password.size() < 8 || password.size() > 128) {
                reply(res, 400, "用户名须为1至64字节，密码须为8至128字节；guest 为保留名称");
                return;
            }
            std::lock_guard lock(mutex_);
            auto now = std::time(nullptr);
            auto &rate = limits_[req.remote_addr];
            if (now - rate.first >= 60)
                rate = {now, 0};
            if (++rate.second > 20) {
                res.set_header("Retry-After", "60");
                reply(res, 429, "登录请求过多，请稍后重试");
                return;
            }
            auto it = accounts_.find(name);
            if (registration) {
                if (it != accounts_.end()) {
                    reply(res, 409, "用户名已存在");
                    return;
                }
                Account a{"u_" + random(16), name, random(16), {}};
                a.hash = derive(password, a.salt);
                accounts_[name] = a;
                if (!save()) {
                    accounts_.erase(name);
                    reply(res, 500, "账号保存失败");
                    return;
                }
                it = accounts_.find(name);
            } else {
                auto salt = it == accounts_.end() ? std::string(32, '0') : it->second.salt;
                auto hash = derive(password, salt);
                if (it == accounts_.end() || !equal(hash, it->second.hash)) {
                    reply(res, 401, "用户名或密码不正确");
                    return;
                }
            }
            for (auto i = sessions_.begin(); i != sessions_.end();)
                if (i->second.expires <= now)
                    i = sessions_.erase(i);
                else
                    ++i;
            sessions_.erase(cookie(req));
            auto token = random(32);
            sessions_[token] = {it->second.id, name, now + 43200};
            res.set_header("Set-Cookie", "mzx_session=" + token +
                                             "; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200");
            info({it->second.id, name, true}, res);
        } catch (const winrt::hresult_error &) {
            reply(res, 400, "账号请求格式错误");
        } catch (...) {
            reply(res, 500, "账号服务暂不可用");
        }
    }
    void logout(const httplib::Request &req, httplib::Response &res) {
        std::lock_guard lock(mutex_);
        sessions_.erase(cookie(req));
        res.set_header("Set-Cookie", "mzx_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0");
        reply(res, 200, "已退出登录");
    }
};
} // namespace mashangzhixin
