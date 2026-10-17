#pragma once
#include <filesystem>
#include <string>

namespace mashangzhixin {
struct LlmConfig {
    std::string api_url = "https://api.deepseek.com/chat/completions";
    std::string model = "deepseek-flash";
    std::string api_key;
    std::string thinking = "disabled";
    int timeout_seconds = 30;
    bool valid = true;
    static LlmConfig load(const std::filesystem::path &env_path = ".env");
};
struct LlmResult {
    bool generated = false;
    std::string answer;
    std::string reason;
    unsigned long http_status = 0;
};
class LlmClient {
public:
    explicit LlmClient(LlmConfig config);
    bool configured() const;
    LlmResult generate(const std::string &course_id, const std::string &question,
                       const std::string &context) const;
private:
    LlmConfig config_;
};
} // namespace mashangzhixin