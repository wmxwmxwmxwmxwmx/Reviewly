#ifdef PRISM_USE_GRPC

#include "diff/parser.hpp"
#include "rules/rules.hpp"
#include "scoring/scoring.hpp"

#include <grpcpp/grpcpp.h>
#include <iostream>
#include <memory>
#include <string>

// Generated from packages/contracts/proto/prism/v1/engine.proto
#include "prism/v1/engine.grpc.pb.h"
#include "prism/v1/engine.pb.h"

namespace {

using grpc::Server;
using grpc::ServerBuilder;
using grpc::ServerContext;
using grpc::ServerWriter;
using grpc::Status;

class EngineServiceImpl final : public prism::v1::EngineService::Service {
 public:
  Status HealthCheck(ServerContext*, const prism::v1::HealthCheckRequest*,
                     prism::v1::HealthCheckResponse* response) override {
    response->set_status("ok");
    response->set_version("0.1.0");
    return Status::OK;
  }

  Status ParseDiff(ServerContext*, const prism::v1::ParseDiffRequest* request,
                   prism::v1::ParseDiffResponse* response) override {
    auto parsed = prism::diff::parse_unified_diff(request->patch());
    for (const auto& src : parsed) {
      auto* file = response->add_files();
      file->set_path(src.path);
      file->set_type(src.type);
      file->set_additions(src.additions);
      file->set_deletions(src.deletions);
      file->set_risk_level(src.risk_level);
      file->set_language(src.language);
      file->set_collapsed(src.collapsed);
      for (const auto& c : src.chunks) {
        auto* chunk = file->add_chunks();
        chunk->set_header(c.header);
        for (const auto& line : c.lines) {
          auto* out = chunk->add_lines();
          out->set_type(line.type);
          if (line.old_num >= 0) out->set_old_num(line.old_num);
          if (line.new_num >= 0) out->set_new_num(line.new_num);
          out->set_content(line.content);
        }
      }
    }
    return Status::OK;
  }

  Status RunAnalysis(ServerContext*, const prism::v1::AnalysisInput* request,
                     ServerWriter<prism::v1::AnalysisProgress>* writer) override {
    const std::string patch = request->patch();
    auto files = prism::diff::parse_unified_diff(patch);
    const int total = std::max(static_cast<int>(request->file_paths_size()), 1);

    int critical = 0, high = 0, medium = 0;
    for (int i = 0; i < total; ++i) {
      prism::v1::AnalysisProgress progress;
      progress.set_status("running");
      progress.set_progress(static_cast<int>((i + 1) * 100 / total));
      progress.set_chunk_index(i + 1);
      progress.set_chunk_total(total);

      if (i < static_cast<int>(files.size())) {
        std::string content;
        for (const auto& chunk : files[i].chunks) {
          for (const auto& line : chunk.lines) {
            content += line.content + "\n";
          }
        }
        auto findings = prism::rules::scan_sql_concat(files[i].path, content);
        for (const auto& f : findings) {
          auto* out = progress.add_findings();
          out->set_id(f.id);
          out->set_type("security");
          out->set_severity(f.severity);
          out->set_title(f.title);
          out->set_file(f.file);
          out->set_line(f.line);
          if (f.severity == "critical") ++critical;
          else if (f.severity == "high") ++high;
          else ++medium;
        }
      }
      writer->Write(progress);
    }

    prism::v1::AnalysisProgress done;
    done.set_status("completed");
    done.set_progress(100);
    done.set_chunk_index(total);
    done.set_chunk_total(total);
    const int risk = prism::scoring::aggregate_risk_score(critical, high, medium);
    (void)risk;
    writer->Write(done);
    return Status::OK;
  }

  Status BuildDependencyGraph(ServerContext*, const prism::v1::DependencyGraphRequest* request,
                              prism::v1::DependencyGraphResponse* response) override {
    auto* node = response->add_nodes();
    node->set_id(request->repo_id());
    node->set_label(request->repo_id());
    return Status::OK;
  }
};

}  // namespace

int RunGrpcServer(const std::string& addr) {
  EngineServiceImpl service;
  ServerBuilder builder;
  builder.AddListeningPort(addr, grpc::InsecureServerCredentials());
  builder.RegisterService(&service);
  std::unique_ptr<Server> server(builder.BuildAndStart());
  if (!server) {
    std::cerr << "Failed to start gRPC server on " << addr << "\n";
    return 1;
  }
  std::cout << "PRism engine gRPC listening on " << addr << "\n";
  server->Wait();
  return 0;
}

#endif
