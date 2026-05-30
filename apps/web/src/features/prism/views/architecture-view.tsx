"use client"

import { BrainCircuit, Loader2, Network } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { ArchitectureDistributionCharts } from "@/features/prism/components/architecture-distribution-charts"
import { ArchitectureModuleExplorer } from "@/features/prism/components/architecture-module-explorer"
import { ArchitectureOverview } from "@/features/prism/components/architecture-overview"
import { ArchitectureRisksPanel } from "@/features/prism/components/architecture-risks-panel"
import { ArchitectureScanProgressBar } from "@/features/prism/components/architecture-scan-progress"
import { ArchitectureTopologyGraph } from "@/features/prism/components/architecture-topology-graph"
import { SummaryMarkdown } from "@/features/prism/components/summary-markdown"
import { useNavigation } from "@/features/prism/contexts/navigation-context"
import { useReposStore } from "@/features/prism/contexts/repos-context"
import { useArchitecture } from "@/hooks/use-architecture"
import { useArchitectureAnalyze } from "@/hooks/use-architecture-analyze"
import { useArchitectureSecurityFindings } from "@/hooks/use-architecture-security-findings"
import { useArchitectureSelection } from "@/hooks/use-architecture-selection"
import { usePersistedViewState } from "@/hooks/use-persisted-view-state"
import { useRepositoryJobs } from "@/hooks/use-repository-jobs"
import type { RiskFocus } from "@/lib/architecture/graph-utils"
import { extendSummary } from "@/lib/architecture/graph-utils"
import { isStatsEligibleRepo } from "@/lib/repos-utils"
import { zh } from "@/lib/i18n/zh"

