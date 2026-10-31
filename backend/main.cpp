#include <httplib.h>
#include <winrt/base.h>

#include "rag_retriever.h"
#include "llm_client.h"
#include "learning_progress.h"
#include "auth_store.h"

#include <algorithm>
#include <cctype>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <mutex>
#include <limits>
#include <random>
#include <set>
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
    std::string user_id = "guest";
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

// Parse JSON structurally: escaped Unicode and nested field names cannot confuse fields.
bool get_json_string(const std::string& body,const std::string& key,std::string& value){
    try{auto o=winrt::Windows::Data::Json::JsonObject::Parse(winrt::to_hstring(body));value=winrt::to_string(o.GetNamedString(winrt::to_hstring(key)));return true;}catch(...){return false;}
}
bool get_json_int(const std::string& body,const std::string& key,int& value){
    try{auto o=winrt::Windows::Data::Json::JsonObject::Parse(winrt::to_hstring(body));auto n=o.GetNamedNumber(winrt::to_hstring(key));if(!std::isfinite(n)||n<std::numeric_limits<int>::min()||n>std::numeric_limits<int>::max()||std::floor(n)!=n)return false;value=static_cast<int>(n);return true;}catch(...){return false;}
}

bool is_supported_course(const std::string &course_id) {
    return course_id == "cpp" || course_id == "data-structure";
}

bool is_supported_status(const std::string &status) {
    return status == "待复习" || status == "易错" || status == "已掌握";
}

