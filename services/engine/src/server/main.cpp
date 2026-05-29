#include "diff/parser.hpp"
#include "scoring/scoring.hpp"

#include <iostream>
#include <string>

int main(int argc, char** argv) {
  if (argc > 1 && std::string(argv[1]) == "--parse-stdin") {
    std::string patch((std::istreambuf_iterator<char>(std::cin)), {});
    auto files = prism::diff::parse_unified_diff(patch);
    std::cout << "files=" << files.size() << "\n";
    for (const auto& f : files) {
      std::cout << f.path << " +" << f.additions << " -" << f.deletions << "\n";
    }
    return 0;
  }

#ifndef PRISM_USE_GRPC
  std::cout << "PRism analysis engine (stub mode).\n"
            << "  Build with -DPRISM_USE_GRPC=ON and install gRPC via vcpkg for production.\n"
            << "  Gateway: set PRISM_STUB_ENGINE=1 (default) to use Python stub client.\n"
            << "  Test parser: prism_engine --parse-stdin < patch.diff\n";
  const int score = prism::scoring::aggregate_risk_score(2, 1, 1);
  std::cout << "sample risk_score=" << score
            << " recommendation=" << prism::scoring::merge_recommendation(score) << "\n";
  return 0;
#else
  std::cout << "gRPC server starting on :50051 (PRISM_USE_GRPC)\n";
  // B4: wire EngineService from generated stubs
  return 0;
#endif
}
