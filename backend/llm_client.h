#pragma once

#include <string>

namespace mashangzhixin {

struct LlmResult {
    bool success = false;
    std::string answer;
    std::string error;
    int status_code = 0;
};

class LlmClient {
public:
    LlmClient();

    bool is_configured() const;
    const std::string &model() const;

    LlmResult generate_answer(const std::string &course_id,
                              const std::string &question,
                              const std::string &retrieved_context) const;

private:
    std::string api_key_;
    std::string model_;
};

}  // namespace mashangzhixin
