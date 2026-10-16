#include <httplib.h>

#include "rag_retriever.h"

#include <algorithm>
#include <cctype>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <mutex>
#include <sstream>
#include <string>
#include <utility>
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

const std::filesystem::path kWrongQuestionsDataPath =
    std::filesystem::path("data") / "wrong_questions.json";

const std::filesystem::path kKnowledgeBasePath = "knowledge_base";

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

std::string build_rag_response_json(
    const mashangzhixin::RagAnswer &rag_answer) {
    std::string body =
        "{\"answer\":\"" + escape_json_string(rag_answer.answer) +
        "\",\"sources\":[";

    for (std::size_t index = 0; index < rag_answer.sources.size(); ++index) {
        if (index > 0) {
            body += ',';
        }

        const mashangzhixin::RagSource &source = rag_answer.sources[index];
        body += "{\"title\":\"" + escape_json_string(source.title) +
                "\",\"section\":\"" +
                escape_json_string(source.section) +
                "\",\"path\":\"" +
                escape_json_string(source.relative_path) +
                "\",\"page\":null}";
    }

    body += "],\"mode\":\"" + escape_json_string(rag_answer.mode) +
            "\",\"notice\":\"" + escape_json_string(rag_answer.notice) + "\"}";
    return body;
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

bool is_supported_status(const std::string &status) {
    return status == "待复习" || status == "易错" || status == "已掌握";
}

void append_wrong_question_json(std::string &body,
                                const WrongQuestion &wrong_question) {
    body += "{\"id\":" + std::to_string(wrong_question.id) +
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

std::string build_wrong_questions_file_json(
    const std::vector<WrongQuestion> &wrong_questions,
    int next_wrong_question_id) {
    std::string body = "{\n  \"next_id\":" +
                       std::to_string(next_wrong_question_id) +
                       ",\n  \"items\":[";

    for (std::size_t index = 0; index < wrong_questions.size(); ++index) {
        if (index > 0) {
            body += ',';
        }
        body += "\n    ";
        append_wrong_question_json(body, wrong_questions[index]);
    }

    if (!wrong_questions.empty()) {
        body += '\n';
    }
    body += "  ]\n}\n";
    return body;
}

bool extract_json_array_objects(const std::string &body,
                                const std::string &key,
                                std::vector<std::string> &objects,
                                std::string &error) {
    const std::string key_token = "\"" + key + "\"";
    const std::size_t key_position = body.find(key_token);
    if (key_position == std::string::npos) {
        error = "Missing JSON array: " + key;
        return false;
    }

    std::size_t position = body.find(':', key_position + key_token.size());
    if (position == std::string::npos) {
        error = "Missing ':' after JSON key: " + key;
        return false;
    }

    ++position;
    while (position < body.size() &&
           std::isspace(static_cast<unsigned char>(body[position]))) {
        ++position;
    }

    if (position >= body.size() || body[position] != '[') {
        error = "JSON key is not an array: " + key;
        return false;
    }

    ++position;
    bool in_string = false;
    bool escaped = false;
    int object_depth = 0;
    std::size_t object_start = std::string::npos;

    for (; position < body.size(); ++position) {
        const char character = body[position];

        if (in_string) {
            if (escaped) {
                escaped = false;
            } else if (character == '\\') {
                escaped = true;
            } else if (character == '"') {
                in_string = false;
            }
            continue;
        }

        if (character == '"') {
            in_string = true;
            continue;
        }

        if (character == '{') {
            if (object_depth == 0) {
                object_start = position;
            }
            ++object_depth;
            continue;
        }

        if (character == '}') {
            if (object_depth <= 0) {
                error = "Unexpected '}' in JSON array: " + key;
                return false;
            }

            --object_depth;
            if (object_depth == 0) {
                objects.push_back(
                    body.substr(object_start, position - object_start + 1));
                object_start = std::string::npos;
            }
            continue;
        }

        if (character == ']' && object_depth == 0) {
            return true;
        }

        if (object_depth == 0 && character != ',' &&
            !std::isspace(static_cast<unsigned char>(character))) {
            error = "Unexpected value in JSON array: " + key;
            return false;
        }
    }

    error = "Unterminated JSON array: " + key;
    return false;
}

bool parse_wrong_questions_json(
    const std::string &body,
    std::vector<WrongQuestion> &wrong_questions,
    int &next_wrong_question_id,
    std::string &error) {
    int stored_next_id = 0;
    if (!get_json_int(body, "next_id", stored_next_id) || stored_next_id < 1) {
        error = "next_id is missing or invalid";
        return false;
    }

    std::vector<std::string> item_objects;
    if (!extract_json_array_objects(body, "items", item_objects, error)) {
        return false;
    }

    std::vector<WrongQuestion> parsed_items;
    int maximum_id = 0;

    for (const std::string &object : item_objects) {
        WrongQuestion item{};
        if (!get_json_int(object, "id", item.id) || item.id < 1 ||
            !get_json_string(object, "course_id", item.course_id) ||
            !get_json_string(object, "question", item.question) ||
            !get_json_string(object, "answer", item.answer) ||
            !get_json_string(
                object, "knowledge_point", item.knowledge_point) ||
            !get_json_string(object, "status", item.status)) {
            error = "A wrong-question record is incomplete or invalid";
            return false;
        }

        if (!is_supported_course(item.course_id) || item.question.empty() ||
            item.answer.empty() || item.knowledge_point.empty() ||
            !is_supported_status(item.status)) {
            error = "A wrong-question record contains unsupported values";
            return false;
        }

        for (const WrongQuestion &existing : parsed_items) {
            if (existing.id == item.id) {
                error = "Duplicate wrong-question id: " +
                        std::to_string(item.id);
                return false;
            }
        }

        maximum_id = std::max(maximum_id, item.id);
        parsed_items.push_back(std::move(item));
    }

    wrong_questions = std::move(parsed_items);
    next_wrong_question_id = std::max(stored_next_id, maximum_id + 1);
    return true;
}

bool read_text_file(const std::filesystem::path &path,
                    std::string &contents,
                    std::string &error) {
    std::ifstream input(path, std::ios::binary);
    if (!input) {
        error = "Cannot open data file: " + path.string();
        return false;
    }

    std::ostringstream buffer;
    buffer << input.rdbuf();
    if (!input.good() && !input.eof()) {
        error = "Cannot read data file: " + path.string();
        return false;
    }

    contents = buffer.str();
    return true;
}

bool load_wrong_questions(const std::filesystem::path &data_path,
                          std::vector<WrongQuestion> &wrong_questions,
                          int &next_wrong_question_id,
                          std::string &error) {
    std::error_code filesystem_error;
    const bool data_file_exists =
        std::filesystem::exists(data_path, filesystem_error);
    if (filesystem_error) {
        error = "Cannot inspect data file: " + filesystem_error.message();
        return false;
    }

    std::filesystem::path backup_path = data_path;
    backup_path += ".bak";

    if (!data_file_exists) {
        const bool backup_exists =
            std::filesystem::exists(backup_path, filesystem_error);
        if (filesystem_error) {
            error = "Cannot inspect backup data file: " +
                    filesystem_error.message();
            return false;
        }

        if (!backup_exists) {
            wrong_questions.clear();
            next_wrong_question_id = 1;
            return true;
        }
    }

    const std::filesystem::path path_to_read =
        data_file_exists ? data_path : backup_path;
    std::string contents;
    if (!read_text_file(path_to_read, contents, error)) {
        return false;
    }

    if (parse_wrong_questions_json(
            contents, wrong_questions, next_wrong_question_id, error)) {
        return true;
    }

    if (path_to_read == backup_path) {
        return false;
    }

    std::string backup_contents;
    std::string backup_error;
    if (!read_text_file(backup_path, backup_contents, backup_error)) {
        error += "; backup recovery unavailable: " + backup_error;
        return false;
    }

    if (!parse_wrong_questions_json(
            backup_contents,
            wrong_questions,
            next_wrong_question_id,
            backup_error)) {
        error += "; backup recovery failed: " + backup_error;
        return false;
    }

    std::cerr << "Warning: recovered wrong questions from backup file: "
              << backup_path.string() << std::endl;
    return true;
}

bool save_wrong_questions(const std::filesystem::path &data_path,
                          const std::vector<WrongQuestion> &wrong_questions,
                          int next_wrong_question_id,
                          std::string &error) {
    std::error_code filesystem_error;
    std::filesystem::create_directories(
        data_path.parent_path(), filesystem_error);
    if (filesystem_error) {
        error = "Cannot create data directory: " +
                filesystem_error.message();
        return false;
    }

    std::filesystem::path temporary_path = data_path;
    temporary_path += ".tmp";
    std::filesystem::path backup_path = data_path;
    backup_path += ".bak";

    {
        std::ofstream output(
            temporary_path, std::ios::binary | std::ios::trunc);
        if (!output) {
            error = "Cannot open temporary data file for writing: " +
                    temporary_path.string();
            return false;
        }

        output << build_wrong_questions_file_json(
            wrong_questions, next_wrong_question_id);
        output.flush();
        if (!output) {
            error = "Cannot write temporary data file: " +
                    temporary_path.string();
            return false;
        }
    }

    std::filesystem::remove(backup_path, filesystem_error);
    if (filesystem_error) {
        error = "Cannot remove stale data backup: " +
                filesystem_error.message();
        std::error_code cleanup_error;
        std::filesystem::remove(temporary_path, cleanup_error);
        return false;
    }
    filesystem_error.clear();

    const bool original_exists =
        std::filesystem::exists(data_path, filesystem_error);
    if (filesystem_error) {
        error = "Cannot inspect existing data file: " +
                filesystem_error.message();
        std::filesystem::remove(temporary_path, filesystem_error);
        return false;
    }

    if (original_exists) {
        std::filesystem::rename(data_path, backup_path, filesystem_error);
        if (filesystem_error) {
            error = "Cannot create data backup: " +
                    filesystem_error.message();
            std::filesystem::remove(temporary_path, filesystem_error);
            return false;
        }
    }

    std::filesystem::rename(temporary_path, data_path, filesystem_error);
    if (filesystem_error) {
        const std::string rename_error = filesystem_error.message();
        std::error_code recovery_error;
        if (original_exists) {
            std::filesystem::rename(backup_path, data_path, recovery_error);
        }
        std::filesystem::remove(temporary_path, recovery_error);
        error = "Cannot replace data file: " + rename_error;
        return false;
    }

    if (original_exists) {
        std::filesystem::remove(backup_path, filesystem_error);
    }
    return true;
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
    server.set_payload_max_length(65536);
    // Serve only the frontend directory; .env and runtime data stay private.
    if (!server.set_mount_point("/", "frontend")) {
        std::cerr << "Cannot serve frontend; start from the project root." << std::endl;
        return 1;
    }
    std::vector<WrongQuestion> wrong_questions;
    std::mutex wrong_questions_mutex;
    int next_wrong_question_id = 1;

    mashangzhixin::RagRetriever rag_retriever(kKnowledgeBasePath);
    std::string rag_load_error;
    if (!rag_retriever.load(rag_load_error)) {
        std::cerr << "Failed to load course knowledge base: "
                  << rag_load_error << std::endl;
        std::cerr << "Start the server from the project root so that "
                  << std::filesystem::absolute(kKnowledgeBasePath).string()
                  << " can be found." << std::endl;
        return 1;
    }

    std::cout << "Loaded " << rag_retriever.document_count()
              << " knowledge document(s) and "
              << rag_retriever.chunk_count() << " chunk(s) from "
              << std::filesystem::absolute(kKnowledgeBasePath).string()
              << std::endl;

    std::string load_error;
    if (!load_wrong_questions(
            kWrongQuestionsDataPath,
            wrong_questions,
            next_wrong_question_id,
            load_error)) {
        std::cerr << "Failed to load wrong-question data: " << load_error
                  << std::endl;
        std::cerr << "Fix or restore "
                  << std::filesystem::absolute(kWrongQuestionsDataPath).string()
                  << " before restarting the server." << std::endl;
        return 1;
    }

    std::cout << "Loaded " << wrong_questions.size()
              << " wrong question(s) from "
              << std::filesystem::absolute(kWrongQuestionsDataPath).string()
              << std::endl;

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
                [&rag_retriever](const httplib::Request &request,
                                 httplib::Response &response) {
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

                    if (question.size() > 6000 ||
                        question.find_first_not_of(" \t\r\n") == std::string::npos) {
                        response.status = 400;
                        response.set_content(
                            R"({"status":"error","message":"Question is empty or too long"})",
                            "application/json; charset=utf-8");
                        return;
                    }

                    mashangzhixin::RagAnswer rag_answer =
                        rag_retriever.answer(course_id, question, 5);
                    if (rag_answer.sources.empty()) {
                        rag_answer.mode = "no_evidence";
                        rag_answer.notice = "未找到足够相关的课程资料，未调用大模型。";
                    } else {
                        // The local Python gateway handles HTTPS and provider JSON
                        // using the standard library. No credentials enter the browser.
                        httplib::Client gateway("127.0.0.1", 8081);
                        gateway.set_connection_timeout(2);
                        gateway.set_read_timeout(50);
                        gateway.set_write_timeout(5);
                        const std::string payload =
                            "{\"course_id\":\"" + escape_json_string(course_id) +
                            "\",\"question\":\"" + escape_json_string(question) +
                            "\",\"context\":\"" + escape_json_string(rag_answer.answer) + "\"}";
                        const auto result = gateway.Post(
                            "/generate", payload, "application/json; charset=utf-8");
                        std::string mode, answer, reason;
                        if (result && result->status == 200 &&
                            get_json_string(result->body, "mode", mode) &&
                            mode == "generated" &&
                            get_json_string(result->body, "answer", answer) &&
                            !answer.empty()) {
                            rag_answer.answer = std::move(answer);
                            rag_answer.mode = "generated";
                            rag_answer.notice = "AI 已依据下列检索资料生成讲解，请结合原文核对。";
                        } else {
                            if (result) get_json_string(result->body, "reason", reason);
                            rag_answer.notice = reason == "not_configured"
                                ? "尚未配置大模型，以下为课程资料摘录。"
                                : "大模型服务暂不可用，以下为课程资料摘录。";
                        }
                    }
                    response.set_content(
                        build_rag_response_json(rag_answer),
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
                    const int id = next_wrong_question_id;
                    wrong_questions.push_back(
                        {id,
                         course_id,
                         question,
                         answer,
                         knowledge_point,
                         "待复习"});
                    ++next_wrong_question_id;

                    std::string save_error;
                    if (!save_wrong_questions(
                            kWrongQuestionsDataPath,
                            wrong_questions,
                            next_wrong_question_id,
                            save_error)) {
                        wrong_questions.pop_back();
                        --next_wrong_question_id;
                        response.status = 500;
                        response.set_content(
                            "{\"status\":\"error\",\"message\":\"Failed to persist wrong question: " +
                                escape_json_string(save_error) + "\"}",
                            "application/json; charset=utf-8");
                        return;
                    }

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

            if (!is_supported_status(new_status)) {
                response.status = 400;
                response.set_content(
                    R"({"status":"error","message":"Unsupported status"})",
                    "application/json; charset=utf-8");
                return;
            }

            std::lock_guard<std::mutex> lock(wrong_questions_mutex);
            for (WrongQuestion &wrong_question : wrong_questions) {
                if (wrong_question.id == id) {
                    const std::string previous_status = wrong_question.status;
                    wrong_question.status = new_status;

                    std::string save_error;
                    if (!save_wrong_questions(
                            kWrongQuestionsDataPath,
                            wrong_questions,
                            next_wrong_question_id,
                            save_error)) {
                        wrong_question.status = previous_status;
                        response.status = 500;
                        response.set_content(
                            "{\"status\":\"error\",\"message\":\"Failed to persist mastery status: " +
                                escape_json_string(save_error) + "\"}",
                            "application/json; charset=utf-8");
                        return;
                    }

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

                       append_wrong_question_json(body, wrong_question);
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
