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

struct Choice {
    std::string key;
    std::string text;
};

struct Exercise {
    int id;
    std::string course_id;
    std::string knowledge_point;
    std::string question;
    std::vector<Choice> options;
    std::string correct_answer;
    std::string explanation;
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
        default: {
            const unsigned char byte = static_cast<unsigned char>(character);
            if (byte < 0x20) {
                const char hex_digits[] = "0123456789abcdef";
                escaped += "\\u00";
                escaped += hex_digits[(byte >> 4) & 0x0f];
                escaped += hex_digits[byte & 0x0f];
            } else {
                escaped += character;
            }
            break;
        }
        }
    }

    return escaped;
}

bool get_json_value_position(const std::string &body,
                             const std::string &key,
                             std::size_t &value_position) {
    const std::string key_token = "\"" + key + "\"";
    const std::size_t key_position = body.find(key_token);
    if (key_position == std::string::npos) {
        return false;
    }

    value_position = body.find(':', key_position + key_token.size());
    if (value_position == std::string::npos) {
        return false;
    }

    ++value_position;
    while (value_position < body.size() &&
           std::isspace(static_cast<unsigned char>(body[value_position]))) {
        ++value_position;
    }

    return value_position < body.size();
}

bool get_json_string(const std::string &body,
                     const std::string &key,
                     std::string &value) {
    std::size_t value_position = 0;
    if (!get_json_value_position(body, key, value_position) ||
        body[value_position] != '"') {
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

bool get_json_int(const std::string &body, const std::string &key, int &value) {
    std::size_t value_position = 0;
    if (!get_json_value_position(body, key, value_position)) {
        return false;
    }

    std::size_t end_position = value_position;
    if (body[end_position] == '-') {
        ++end_position;
    }

    const std::size_t digit_start = end_position;
    while (end_position < body.size() &&
           std::isdigit(static_cast<unsigned char>(body[end_position]))) {
        ++end_position;
    }

    if (end_position == digit_start) {
        return false;
    }

    try {
        value = std::stoi(body.substr(value_position, end_position - value_position));
    } catch (...) {
        return false;
    }

    return true;
}

bool is_supported_course(const std::string &course_id) {
    return course_id == "cpp" || course_id == "data-structure";
}

std::string normalize_answer(std::string answer) {
    while (!answer.empty() &&
           std::isspace(static_cast<unsigned char>(answer.front()))) {
        answer.erase(answer.begin());
    }

    while (!answer.empty() &&
           std::isspace(static_cast<unsigned char>(answer.back()))) {
        answer.pop_back();
    }

    if (answer.size() == 1 && answer[0] >= 'a' && answer[0] <= 'z') {
        answer[0] = static_cast<char>(answer[0] - 'a' + 'A');
    }

    return answer;
}

const std::vector<Exercise> &exercise_bank() {
    static const std::vector<Exercise> exercises = {
        {101,
         "data-structure",
         "树与二叉树",
         "二叉树的中序遍历顺序是什么？",
         {{"A", "根结点 → 左子树 → 右子树"},
          {"B", "左子树 → 根结点 → 右子树"},
          {"C", "左子树 → 右子树 → 根结点"},
          {"D", "右子树 → 根结点 → 左子树"}},
         "B",
         "中序遍历按照左子树、根结点、右子树的顺序访问。"},
        {102,
         "data-structure",
         "图与最短路径",
         "关于 Dijkstra 算法，下列说法正确的是？",
         {{"A", "可以直接处理包含负权边的任意图"},
          {"B", "适用于边权非负的单源最短路径问题"},
          {"C", "只能用于无向无权图"},
          {"D", "必须使用邻接矩阵才能实现"}},
         "B",
         "经典 Dijkstra 算法要求边权非负，用于求单源最短路径。"},
        {103,
         "data-structure",
         "栈与队列",
         "下列哪一种数据结构遵循后进先出原则？",
         {{"A", "栈"}, {"B", "队列"}, {"C", "链表"}, {"D", "图"}},
         "A",
         "栈遵循 LIFO（后进先出）原则。"},
        {201,
         "cpp",
         "指针与引用",
         "关于 C++ 指针和引用，下列说法正确的是？",
         {{"A", "引用可以不初始化"},
          {"B", "指针可以为空，而引用在定义时必须绑定对象"},
          {"C", "引用可以随时改为引用另一个对象"},
          {"D", "指针和引用完全相同"}},
         "B",
         "指针可以保存空地址；引用定义时必须初始化，并绑定到一个对象。"},
        {202,
         "cpp",
         "STL容器",
         "哪个 STL 容器支持高效的随机访问？",
         {{"A", "std::vector"},
          {"B", "std::list"},
          {"C", "std::set"},
          {"D", "std::forward_list"}},
         "A",
         "std::vector 使用连续内存，支持常数时间的下标随机访问。"},
        {203,
         "cpp",
         "继承与多态",
         "通过基类指针删除派生类对象时，基类析构函数通常应声明为什么？",
         {{"A", "static"}, {"B", "const"}, {"C", "virtual"}, {"D", "inline"}},
         "C",
         "虚析构函数可以保证通过基类指针删除对象时正确调用派生类析构函数。"}};

    return exercises;
}

bool exercise_matches(const Exercise &exercise,
                      const std::string &course_id,
                      const std::string &knowledge_point,
                      bool ignore_knowledge_point) {
    if (!course_id.empty() && exercise.course_id != course_id) {
        return false;
    }

    if (!ignore_knowledge_point && !knowledge_point.empty() &&
        exercise.knowledge_point != knowledge_point) {
        return false;
    }

    return true;
}

std::string build_recommendations_json(const std::vector<const Exercise *> &matches,
                                       bool fallback) {
    std::string body = R"({"items":[)";

    for (std::size_t index = 0; index < matches.size(); ++index) {
        if (index > 0) {
            body += ',';
        }

        const Exercise &exercise = *matches[index];
        body += "{\"id\":" + std::to_string(exercise.id) +
                ",\"course_id\":\"" + escape_json_string(exercise.course_id) +
                "\",\"knowledge_point\":\"" +
                escape_json_string(exercise.knowledge_point) +
                "\",\"type\":\"single-choice\",\"question\":\"" +
                escape_json_string(exercise.question) + "\",\"options\":[";

        for (std::size_t option_index = 0;
             option_index < exercise.options.size();
             ++option_index) {
            if (option_index > 0) {
                body += ',';
            }

            const Choice &choice = exercise.options[option_index];
            body += "{\"key\":\"" + escape_json_string(choice.key) +
                    "\",\"text\":\"" + escape_json_string(choice.text) + "\"}";
        }

        body += "]}";
    }

    body += "],\"count\":" + std::to_string(matches.size()) +
            ",\"fallback\":" + (fallback ? "true" : "false") + "}";
    return body;
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
        {"Access-Control-Allow-Headers", "Content-Type"}});

    server.Options(R"(.*)",
                   [](const httplib::Request &, httplib::Response &response) {
                       response.status = 204;
                   });

    server.Get("/api/health",
               [](const httplib::Request &, httplib::Response &response) {
                   response.set_content(
                       R"({"status":"ok","message":"Mashangzhixin backend is running"})",
                       "application/json; charset=utf-8");
               });

    server.Post("/api/ask",
                [](const httplib::Request &request, httplib::Response &response) {
                    std::string course_id;
                    std::string question;

                    if (!get_json_string(request.body, "course_id", course_id) ||
                        course_id.empty()) {
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

                    if (!get_json_string(request.body, "question", question) ||
                        question.empty()) {
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

    server.Get("/api/recommendations",
               [](const httplib::Request &request, httplib::Response &response) {
                   const std::string course_id =
                       request.has_param("course_id")
                           ? request.get_param_value("course_id")
                           : "";
                   const std::string knowledge_point =
                       request.has_param("knowledge_point")
                           ? request.get_param_value("knowledge_point")
                           : "";

                   if (!course_id.empty() && !is_supported_course(course_id)) {
                       response.status = 400;
                       response.set_content(
                           R"({"status":"error","message":"Unsupported course_id"})",
                           "application/json; charset=utf-8");
                       return;
                   }

                   std::vector<const Exercise *> matches;
                   for (const Exercise &exercise : exercise_bank()) {
                       if (exercise_matches(
                               exercise, course_id, knowledge_point, false)) {
                           matches.push_back(&exercise);
                       }
                   }

                   bool fallback = false;
                   if (matches.empty() && !knowledge_point.empty()) {
                       fallback = true;
                       for (const Exercise &exercise : exercise_bank()) {
                           if (exercise_matches(
                                   exercise, course_id, knowledge_point, true)) {
                               matches.push_back(&exercise);
                           }
                       }
                   }

                   response.set_content(
                       build_recommendations_json(matches, fallback),
                       "application/json; charset=utf-8");
               });

    server.Post("/api/exercises/submit",
                [](const httplib::Request &request, httplib::Response &response) {
                    int exercise_id = 0;
                    std::string selected_answer;

                    if (!get_json_int(request.body, "exercise_id", exercise_id)) {
                        response.status = 400;
                        response.set_content(
                            R"({"status":"error","message":"exercise_id is required and must be an integer"})",
                            "application/json; charset=utf-8");
                        return;
                    }

                    if (!get_json_string(request.body, "answer", selected_answer) ||
                        selected_answer.empty()) {
                        response.status = 400;
                        response.set_content(
                            R"({"status":"error","message":"answer is required"})",
                            "application/json; charset=utf-8");
                        return;
                    }

                    const Exercise *target = nullptr;
                    for (const Exercise &exercise : exercise_bank()) {
                        if (exercise.id == exercise_id) {
                            target = &exercise;
                            break;
                        }
                    }

                    if (target == nullptr) {
                        response.status = 404;
                        response.set_content(
                            R"({"status":"error","message":"Exercise not found"})",
                            "application/json; charset=utf-8");
                        return;
                    }

                    selected_answer = normalize_answer(selected_answer);
                    const bool correct = selected_answer == target->correct_answer;

                    const std::string body =
                        "{\"status\":\"ok\",\"exercise_id\":" +
                        std::to_string(target->id) +
                        ",\"correct\":" + (correct ? "true" : "false") +
                        ",\"correct_answer\":\"" +
                        escape_json_string(target->correct_answer) +
                        "\",\"explanation\":\"" +
                        escape_json_string(target->explanation) + "\"}";

                    response.set_content(body, "application/json; charset=utf-8");
                });

    server.Post("/api/wrong-questions",
                [&](const httplib::Request &request,
                    httplib::Response &response) {
                    std::string course_id;
                    std::string question;
                    std::string answer;
                    std::string knowledge_point;

                    if (!get_json_string(request.body, "course_id", course_id) ||
                        course_id.empty() ||
                        !get_json_string(request.body, "question", question) ||
                        question.empty() ||
                        !get_json_string(request.body, "answer", answer) ||
                        answer.empty() ||
                        !get_json_string(
                            request.body, "knowledge_point", knowledge_point) ||
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
                        {id,
                         course_id,
                         question,
                         answer,
                         knowledge_point,
                         "待复习"});

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

            if (new_status != "待复习" && new_status != "易错" &&
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
                        "{\"status\":\"ok\",\"message\":\"Mastery status updated\",\"id\":" +
                            std::to_string(id) + ",\"new_status\":\"" +
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

    server.Get("/api/wrong-questions",
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
                           "{\"id\":" + std::to_string(wrong_question.id) +
                           ",\"course_id\":\"" +
                           escape_json_string(wrong_question.course_id) +
                           "\",\"question\":\"" +
                           escape_json_string(wrong_question.question) +
                           "\",\"answer\":\"" +
                           escape_json_string(wrong_question.answer) +
                           "\",\"knowledge_point\":\"" +
                           escape_json_string(wrong_question.knowledge_point) +
                           "\",\"status\":\"" +
                           escape_json_string(wrong_question.status) + "\"}";
                   }

                   body += "]}";
                   response.set_content(body, "application/json; charset=utf-8");
               });

    std::cout
        << "Mashangzhixin backend listening at http://127.0.0.1:8080/api/health"
        << std::endl;

    if (!server.listen("127.0.0.1", 8080)) {
        std::cerr << "Failed to listen on http://127.0.0.1:8080" << std::endl;
        return 1;
    }

    return 0;
}