void append_wrong_question_json(std::string &body,
                                const WrongQuestion &wrong_question) {
    body += "{\"user_id\":\"" + escape_json_string(wrong_question.user_id) + "\",\"id\":" + std::to_string(wrong_question.id) +
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
        get_json_string(object, "user_id", item.user_id);
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
         "虚析构函数可以保证通过基类指针删除对象时正确调用派生类析构函数。"},
        {104,
         "data-structure",
         "树与二叉树",
         "二叉树的前序遍历顺序是什么？",
         {{"A", "根、左子树、右子树"}, {"B", "左子树、根、右子树"}, {"C", "左子树、右子树、根"}, {"D", "右子树、根、左子树"}},
         "A",
         "前序遍历先访问根，再递归访问左子树和右子树。"},
        {105,
         "data-structure",
         "树与二叉树",
         "含有 n 个结点的非空树共有多少条边？",
         {{"A", "n"}, {"B", "n+1"}, {"C", "n-1"}, {"D", "2n"}},
         "C",
         "树连通且无环，除根以外的每个结点有一条连接父结点的边，因此有 n-1 条边。"},
        {106,
         "data-structure",
         "图与最短路径",
         "无权图中，求从一个顶点到其他顶点的最少边数应优先采用哪种算法？",
         {{"A", "深度优先搜索"}, {"B", "广度优先搜索"}, {"C", "快速排序"}, {"D", "堆排序"}},
         "B",
         "BFS 按距离层次访问顶点，第一次发现顶点时即可确定从起点到它的最少边数。"},
        {107,
         "data-structure",
         "图与最短路径",
         "带负权边且不存在从源点可达的负权环时，哪种算法可求单源最短路径？",
         {{"A", "普通二分查找"}, {"B", "直接使用经典 Dijkstra"}, {"C", "拓扑排序适用于任意图"}, {"D", "Bellman-Ford"}},
         "D",
         "Bellman-Ford 通过多轮松弛处理负权边；可达负权环会使受影响顶点的有限最短路不存在。"},
        {108,
         "data-structure",
         "栈与队列",
         "普通队列的出队顺序遵循什么原则？",
         {{"A", "后进先出"}, {"B", "按数值大小"}, {"C", "先进先出"}, {"D", "随机出队"}},
         "C",
         "队列从队尾入队、从队头出队，先进入的元素先离开。"},
        {109,
         "data-structure",
         "栈与队列",
         "容量为 N 的循环队列保留一个空位，队头 front、队尾 rear 指向下一插入位置，队满条件是？",
         {{"A", "front == rear"}, {"B", "(rear + 1) % N == front"}, {"C", "rear == N"}, {"D", "front == N"}},
         "B",
         "保留一个空位时，队尾再前进一格就到队头表示队满；front == rear 表示队空。"},
        {110,
         "data-structure",
         "时间复杂度",
         "循环 for(int i=0;i<n;++i) 每次执行常数时间操作，其时间复杂度是？",
         {{"A", "O(1)"}, {"B", "O(log n)"}, {"C", "O(n)"}, {"D", "O(n*n)"}},
         "C",
         "循环执行 n 次，每次耗时为常数，总时间与 n 成正比。"},
        {111,
         "data-structure",
         "时间复杂度",
         "令 i=1，每轮 i 乘以 2，直到 i 不小于 n（忽略溢出），循环次数的数量级是？",
         {{"A", "O(log n)"}, {"B", "O(n)"}, {"C", "O(n*n)"}, {"D", "O(2^n)"}},
         "A",
         "执行 k 次后 i 为 2 的 k 次方，达到 n 需要约 log2(n) 次。"},
        {112,
         "data-structure",
         "时间复杂度",
         "两个独立的嵌套循环各执行 n 次，循环体耗时为常数，总时间复杂度是？",
         {{"A", "O(n)"}, {"B", "O(log n)"}, {"C", "O(1)"}, {"D", "O(n*n)"}},
         "D",
         "外层每次都完整执行内层 n 次，总共执行 n*n 次循环体。"},
        {113,
         "data-structure",
         "线性表",
         "顺序表已知合法下标时，访问该元素的时间复杂度是？",
         {{"A", "O(n)"}, {"B", "O(1)"}, {"C", "O(log n)"}, {"D", "O(n*n)"}},
         "B",
         "连续存储允许根据首地址和下标直接计算元素地址。"},
        {114,
         "data-structure",
         "线性表",
         "容量足够的顺序表在表头插入一个元素，最坏需要移动多少个原有元素？",
         {{"A", "0"}, {"B", "1"}, {"C", "n"}, {"D", "log2(n)"}},
         "C",
         "表头插入需要把原有 n 个元素向后移动一位，为新元素腾出位置。"},
        {115,
         "data-structure",
         "线性表",
         "关于线性表的逻辑结构，正确的是？",
         {{"A", "每个元素都必须有两个后继"}, {"B", "元素只能用连续内存存储"}, {"C", "只能保存整数"}, {"D", "除首尾外，每个元素各有一个直接前驱和直接后继"}},
         "D",
         "线性表描述元素的一对一逻辑关系，可用顺序存储或链式存储实现。"},
        {116,
         "data-structure",
         "链表",
         "在单链表中已知结点 p，在其后插入结点 s 的正确顺序是？",
         {{"A", "s->next=p->next; p->next=s;"}, {"B", "p->next=s; s->next=p->next;"}, {"C", "p=s;"}, {"D", "s->next=nullptr; p=nullptr;"}},
         "A",
         "先保存原后继，再连接新结点，避免丢失链表后半部分或形成自环。"},
        {117,
         "data-structure",
         "链表",
         "不带下标索引的单链表查找第 k 个结点，通常需要？",
         {{"A", "直接下标访问"}, {"B", "从头沿 next 逐个访问"}, {"C", "二分地址"}, {"D", "按哈希值直接定位"}},
         "B",
         "单链表不支持随机访问，需要从头逐个跟随后继指针。"},
        {118,
         "data-structure",
         "链表",
         "已知单链表结点 p 的后继 q 存在且由 new 创建，删除 q 的正确做法是？",
         {{"A", "只执行 delete p"}, {"B", "只令 q=nullptr"}, {"C", "p->next=q->next; delete q;"}, {"D", "先 delete q，再读取 q->next"}},
         "C",
         "先连接到 q 的后继，再释放 q；释放后不能再读取 q 的成员。"},
        {119,
         "data-structure",
         "堆与优先队列",
         "大根堆的堆顶元素具有什么性质？",
         {{"A", "一定最小"}, {"B", "一定为中位数"}, {"C", "一定最早插入"}, {"D", "是当前堆中最大元素"}},
         "D",
         "大根堆每个父结点不小于其孩子，因此根结点保存最大元素。"},
        {120,
         "data-structure",
         "堆与优先队列",
         "二叉堆插入一个元素并恢复堆性质，最坏时间复杂度是？",
         {{"A", "O(log n)"}, {"B", "O(1)"}, {"C", "O(n*n)"}, {"D", "O(2^n)"}},
         "A",
         "新元素最多沿高度为 O(log n) 的路径上浮到根。"},
        {121,
         "data-structure",
         "堆与优先队列",
         "std::priority_queue<int> 使用默认比较规则时，top() 返回什么？",
         {{"A", "最小元素"}, {"B", "最大元素"}, {"C", "最后插入元素"}, {"D", "任意元素"}},
         "B",
         "默认比较规则使 priority_queue 表现为大根堆，top() 返回最大值。"},
        {122,
         "data-structure",
         "图的遍历",
         "广度优先搜索 BFS 通常借助哪种辅助结构？",
         {{"A", "栈"}, {"B", "优先队列"}, {"C", "普通队列"}, {"D", "二叉搜索树"}},
         "C",
         "FIFO 队列确保先发现的顶点先展开，从而按层遍历。"},
        {123,
         "data-structure",
         "图的遍历",
         "递归实现深度优先搜索 DFS 时，递归调用主要依赖什么？",
         {{"A", "哈希桶"}, {"B", "循环队列"}, {"C", "邻接矩阵排序"}, {"D", "调用栈"}},
         "D",
         "递归把尚未完成的调用保存在调用栈中，回溯时逐层返回。"},
        {124,
         "data-structure",
         "图的遍历",
         "从一个顶点开始 BFS 后仍有未访问顶点，若需遍历非连通无向图全部顶点，应当？",
         {{"A", "从每个尚未访问的顶点继续启动遍历"}, {"B", "直接结束"}, {"C", "删除未访问顶点"}, {"D", "只重复访问起点"}},
         "A",
         "一次遍历只能覆盖起点所在连通分量；遍历所有未访问顶点才能覆盖整张图。"},
        {125,
         "data-structure",
         "排序与查找",
         "对数组使用普通二分查找的前提是？",
         {{"A", "数组长度必须为偶数"}, {"B", "数组按相同比较规则有序"}, {"C", "所有元素必须不同"}, {"D", "数组必须存于链表"}},
         "B",
         "二分查找利用有序性排除一半区间，重复元素和奇数长度不影响基本适用性。"},
        {126,
         "data-structure",
         "排序与查找",
         "直接插入排序遇到已经升序的数组，采用遇到有序即停止后移的实现，时间复杂度是？",
         {{"A", "O(n*n)"}, {"B", "O(n log n)"}, {"C", "O(n)"}, {"D", "O(2^n)"}},
         "C",
         "每个待插入元素只需与前一个元素比较，无须移动，整体为线性时间。"},
        {127,
         "data-structure",
         "排序与查找",
         "归并排序合并两个有序序列时，遇到相等元素先取左侧元素，通常可以保证什么？",
         {{"A", "原地且常数额外空间"}, {"B", "无需比较"}, {"C", "最坏为 O(1)"}, {"D", "排序稳定性"}},
         "D",
         "先取左侧相等元素可保留它们原本的先后顺序，这是稳定性的关键。"},
        {128,
         "data-structure",
         "哈希表",
         "哈希冲突指的是什么？",
         {{"A", "不同键映射到了相同的哈希表位置"}, {"B", "同一个键被读取两次"}, {"C", "表内没有数据"}, {"D", "数组下标一定越界"}},
         "A",
         "不同键可能有相同哈希地址，需要链地址法或开放定址法等方法处理。"},
        {129,
         "data-structure",
         "哈希表",
         "用链地址法处理冲突时，同一个桶中的元素通常如何组织？",
         {{"A", "必须全部丢弃"}, {"B", "放入该桶关联的链式结构等容器"}, {"C", "覆盖原有元素且不检查键"}, {"D", "强制重新编号为数组下标"}},
         "B",
         "链地址法把落入同一桶的键值对放在桶关联的结构中，查找时还需比较键。"},
        {130,
         "data-structure",
         "哈希表",
         "哈希函数分布良好、负载因子受控时，哈希表查找的平均时间复杂度通常是？",
         {{"A", "O(n*n)"}, {"B", "O(n log n)"}, {"C", "O(1)"}, {"D", "必定 O(log n)"}},
         "C",
         "良好分布和受控负载使平均查找接近常数时间；严重冲突时最坏情况仍可能为 O(n)。"},
        {204,
         "cpp",
         "指针与引用",
         "若 int x=10; int& r=x; 执行 r=20; 后 x 是多少？",
         {{"A", "10"}, {"B", "20"}, {"C", "0"}, {"D", "无法确定"}},
         "B",
         "r 是 x 的别名，对 r 赋值就是修改 x。"},
        {205,
         "cpp",
         "指针与引用",
         "若 int x=3; int* p=&x; 执行 *p=8; 后 x 是多少？",
         {{"A", "3"}, {"B", "地址值"}, {"C", "0"}, {"D", "8"}},
         "D",
         "p 保存 x 的地址，解引用赋值会修改 x。"},
        {206,
         "cpp",
         "STL容器",
         "std::vector<int> v{1,2}; 执行 v.push_back(3); 后 v.size() 是多少？",
         {{"A", "3"}, {"B", "2"}, {"C", "1"}, {"D", "0"}},
         "A",
         "push_back 在末尾添加一个元素，元素数量由 2 变为 3。"},
        {207,
         "cpp",
         "STL容器",
         "std::map 中每个键通常具有哪种约束？",
         {{"A", "必须是整数"}, {"B", "必须从零连续编号"}, {"C", "键唯一，按比较器的等价关系判断"}, {"D", "同一个键可以任意重复存储"}},
         "C",
         "map 不允许等价键重复；需要重复键时可考虑 multimap。"},
        {208,
         "cpp",
         "继承与多态",
         "通过基类指针调用派生类重写的函数，要实现运行时动态派发，该函数在基类中应为？",
         {{"A", "static 函数"}, {"B", "虚函数"}, {"C", "普通非虚函数"}, {"D", "全局函数"}},
         "B",
         "虚函数结合基类指针或引用，使调用根据实际对象类型选择实现。"},
        {209,
         "cpp",
         "继承与多态",
         "在派生类成员函数声明后使用 override 的主要作用是？",
         {{"A", "强制变为静态函数"}, {"B", "取消继承"}, {"C", "允许任意改变参数类型"}, {"D", "让编译器检查是否正确重写基类虚函数"}},
         "D",
         "override 能发现函数签名不匹配等错误，避免误把新函数当作重写。"},
        {210,
         "cpp",
         "变量与数据类型",
         "以下哪种类型直接表示 true 或 false？",
         {{"A", "bool"}, {"B", "int*"}, {"C", "std::string"}, {"D", "double"}},
         "A",
         "bool 表示布尔值，常用于条件和逻辑判断。"},
        {211,
         "cpp",
         "变量与数据类型",
         "定义 const int limit=10; 后，执行 limit=20; 会怎样？",
         {{"A", "正常改为 20"}, {"B", "自动改为 double"}, {"C", "编译错误"}, {"D", "必定运行时崩溃"}},
         "C",
         "const 对象初始化后不能通过该变量进行赋值修改，编译器会拒绝这条语句。"},
        {212,
         "cpp",
         "变量与数据类型",
         "auto x=3.5; 中 x 的类型是什么？",
         {{"A", "int"}, {"B", "double"}, {"C", "float"}, {"D", "char"}},
         "B",
         "无后缀的浮点字面量 3.5 类型为 double，auto 据此推导。"},
        {213,
         "cpp",
         "运算符与表达式",
         "在 C++ 中，整数表达式 7 / 2 的值是多少？",
         {{"A", "3.5"}, {"B", "4"}, {"C", "2"}, {"D", "3"}},
         "D",
         "两个操作数都是整数，整数除法舍弃小数部分，结果为 3。"},
        {214,
         "cpp",
         "运算符与表达式",
         "表达式 2 + 3 * 4 的值是多少？",
         {{"A", "14"}, {"B", "20"}, {"C", "24"}, {"D", "9"}},
         "A",
         "乘法优先级高于加法，先计算 3*4，再加 2。"},
        {215,
         "cpp",
         "运算符与表达式",
         "内置逻辑与表达式 false && (++x > 0) 中，初始 x=0，求值后 x 为多少？",
         {{"A", "1"}, {"B", "-1"}, {"C", "0"}, {"D", "未定义"}},
         "C",
         "内置 && 短路求值，左侧为 false 时不计算右侧，因此 x 不变。"},
        {216,
         "cpp",
         "条件与循环",
         "执行 for(int i=0;i<3;++i) 的循环体共执行几次？",
         {{"A", "2"}, {"B", "3"}, {"C", "4"}, {"D", "0"}},
         "B",
         "i 依次为 0、1、2 时进入循环，i 为 3 时条件不成立。"},
        {217,
         "cpp",
         "条件与循环",
         "在普通 for 循环体中执行 continue 后会怎样？",
         {{"A", "退出整个函数"}, {"B", "一定退出整个循环"}, {"C", "跳过循环条件检查"}, {"D", "跳过本轮剩余语句，随后执行更新表达式并检查条件"}},
         "D",
         "continue 开始下一轮流程；for 循环仍执行更新表达式，然后重新判断条件。"},
        {218,
         "cpp",
         "条件与循环",
         "switch 某个 case 执行后没有 break、return 等跳转语句时，通常会怎样？",
         {{"A", "继续执行后续分支语句，即贯穿"}, {"B", "自动退出 switch"}, {"C", "自动重新比较当前 case"}, {"D", "编译器必定报错"}},
         "A",
         "case 标签不会自动终止分支；缺少跳转会贯穿，需区分有意贯穿和遗漏 break。"},
        {219,
         "cpp",
         "函数",
         "void f(int x){x=9;}，调用前 int a=1; 执行 f(a); 后 a 是多少？",
         {{"A", "9"}, {"B", "0"}, {"C", "1"}, {"D", "无法编译"}},
         "C",
         "值传递让参数 x 获得副本，对 x 的修改不会改变 a。"},
        {220,
         "cpp",
         "函数",
         "void f(int& x){x=9;}，调用前 int a=1; 执行 f(a); 后 a 是多少？",
         {{"A", "1"}, {"B", "9"}, {"C", "0"}, {"D", "无法确定"}},
         "B",
         "引用参数绑定实参，对参数赋值会修改 a。"},
        {221,
         "cpp",
         "函数",
         "同一作用域中两个普通函数只有返回类型不同、名称及参数列表相同，能否构成合法重载？",
         {{"A", "可以，只看返回类型"}, {"B", "可以，只要一个返回 int"}, {"C", "可以，由赋值目标决定"}, {"D", "不可以仅凭返回类型重载"}},
         "D",
         "普通函数重载不能只靠返回类型区分，需要不同的参数列表等合法差异。"},
        {222,
         "cpp",
         "数组与字符串",
         "int a[4]={1,2,3,4}; 的合法元素下标范围是？",
         {{"A", "0 到 3"}, {"B", "1 到 4"}, {"C", "0 到 4"}, {"D", "-1 到 2"}},
         "A",
         "含 4 个元素的数组使用从 0 开始的下标，访问 a[4] 越界。"},
        {223,
         "cpp",
         "数组与字符串",
         "std::string s=\"abc\"; 执行 s += \"de\"; 后 s.size() 是多少？",
         {{"A", "3"}, {"B", "4"}, {"C", "5"}, {"D", "6"}},
         "C",
         "追加两个字符后共有 5 个字符；string::size 不把末尾终止空字符算入长度。"},
        {224,
         "cpp",
         "数组与字符串",
         "char s[]=\"abc\"; 中 sizeof(s) 是多少？",
         {{"A", "3"}, {"B", "4"}, {"C", "5"}, {"D", "取决于指针宽度"}},
         "B",
         "数组包含 a、b、c 和末尾的空字符，共 4 个 char；sizeof(char) 为 1。"},
        {225,
         "cpp",
         "类与对象",
         "class 声明中未显式写访问说明符的成员，默认访问权限是什么？",
         {{"A", "public"}, {"B", "protected"}, {"C", "全局可见"}, {"D", "private"}},
         "D",
         "class 成员默认 private；struct 成员默认 public。"},
        {226,
         "cpp",
         "类与对象",
         "构造函数的主要用途是什么？",
         {{"A", "初始化新创建的对象"}, {"B", "只负责释放对象内存"}, {"C", "必须返回 int"}, {"D", "替代所有普通成员函数"}},
         "A",
         "构造函数在对象初始化时运行，建立对象的初始状态，没有返回类型。"},
        {227,
         "cpp",
         "类与对象",
         "在普通 const 成员函数中，通常不能直接修改哪类成员？",
         {{"A", "局部变量"}, {"B", "mutable 成员"}, {"C", "非 mutable 的非静态数据成员"}, {"D", "函数参数的副本"}},
         "C",
         "const 成员函数不能通过 this 修改普通数据成员；mutable 成员是特例。"},
        {228,
         "cpp",
         "动态内存",
         "int* p=new int[5]; 对应的正确释放方式是？",
         {{"A", "free(p)"}, {"B", "delete[] p"}, {"C", "delete p"}, {"D", "不需要释放"}},
         "B",
         "new[] 与 delete[] 配对；不能与标量 delete 或 malloc/free 混用。"},
        {229,
         "cpp",
         "动态内存",
         "std::unique_ptr 的核心所有权语义是什么？",
         {{"A", "任意复制共享所有权"}, {"B", "完全不管理资源"}, {"C", "永不释放对象"}, {"D", "独占所有权，可通过移动转移"}},
         "D",
         "unique_ptr 不可复制，可移动，默认在销毁时释放其拥有的对象。"},
        {230,
         "cpp",
         "动态内存",
         "对象已被 delete，仍保存原地址的指针应如何对待？",
         {{"A", "它是悬空指针，不能再解引用"}, {"B", "可以继续读取原对象"}, {"C", "可再次 delete 保证释放"}, {"D", "自动指向新对象"}},
         "A",
         "释放后对象生命周期结束，原指针成为悬空指针；再次访问或重复释放会导致未定义行为。"}};

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

