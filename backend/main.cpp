#include <httplib.h>

#include <cctype>
#include <iostream>
#include <mutex>
#include <string>
#include <vector>

namespace {
struct WrongQuestion {
    int id;
    std::string course_id;
    std::string question;
    std::string answer;
    std::string knowledge_point;
};

std::string escape_json_string(const std::string &value) {
    std::string escaped;
    escaped.reserve(value.size());

    for (const char character : value) {
        switch (character) {
        case '"':
            escaped += "\\\"";
            break;
        case '\\':
            escaped += "\\\\";
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
        case '\b':
            escaped += "\\b";
            break;
        case '\f':
            escaped += "\\f";
            break;
        default:
            if (static_cast<unsigned char>(character) < 0x20) {
                const char hex_digits[] = "0123456789abcdef";
                escaped += "\\u00";
                escaped += hex_digits[(character >> 4) & 0x0f];
                escaped += hex_digits[character & 0x0f];
            } else {
                escaped += character;
            }
            break;
        }
    }

    return escaped;
}

bool get_json_string(const std::string &body, const std::string &key, std::string &value) {
    const std::string key_token = "\"" + key + "\"";
    const std::size_t key_position = body.find(key_token);
    if (key_position == std::string::npos) {
        return false;
    }

    std::size_t value_position = body.find(':', key_position + key_token.size());
    if (value_position == std::string::npos) {
        return false;
    }

    ++value_position;
    while (value_position < body.size() &&
           std::isspace(static_cast<unsigned char>(body[value_position]))) {
        ++value_position;
    }

    if (value_position >= body.size() || body[value_position] != '"') {
        return false;
    }

    ++value_position;
    value.clear();
    while (value_position < body.size()) {
        const char character = body[value_position++];
        if (character == '"') {
            return true;
        }

        if (character != '\\') {
            value += character;
            continue;
        }

        if (value_position >= body.size()) {
            return false;
        }

        const char escaped_character = body[value_position++];
        switch (escaped_character) {
        case '"':
        case '\\':
        case '/':
            value += escaped_character;
            break;
        case 'b':
            value += '\b';
            break;
        case 'f':
            value += '\f';
            break;
        case 'n':
            value += '\n';
            break;
        case 'r':
            value += '\r';
            break;
        case 't':
            value += '\t';
            break;
        default:
            return false;
        }
    }

    return false;
}
}  // namespace

int main() {
    httplib::Server server;
    std::vector<WrongQuestion> wrong_questions;
    std::mutex wrong_questions_mutex;
    int next_wrong_question_id = 1;

    server.set_default_headers({
    {"Access-Control-Allow-Origin", "http://127.0.0.1:5500"},
    {"Access-Control-Allow-Methods", "GET, POST, OPTIONS"},
    {"Access-Control-Allow-Headers", "Content-Type"}
});

server.Options(R"(.*)", [](const httplib::Request &, httplib::Response &response) {
    response.status = 204;
});

    server.Get("/api/health", [](const httplib::Request &, httplib::Response &response) {
        response.set_content(
            R"({"status":"ok","message":"Mashangzhixin backend is running"})",
            "application/json");
    });

    server.Post("/api/ask", [](const httplib::Request &request, httplib::Response &response) {
        std::string question;
        if (!get_json_string(request.body, "question", question) || question.empty()) {
            response.status = 400;
            response.set_content(R"({"error":"question is required"})", "application/json");
            return;
        }

        response.set_content(
            R"({"answer":"这是 C 语言数组与指针的演示回答。","sources":[{"title":"C语言课程讲义","section":"数组与指针","page":null}]})",
            "application/json");
    });

    server.Post("/api/wrong-questions", [&](const httplib::Request &request,
                                             httplib::Response &response) {
        std::string course_id;
        std::string question;
        std::string answer;
        std::string knowledge_point;
        if (!get_json_string(request.body, "course_id", course_id) || course_id.empty() ||
            !get_json_string(request.body, "question", question) || question.empty() ||
            !get_json_string(request.body, "answer", answer) || answer.empty() ||
            !get_json_string(request.body, "knowledge_point", knowledge_point) ||
            knowledge_point.empty()) {
            response.status = 400;
            response.set_content(R"({"error":"course_id, question, answer and knowledge_point are required"})",
                                 "application/json");
            return;
        }

        std::lock_guard<std::mutex> lock(wrong_questions_mutex);
        const int id = next_wrong_question_id++;
        wrong_questions.push_back({id, course_id, question, answer, knowledge_point});

        response.status = 201;
        response.set_content(
            "{\"status\":\"ok\",\"message\":\"Wrong question saved\",\"id\":" +
                std::to_string(id) + "}",
            "application/json");
    });

    server.Get("/api/wrong-questions", [&](const httplib::Request &, httplib::Response &response) {
        std::lock_guard<std::mutex> lock(wrong_questions_mutex);
        std::string body = R"({"items":[)";
        for (std::size_t index = 0; index < wrong_questions.size(); ++index) {
            if (index > 0) {
                body += ',';
            }

            const WrongQuestion &wrong_question = wrong_questions[index];
            body += "{\"id\":" + std::to_string(wrong_question.id) +
                    ",\"course_id\":\"" + escape_json_string(wrong_question.course_id) +
                    "\",\"question\":\"" + escape_json_string(wrong_question.question) +
                    "\",\"answer\":\"" + escape_json_string(wrong_question.answer) +
                    "\",\"knowledge_point\":\"" +
                    escape_json_string(wrong_question.knowledge_point) + "\"}";
        }
        body += "]}";
        response.set_content(body, "application/json");
    });

    std::cout << "Mashangzhixin backend listening at http://127.0.0.1:8080/api/health"
              << std::endl;

    if (!server.listen("127.0.0.1", 8080)) {
        std::cerr << "Failed to listen on http://127.0.0.1:8080" << std::endl;
        return 1;
    }

    return 0;
}