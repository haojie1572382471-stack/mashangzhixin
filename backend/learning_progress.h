#pragma once
#include <algorithm>
#include <cmath>
#include <ctime>
#include <filesystem>
#include <fstream>
#include <iterator>
#include <map>
#include <mutex>
#include <roapi.h>
#include <set>
#include <string>
#include <utility>
#include <vector>
#include <windows.h>
#include <winrt/Windows.Data.Json.h>
#include <winrt/Windows.Foundation.Collections.h>

namespace mashangzhixin {
struct LearningAttempt {
    std::string user_id, course_id, knowledge_point, selected_answer, attempted_at, submission_id;
    int exercise_id = 0;
    bool correct = false;
};
struct LearningStats {
    std::size_t attempted = 0, correct = 0;
    std::vector<bool> recent;
    std::vector<int> recent_ids;
    std::set<int> seen;
    std::size_t first_correct = 0;
    std::string last_attempted_at;
    int accuracy() const {
        return attempted ? static_cast<int>(std::lround(100.0 * correct / attempted)) : 0;
    }
    int mastery() const {
        return recent.empty()
                   ? 0
                   : static_cast<int>(std::lround(
                         100.0 * std::count(recent.begin(), recent.end(), true) / recent.size()));
    }
    std::string level() const {
        if (!attempted)
            return "未学习";
        if (mastery() < 60)
            return "待加强";
        return seen.size() >= 3 && mastery() >= 80 ? "已掌握" : "学习中";
    }
};
class LearningProgress {
    using JsonObject = winrt::Windows::Data::Json::JsonObject;
    using JsonArray = winrt::Windows::Data::Json::JsonArray;
    using JsonValue = winrt::Windows::Data::Json::JsonValue;
    struct Apartment {
        HRESULT result = RoInitialize(RO_INIT_MULTITHREADED);
        Apartment() {
            if (FAILED(result) && result != RPC_E_CHANGED_MODE)
                winrt::check_hresult(result);
        }
        ~Apartment() {
            if (SUCCEEDED(result))
                RoUninitialize();
        }
    };
    std::filesystem::path path_;
    std::vector<LearningAttempt> attempts_;
    mutable std::mutex mutex_;
    static void text(JsonObject &o, const wchar_t *key, const std::string &value) {
        o.Insert(key, JsonValue::CreateStringValue(winrt::to_hstring(value)));
    }
    static void number(JsonObject &o, const wchar_t *key, double value) {
        o.Insert(key, JsonValue::CreateNumberValue(value));
    }
    static std::string field(const JsonObject &o, const wchar_t *key) {
        return winrt::to_string(o.GetNamedString(key));
    }
    static std::string timestamp() {
        const auto now = std::time(nullptr);
        std::tm utc{};
        gmtime_s(&utc, &now);
        char buffer[32];
        std::strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%SZ", &utc);
        return buffer;
    }
    std::string serialize() const {
        JsonObject root;
        number(root, L"version", 1);
        JsonArray items;
        for (const auto &a : attempts_) {
            JsonObject o;
            text(o, L"user_id", a.user_id);
            number(o, L"exercise_id", a.exercise_id);
            text(o, L"course_id", a.course_id);
            text(o, L"knowledge_point", a.knowledge_point);
            text(o, L"selected_answer", a.selected_answer);
            text(o, L"attempted_at", a.attempted_at);
            text(o, L"submission_id", a.submission_id);
            o.Insert(L"correct", JsonValue::CreateBooleanValue(a.correct));
            items.Append(o);
        }
        root.Insert(L"items", items);
        return winrt::to_string(root.Stringify());
    }
    static bool parse(const std::filesystem::path &path, std::vector<LearningAttempt> &parsed) {
        try {
            std::ifstream input(path, std::ios::binary);
            if (!input)
                return false;
            const std::string data((std::istreambuf_iterator<char>(input)), {});
            const auto root = JsonObject::Parse(winrt::to_hstring(data));
            if (root.GetNamedNumber(L"version") != 1)
                return false;
            std::vector<LearningAttempt> result;
            std::set<std::pair<std::string, std::string>> tokens;
            for (const auto &item : root.GetNamedArray(L"items")) {
                auto o = item.GetObject();
                LearningAttempt a;
                a.user_id = field(o, L"user_id");
                a.course_id = field(o, L"course_id");
                a.knowledge_point = field(o, L"knowledge_point");
                a.selected_answer = field(o, L"selected_answer");
                a.attempted_at = field(o, L"attempted_at");
                a.submission_id = field(o, L"submission_id");
                a.correct = o.GetNamedBoolean(L"correct");
                double id = o.GetNamedNumber(L"exercise_id");
                if (!std::isfinite(id) || id < 1 || id > 2147483647 || std::floor(id) != id)
                    return false;
                a.exercise_id = static_cast<int>(id);
                if (!valid_user(a.user_id) ||
                    (a.course_id != "cpp" && a.course_id != "data-structure") ||
                    a.knowledge_point.empty() || a.attempted_at.empty() ||
                    a.selected_answer.size() != 1 ||
                    std::string("ABCD").find(a.selected_answer) == std::string::npos ||
                    !valid_token(a.submission_id))
                    return false;
                if (!a.submission_id.empty() && !tokens.emplace(a.user_id, a.submission_id).second)
                    return false;
                result.push_back(std::move(a));
            }
            parsed = std::move(result);
            return true;
        } catch (...) {
            return false;
        }
    }
    bool persist(bool backup) const {
        try {
            std::error_code ec;
            std::filesystem::create_directories(path_.parent_path(), ec);
            if (ec)
                return false;
            auto temp = path_;
            temp += L".tmp";
            auto bak = path_;
            bak += L".bak";
            const auto data = serialize();
            if (data.size() > MAXDWORD)
                return false;
            HANDLE file = CreateFileW(temp.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS,
                                      FILE_ATTRIBUTE_NORMAL, nullptr);
            if (file == INVALID_HANDLE_VALUE)
                return false;
            DWORD written = 0;
            bool ok =
                WriteFile(file, data.data(), static_cast<DWORD>(data.size()), &written, nullptr) &&
                written == data.size();
            if (ok)
                ok = FlushFileBuffers(file) != FALSE;
            CloseHandle(file);
            if (!ok) {
                DeleteFileW(temp.c_str());
                return false;
            }
            if (backup && std::filesystem::exists(path_) &&
                !CopyFileW(path_.c_str(), bak.c_str(), FALSE)) {
                DeleteFileW(temp.c_str());
                return false;
            }
            if (!MoveFileExW(temp.c_str(), path_.c_str(),
                             MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)) {
                DeleteFileW(temp.c_str());
                return false;
            }
            return true;
        } catch (...) {
            return false;
        }
    }

