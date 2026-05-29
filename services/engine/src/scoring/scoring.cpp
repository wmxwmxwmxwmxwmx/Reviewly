#include <algorithm>

namespace prism::scoring {

int aggregate_risk_score(int critical, int high, int medium) {
  return std::min(100, critical * 25 + high * 12 + medium * 5);
}

const char* merge_recommendation(int risk_score) {
  if (risk_score >= 70) return "block";
  if (risk_score >= 40) return "request_changes";
  return "approve";
}

}  // namespace prism::scoring