export function ArchitectureView() {
  const { repoId: urlRepoId, navigate } = useNavigation()
  const { repos: allRepos, loading: reposLoading, error: reposError, refresh: refreshRepos } =
    useReposStore()
  const repos = useMemo(() => allRepos.filter(isStatsEligibleRepo), [allRepos])

  const [archState, setArchState] = usePersistedViewState("architecture", {
    repoId: null as string | null,
    selectedNodeId: null as string | null,
  })
  const repoId = archState.repoId
  const setRepoId = useCallback(
    (id: string | null) => {
      setArchState({ repoId: id })
      if (id) navigate("architecture", { repoId: id })
    },
    [setArchState, navigate],
  )
  const selectedNodeId = archState.selectedNodeId
  const setSelectedNodeId = (id: string | null) => setArchState({ selectedNodeId: id })

  const [riskFocus, setRiskFocus] = useState<RiskFocus>(null)

  useEffect(() => {
    if (urlRepoId && urlRepoId !== repoId) {
      setArchState({ repoId: urlRepoId })
    }
  }, [urlRepoId, repoId, setArchState])

  useEffect(() => {
    if (!repoId && repos.length > 0) {
      const first = repos[0].id
      setArchState({ repoId: first })
      navigate("architecture", { repoId: first })
    }
  }, [repoId, repos, setArchState, navigate])

  const selectedRepo = repos.find((r) => r.id === repoId)
  const securityByFile = useArchitectureSecurityFindings(selectedRepo?.fullName)

  const {
    graph,
    metrics,
    loading,
    scanning,
    scanProgress,
    error,
    scan,
    scanInBackground,
    refetch,
  } = useArchitecture(repoId)

  const { active: jobActive, latest: latestJob, refresh: refreshJob } = useRepositoryJobs(
    repoId,
    Boolean(repoId),
  )

  useEffect(() => {
    if (!jobActive && latestJob?.jobType === "architecture" && latestJob.status === "success") {
      void refetch()
      void refreshRepos()
      refreshJob()
    }
  }, [jobActive, latestJob, refetch, refreshRepos, refreshJob])

  const { selectedNode, inbound, outbound } = useArchitectureSelection(
    graph,
    selectedNodeId,
    setSelectedNodeId,
  )
  const { content: aiContent, loading: aiLoading, error: aiError, analyze } =
    useArchitectureAnalyze(repoId)

  const selectedLabel = selectedRepo?.fullName
  const needsScan = graph?.status === "empty"
  const hasGraphData = (graph?.nodes.length ?? 0) > 0
  const scanReturnedEmpty =
    Boolean(graph?.scannedAt) && !needsScan && !hasGraphData && !loading && !scanning
  const scanSummary = extendSummary(metrics ?? undefined)
  const scanWasTruncated = Boolean(scanSummary?.truncated)

  const handleAnalyze = async () => {
    if (!repoId || aiLoading) return
    if (!hasGraphData) {
      const scanned = await scan()
      if (!scanned?.nodes.length) return
    }
    await analyze()
  }

  const handleRepoChange = (id: string) => {
    setRepoId(id || null)
    setSelectedNodeId(null)
    setRiskFocus(null)
  }

  const backgroundScanning =
    scanning || (jobActive && latestJob?.jobType === "architecture")

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-foreground">架构分析</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{zh.pageSubtitle.architecture}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void scanInBackground()}
            disabled={!repoId || backgroundScanning}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground bg-surface-2 border border-border rounded-md hover:bg-surface-3 disabled:opacity-50"
          >
            {zh.architecture.scanInBackground}
          </button>
          <button
            type="button"
            onClick={() => void scan()}
            disabled={!repoId || backgroundScanning}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-ai-blue rounded-md hover:bg-[oklch(0.55_0.19_240)] transition-colors disabled:opacity-50"
          >
            {backgroundScanning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Network className="w-3.5 h-3.5" />
            )}
            {zh.architecture.rescan}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-border p-4 bg-surface-2 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium text-foreground">{zh.architecture.selectRepo}</div>
          {reposError && <p className="text-sm text-risk-high">{reposError}</p>}
        </div>
        <select
          value={repoId ?? ""}
          onChange={(e) => handleRepoChange(e.target.value)}
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
        {selectedLabel && (
          <div className="text-xs text-muted-foreground">
            {zh.architecture.current}：{selectedLabel}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-risk-high/30 bg-risk-high/10 px-4 py-3 text-sm text-risk-high">
          {error}
        </div>
      )}

      {(scanning && scanProgress) || (jobActive && latestJob?.jobType === "architecture") ? (
        <ArchitectureScanProgressBar
          progress={
            scanProgress ?? {
              phase: "prepare",
              percent: latestJob?.progress ?? 10,
              message: latestJob?.message ?? "后台扫描进行中…",
            }
          }
        />
      ) : null}

      {!loading && !backgroundScanning && needsScan && repoId && (
        <div className="rounded-lg border border-ai-blue/30 bg-ai-blue/10 px-4 py-3 text-sm text-foreground">
          {zh.architecture.scanBeforeAi}
        </div>
      )}

      {scanReturnedEmpty && (
        <div className="rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm text-muted-foreground">
          {zh.architecture.scanEmpty}
        </div>
      )}

      {scanWasTruncated && hasGraphData && (
        <div className="rounded-lg border border-ai-blue/30 bg-ai-blue/5 px-4 py-3 text-xs text-muted-foreground">
          {zh.architecture.scanTruncated}
          {scanSummary?.filesDiscovered != null && (
            <span className="ml-1 text-foreground">
              （仓库共 {scanSummary.filesDiscovered} 个源文件，已分析 {scanSummary.fileCount} 个）
            </span>
          )}
        </div>
      )}

      <ArchitectureOverview graph={graph} metrics={metrics ?? undefined} loading={loading} />

      {hasGraphData && graph && metrics && (
        <ArchitectureDistributionCharts nodes={graph.nodes} metrics={metrics} />
      )}

      {hasGraphData && graph && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-3 space-y-3">
            <ArchitectureRisksPanel
              graph={graph}
              riskFocus={riskFocus}
              onRiskFocus={setRiskFocus}
              onSelectNode={setSelectedNodeId}
            />
            <ArchitectureModuleExplorer
              graph={graph}
              selectedNodeId={selectedNodeId}
              selectedNode={selectedNode}
              inbound={inbound}
              outbound={outbound}
              onSelectNode={setSelectedNodeId}
              securityCountByFile={securityByFile}
            />
          </div>

          <div className="xl:col-span-5 space-y-3">
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="px-4 py-2 bg-surface-2 border-b border-border flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {zh.architecture.topology}
                </span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {zh.architecture.graphSummary(graph.nodes.length, graph.edges.length)}
                </span>
              </div>
              <ArchitectureTopologyGraph
                graph={graph}
                selectedNodeId={selectedNodeId}
                riskFocus={riskFocus}
                onSelectNode={setSelectedNodeId}
                securityCountByFile={securityByFile}
              />
            </div>
          </div>

          <div className="xl:col-span-4">
            <div className="rounded-lg border border-border overflow-hidden sticky top-4">
              <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="w-4 h-4 text-ai-blue" />
                  <span className="text-sm font-medium text-foreground">
                    {zh.architecture.aiAnalysis}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleAnalyze()}
                  disabled={!repoId || aiLoading || backgroundScanning}
                  className="text-xs px-2.5 py-1 rounded-md bg-ai-blue/15 text-ai-blue hover:bg-ai-blue/25 disabled:opacity-50 flex items-center gap-1"
                >
                  {(aiLoading || backgroundScanning) && (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  )}
                  {aiContent && !aiLoading ? zh.actions.regenerate : zh.actions.analyzeArchitecture}
                </button>
              </div>

              {hasGraphData && metrics && (metrics.cycles.length > 0 || metrics.layerViolations.length > 0) && (
                <div className="px-4 py-2 border-b border-border text-[10px] text-muted-foreground bg-surface-1">
                  结构化风险：
                  {metrics.cycles.length > 0 && (
                    <span className="text-risk-high ml-1">{metrics.cycles.length} 环</span>
                  )}
                  {metrics.layerViolations.length > 0 && (
                    <span className="text-amber-400 ml-1">
                      {metrics.layerViolations.length} 分层违规
                    </span>
                  )}
                  {metrics.giantModules.length > 0 && (
                    <span className="ml-1">{metrics.giantModules.length} 巨型模块</span>
                  )}
                  <span className="block mt-1">下方 AI 报告基于同一依赖图生成。</span>
                </div>
              )}

              {needsScan && (
                <p className="px-4 py-2 text-xs text-muted-foreground border-b border-border">
                  {zh.architecture.scanBeforeAi}
                </p>
              )}
              {needsScan && aiContent && !aiLoading && (
                <p className="px-4 py-2 text-xs text-amber-400/90 border-b border-border">
                  以下为基于空依赖图生成的历史结果，请重新扫描后再生成。
                </p>
              )}
              {aiError && <p className="px-4 py-2 text-xs text-risk-high">{aiError}</p>}
              {aiLoading && (
                <div className="px-4 py-3 border-b border-border space-y-2">
                  <p className="text-xs text-ai-blue flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {zh.architecture.aiGenerating}
                  </p>
                  {aiContent ? (
                    <div className="text-sm max-h-96 overflow-y-auto">
                      <SummaryMarkdown content={aiContent} />
                    </div>
                  ) : (
                    <Skeleton className="h-24 w-full" />
                  )}
                </div>
              )}
              {aiContent && !aiLoading && (
                <div className="px-4 py-3 text-sm max-h-[min(70vh,520px)] overflow-y-auto">
                  <SummaryMarkdown content={aiContent} />
                </div>
              )}
              {!aiContent && !aiLoading && (
                <p className="px-4 py-3 text-xs text-muted-foreground">
                  {needsScan || !hasGraphData
                    ? zh.architecture.scanBeforeAi
                    : zh.architecture.aiAnalyzeHint}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {(loading || backgroundScanning) && !graph && !scanProgress && !jobActive && (
        <div className="p-4 space-y-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      )}

      {!loading && !backgroundScanning && needsScan && repoId && (
        <div className="flex flex-col items-center justify-center gap-3 p-10 text-center rounded-lg border border-border">
          <Network className="w-8 h-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">{zh.architecture.notScannedYet}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void scan()}
              disabled={backgroundScanning}
              className="text-xs font-medium text-white bg-ai-blue px-3 py-1.5 rounded-md"
            >
              {zh.architecture.startScan}
            </button>
            <button
              type="button"
              onClick={() => void scanInBackground()}
              disabled={backgroundScanning}
              className="text-xs font-medium text-muted-foreground bg-surface-2 border border-border px-3 py-1.5 rounded-md"
            >
              {zh.architecture.scanInBackground}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