int main(int argc, char **argv) {
    // Keep the MTA alive between HTTP requests so cached WinRT factories remain valid.
    // Declared first: release the cache only after server workers and WinRT objects stop.
    struct RuntimeLifetime {
        RuntimeLifetime() { winrt::init_apartment(); }
        ~RuntimeLifetime() {
            winrt::clear_factory_cache();
            winrt::uninit_apartment();
        }
    } runtime;
    const mashangzhixin::LlmClient llm(mashangzhixin::LlmConfig::load());
    if (argc == 2 && std::string(argv[1]) == "--test-api") {
        const auto result = llm.generate("cpp", "Explain a pointer in one sentence.", "A pointer stores an object's memory address.");
        if (result.generated) {
            std::cout << "PASS: C++ model API returned a complete answer." << std::endl;
            return 0;
        }
        std::cerr << "API test failed: " << result.reason;
        if (result.http_status) std::cerr << " (HTTP " << result.http_status << ")";
        std::cerr << std::endl;
        return 1;
    }
    std::cout << (llm.configured() ? "C++ model client configured." : "Model key not configured; retrieval fallback enabled.") << std::endl;
    mashangzhixin::AuthStore auth("data/accounts.json");
    if (!auth.load()) { std::cerr << "Account file is invalid; restore it before starting." << std::endl; return 1; }
    httplib::Server server;
    server.set_payload_max_length(65536);
    // Serve only the frontend directory; .env and runtime data stay private.
    if (!server.set_mount_point("/", "frontend")) {
        std::cerr << "Cannot serve frontend; start from the project root." << std::endl;
        return 1;
    }
    mashangzhixin::LearningProgress learning("data/learning_attempts.json");
    bool learning_recovered = false;
    if (!learning.load(learning_recovered)) {
        std::cerr << "Failed to load learning records; restore data/learning_attempts.json or its backup." << std::endl;
        return 1;
    }
    if (learning_recovered) std::cerr << "Recovered learning records from backup." << std::endl;
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
        {"Access-Control-Allow-Headers", "Content-Type"},
        {"Access-Control-Allow-Credentials", "true"}});

    // Cookies identify users. Query/body user_id is never an authorization credential.
    server.set_pre_routing_handler([&](const httplib::Request& req, httplib::Response& res) {
        if (req.path.rfind("/api/", 0) != 0) return httplib::Server::HandlerResponse::Unhandled;
        res.set_header("Cache-Control", "no-store");
        const auto origin = req.get_header_value("Origin");
        if (!origin.empty() && origin != "http://127.0.0.1:8080" && origin != "http://127.0.0.1:5500") {
            mashangzhixin::AuthStore::reply(res,403,"不允许此来源访问接口");
            return httplib::Server::HandlerResponse::Handled;
        }
        if (req.method == "OPTIONS" || req.path == "/api/health" || req.path == "/api/auth/login" || req.path == "/api/auth/register" || req.path == "/api/auth/logout") return httplib::Server::HandlerResponse::Unhandled;
        const auto who=auth.identity(req);
        if (!who.valid) { res.set_header("Set-Cookie","mzx_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"); mashangzhixin::AuthStore::reply(res,401,"登录已过期，请重新登录"); return httplib::Server::HandlerResponse::Handled; }
        std::string declared;
        if(req.has_param("user_id")) declared=req.get_param_value("user_id");
        if(!req.body.empty()) {
            try { auto obj=winrt::Windows::Data::Json::JsonObject::Parse(winrt::to_hstring(req.body));
                if(obj.HasKey(L"user_id")) declared=winrt::to_string(obj.GetNamedString(L"user_id"));
            } catch(...) { mashangzhixin::AuthStore::reply(res,400,"请求须为有效 JSON");return httplib::Server::HandlerResponse::Handled; }
        }
        if(!declared.empty() && declared!=who.name){mashangzhixin::AuthStore::reply(res,403,"不能访问其他用户的数据");return httplib::Server::HandlerResponse::Handled;}
        return httplib::Server::HandlerResponse::Unhandled;
    });
    server.Post("/api/auth/register",[&](const httplib::Request& req,httplib::Response& res){auth.login(req,res,true);});
    server.Post("/api/auth/login",[&](const httplib::Request& req,httplib::Response& res){auth.login(req,res,false);});
    server.Post("/api/auth/logout",[&](const httplib::Request& req,httplib::Response& res){auth.logout(req,res);});
    server.Get("/api/auth/me",[&](const httplib::Request& req,httplib::Response& res){auth.info(auth.identity(req),res);});

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
                [&rag_retriever, &llm](const httplib::Request &request,
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
                        const auto result = llm.generate(course_id, question, rag_answer.answer);
                        if (result.generated) {
                            rag_answer.answer = result.answer;
                            rag_answer.mode = "generated";
                            rag_answer.notice = "AI 已依据下列检索资料生成讲解，请结合原文核对。";
                        } else {
                            rag_answer.notice = result.reason == "not_configured"
                                ? "尚未配置大模型，以下为课程资料摘录。"
                                : "大模型服务暂不可用，以下为课程资料摘录。";
                            // Only diagnostic codes, never credentials or provider bodies.
                            std::cerr << "Model fallback: " << result.reason
                                      << " HTTP=" << result.http_status << std::endl;
                        }
                    }
                    response.set_content(
                        build_rag_response_json(rag_answer),
                        "application/json; charset=utf-8");
                });

    server.Get("/api/progress", [&](const httplib::Request& request, httplib::Response& response) {
        const auto who = auth.identity(request);
        const auto user = who.id;
        const auto course = request.has_param("course_id")
            ? request.get_param_value("course_id")
            : "";
        if (!mashangzhixin::LearningProgress::valid_user(user) || !is_supported_course(course)) {
            response.status = 400;
            response.set_content(R"({"status":"error","message":"Valid user_id and course_id are required"})", "application/json; charset=utf-8");
            return;
        }
        std::set<std::string> topics;
        for (const auto& exercise : exercise_bank()) if (exercise.course_id == course) topics.insert(exercise.knowledge_point);
        response.set_header("Cache-Control", "no-store");
        response.set_content(learning.progress_json(user, course, topics, who.name), "application/json; charset=utf-8");
    });
    server.Get("/api/recommendations",
               [&](const httplib::Request &request, httplib::Response &response) {
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

                   const std::string user = auth.identity(request).id;
                   if (!mashangzhixin::LearningProgress::valid_user(user)) {
                       response.status = 400;
                       response.set_content(R"({"status":"error","message":"Invalid user_id"})", "application/json; charset=utf-8");
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

                   const std::size_t recommendation_limit =
                       knowledge_point.empty() ? 10U : 3U;
                   std::mt19937 generator{std::random_device{}()};
                   std::shuffle(matches.begin(), matches.end(), generator);
                   // Preserve same-topic filtering; prioritize only ordinary course practice.
                   if (knowledge_point.empty() && !course_id.empty()) {
                       const auto progress = learning.stats(user, course_id);
                       const auto priority = [&](const Exercise* exercise) {
                           const auto found = progress.find(exercise->knowledge_point);
                           return found != progress.end() && found->second.attempted && found->second.mastery() < 60
                               ? found->second.mastery() : 101;
                       };
                       std::stable_sort(matches.begin(), matches.end(), [&](const Exercise* a, const Exercise* b) {
                           return priority(a) < priority(b);
                       });
                   }
                   response.set_header("Cache-Control", "no-store");
                   if (matches.size() > recommendation_limit) {
                       matches.resize(recommendation_limit);
                   }

                   response.set_content(
                       build_recommendations_json(matches, fallback),
                       "application/json; charset=utf-8");
               });

    server.Post("/api/exercises/submit",
                [&](const httplib::Request &request, httplib::Response &response) {
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
                    if (selected_answer.size() != 1 || std::string("ABCD").find(selected_answer) == std::string::npos) {
                        response.status = 400;
                        response.set_content(R"({"status":"error","message":"Answer must be A, B, C or D"})", "application/json; charset=utf-8");
                        return;
                    }
                    std::string user = "guest", token;
                    if (!mashangzhixin::LearningProgress::identity(request.body, user, token)) {
                        response.status = 400;
                        response.set_content(R"({"status":"error","message":"Invalid user_id or submission_id"})", "application/json; charset=utf-8");
                        return;
                    }
                    const bool correct = selected_answer == target->correct_answer;
                    mashangzhixin::LearningAttempt attempt;
                    attempt.user_id=auth.identity(request).id;attempt.course_id=target->course_id;attempt.knowledge_point=target->knowledge_point;
                    attempt.exercise_id=target->id;attempt.selected_answer=selected_answer;attempt.correct=correct;attempt.submission_id=token;
                    std::size_t attempt_id=0;
                    const auto saved=learning.record(std::move(attempt),attempt_id);
                    if(saved=="storage_error"||saved=="conflict") {
                        response.status=saved=="conflict"?409:500;
                        response.set_content(saved=="conflict" ? R"({"status":"error","message":"Submission token was already used for a different answer"})" : R"({"status":"error","message":"Learning record could not be saved; please retry"})", "application/json; charset=utf-8");
                        return;
                    }

                    const std::string body =
                        "{\"status\":\"ok\",\"exercise_id\":" +
                        std::to_string(target->id) +
                        ",\"attempt_id\":" + std::to_string(attempt_id) +
                        ",\"recorded\":" + (saved == "ok" ? "true" : "false") +
                        ",\"reused\":" + (saved == "reused" ? "true" : "false") +
                        ",\"correct\":" + (correct ? "true" : "false") +
                        ",\"correct_answer\":\"" +
                        escape_json_string(target->correct_answer) +
                        "\",\"explanation\":\"" +
                        escape_json_string(target->explanation) + "\"}";

                    response.set_content(body, "application/json; charset=utf-8");
                });

    server.Post("/api/exercises/coach",[&](const httplib::Request& request,httplib::Response& response){
        int id=0;if(!get_json_int(request.body,"exercise_id",id)){mashangzhixin::AuthStore::reply(response,400,"缺少题目编号");return;}
        const Exercise* target=nullptr;for(const auto& q:exercise_bank())if(q.id==id){target=&q;break;}
        mashangzhixin::LearningAttempt attempt;
        if(!target||!learning.latest(auth.identity(request).id,id,attempt)){mashangzhixin::AuthStore::reply(response,404,"请先完成这道题再查看辅导");return;}
        auto result=rag_retriever.answer(target->course_id,target->knowledge_point,3);
        std::string context="题目："+target->question+"\n";
        for(const auto& option:target->options)context+=option.key+". "+option.text+"\n";
        context+="学生选择："+attempt.selected_answer+"\n标准答案："+target->correct_answer+"\n标准解析："+target->explanation+"\n课程资料：\n"+result.answer;
        const std::string prompt="请依据题目、学生所选选项和课程资料，按【可能的误区】【对比讲解】【复习步骤】【自检问题】辅导。只能说可能的误区，不能凭一次作答断言能力；正确答案以提供的标准答案为准，不另编选择题或题号。";
        result.answer="正确答案："+target->correct_answer+"\n解析："+target->explanation+"\n复习步骤：回顾“"+target->knowledge_point+"”的定义，逐项比较选项，再完成一道不同题目验证理解。";
        result.mode="retrieval";result.notice="当前显示题库解析与复习建议；掌握度是练习表现估计。";
        if(!result.sources.empty()){
            auto generated=llm.generate(target->course_id,prompt,context);
            if(generated.generated){result.answer=generated.answer;result.mode="generated";result.notice="AI 辅导基于本次选择与课程资料；误区为推测，请以标准答案和原文为准。";}
        }
        int next=0;for(const auto& q:exercise_bank())if(q.id!=id&&q.course_id==target->course_id&&q.knowledge_point==target->knowledge_point){next=q.id;break;}
        auto json=build_rag_response_json(result);json.pop_back();json+=",\"verification_exercise_id\":"+std::to_string(next)+"}";
        response.set_content(json,"application/json; charset=utf-8");
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
                         "待复习", auth.identity(request).id});
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
                if (wrong_question.id == id && wrong_question.user_id == auth.identity(request).id) {
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
               [&](const httplib::Request &request, httplib::Response &response) {
                   std::lock_guard<std::mutex> lock(wrong_questions_mutex);
                   std::string body = R"({"items":[)";

                   bool first = true;
                   const auto owner=auth.identity(request).id;
                   for (const auto& wrong_question : wrong_questions) {
                       if(wrong_question.user_id != owner) continue;
                       if(!first) body += ',';
                       first=false;
                       append_wrong_question_json(body,wrong_question);
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
