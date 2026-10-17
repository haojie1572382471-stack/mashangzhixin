#include "llm_client.h"

#include <cctype>
#include <cstdint>
#include <cstdlib>
#include <limits>
#include <string>
#include <utility>
#include <vector>

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <winhttp.h>
#endif

namespace mashangzhixin {
namespace {

constexpr std::size_t kMaximumResponseBytes = 4 * 1024 * 1024;

std::string read_environment_variable(const char *name) {
    const char *value = std::getenv(name);
    return value == nullptr ? std::string() : std::string(value);
}

std::string escape_json_string(const std::string &value) {
    std::string escaped;
    escaped.reserve(value.size());

    for (const unsigned char byte : value) {
        switch (byte) {
        case '"':
            escaped += "\\\"";
            break;
        case '\\':
            escaped += "\\\\";
            break;
        case '\b':
            escaped += "\\b";
            break;
        case '\f':
            escaped += "\\f";
            break;
        case '\n':
            escaped += "\\n";
            break;
        case '\r':
            escaped += "\\r";
            break;
        case '\t':
            escaped += "\\t";
            break;
        default:
            if (byte < 0x20) {
                const char hex_digits[] = "0123456789abcdef";
                escaped += "\\u00";
                escaped += hex_digits[(byte >> 4) & 0x0f];
                escaped += hex_digits[byte & 0x0f];
            } else {
                escaped.push_back(static_cast<char>(byte));
            }
            break;
        }
    }

    return escaped;
}

int hex_value(char character) {
    if (character >= '0' && character <= '9') {
        return character - '0';
    }
    if (character >= 'a' && character <= 'f') {
        return character - 'a' + 10;
    }
    if (character >= 'A' && character <= 'F') {
        return character - 'A' + 10;
    }
    return -1;
}

bool read_hex_code_unit(const std::string &json,
                        std::size_t position,
                        std::uint32_t &code_unit) {
    if (position + 4 > json.size()) {
        return false;
    }

    code_unit = 0;
    for (std::size_t offset = 0; offset < 4; ++offset) {
        const int value = hex_value(json[position + offset]);
        if (value < 0) {
            return false;
        }
        code_unit = (code_unit << 4) | static_cast<std::uint32_t>(value);
    }
    return true;
}

void append_utf8(std::uint32_t code_point, std::string &output) {
    if (code_point <= 0x7f) {
        output.push_back(static_cast<char>(code_point));
    } else if (code_point <= 0x7ff) {
        output.push_back(static_cast<char>(0xc0 | (code_point >> 6)));
        output.push_back(static_cast<char>(0x80 | (code_point & 0x3f)));
    } else if (code_point <= 0xffff) {
        output.push_back(static_cast<char>(0xe0 | (code_point >> 12)));
        output.push_back(
            static_cast<char>(0x80 | ((code_point >> 6) & 0x3f)));
        output.push_back(static_cast<char>(0x80 | (code_point & 0x3f)));
    } else if (code_point <= 0x10ffff) {
        output.push_back(static_cast<char>(0xf0 | (code_point >> 18)));
        output.push_back(
            static_cast<char>(0x80 | ((code_point >> 12) & 0x3f)));
        output.push_back(
            static_cast<char>(0x80 | ((code_point >> 6) & 0x3f)));
        output.push_back(static_cast<char>(0x80 | (code_point & 0x3f)));
    }
}

bool parse_json_string(const std::string &json,
                       std::size_t quote_position,
                       std::string &value) {
    if (quote_position >= json.size() || json[quote_position] != '"') {
        return false;
    }

    value.clear();
    std::size_t position = quote_position + 1;
    while (position < json.size()) {
        const char character = json[position++];
        if (character == '"') {
            return true;
        }
        if (character != '\\') {
            value.push_back(character);
            continue;
        }
        if (position >= json.size()) {
            return false;
        }

        const char escaped = json[position++];
        switch (escaped) {
        case '"':
        case '\\':
        case '/':
            value.push_back(escaped);
            break;
        case 'b':
            value.push_back('\b');
            break;
        case 'f':
            value.push_back('\f');
            break;
        case 'n':
            value.push_back('\n');
            break;
        case 'r':
            value.push_back('\r');
            break;
        case 't':
            value.push_back('\t');
            break;
        case 'u': {
            std::uint32_t first = 0;
            if (!read_hex_code_unit(json, position, first)) {
                return false;
            }
            position += 4;

            std::uint32_t code_point = first;
            if (first >= 0xd800 && first <= 0xdbff) {
                if (position + 6 > json.size() ||
                    json[position] != '\\' || json[position + 1] != 'u') {
                    return false;
                }
                std::uint32_t second = 0;
                if (!read_hex_code_unit(json, position + 2, second) ||
                    second < 0xdc00 || second > 0xdfff) {
                    return false;
                }
                position += 6;
                code_point = 0x10000 +
                             ((first - 0xd800) << 10) +
                             (second - 0xdc00);
            } else if (first >= 0xdc00 && first <= 0xdfff) {
                return false;
            }

            append_utf8(code_point, value);
            break;
        }
        default:
            return false;
        }
    }

    return false;
}

bool find_json_string_value(const std::string &json,
                            const std::string &key,
                            std::size_t search_start,
                            std::string &value) {
    const std::string token = "\"" + key + "\"";
    std::size_t key_position = json.find(token, search_start);

    while (key_position != std::string::npos) {
        std::size_t position = key_position + token.size();
        while (position < json.size() &&
               std::isspace(static_cast<unsigned char>(json[position]))) {
            ++position;
        }
        if (position < json.size() && json[position] == ':') {
            ++position;
            while (position < json.size() &&
                   std::isspace(static_cast<unsigned char>(json[position]))) {
                ++position;
            }
            if (position < json.size() && json[position] == '"') {
                return parse_json_string(json, position, value);
            }
        }
        key_position = json.find(token, key_position + token.size());
    }

    return false;
}

std::string shorten_error(std::string value) {
    constexpr std::size_t maximum_length = 300;
    if (value.size() > maximum_length) {
        value.resize(maximum_length);
        value += "...";
    }
    return value;
}

#ifdef _WIN32

class InternetHandle {
public:
    explicit InternetHandle(HINTERNET handle = nullptr) : handle_(handle) {}

