#include <string>
#include <vector>

namespace prism::chunking {

std::vector<std::string> split_files(const std::vector<std::string>& paths, bool ignore_lockfiles) {
  std::vector<std::string> out;
  for (const auto& p : paths) {
    if (ignore_lockfiles && (p.find("package-lock") != std::string::npos ||
                             p.find("pnpm-lock") != std::string::npos)) {
      continue;
    }
    out.push_back(p);
  }
  return out;
}

}  // namespace prism::chunking
