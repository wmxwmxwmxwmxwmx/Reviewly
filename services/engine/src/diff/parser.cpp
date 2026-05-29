#include "diff/parser.hpp"

#include <sstream>

namespace prism::diff {

namespace {

std::string extension_of(const std::string& path) {
  const auto pos = path.find_last_of('.');
  if (pos == std::string::npos) return "text";
  return path.substr(pos + 1);
}

}  // namespace

std::vector<DiffFile> parse_unified_diff(const std::string& patch) {
  std::vector<DiffFile> files;
  if (patch.empty()) return files;

  std::istringstream stream(patch);
  std::string line;
  DiffFile* current = nullptr;
  DiffChunk* chunk = nullptr;

  while (std::getline(stream, line)) {
    if (!line.empty() && line.back() == '\r') line.pop_back();

    if (line.rfind("+++ ", 0) == 0) {
      files.emplace_back();
      current = &files.back();
      std::string path = line.substr(4);
      if (path.rfind("b/", 0) == 0) path = path.substr(2);
      current->path = path;
      current->language = extension_of(path);
      chunk = nullptr;
      continue;
    }

    if (!current) continue;

    if (line.rfind("@@", 0) == 0) {
      current->chunks.emplace_back();
      chunk = &current->chunks.back();
      chunk->header = line;
      continue;
    }

    if (!chunk) continue;

    DiffLine dl;
    if (line.empty()) {
      dl.type = "context";
      dl.content = "";
    } else if (line[0] == '+') {
      dl.type = "add";
      dl.content = line.substr(1);
      current->additions++;
    } else if (line[0] == '-') {
      dl.type = "delete";
      dl.content = line.substr(1);
      current->deletions++;
    } else if (line[0] == ' ') {
      dl.type = "context";
      dl.content = line.substr(1);
    } else {
      continue;
    }
    chunk->lines.push_back(std::move(dl));
  }

  return files;
}

}  // namespace prism::diff