  public:
    explicit LearningProgress(std::filesystem::path path) : path_(std::move(path)) {}
    static bool valid_user(const std::string &user) {
        return !user.empty() && user.size() <= 128 &&
               std::any_of(user.begin(), user.end(), [](unsigned char c) { return c > 32; }) &&
               std::none_of(user.begin(), user.end(),
                            [](unsigned char c) { return c < 32 || c == 127; });
    }
    static bool valid_token(const std::string &token) {
        return token.size() <= 100 && std::all_of(token.begin(), token.end(), [](unsigned char c) {
                   return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
                          (c >= '0' && c <= '9') || c == '-' || c == '_';
               });
    }
    static bool identity(const std::string &body, std::string &user, std::string &token) {
        try {
            Apartment apartment;
            const auto object = JsonObject::Parse(winrt::to_hstring(body));
            user = winrt::to_string(object.GetNamedString(L"user_id", L"guest"));
            token = winrt::to_string(object.GetNamedString(L"submission_id", L""));
            return valid_user(user) && valid_token(token);
        } catch (...) {
            return false;
        }
    }
    bool load(bool &recovered) {
        Apartment apartment;
        std::lock_guard<std::mutex> lock(mutex_);
        recovered = false;
        auto backup = path_;
        backup += L".bak";
        if (!std::filesystem::exists(path_) && !std::filesystem::exists(backup))
            return true;
        if (parse(path_, attempts_))
            return true;
        if (!parse(backup, attempts_))
            return false;
        recovered = true;
        return persist(false);
    }
    // Returns ok/reused/conflict/storage_error. A retry token never creates a second attempt.
    std::string record(LearningAttempt a, std::size_t &attempt_id) {
        Apartment apartment;
        std::lock_guard<std::mutex> lock(mutex_);
        if (!a.submission_id.empty())
            for (std::size_t i = 0; i < attempts_.size(); ++i) {
                const auto &old = attempts_[i];
                if (old.user_id == a.user_id && old.submission_id == a.submission_id) {
                    attempt_id = i + 1;
                    return old.exercise_id == a.exercise_id &&
                                   old.selected_answer == a.selected_answer
                               ? "reused"
                               : "conflict";
                }
            }
        a.attempted_at = timestamp();
        attempts_.push_back(std::move(a));
        if (!persist(true)) {
            attempts_.pop_back();
            return "storage_error";
        }
        attempt_id = attempts_.size();
        return "ok";
    }
    bool latest(const std::string &user, int exercise, LearningAttempt &result) const {
        std::lock_guard lock(mutex_);
        for (auto it = attempts_.rbegin(); it != attempts_.rend(); ++it)
            if (it->user_id == user && it->exercise_id == exercise) {
                result = *it;
                return true;
            }
        return false;
    }
    std::map<std::string, LearningStats> stats(const std::string &user,
                                               const std::string &course) const {
        std::lock_guard<std::mutex> lock(mutex_);
        std::map<std::string, LearningStats> result;
        for (const auto &a : attempts_)
            if (a.user_id == user && a.course_id == course) {
                auto &s = result[a.knowledge_point];
                ++s.attempted;
                if (a.correct)
                    ++s.correct;
                if (s.seen.insert(a.exercise_id).second && a.correct)
                    ++s.first_correct;
                s.last_attempted_at = a.attempted_at;
                auto existing = std::find(s.recent_ids.begin(), s.recent_ids.end(), a.exercise_id);
                if (existing != s.recent_ids.end()) {
                    auto index = existing - s.recent_ids.begin();
                    s.recent_ids.erase(existing);
                    s.recent.erase(s.recent.begin() + index);
                }
                s.recent_ids.push_back(a.exercise_id);
                s.recent.push_back(a.correct);
                if (s.recent.size() > 20) {
                    s.recent.erase(s.recent.begin());
                    s.recent_ids.erase(s.recent_ids.begin());
                }
            }
        return result;
    }
    std::string progress_json(const std::string &user, const std::string &course,
                              const std::set<std::string> &topics,
                              const std::string &display_user = "") const {
        Apartment apartment;
        auto all = stats(user, course);
        JsonObject root;
        JsonArray points, weak;
        std::size_t total = 0, correct = 0;
        int sum_mastery = 0;
        for (const auto &kp : topics) {
            const auto &s = all[kp];
            JsonObject o;
            text(o, L"knowledge_point", kp);
            number(o, L"attempted", static_cast<double>(s.attempted));
            number(o, L"correct", static_cast<double>(s.correct));
            number(o, L"accuracy", s.accuracy());
            number(o, L"mastery", s.mastery());
            number(o, L"recent_attempts", static_cast<double>(s.recent.size()));
            number(o, L"unique_exercises", static_cast<double>(s.seen.size()));
            number(o, L"first_attempt_accuracy",
                   s.seen.empty() ? 0 : std::lround(100.0 * s.first_correct / s.seen.size()));
            text(o, L"last_attempted_at", s.last_attempted_at);
            text(o, L"level", s.level());
            points.Append(o);
            if (s.attempted && s.mastery() < 60)
                weak.Append(JsonValue::CreateStringValue(winrt::to_hstring(kp)));
            total += s.attempted;
            correct += s.correct;
            sum_mastery += s.mastery();
        }
        text(root, L"status", "ok");
        text(root, L"user_id", display_user.empty() ? user : display_user);
        text(root, L"course_id", course);
        number(root, L"total_attempts", static_cast<double>(total));
        number(root, L"correct_attempts", static_cast<double>(correct));
        number(root, L"accuracy", total ? std::lround(100.0 * correct / total) : 0);
        number(root, L"mastery",
               topics.empty() ? 0 : std::lround(static_cast<double>(sum_mastery) / topics.size()));
        number(root, L"mastery_window", 20);
        root.Insert(L"knowledge_points", points);
        root.Insert(L"weak_knowledge_points", weak);
        return winrt::to_string(root.Stringify());
    }
};
} // namespace mashangzhixin
