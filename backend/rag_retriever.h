#pragma once

#include <cstddef>
#include <filesystem>
#include <string>
#include <vector>

namespace mashangzhixin {

struct RagSource {
    std::string title;
    std::string section;
    std::string relative_path;
    std::string excerpt;
    double score = 0.0;
};

struct RagAnswer {
    std::string answer;
    std::vector<RagSource> sources;
};

class RagRetriever {
public:
    explicit RagRetriever(std::filesystem::path knowledge_base_path);

    bool load(std::string &error);

    RagAnswer answer(const std::string &course_id,
                     const std::string &question,
                     std::size_t maximum_sources = 5) const;

    std::size_t document_count() const;
    std::size_t chunk_count() const;

private:
    struct Chunk {
        std::string course_id;
        std::string title;
        std::string section;
        std::string relative_path;
        std::string content;
        std::string search_context;
        std::size_t order = 0;
    };

    bool load_document(const std::filesystem::path &path,
                       const std::string &course_id,
                       std::string &error);

    std::filesystem::path knowledge_base_path_;
    std::vector<Chunk> chunks_;
    std::size_t document_count_ = 0;
};

}  // namespace mashangzhixin
