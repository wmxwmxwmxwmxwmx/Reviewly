"use client"

import { Loader2, Network, BrainCircuit } from "lucide-react"
import { useEffect } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { ArchitectureGraphViewer } from "@/features/prism/components/architecture-graph-viewer"
import { SummaryMarkdown } from "@/features/prism/components/summary-markdown"
import { useArchitecture } from "@/hooks/use-architecture"
import { useArchitectureAnalyze } from "@/hooks/use-architecture-analyze"
import { useArchitectureSelection } from "@/hooks/use-architecture-selection"
import { usePersistedViewState } from "@/hooks/use-persisted-view-state"
import { useReposStore } from "@/features/prism/contexts/repos-context"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"

export function ArchitectureView() {
  const { repos, loading: reposLoading, error: reposError } = useReposStore()
  const [archState, setArchState] = usePersistedViewState("architecture", {
    repoId: null as string | null,
    selectedNodeId: null as string | null,
  })
  const repoId = archState.repoId
  const setRepoId = (id: string | null) => setArchState({ repoId: id })
  const selectedNodeId = archState.selectedNodeId
  const setSelectedNodeId = (id: string | null) => setArchState({ selectedNodeId: id })

  useEffect(() => {
    if (!repoId && repos.length > 0) {
      setRepoId(repos[0].id)
    }
  }, [repoId, repos, setRepoId])

  const { graph, metrics, loading, scanning, error, scan } = useArchitecture(repoId)
  const { selectedNode, inbound, outbound } = useArchitectureSelection(
    graph,
    selectedNodeId,
    setSelectedNodeId,
  )
  const { content: aiContent, loading: aiLoading, error: aiError, analyze } =
    useArchitectureAnalyze(repoId)

  const selectedLabel = repos.find((r) => r.id === repoId)?.fullName

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">架构分析</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{zh.pageSubtitle.architecture}</p>
        </div>
        <button
          type="button"
          onClick={() => scan()}
          disabled={!repoId || scanning}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-ai-blue rounded-md hover:bg-[oklch(0.55_0.19_240)] transition-colors disabled:opacity-50"
        >
          {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Network className="w-3.5 h-3.5" />}
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
          onChange={(e) => {
            setRepoId(e.target.value || null)
            setSelectedNodeId(null)
          }}
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

      {error && (
        <div className="rounded-lg border border-risk-high/30 bg-risk-high/10 px-4 py-3 text-sm text-risk-high">
          {error}
        </div>
      )}

      {metrics && (metrics.cycles.length > 0 || metrics.giantModules.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {metrics.cycles.length > 0 && (
            <div className="rounded-lg border border-border p-3 bg-surface-2">
              <p className="text-xs font-medium text-foreground mb-1">循环依赖</p>
              <p className="text-xs text-muted-foreground">{metrics.cycles.length} 处检测到环</p>
            </div>
          )}
          {metrics.giantModules.length > 0 && (
            <div className="rounded-lg border border-border p-3 bg-surface-2">
              <p className="text-xs font-medium text-foreground mb-1">巨型模块</p>
              <p className="text-xs text-muted-foreground">{metrics.giantModules.length} 个文件超阈值</p>
            </div>
          )}
        </div>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">依赖图</span>
          {graph && (
            <span className="text-xs text-muted-foreground ml-auto">
              节点 {graph.nodes.length} · 边 {graph.edges.length}
            </span>
          )}
        </div>

        {(loading || scanning) && !graph && (
          <div className="p-4 space-y-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}

        {!loading && !scanning && !graph && !error && repoId && (
          <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <Network className="w-8 h-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">尚未扫描依赖图</p>
            <button
              type="button"
              onClick={() => scan()}
              disabled={scanning}
              className="text-xs font-medium text-white bg-ai-blue px-3 py-1.5 rounded-md hover:bg-[oklch(0.55_0.19_240)] transition-colors disabled:opacity-50"
            >
              开始扫描
            </button>
          </div>
        )}

        {graph && (
          <ArchitectureGraphViewer
            graph={graph}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
          />
        )}

        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 border-t border-border">
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">节点列表</div>
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {graph?.nodes.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setSelectedNodeId(n.id)}
                    className={cn(
                      "w-full flex items-center justify-between text-xs px-2 py-1 rounded border",
                      selectedNodeId === n.id
                        ? "border-ai-blue bg-ai-blue/10"
                        : "border-border bg-surface-2",
                    )}
                  >
                    <span className="font-mono text-foreground truncate">{n.label}</span>
                    <span className="text-muted-foreground ml-2 shrink-0">{n.layer}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">模块详情</div>
            {selectedNode ? (
              <div className="text-xs space-y-2 p-3 rounded border border-border bg-surface-2">
                <div>
                  <span className="text-muted-foreground">路径 </span>
                  <span className="font-mono text-foreground">{selectedNode.path ?? selectedNode.id}</span>
                </div>
                <div className="flex gap-3">
                  <span>语言 {selectedNode.language ?? "—"}</span>
                  <span>分层 {selectedNode.layer ?? "—"}</span>
                  <span>行数 {selectedNode.lines ?? "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">入边 ({inbound.length})</span>
                  <ul className="mt-1 font-mono text-[10px] text-muted-foreground max-h-16 overflow-y-auto">
                    {inbound.map((e) => (
                      <li key={`${e.from}-${e.to}`}>{e.from}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <span className="text-muted-foreground">出边 ({outbound.length})</span>
                  <ul className="mt-1 font-mono text-[10px] text-muted-foreground max-h-16 overflow-y-auto">
                    {outbound.map((e) => (
                      <li key={`${e.from}-${e.to}`}>{e.to}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground p-3">点击节点查看详情</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 text-ai-blue" />
            <span className="text-sm font-medium text-foreground">AI 架构分析</span>
          </div>
          <button
            type="button"
            onClick={() => analyze()}
            disabled={!repoId || !graph || aiLoading}
            className="text-xs px-2.5 py-1 rounded-md bg-ai-blue/15 text-ai-blue hover:bg-ai-blue/25 disabled:opacity-50 flex items-center gap-1"
          >
            {aiLoading && <Loader2 className="w-3 h-3 animate-spin" />}
            {aiContent && !aiLoading ? zh.actions.regenerate : zh.actions.analyzeArchitecture}
          </button>
        </div>
        {aiError && <p className="px-4 py-2 text-xs text-risk-high">{aiError}</p>}
        {aiContent && (
          <div className="px-4 py-3 text-sm border-t border-border max-h-96 overflow-y-auto">
            <SummaryMarkdown content={aiContent} />
          </div>
        )}
        {!aiContent && !aiLoading && (
          <p className="px-4 py-3 text-xs text-muted-foreground">完成扫描后，可请求 AI 生成架构建议</p>
        )}
      </div>
    </div>
  )
}
