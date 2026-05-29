"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  BrainCircuit,
  AlertOctagon,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  Loader2,
  GitMerge,
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  Cpu,
  Zap,
  TriangleAlert,
  Flame,
  ScrollText,
  Building2,
  ExternalLink,
} from "lucide-react"
import { useAISettings } from "@/components/prism/ai-settings-context"
import { cn } from "@/lib/utils"
import { mockRisks, mockGovernanceRules, mockIncidents, type RiskItem } from "@/components/prism/mock-data"

type PanelTab = "stream" | "risks" | "merge" | "governance" | "incidents"

const tabs: { key: PanelTab; label: string; icon: React.ElementType; badge?: string }[] = [
  { key: "stream", label: "AI 流", icon: BrainCircuit },
  { key: "risks", label: "风险", icon: Shield, badge: "6" },
  { key: "merge", label: "合并", icon: GitMerge },
  { key: "governance", label: "治理", icon: ScrollText, badge: "3" },
  { key: "incidents", label: "事故", icon: Flame, badge: "3" },
]

const severityConfig = {
  critical: { icon: AlertOctagon, color: "text-risk-critical", bg: "bg-[oklch(0.55_0.22_27/0.10)]", border: "border-[oklch(0.55_0.22_27/0.30)]", label: "严重" },
  high: { icon: AlertTriangle, color: "text-risk-high", bg: "bg-[oklch(0.65_0.18_46/0.10)]", border: "border-[oklch(0.65_0.18_46/0.30)]", label: "高危" },
  medium: { icon: TriangleAlert, color: "text-risk-medium", bg: "bg-[oklch(0.75_0.16_83/0.10)]", border: "border-[oklch(0.75_0.16_83/0.30)]", label: "中危" },
  low: { icon: Info, color: "text-risk-low", bg: "bg-[oklch(0.62_0.17_148/0.10)]", border: "border-[oklch(0.62_0.17_148/0.30)]", label: "低危" },
}

// ── AI Stream Panel ────────────────────────────────────────────────────────────
const streamLines = [
  { type: "info", text: "正在加载 PR 上下文... 47 文件，5113 行变更" },
  { type: "step", text: "分析安全漏洞模式..." },
  { type: "finding", text: "[Critical] payment_cache.go:145 — 竞态条件检测" },
  { type: "finding", text: "[Critical] query_builder.go:89 — SQL 注入模式匹配" },
  { type: "step", text: "分析性能影响..." },
  { type: "step", text: "检测 API Breaking Changes..." },
  { type: "finding", text: "[Warning] PaymentCallback.legacy_txn_id 字段已移除" },
  { type: "step", text: "执行工程治理规则检查..." },
  { type: "finding", text: "[Violation] processor.go:312 — 禁止打印 Token" },
  { type: "done", text: "分析完成 · 发现 6 个风险，3 个违规" },
]

function AIStreamPanel({ analyzing }: { analyzing: boolean }) {
  const { settings, monthlyUsage, usageRecords } = useAISettings()
  const latestUsage = usageRecords[0]

  return (
    <div className="space-y-3">
      {/* Model Info */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "模型", value: settings.model, icon: Cpu },
          { label: "延迟", value: latestUsage ? `${(latestUsage.latencyMs / 1000).toFixed(2)}s` : "--", icon: Zap },
          { label: "Token 用量", value: latestUsage ? latestUsage.totalTokens.toLocaleString() : "0", icon: BrainCircuit },
          { label: "本月成本", value: `¥${monthlyUsage.costCny.toFixed(2)}`, icon: Info },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-surface-2 border border-border">
            <item.icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] text-muted-foreground">{item.label}</div>
              <div className="text-[11px] font-semibold text-foreground font-mono truncate">{item.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Context Window */}
      <div className="px-3 py-2 rounded-md bg-surface-2 border border-border">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-muted-foreground">Context Window</span>
          <span className="text-[10px] font-mono text-foreground">67K / 200K</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-4 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-ai-blue"
            initial={{ width: 0 }}
            animate={{ width: "33.5%" }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Stream Log */}
      <div className="rounded-md border border-border bg-surface-1 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <div className={cn("w-2 h-2 rounded-full", analyzing ? "bg-ai-blue glow-pulse" : "bg-risk-low")} />
          <span className="text-[10px] font-semibold text-foreground">推理日志</span>
          {analyzing && (
            <div className="flex items-center gap-1 ml-1">
              <div className="thinking-dot w-1 h-1 rounded-full bg-ai-blue" />
              <div className="thinking-dot w-1 h-1 rounded-full bg-ai-blue" />
              <div className="thinking-dot w-1 h-1 rounded-full bg-ai-blue" />
            </div>
          )}
        </div>
        <div className="p-2 space-y-1 max-h-52 overflow-y-auto font-mono text-[10px]">
          {streamLines.map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: i * 0.06 }}
              className={cn(
                "flex items-start gap-1.5 px-2 py-1 rounded",
                line.type === "finding" ? "bg-[oklch(0.55_0.22_27/0.06)] text-risk-high" :
                line.type === "done" ? "bg-[oklch(0.62_0.17_148/0.06)] text-risk-low" :
                line.type === "step" ? "text-ai-blue" : "text-muted-foreground"
              )}
            >
              <span className="opacity-50 shrink-0">{String(i).padStart(2, "0")}</span>
              <span>{line.text}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Risk Panel ────────────────────────────────────────────────────────────────
