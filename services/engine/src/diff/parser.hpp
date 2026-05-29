#pragma once

#include <string>
#include <vector>

namespace prism::diff {

struct DiffLine {
  std::string type;
  int old_num = -1;
  int new_num = -1;
  std::string content;
};

struct DiffChunk {
  std::string header;
  std::vector<DiffLine> lines;
};

struct DiffFile {
  std::string path;
  std::string type = "modified";
  int additions = 0;
  int deletions = 0;
  std::string risk_level = "none";
  std::string language = "text";
  bool collapsed = false;
  std::vector<DiffChunk> chunks;
};

/** Parse unified diff patch into DiffFile list (B3/B4). */
std::vector<DiffFile> parse_unified_diff(const std::string& patch);

}  // namespace prism::diff
