#include <string>
#include <vector>

namespace prism::rules {

struct Finding {
  std::string id;
  std::string severity;
  std::string title;
  std::string file;
  int line = 0;
};

std::vector<Finding> scan_sql_concat(const std::string& file, const std::string& content) {
  std::vector<Finding> findings;
  if (content.find("fmt.Sprintf") != std::string::npos &&
      content.find("SELECT") != std::string::npos) {
    findings.push_back(
        {"rule-sql", "critical", "疑似 SQL 拼接", file, 0});
  }
  return findings;
}

}  // namespace prism::rules
