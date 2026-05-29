#include "diff/parser.hpp"

#include <cassert>
#include <string>

int main() {
  const std::string patch =
      "+++ b/foo.go\n"
      "@@ -1,2 +1,3 @@\n"
      " context\n"
      "+added\n"
      "-removed\n";

  auto files = prism::diff::parse_unified_diff(patch);
  assert(files.size() == 1);
  assert(files[0].path == "foo.go");
  assert(files[0].additions >= 1);
  assert(files[0].deletions >= 1);
  assert(!files[0].chunks.empty());
  return 0;
}
