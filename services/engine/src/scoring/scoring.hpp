#pragma once

namespace prism::scoring {

int aggregate_risk_score(int critical, int high, int medium);
const char* merge_recommendation(int risk_score);

}  // namespace prism::scoring
