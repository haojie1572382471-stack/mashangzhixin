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
    std::string status;
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

bool is_supported_course(const std::string &course_id) {
    return course_id == "cpp" || course_id == "data-structure";
}
}  // namespace

int main() {
    httplib::Server server;
    std::vector<WrongQuestion> wrong_questions;
    std::mutex wrong_questions_mutex;
    int next_wrong_question_id = 1;

    server.set_default_headers({
    {"Access-Control-Allow-Origin", "http://127.0.0.1:5500"},
    {"Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS"},
    {"Access-Control-Allow-Headers", "Content-Type"}
});

server.Options(R"(.*)", [](const httplib::Request &, httplib::Response &response) {
    response.status = 204;
});

    server.Get("/api/health", [](const httplib::Request &, httplib::Response &response) {
        response.set_content(
            R"({"status":"ok","message":"Mashangzhixin backend is running"})",
            "application/json; charset=utf-8");
    });

    server.Post("/api/ask", [](const httplib::Request &request, httplib::Response &response) {
        std::string course_id;
        std::string question;
        if (!get_json_string(request.body, "course_id", course_id) || course_id.empty()) {
            response.status = 400;
            response.set_content(
                R"({"status":"error","message":"course_id is required"})",
                "application/json; charset=utf-8");
            return;
        }

        if (!is_supported_course(course_id)) {
            response.status = 400;
            response.set_content(
                R"({"status":"error","message":"Unsupported course_id"})",
                "application/json; charset=utf-8");
            return;
        }

        if (!get_json_string(request.body, "question", question) || question.empty()) {
            response.status = 400;
            response.set_content(
                R"({"status":"error","message":"question is required"})",
                "application/json; charset=utf-8");
            return;
        }

        if (course_id == "cpp") {
            response.set_content(
                R"({"answer":"C++中的引用是已有对象的别名，指针是保存内存地址的变量。指针可以为空并改变指向，引用初始化后通常不能改为引用其他对象。","sources":[{"title":"C++程序设计课程讲义","section":"指针与引用","page":72}]})",
                "application/json; charset=utf-8");
            return;
        }

        response.set_content(
            R"({"answer":"二叉树是每个节点最多有两个子节点的树结构，两个子节点通常称为左子节点和右子节点。","sources":[{"title":"数据结构课程讲义","section":"树与二叉树","page":86}]})",
            "application/json; charset=utf-8");
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
            response.set_content(
                R"({"status":"error","message":"course_id, question, answer and knowledge_point are required"})",
                "application/json; charset=utf-8");
            return;
        }

        if (!is_supported_course(course_id)) {
            response.status = 400;
            response.set_content(
                R"({"status":"error","message":"Unsupported course_id"})",
                "application/json; charset=utf-8");
            return;
        }

        std::lock_guard<std::mutex> lock(wrong_questions_mutex);
        const int id = next_wrong_question_id++;
       wrong_questions.push_back(
    {id, course_id, question, answer, knowledge_point, "待复习"});

        response.status = 201;
        response.set_content(
            "{\"status\":\"ok\",\"message\":\"Wrong question saved\",\"id\":" +
                std::to_string(id) + "}",
            "application/json; charset=utf-8");
    });
        server.Put(
        R"(/api/wrong-questions/(\d+)/status)",
        [&](const httplib::Request &request, httplib::Response &response) {
            int id = 0;

            try {
                id = std::stoi(request.matches[1].str());
            } catch (...) {
                response.status = 400;
                response.set_content(
                    R"({"status":"error","message":"Invalid wrong question id"})",
                    "application/json; charset=utf-8");
                return;
            }

            std::string new_status;

            if (!get_json_string(request.body, "status", new_status) ||
                new_status.empty()) {
                response.status = 400;
                response.set_content(
                    R"({"status":"error","message":"status is required"})",
                    "application/json; charset=utf-8");
                return;
            }

            if (new_status != "待复习" &&
                new_status != "易错" &&
                new_status != "已掌握") {
                response.status = 400;
                response.set_content(
                    R"({"status":"error","message":"Unsupported status"})",
                    "application/json; charset=utf-8");
                return;
            }

            std::lock_guard<std::mutex> lock(wrong_questions_mutex);

            for (WrongQuestion &wrong_question : wrong_questions) {
                if (wrong_question.id == id) {
                    wrong_question.status = new_status;

                    response.set_content(
                        "{\"status\":\"ok\","
                        "\"message\":\"Mastery status updated\","
                        "\"id\":" +
                            std::to_string(id) +
                            ",\"new_status\":\"" +
                            escape_json_string(new_status) + "\"}",
                        "application/json; charset=utf-8");
                    return;
                }
            }

            response.status = 404;
            response.set_content(
                R"({"status":"error","message":"Wrong question not found"})",
                "application/json; charset=utf-8");
        });

        server.Get(
        "/api/wrong-questions",
        [&](const httplib::Request &, httplib::Response &response) {
            std::lock_guard<std::mutex> lock(wrong_questions_mutex);

            std::string body = R"({"items":[)";

            for (std::size_t index = 0;
                 index < wrong_questions.size();
                 ++index) {
                if (index > 0) {
                    body += ',';
                }

                const WrongQuestion &wrong_question =
                    wrong_questions[index];

                body +=
                    "{\"id\":" +
                    std::to_string(wrong_question.id) +
                    ",\"course_id\":\"" +
                    escape_json_string(wrong_question.course_id) +
                    "\",\"question\":\"" +
                    escape_json_string(wrong_question.question) +
                    "\",\"answer\":\"" +
                    escape_json_string(wrong_question.answer) +
                    "\",\"knowledge_point\":\"" +
                    escape_json_string(wrong_question.knowledge_point) +
                    "\",\"status\":\"" +
                    escape_json_string(wrong_question.status) +
                    "\"}";
            }

            body += "]}";

            response.set_content(
                body,
                "application/json; charset=utf-8");
        });
    std::cout << "Mashangzhixin backend listening at http://127.0.0.1:8080/api/health"
              << std::endl;

    if (!server.listen("127.0.0.1", 8080)) {
        std::cerr << "Failed to listen on http://127.0.0.1:8080" << std::endl;
        return 1;
    }

    return 0;
}