function RiskCard({ risk, index }: { risk: RiskItem; index: number }) {
  const [expanded, setExpanded] = useState(index < 2)
  const cfg = severityConfig[risk.severity]

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn("rounded-md border overflow-hidden", cfg.border)}
    >
      <button
        className={cn("w-full flex items-start gap-2.5 px-3 py-2.5 text-left", expanded ? cfg.bg : "hover:bg-accent transition-colors")}
        onClick={() => setExpanded(!expanded)}
      >
        <cfg.icon className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", cfg.color)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={cn("text-[9px] font-bold uppercase tracking-wider", cfg.color)}>{cfg.label}</span>
            <span className="text-[9px] text-muted-foreground">{risk.type}</span>
            {risk.cweId && (
              <span className="text-[9px] px-1 rounded bg-surface-4 text-muted-foreground font-mono">{risk.cweId}</span>
            )}
          </div>
          <p className="text-[11px] font-medium text-foreground truncate">{risk.title}</p>
          <p className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">{risk.file}:{risk.line}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-[9px] text-muted-foreground">{risk.confidence}%</span>
          {expanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border">
              <p className="text-[11px] text-muted-foreground leading-relaxed">{risk.description}</p>
              <div className="space-y-1.5">
                <div className="text-[10px] text-muted-foreground">
                  <span className="text-foreground font-medium">根因：</span> {risk.rootCause}
                </div>
                {risk.callChain && (
                  <div className="text-[10px] font-mono text-muted-foreground px-2 py-1.5 rounded bg-surface-2 border border-border">
                    {risk.callChain.join(" → ")}
                  </div>
                )}
                <div className={cn("text-[10px] px-2 py-1.5 rounded border", cfg.bg, cfg.border, cfg.color)}>
                  <span className="font-medium">修复建议：</span> {risk.fixSuggestion}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function RisksPanel() {
  const criticalCount = mockRisks.filter(r => r.severity === "critical").length
  const highCount = mockRisks.filter(r => r.severity === "high").length

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-1.5">
        {(["critical", "high", "medium", "low"] as const).map((s) => {
          const count = mockRisks.filter(r => r.severity === s).length
          const cfg = severityConfig[s]
          return (
            <div key={s} className={cn("flex flex-col items-center gap-0.5 py-2 rounded-md border", cfg.bg, cfg.border)}>
              <span className={cn("text-base font-bold tabular-nums", cfg.color)}>{count}</span>
              <span className={cn("text-[9px]", cfg.color)}>{cfg.label}</span>
            </div>
          )
        })}
      </div>

      {/* Risk List */}
      <div className="space-y-2">
        {mockRisks.map((risk, i) => (
          <RiskCard key={risk.id} risk={risk} index={i} />
        ))}
      </div>

      {/* Business Risk */}
      <div className="rounded-md border border-border overflow-hidden">
        <div className="px-3 py-2 border-b border-border bg-surface-2">
          <span className="text-[11px] font-semibold text-foreground">业务风险中心</span>
        </div>
        <div className="p-2.5 space-y-1.5">
          {[
            { module: "payment/", risk: "高", color: "text-risk-critical", glow: "bg-[oklch(0.55_0.22_27/0.06)]" },
            { module: "auth/", risk: "高", color: "text-risk-high", glow: "bg-[oklch(0.65_0.18_46/0.06)]" },
            { module: "gateway/", risk: "中", color: "text-risk-medium", glow: "bg-[oklch(0.75_0.16_83/0.06)]" },
            { module: "billing/", risk: "高", color: "text-risk-high", glow: "bg-[oklch(0.65_0.18_46/0.06)]" },
          ].map((item) => (
            <div key={item.module} className={cn("flex items-center gap-2 px-2 py-1.5 rounded", item.glow)}>
              <Building2 className={cn("w-3.5 h-3.5 shrink-0", item.color)} />
              <span className="flex-1 text-[11px] font-mono text-foreground">{item.module}</span>
              <span className={cn("text-[10px] font-semibold", item.color)}>{item.risk}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Merge Panel ───────────────────────────────────────────────────────────────
function MergePanel() {
  const checks = [
    { label: "CI / 构建通过", status: "pass", detail: "所有 312 个测试通过" },
    { label: "必需 Reviewer 审批", status: "fail", detail: "需要 security-team 审批" },
    { label: "严重安全漏洞修复", status: "fail", detail: "2 处 Critical 未修复" },
    { label: "工程治理合规", status: "fail", detail: "3 条规则违规未处理" },
    { label: "Breaking Change 记录", status: "warn", detail: "CHANGELOG 未更新" },
    { label: "性能回归测试", status: "pass", detail: "基准测试 +12% 提升" },
    { label: "回滚方案确认", status: "warn", detail: "需要 Ops 确认回滚脚本" },
  ]

  const iconMap = {
    pass: <CheckCircle2 className="w-4 h-4 text-risk-low shrink-0" />,
    fail: <XCircle className="w-4 h-4 text-risk-critical shrink-0" />,
    warn: <AlertTriangle className="w-4 h-4 text-risk-high shrink-0" />,
    pending: <Clock className="w-4 h-4 text-muted-foreground shrink-0" />,
  }

  const blockingCount = checks.filter(c => c.status === "fail").length

  return (
    <div className="space-y-3">
      <div className={cn(
        "flex items-center gap-2.5 px-3 py-2.5 rounded-lg border",
        blockingCount > 0
          ? "bg-[oklch(0.55_0.22_27/0.08)] border-[oklch(0.55_0.22_27/0.3)] text-risk-critical"
          : "bg-[oklch(0.62_0.17_148/0.08)] border-[oklch(0.62_0.17_148/0.3)] text-risk-low"
      )}>
        {blockingCount > 0 ? <XCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
        <div className="flex-1">
          <div className="text-xs font-semibold">
            {blockingCount > 0 ? `${blockingCount} 项阻塞合并` : "可以合并"}
          </div>
          <div className="text-[10px] opacity-80">
            发布可信度：{blockingCount > 0 ? "32%" : "95%"}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        {checks.map((check) => (
          <div key={check.label} className="flex items-start gap-2.5 px-2.5 py-2 rounded-md bg-surface-2 border border-border">
            {iconMap[check.status as keyof typeof iconMap]}
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-medium text-foreground">{check.label}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{check.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Governance Panel ──────────────────────────────────────────────────────────
function GovernancePanel() {
  return (
    <div className="space-y-2">
      <div className="text-[11px] text-muted-foreground pb-1">组织工程规范检查</div>
      {mockGovernanceRules.map((rule, i) => (
        <motion.div
          key={rule.id}
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className={cn(
            "flex items-start gap-2.5 px-3 py-2.5 rounded-md border",
            rule.violated
              ? "bg-[oklch(0.55_0.22_27/0.06)] border-[oklch(0.55_0.22_27/0.25)]"
              : "bg-surface-2 border-border"
          )}
        >
          {rule.violated ? (
            <XCircle className="w-3.5 h-3.5 text-risk-critical shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-risk-low shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-foreground">{rule.rule}</div>
            {rule.violated && rule.file && (
              <div className="text-[10px] font-mono text-risk-high mt-0.5 truncate">{rule.file}</div>
            )}
          </div>
          <span className={cn(
            "text-[9px] px-1.5 py-0.5 rounded shrink-0",
            rule.severity === "critical" ? "bg-[oklch(0.55_0.22_27/0.15)] text-risk-critical" :
            rule.severity === "high" ? "bg-[oklch(0.65_0.18_46/0.15)] text-risk-high" :
            "bg-surface-4 text-muted-foreground"
          )}>
            {rule.severity}
          </span>
        </motion.div>
      ))}
    </div>
  )
}

// ── Incidents Panel ───────────────────────────────────────────────────────────
function IncidentsPanel() {
  return (
    <div className="space-y-3">
      <div className="text-[11px] text-muted-foreground">与本次变更相似的历史事故</div>
      {mockIncidents.map((incident, i) => (
        <motion.div
          key={incident.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07 }}
          className="rounded-md border border-border bg-surface-2 overflow-hidden"
        >
          <div className="px-3 py-2.5">
            <div className="flex items-start gap-2 mb-1.5">
              <Flame className="w-3.5 h-3.5 text-risk-high mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-foreground leading-relaxed">{incident.title}</p>
              </div>
            </div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-muted-foreground">{incident.date}</span>
              <div className="flex items-center gap-1">
                <div
                  className={cn(
                    "h-1 rounded-full",
                    incident.similarity >= 90 ? "bg-risk-critical" :
                    incident.similarity >= 80 ? "bg-risk-high" : "bg-risk-medium"
                  )}
                  style={{ width: `${incident.similarity * 0.6}px` }}
                />
                <span className={cn(
                  "text-[10px] font-semibold",
                  incident.similarity >= 90 ? "text-risk-critical" :
                  incident.similarity >= 80 ? "text-risk-high" : "text-risk-medium"
                )}>
                  {incident.similarity}% 相似
                </span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mb-2">{incident.impact}</p>
            <a href="#" className="inline-flex items-center gap-1 text-[10px] text-ai-blue hover:underline">
              查看 Postmortem <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────────
interface AIPanelProps {
  analyzing: boolean
}

export function AIPanel({ analyzing }: AIPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>("risks")

  return (
    <aside className="w-[390px] shrink-0 flex flex-col h-screen border-l border-border bg-[oklch(0.125_0.004_264)]">
      {/* Panel Header */}
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-border">
        <BrainCircuit className="w-4 h-4 text-ai-blue shrink-0" />
        <span className="text-sm font-semibold text-foreground">AI 分析面板</span>
        {analyzing && (
          <div className="flex items-center gap-1 ml-1">
            <div className="thinking-dot w-1.5 h-1.5 rounded-full bg-ai-blue" />
            <div className="thinking-dot w-1.5 h-1.5 rounded-full bg-ai-blue" />
            <div className="thinking-dot w-1.5 h-1.5 rounded-full bg-ai-blue" />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border px-2 gap-0.5 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "relative flex items-center gap-1.5 px-2.5 py-2.5 text-[11px] font-medium whitespace-nowrap transition-colors",
              activeTab === tab.key
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="w-3.5 h-3.5 shrink-0" />
            {tab.label}
            {tab.badge && (
              <span className={cn(
                "text-[9px] px-1 py-0.5 rounded-full font-semibold",
                activeTab === tab.key
                  ? "bg-[oklch(0.62_0.19_240/0.2)] text-ai-blue"
                  : "bg-surface-3 text-muted-foreground"
              )}>
                {tab.badge}
              </span>
            )}
            {activeTab === tab.key && (
              <motion.div
                layoutId="panel-tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-ai-blue rounded-full"
              />
            )}
          </button>
        ))}
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "stream" && <AIStreamPanel analyzing={analyzing} />}
            {activeTab === "risks" && <RisksPanel />}
            {activeTab === "merge" && <MergePanel />}
            {activeTab === "governance" && <GovernancePanel />}
            {activeTab === "incidents" && <IncidentsPanel />}
          </motion.div>
        </AnimatePresence>
      </div>
    </aside>
  )
}