    ~InternetHandle() {
        if (handle_ != nullptr) {
            WinHttpCloseHandle(handle_);
        }
    }

    InternetHandle(const InternetHandle &) = delete;
    InternetHandle &operator=(const InternetHandle &) = delete;

    HINTERNET get() const {
        return handle_;
    }

    explicit operator bool() const {
        return handle_ != nullptr;
    }

private:
    HINTERNET handle_;
};

std::wstring utf8_to_wide(const std::string &value) {
    if (value.empty()) {
        return std::wstring();
    }

    const int required = MultiByteToWideChar(
        CP_UTF8,
        MB_ERR_INVALID_CHARS,
        value.data(),
        static_cast<int>(value.size()),
        nullptr,
        0);
    if (required <= 0) {
        return std::wstring();
    }

    std::wstring result(static_cast<std::size_t>(required), L'\0');
    const int converted = MultiByteToWideChar(
        CP_UTF8,
        MB_ERR_INVALID_CHARS,
        value.data(),
        static_cast<int>(value.size()),
        result.data(),
        required);
    if (converted != required) {
        return std::wstring();
    }
    return result;
}

std::string winhttp_error(const std::string &operation) {
    return operation + " failed (Windows error " +
           std::to_string(GetLastError()) + ")";
}

LlmResult send_deepseek_request(const std::string &api_key,
                                const std::string &request_body) {
    LlmResult result;

    InternetHandle session(WinHttpOpen(
        L"Mashangzhixin/1.0",
        WINHTTP_ACCESS_TYPE_DEFAULT_PROXY,
        WINHTTP_NO_PROXY_NAME,
        WINHTTP_NO_PROXY_BYPASS,
        0));
    if (!session) {
        result.error = winhttp_error("WinHttpOpen");
        return result;
    }

    if (!WinHttpSetTimeouts(session.get(), 5000, 5000, 10000, 60000)) {
        result.error = winhttp_error("WinHttpSetTimeouts");
        return result;
    }

    InternetHandle connection(WinHttpConnect(
        session.get(), L"api.deepseek.com", INTERNET_DEFAULT_HTTPS_PORT, 0));
    if (!connection) {
        result.error = winhttp_error("WinHttpConnect");
        return result;
    }

    const wchar_t *accepted_types[] = {L"application/json", nullptr};
    InternetHandle request(WinHttpOpenRequest(
        connection.get(),
        L"POST",
        L"/chat/completions",
        nullptr,
        WINHTTP_NO_REFERER,
        accepted_types,
        WINHTTP_FLAG_SECURE));
    if (!request) {
        result.error = winhttp_error("WinHttpOpenRequest");
        return result;
    }

    const std::wstring wide_api_key = utf8_to_wide(api_key);
    if (wide_api_key.empty()) {
        result.error = "invalid_api_key_encoding";
        return result;
    }

    const std::wstring headers =
        L"Content-Type: application/json; charset=utf-8\r\n"
        L"Authorization: Bearer " +
        wide_api_key + L"\r\n";

    if (request_body.size() >
        static_cast<std::size_t>((std::numeric_limits<DWORD>::max)())) {
        result.error = "request_too_large";
        return result;
    }

    const DWORD body_size = static_cast<DWORD>(request_body.size());
    if (!WinHttpSendRequest(
            request.get(),
            headers.c_str(),
            static_cast<DWORD>(-1L),
            const_cast<char *>(request_body.data()),
            body_size,
            body_size,
            0)) {
        result.error = winhttp_error("WinHttpSendRequest");
        return result;
    }

    if (!WinHttpReceiveResponse(request.get(), nullptr)) {
        result.error = winhttp_error("WinHttpReceiveResponse");
        return result;
    }

    DWORD status_code = 0;
    DWORD status_code_size = sizeof(status_code);
    if (!WinHttpQueryHeaders(
            request.get(),
            WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
            WINHTTP_HEADER_NAME_BY_INDEX,
            &status_code,
            &status_code_size,
            WINHTTP_NO_HEADER_INDEX)) {
        result.error = winhttp_error("WinHttpQueryHeaders");
        return result;
    }
    result.status_code = static_cast<int>(status_code);

    std::string response_body;
    while (true) {
        DWORD available = 0;
        if (!WinHttpQueryDataAvailable(request.get(), &available)) {
            result.error = winhttp_error("WinHttpQueryDataAvailable");
            return result;
        }
        if (available == 0) {
            break;
        }
        if (response_body.size() + available > kMaximumResponseBytes) {
            result.error = "response_too_large";
            return result;
        }

        std::vector<char> buffer(available);
        DWORD bytes_read = 0;
        if (!WinHttpReadData(
                request.get(), buffer.data(), available, &bytes_read)) {
            result.error = winhttp_error("WinHttpReadData");
            return result;
        }
        response_body.append(buffer.data(), bytes_read);
    }

    if (status_code < 200 || status_code >= 300) {
        std::string api_message;
        find_json_string_value(response_body, "message", 0, api_message);
        result.error = "DeepSeek HTTP " + std::to_string(status_code);
        if (!api_message.empty()) {
            result.error += ": " + shorten_error(api_message);
        }
        return result;
    }

    const std::size_t message_position = response_body.find("\"message\"");
    if (message_position == std::string::npos ||
        !find_json_string_value(
            response_body, "content", message_position, result.answer) ||
        result.answer.empty()) {
        result.error = "DeepSeek response does not contain message.content";
        return result;
    }

    result.success = true;
    return result;
}

#endif

}  // namespace

LlmClient::LlmClient()
    : api_key_(read_environment_variable("DEEPSEEK_API_KEY")),
      model_(read_environment_variable("DEEPSEEK_MODEL")) {
    if (model_.empty()) {
        model_ = "deepseek-flash";
    }
}

bool LlmClient::is_configured() const {
    return !api_key_.empty();
}

const std::string &LlmClient::model() const {
    return model_;
}

LlmResult LlmClient::generate_answer(
    const std::string &course_id,
    const std::string &question,
    const std::string &retrieved_context) const {
    if (!is_configured()) {
        LlmResult result;
        result.error = "not_configured";
        return result;
    }

    const std::string course_name =
        course_id == "data-structure" ? "数据结构" : "C++";
    const std::string system_prompt =
        "你是“码上知新”编程学习助手。请以给定课程资料为主要依据，"
        "用准确、清晰、适合大学生复习的中文回答问题。"
        "可以补充必要解释和简短示例，但不得编造资料中不存在的结论。"
        "如果资料不足，请明确说明。";
    const std::string user_prompt =
        "课程：" + course_name +
        "\n学生问题：" + question +
        "\n\n检索到的课程资料：\n" + retrieved_context +
        "\n\n请直接给出结构清楚的学习解答。";

    const std::string request_body =
        "{\"model\":\"" + escape_json_string(model_) +
        "\",\"messages\":[{\"role\":\"system\",\"content\":\"" +
        escape_json_string(system_prompt) +
        "\"},{\"role\":\"user\",\"content\":\"" +
        escape_json_string(user_prompt) +
        "\"}],\"thinking\":{\"type\":\"disabled\"},"
        "\"max_tokens\":1200,\"stream\":false}";

#ifdef _WIN32
    return send_deepseek_request(api_key_, request_body);
#else
    LlmResult result;
    result.error = "unsupported_platform";
    return result;
#endif
}

}  // namespace mashangzhixin
