#include <string>
#include <vector>

namespace prism::graph {

struct Node {
  std::string id;
  std::string label;
};

struct Edge {
  std::string from;
  std::string to;
};

struct Graph {
  std::vector<Node> nodes;
  std::vector<Edge> edges;
};

Graph build_stub(const std::string& repo_id) {
  Graph g;
  g.nodes.push_back({repo_id, repo_id});
  return g;
}

}  // namespace prism::graph
