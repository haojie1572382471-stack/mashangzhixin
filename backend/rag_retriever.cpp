#include "rag_retriever.h"

#include <algorithm>
#include <cctype>
#include <cstdint>
#include <fstream>
#include <sstream>
#include <unordered_set>
#include <utility>

namespace mashangzhixin {
namespace {

struct Utf8Character {
    std::uint32_t code_point = 0;
    std::string bytes;
};

struct ScoredChunk {
    std::size_t index = 0;
    double score = 0.0;
};

std::string trim(const std::string &value) {
    std::size_t begin = 0;
    while (begin < value.size() &&
           std::isspace(static_cast<unsigned char>(value[begin]))) {
        ++begin;
    }

    std::size_t end = value.size();
    while (end > begin &&
           std::isspace(static_cast<unsigned char>(value[end - 1]))) {
        --end;
    }

    return value.substr(begin, end - begin);
}

bool starts_with(const std::string &value, const std::string &prefix) {
    return value.size() >= prefix.size() &&
           value.compare(0, prefix.size(), prefix) == 0;
}

std::string lower_ascii(std::string value) {
    for (char &character : value) {
        const unsigned char byte = static_cast<unsigned char>(character);
        if (byte < 0x80) {
            character = static_cast<char>(std::tolower(byte));
        }
    }
    return value;
}

void replace_all(std::string &value,
                 const std::string &needle,
                 const std::string &replacement) {
    if (needle.empty()) {
        return;
    }

    std::size_t position = 0;
    while ((position = value.find(needle, position)) != std::string::npos) {
        value.replace(position, needle.size(), replacement);
        position += replacement.size();
    }
}

std::string normalize_question(std::string value) {
    value = lower_ascii(std::move(value));

    // Course selection is already supplied separately. Removing course names
    // and common question scaffolding keeps them from making every chunk look
    // relevant to the same query.
    static const std::vector<std::string> removable_phrases = {
        "c++", "cpp", "数据结构", "程序设计",
        "是不是", "会有什么后果", "有什么后果", "需要",
        "有什么作用", "有什么区别", "有哪些区别", "有何区别", "有哪些",
        "有什么不同", "是什么意思", "什么是", "是什么", "怎么样", "是多少",
        "请问", "请解释", "请说明", "为什么", "如何", "怎么", "怎样",
        "以及", "和", "与", "及", "跟", "的",
        "？", "。", "，", "！", "：", "；", "、", "（", "）"};

    for (const std::string &phrase : removable_phrases) {
        replace_all(value, phrase, " ");
    }
    return value;
}

std::string compact_phrase(const std::string &value) {
    std::string compact;
    compact.reserve(value.size());
    for (const unsigned char byte : value) {
        if (byte >= 0x80 || std::isalnum(byte) || byte == '+' ||
            byte == '#' || byte == '_') {
            compact.push_back(static_cast<char>(byte));
        }
    }
    return compact;
}

std::string normalize_course_directory(std::string value) {
    value = lower_ascii(std::move(value));
    if (value == "cpp") {
        return "cpp";
    }
    if (value == "data_structure" || value == "data-structure") {
        return "data-structure";
    }
    return "";
}

std::vector<Utf8Character> decode_utf8(const std::string &value) {
    std::vector<Utf8Character> characters;

    for (std::size_t index = 0; index < value.size();) {
        const unsigned char first =
            static_cast<unsigned char>(value[index]);
        std::size_t length = 1;
        std::uint32_t code_point = first;

        if ((first & 0xe0) == 0xc0 && index + 1 < value.size()) {
            length = 2;
            code_point = first & 0x1f;
        } else if ((first & 0xf0) == 0xe0 && index + 2 < value.size()) {
            length = 3;
            code_point = first & 0x0f;
        } else if ((first & 0xf8) == 0xf0 && index + 3 < value.size()) {
            length = 4;
            code_point = first & 0x07;
        }

        bool valid = length > 1;
        if (length > 1) {
            for (std::size_t offset = 1; offset < length; ++offset) {
                const unsigned char continuation =
                    static_cast<unsigned char>(value[index + offset]);
                if ((continuation & 0xc0) != 0x80) {
                    valid = false;
                    break;
                }
                code_point = (code_point << 6) | (continuation & 0x3f);
            }
        }

        if (!valid && length > 1) {
            length = 1;
            code_point = first;
        }

        characters.push_back(
            {code_point, value.substr(index, length)});
        index += length;
    }

    return characters;
}

bool is_cjk(std::uint32_t code_point) {
    return (code_point >= 0x3400 && code_point <= 0x4dbf) ||
           (code_point >= 0x4e00 && code_point <= 0x9fff) ||
           (code_point >= 0xf900 && code_point <= 0xfaff);
}

bool is_ascii_word_character(std::uint32_t code_point) {
    if (code_point >= 0x80) {
        return false;
    }
    const unsigned char character =
        static_cast<unsigned char>(code_point);
    return std::isalnum(character) || character == '_' ||
           character == '+' || character == '#';
}

bool is_stop_token(const std::string &token) {
    static const std::unordered_set<std::string> stop_tokens = {
        "a", "an", "and", "are", "does", "how", "is", "of",
        "the", "to", "what", "which", "why", "c++", "cpp",
        "一个", "一种", "什么", "为何", "哪些", "可以", "如何",
        "怎么", "怎样", "是否", "请问", "中", "里", "吗", "呢"};
    return stop_tokens.find(token) != stop_tokens.end();
}

void append_unique_token(const std::string &token,
                         std::vector<std::string> &tokens,
                         std::unordered_set<std::string> &seen) {
    if (token.empty() || is_stop_token(token)) {
        return;
    }
    if (seen.insert(token).second) {
        tokens.push_back(token);
    }
}

std::vector<std::string> tokenize(const std::string &value) {
    std::vector<std::string> tokens;
    std::unordered_set<std::string> seen;
    std::string ascii_word;
    std::vector<std::string> cjk_run;

    const auto flush_ascii = [&]() {
        if (!ascii_word.empty()) {
            append_unique_token(lower_ascii(ascii_word), tokens, seen);
            ascii_word.clear();
        }
    };

    const auto flush_cjk = [&]() {
        if (cjk_run.empty()) {
            return;
        }

        if (cjk_run.size() == 1) {
            append_unique_token(cjk_run.front(), tokens, seen);
        } else {
            for (std::size_t index = 0; index + 1 < cjk_run.size(); ++index) {
                append_unique_token(
                    cjk_run[index] + cjk_run[index + 1], tokens, seen);
            }
            for (std::size_t index = 0; index + 2 < cjk_run.size(); ++index) {
                append_unique_token(cjk_run[index] + cjk_run[index + 1] +
                                        cjk_run[index + 2],
                                    tokens,
                                    seen);
            }
        }
        cjk_run.clear();
    };

    for (const Utf8Character &character : decode_utf8(value)) {
        if (is_ascii_word_character(character.code_point)) {
            flush_cjk();
            ascii_word += character.bytes;
        } else if (is_cjk(character.code_point)) {
            flush_ascii();
            cjk_run.push_back(character.bytes);
        } else {
            flush_ascii();
            flush_cjk();
        }
    }

    flush_ascii();
    flush_cjk();
    return tokens;
}

std::size_t count_occurrences(const std::string &haystack,
                              const std::string &needle) {
    if (needle.empty()) {
        return 0;
    }

    std::size_t count = 0;
    std::size_t position = 0;
    while ((position = haystack.find(needle, position)) != std::string::npos) {
        ++count;
        position += needle.size();
    }
    return count;
}

double token_significance(const std::string &token) {
    const std::size_t character_count = decode_utf8(token).size();
    if (character_count >= 3) {
        return 1.6;
    }
    if (character_count == 2 || token.size() >= 4) {
        return 1.25;
    }
    return 1.0;
}

std::string truncate_utf8(const std::string &value,
                          std::size_t maximum_characters) {
    const std::vector<Utf8Character> characters = decode_utf8(value);
    if (characters.size() <= maximum_characters) {
        return value;
    }

    std::string result;
    for (std::size_t index = 0; index < maximum_characters; ++index) {
        result += characters[index].bytes;
    }
    result += "……";
    return result;
}

std::string course_display_name(const std::string &course_id) {
    return course_id == "cpp" ? "C++" : "数据结构";
}

}  // namespace

RagRetriever::RagRetriever(std::filesystem::path knowledge_base_path)
    : knowledge_base_path_(std::move(knowledge_base_path)) {}

bool RagRetriever::load(std::string &error) {
    chunks_.clear();
    document_count_ = 0;
    error.clear();

    std::error_code filesystem_error;
    if (!std::filesystem::exists(knowledge_base_path_, filesystem_error)) {
        error = filesystem_error
                    ? "Cannot inspect knowledge base: " +
                          filesystem_error.message()
                    : "Knowledge-base directory does not exist: " +
                          knowledge_base_path_.string();
        return false;
    }

    if (!std::filesystem::is_directory(
            knowledge_base_path_, filesystem_error)) {
        error = filesystem_error
                    ? "Cannot inspect knowledge-base directory: " +
                          filesystem_error.message()
                    : "Knowledge-base path is not a directory: " +
                          knowledge_base_path_.string();
        return false;
    }

    std::vector<std::filesystem::path> documents;
    std::filesystem::recursive_directory_iterator iterator(
        knowledge_base_path_, filesystem_error);
    const std::filesystem::recursive_directory_iterator end;
    if (filesystem_error) {
        error = "Cannot scan knowledge base: " + filesystem_error.message();
        return false;
    }

    while (iterator != end) {
        const std::filesystem::directory_entry &entry = *iterator;
        if (entry.is_regular_file(filesystem_error)) {
            std::string extension = lower_ascii(entry.path().extension().string());
            if (extension == ".md" || extension == ".txt") {
                documents.push_back(entry.path());
            }
        }
        if (filesystem_error) {
            error = "Cannot inspect knowledge-base entry: " +
                    filesystem_error.message();
            return false;
        }

        iterator.increment(filesystem_error);
        if (filesystem_error) {
            error = "Cannot continue scanning knowledge base: " +
                    filesystem_error.message();
            return false;
        }
    }

    std::sort(documents.begin(), documents.end());

    for (const std::filesystem::path &document : documents) {
        const std::filesystem::path relative_path =
            std::filesystem::relative(
                document, knowledge_base_path_, filesystem_error);
        if (filesystem_error || relative_path.empty()) {
            error = "Cannot resolve knowledge-base file path: " +
                    document.string();
            return false;
        }

        const auto component = relative_path.begin();
        if (component == relative_path.end()) {
            continue;
        }

        const std::string course_id =
            normalize_course_directory(component->string());
        if (course_id.empty()) {
            continue;
        }

        if (!load_document(document, course_id, error)) {
            return false;
        }
        ++document_count_;
    }

    if (document_count_ == 0 || chunks_.empty()) {
        error = "No supported Markdown or text documents were loaded from " +
                knowledge_base_path_.string();
        return false;
    }

    return true;
}

bool RagRetriever::load_document(const std::filesystem::path &path,
                                 const std::string &course_id,
                                 std::string &error) {
    std::ifstream input(path, std::ios::binary);
    if (!input) {
        error = "Cannot open knowledge-base file: " + path.string();
        return false;
    }

    std::vector<std::string> lines;
    std::string line;
    while (std::getline(input, line)) {
        if (!line.empty() && line.back() == '\r') {
            line.pop_back();
        }
        lines.push_back(line);
    }
    if (!input.good() && !input.eof()) {
        error = "Cannot read knowledge-base file: " + path.string();
        return false;
    }

    std::error_code filesystem_error;
    const std::filesystem::path relative_path =
        std::filesystem::relative(path, knowledge_base_path_, filesystem_error);
    if (filesystem_error) {
        error = "Cannot resolve knowledge-base file: " + path.string();
        return false;
    }

    std::string title = path.stem().string();
    std::string section = "概览";
    std::string metadata;
    std::vector<std::string> content_lines;
    std::size_t section_order = 0;

    const auto flush_section = [&]() {
        std::ostringstream content_stream;
        bool has_content = false;
        for (const std::string &content_line : content_lines) {
            if (!content_line.empty()) {
                has_content = true;
            }
            content_stream << content_line << '\n';
        }

        const std::string content = trim(content_stream.str());
        if (has_content && !content.empty()) {
            Chunk chunk;
            chunk.course_id = course_id;
            chunk.title = title;
            chunk.section = section;
            chunk.relative_path = relative_path.generic_string();
            chunk.content = content;
            chunk.search_context = metadata;
            chunk.order = section_order++;
            chunks_.push_back(std::move(chunk));
        }
        content_lines.clear();
    };

    for (const std::string &raw_line : lines) {
        const std::string stripped = trim(raw_line);

        if (starts_with(stripped, "# ")) {
            title = trim(stripped.substr(2));
            continue;
        }

        if (starts_with(stripped, "## ")) {
            flush_section();
            section = trim(stripped.substr(3));
            continue;
        }

        if (starts_with(stripped, "课程：") ||
            starts_with(stripped, "课程:") ||
            starts_with(stripped, "知识点：") ||
            starts_with(stripped, "知识点:") ||
            starts_with(stripped, "来源：") ||
            starts_with(stripped, "来源:")) {
            if (!metadata.empty()) {
                metadata += ' ';
            }
            metadata += stripped;
            continue;
        }

        content_lines.push_back(raw_line);
    }

    flush_section();
    return true;
}

RagAnswer RagRetriever::answer(const std::string &course_id,
                               const std::string &question,
                               std::size_t maximum_sources) const {
    RagAnswer result;
    const std::string normalized_question = normalize_question(question);
    const std::vector<std::string> query_tokens =
        tokenize(normalized_question);
    const std::string compact_question = compact_phrase(normalized_question);

    if (query_tokens.empty() || maximum_sources == 0) {
        result.answer =
            "问题中没有可用于检索的关键词，请补充更具体的课程问题。";
        return result;
    }

    std::vector<ScoredChunk> scored_chunks;
    for (std::size_t chunk_index = 0;
         chunk_index < chunks_.size();
         ++chunk_index) {
        const Chunk &chunk = chunks_[chunk_index];
        if (chunk.course_id != course_id) {
            continue;
        }

        const std::string searchable_title = lower_ascii(chunk.title);
        const std::string searchable_section = lower_ascii(chunk.section);
        const std::string searchable_content = lower_ascii(chunk.content);
        const std::string searchable_context = lower_ascii(chunk.search_context);

        double score = 0.0;
        std::size_t matched_tokens = 0;
        for (const std::string &raw_token : query_tokens) {
            const std::string token = lower_ascii(raw_token);
            const double significance = token_significance(token);
            const std::size_t title_matches =
                count_occurrences(searchable_title, token);
            const std::size_t section_matches =
                count_occurrences(searchable_section, token);
            const std::size_t content_matches = std::min<std::size_t>(
                count_occurrences(searchable_content, token), 3);
            const std::size_t context_matches =
                count_occurrences(searchable_context, token);

            // Document metadata is shared by every section. It may provide a
            // small boost after a real match, but it must never make an
            // otherwise unrelated section eligible by itself.
            if (title_matches + section_matches + content_matches > 0) {
                ++matched_tokens;
                score += significance *
                         (8.0 * static_cast<double>(title_matches) +
                          12.0 * static_cast<double>(section_matches) +
                          2.5 * static_cast<double>(content_matches) +
                          0.25 * static_cast<double>(context_matches));
            }
        }

        if (matched_tokens == 0) {
            continue;
        }

        const std::string compact_section =
            compact_phrase(normalize_question(chunk.section));
        if (!compact_question.empty() && !compact_section.empty() &&
            compact_section.find(compact_question) != std::string::npos) {
            score += 50.0;
        }

        const double coverage =
            static_cast<double>(matched_tokens) /
            static_cast<double>(query_tokens.size());

        // A single incidental word is not enough for a multi-concept query.
        // This prevents, for example, a data-structure paragraph mentioning
        // a queue pointer from answering a pointer-versus-reference question.
        const std::size_t minimum_matched_tokens =
            std::min<std::size_t>(2, query_tokens.size());
        if (matched_tokens < minimum_matched_tokens || coverage < 0.45) {
            continue;
        }
        score *= 0.75 + coverage;

        if (score >= 3.0) {
            scored_chunks.push_back({chunk_index, score});
        }
    }

    std::sort(
        scored_chunks.begin(),
        scored_chunks.end(),
        [this](const ScoredChunk &left, const ScoredChunk &right) {
            if (left.score != right.score) {
                return left.score > right.score;
            }
            const Chunk &left_chunk = chunks_[left.index];
            const Chunk &right_chunk = chunks_[right.index];
            if (left_chunk.relative_path != right_chunk.relative_path) {
                return left_chunk.relative_path < right_chunk.relative_path;
            }
            return left_chunk.order < right_chunk.order;
        });

    if (scored_chunks.empty()) {
        result.answer = "当前" + course_display_name(course_id) +
                        "知识库中没有找到足够相关的内容。请换一种问法，"
                        "或者先补充对应课程资料。";
        return result;
    }

    const double best_score = scored_chunks.front().score;
    const double relative_cutoff = std::max(3.0, best_score * 0.70);

    std::size_t result_count = 0;
    while (result_count < scored_chunks.size() &&
           result_count < maximum_sources &&
           scored_chunks[result_count].score >= relative_cutoff) {
        ++result_count;
    }
    result.answer = "根据" + course_display_name(course_id) +
                    "课程知识库，检索到以下相关内容：";

    for (std::size_t index = 0; index < result_count; ++index) {
        const ScoredChunk &scored = scored_chunks[index];
        const Chunk &chunk = chunks_[scored.index];

        result.answer += "\n\n【" + chunk.section + "】\n" +
                         truncate_utf8(chunk.content, 900);

        RagSource source;
        source.title = chunk.title;
        source.section = chunk.section;
        source.relative_path = chunk.relative_path;
        source.excerpt = truncate_utf8(chunk.content, 160);
        source.score = scored.score;
        result.sources.push_back(std::move(source));
    }

    return result;
}

std::size_t RagRetriever::document_count() const {
    return document_count_;
}

std::size_t RagRetriever::chunk_count() const {
    return chunks_.size();
}

}  // namespace mashangzhixin
