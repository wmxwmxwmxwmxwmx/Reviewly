"use client"
import { Network } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useRepos } from "@/hooks/use-repos"
import { useArchitecture } from "@/hooks/use-architecture"

export function ArchitectureView() {
  const { repos, loading:reposLoading, error:reposError } = useRepos()
  const [repoId, setRepoId] = useState<string | null>(null)

  useEffect(() => {
    if (!repoId && repos.length > 0) {
      setRepoId(repos[0].id)
    }
  }, [repoId, repos])

  const selectedLabel = useMemo(() => {
    if (!repoId) return null
    const r = repos.find((x) => x.id === repoId)
    return r ? r.fullName : null
  }, [repoId, repos])

  const { graph, loading:graphLoading, error:graphError } = useArchitecture(repoId)

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">架构分析</h1>
          <p className="text-sm text-muted-foreground mt-0.5">模块依赖关系与架构健康度</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-ai-blue rounded-md hover:bg-[oklch(0.55_0.19_240)] transition-colors">
          <Network className="w-3.5 h-3.5" />
          重新扫描
        </button>
      </div>

      <div className="rounded-lg border border-border p-4 bg-surface-2 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium text-foreground">选择仓库</div>
          {reposError && <p className="text-sm text-risk-high">{reposError}</p>}
        </div>

        <select
          value={repoId ?? ""}
          onChange={(e) => setRepoId(e.target.value || null)}
          disabled={reposLoading}
          className="w-full h-9 px-3 text-xs bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ai-blue"
        >
          {reposLoading && <option value="">加载中…</option>}
          {!reposLoading && repos.length === 0 && <option value="">暂无仓库</option>}
          {!reposLoading &&
            repos.map((r) => (
              <option key={r.id} value={r.id}>
                {r.fullName}
              </option>
            ))}
        </select>

        {selectedLabel && <div className="text-xs text-muted-foreground">当前：{selectedLabel}</div>}
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">依赖图</span>
          {graph && (
            <span className="text-xs text-muted-foreground ml-auto">
              节点 {graph.nodes.length} · 边 {graph.edges.length}
            </span>
          )}
        </div>

        <div className="p-4 space-y-3">
          {graphLoading && <p className="text-sm text-muted-foreground">加载依赖图…</p>}
          {graphError && <p className="text-sm text-risk-high">{graphError}</p>}

          {!graphLoading && graph && (
            <>
              <div>
                <div className="text-xs text-muted-foreground mb-2">Nodes</div>
                <div className="space-y-1">
                  {graph.nodes.map((n) => (
                    <div key={n.id} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-surface-2 border border-border">
                      <span className="font-mono text-foreground truncate">{n.id}</span>
                      <span className="text-muted-foreground ml-3 truncate">{n.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground mb-2">Edges</div>
                <div className="space-y-1">
                  {graph.edges.map((e, idx) => (
                    <div
                      key={`${e.from}-${e.to}-${idx}`}
                      className="flex items-center gap-2 text-xs px-2 py-1 rounded bg-surface-2 border border-border"
                    >
                      <span className="font-mono text-muted-foreground truncate">{e.from}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-mono text-muted-foreground truncate">{e.to}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {!graphLoading && !graphError && !graph && (
            <p className="text-sm text-muted-foreground">请选择仓库后查看依赖图。</p>
          )}
        </div>
      </div>
    </div>
  )
}
