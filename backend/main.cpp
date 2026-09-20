#include <httplib.h>

#include <cctype>
#include <iostream>
#include <string>

namespace {
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
    const std::size_t end_position = body.find('"', value_position);
    if (end_position == std::string::npos) {
        return false;
    }

    value = body.substr(value_position, end_position - value_position);
    return true;
}
}  // namespace

int main() {
    httplib::Server server;
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

    std::cout << "Mashangzhixin backend listening at http://127.0.0.1:8080/api/health"
              << std::endl;

    if (!server.listen("127.0.0.1", 8080)) {
        std::cerr << "Failed to listen on http://127.0.0.1:8080" << std::endl;
        return 1;
    }

    return 0;
}