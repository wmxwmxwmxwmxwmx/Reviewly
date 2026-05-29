"use client"

import { motion } from "framer-motion"
import {
  Shield,
  AlertTriangle,
  AlertOctagon,
  ShieldCheck,
  Lock,
  Key,
  Bug,
  FileWarning,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Filter,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useNavigation } from "@/features/prism/contexts/navigation-context"
import { useSecurity } from "@/hooks/use-security"

const severityConfig = {
  critical: { color: "text-[oklch(0.55_0.22_27)]", bg: "bg-[oklch(0.55_0.22_27/0.1)]", label: "严重" },
  high: { color: "text-risk-high", bg: "bg-[oklch(0.62_0.21_32/0.1)]", label: "高危" },
  medium: { color: "text-risk-medium", bg: "bg-[oklch(0.75_0.15_85/0.1)]", label: "中危" },
  low: { color: "text-muted-foreground", bg: "bg-surface-3", label: "低危" },
}

const statusConfig = {
  open: { color: "text-risk-high", bg: "bg-[oklch(0.62_0.21_32/0.15)]", label: "待处理" },
  "in-progress": { color: "text-ai-blue", bg: "bg-[oklch(0.62_0.19_240/0.15)]", label: "处理中" },
  resolved: { color: "text-risk-low", bg: "bg-[oklch(0.62_0.17_148/0.15)]", label: "已解决" },
}

export function SecurityView() {
  const { navigate } = useNavigation()
  const { findings, stats, loading, error } = useSecurity()

  const vulnerabilities =
    findings.map((f) => ({
      id: f.id,
      severity: f.severity,
      title: f.title,
      file: f.file,
      line: f.line,
      cwe: f.cweId ?? "—",
      // 当前后端尚未提供严格的“in-progress”语义；仅展示已解决/待处理。
      status: (f.status === "resolved" ? "resolved" : "open") as "open" | "in-progress" | "resolved",
      discovered: "来自分析",
      description: f.description ?? "",
    }))

  const securityMetrics = [
    {
      label: "安全评分",
      value: stats ? String(Math.max(0, 100 - stats.critical * 15)) : "72",
      change: "+3",
      trend: "up" as const,
      suffix: "/100",
    },
    {
      label: "开放漏洞",
      value: stats ? String(stats.openFindings) : "5",
      change: "-2",
      trend: "down" as const,
      suffix: "",
    },
    {
      label: "严重问题",
      value: stats ? String(stats.critical) : "1",
      change: "0",
      trend: "neutral" as const,
      suffix: "",
    },
    {
      label: "高危问题",
      value: stats ? String(stats.high) : "2",
      change: "0",
      trend: "neutral" as const,
      suffix: "",
    },
  ]

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">安全中心</h1>
          <p className="text-sm text-muted-foreground mt-0.5">代码安全漏洞检测与修复建议</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground bg-surface-2 rounded-md hover:bg-surface-3 transition-colors">
            <Filter className="w-3.5 h-3.5" />
            筛选
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-ai-blue rounded-md hover:bg-[oklch(0.55_0.19_240)] transition-colors">
            <Shield className="w-3.5 h-3.5" />
            开始扫描
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-risk-high">{error}</p>}

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-3">
        {securityMetrics.map((metric) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-lg bg-surface-2 border border-border"
          >
            <div className="text-xs text-muted-foreground">{metric.label}</div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-semibold text-foreground">{metric.value}</span>
              <span className="text-sm text-muted-foreground">{metric.suffix}</span>
            </div>
            <div className={cn(
              "flex items-center gap-1 mt-1 text-xs",
              metric.trend === "up" ? "text-risk-low" : metric.trend === "down" ? "text-risk-low" : "text-muted-foreground"
            )}>
              {metric.trend === "up" && <TrendingUp className="w-3 h-3" />}
              {metric.trend === "down" && <TrendingDown className="w-3 h-3" />}
              <span>{metric.change} 较上周</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Vulnerabilities List */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-risk-high" />
            <span className="text-sm font-medium text-foreground">漏洞列表</span>
            <span className="text-xs text-muted-foreground">({vulnerabilities.length})</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[oklch(0.55_0.22_27)]" />
              严重 1
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-risk-high" />
              高危 2
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-risk-medium" />
              中危 1
            </span>
          </div>
        </div>

        <div className="divide-y divide-border">
          {loading && (
            <p className="px-4 py-6 text-sm text-muted-foreground">加载中…</p>
          )}
          {!loading && vulnerabilities.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground">暂无安全发现。</p>
          )}
          {!loading &&
            vulnerabilities.map((vuln, idx) => {
            const severity = severityConfig[vuln.severity as keyof typeof severityConfig]
            const status = statusConfig[vuln.status as keyof typeof statusConfig]
            return (
              <motion.div
                key={vuln.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.05 }}
                role="button"
                tabIndex={0}
                onClick={() => navigate("ai-review")}
                onKeyDown={(e) => e.key === "Enter" && navigate("ai-review")}
                className="px-4 py-3 hover:bg-surface-2/50 transition-colors cursor-pointer group"
              >
                <div className="flex items-start gap-3">
                  <div className={cn("p-1.5 rounded", severity.bg)}>
                    {vuln.severity === "critical" ? (
                      <AlertOctagon className={cn("w-4 h-4", severity.color)} />
                    ) : vuln.severity === "high" ? (
                      <AlertTriangle className={cn("w-4 h-4", severity.color)} />
                    ) : vuln.severity === "medium" ? (
                      <Bug className={cn("w-4 h-4", severity.color)} />
                    ) : (
                      <FileWarning className={cn("w-4 h-4", severity.color)} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{vuln.title}</span>
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", severity.bg, severity.color)}>
                        {severity.label}
                      </span>
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", status.bg, status.color)}>
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="font-mono">{vuln.id}</span>
                      <span>·</span>
                      <span className="font-mono">{vuln.cwe}</span>
                      <span>·</span>
                      <span>{vuln.file}:{vuln.line}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">{vuln.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">{vuln.discovered}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Security Recommendations */}
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-ai-blue" />
          <span className="text-sm font-medium text-foreground">安全建议</span>
        </div>
        <p className="text-sm text-muted-foreground">
          当前页面基于结构化 findings 展示风险点；如需“可执行修复建议”，可在后续阶段从 engine/规则输出更多字段后再填充。
        </p>
      </div>
    </div>
  )
}
