"use client"

import { motion } from "framer-motion"
import {
  Gauge,
  Clock,
  Zap,
  Database,
  Server,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ArrowRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { usePerformance } from "@/hooks/use-performance"

const performanceMetrics = [
  { label: "页面加载时间", value: "1.8", suffix: "s", target: "< 2s", status: "good", change: "-0.3s" },
  { label: "API 响应时间", value: "245", suffix: "ms", target: "< 300ms", status: "good", change: "-15ms" },
  { label: "内存使用", value: "78", suffix: "%", target: "< 85%", status: "warning", change: "+5%" },
  { label: "CPU 使用率", value: "42", suffix: "%", target: "< 70%", status: "good", change: "-8%" },
]

const slowQueries = [
  { query: "SELECT * FROM orders WHERE user_id = ?", time: "2.4s", file: "src/api/orders.ts:45", impact: "high" },
  { query: "SELECT * FROM products JOIN categories...", time: "1.8s", file: "src/api/products.ts:112", impact: "high" },
  { query: "UPDATE users SET last_login = ? WHERE...", time: "0.9s", file: "src/api/auth.ts:78", impact: "medium" },
  { query: "SELECT COUNT(*) FROM analytics WHERE...", time: "0.7s", file: "src/api/stats.ts:23", impact: "low" },
]

const bundleAnalysis = [
  { name: "node_modules", size: "2.4 MB", percent: 65, color: "bg-risk-high" },
  { name: "src/components", size: "680 KB", percent: 18, color: "bg-ai-blue" },
  { name: "src/lib", size: "320 KB", percent: 9, color: "bg-risk-medium" },
  { name: "其他", size: "290 KB", percent: 8, color: "bg-surface-4" },
]

const suggestions = [
  { severity: "high", title: "优化数据库查询", description: "orders 表缺少 user_id 索引，导致全表扫描", action: "添加索引" },
  { severity: "high", title: "代码分割", description: "检测到 3 个大型依赖可进行动态导入", action: "查看详情" },
  { severity: "medium", title: "图片优化", description: "发现 12 张未压缩图片，总计 4.2MB", action: "自动优化" },
  { severity: "low", title: "缓存策略", description: "API 响应未设置缓存头，建议添加 Cache-Control", action: "应用建议" },
]

export function PerformanceView() {
  const { stats, findings, loading, error } = usePerformance()

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">性能分析</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {stats
              ? `开放发现 ${stats.openFindings} · 影响 ${stats.avgImpact}`
              : "应用性能监控与优化建议"}
          </p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-ai-blue rounded-md hover:bg-[oklch(0.55_0.19_240)] transition-colors">
          <Gauge className="w-3.5 h-3.5" />
          运行性能测试
        </button>
      </div>

      {error && <p className="text-sm text-risk-high">{error}</p>}

      {!loading && findings.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center gap-2">
            <Zap className="w-4 h-4 text-risk-medium" />
            <span className="text-sm font-medium text-foreground">API 性能发现</span>
          </div>
          <div className="divide-y divide-border">
            {findings.map((f) => (
              <div key={f.id} className="px-4 py-3">
                <div className="text-sm font-medium text-foreground">{f.title}</div>
                <div className="text-xs text-muted-foreground font-mono mt-1">
                  {f.file}:{f.line}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-3">
        {performanceMetrics.map((metric, idx) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="p-4 rounded-lg bg-surface-2 border border-border"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{metric.label}</span>
              {metric.status === "good" ? (
                <CheckCircle2 className="w-4 h-4 text-risk-low" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-risk-medium" />
              )}
            </div>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-2xl font-semibold text-foreground">{metric.value}</span>
              <span className="text-sm text-muted-foreground">{metric.suffix}</span>
            </div>
            <div className="flex items-center justify-between mt-2 text-xs">
              <span className="text-muted-foreground">目标: {metric.target}</span>
              <span className={cn(
                "flex items-center gap-1",
                metric.change.startsWith("-") ? "text-risk-low" : "text-risk-medium"
              )}>
                {metric.change.startsWith("-") ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                {metric.change}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Slow Queries */}
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center gap-2">
            <Database className="w-4 h-4 text-risk-high" />
            <span className="text-sm font-medium text-foreground">慢查询分析</span>
          </div>
          <div className="divide-y divide-border">
            {slowQueries.map((query, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.05 }}
                className="px-4 py-3 hover:bg-surface-2/50 transition-colors cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <code className="text-xs text-foreground font-mono block truncate">{query.query}</code>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                      <span className="font-mono">{query.file}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-xs font-medium px-1.5 py-0.5 rounded",
                      query.impact === "high" ? "bg-[oklch(0.62_0.21_32/0.15)] text-risk-high" :
                      query.impact === "medium" ? "bg-[oklch(0.75_0.15_85/0.15)] text-risk-medium" : "bg-surface-3 text-muted-foreground"
                    )}>
                      {query.time}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bundle Analysis */}
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center gap-2">
            <Server className="w-4 h-4 text-ai-blue" />
            <span className="text-sm font-medium text-foreground">Bundle 分析</span>
            <span className="text-xs text-muted-foreground ml-auto">总计: 3.69 MB</span>
          </div>
          <div className="p-4 space-y-3">
            {bundleAnalysis.map((item, idx) => (
              <motion.div
                key={item.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.05 }}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-foreground">{item.name}</span>
                  <span className="text-muted-foreground">{item.size} ({item.percent}%)</span>
                </div>
                <div className="h-2 rounded-full bg-surface-3 overflow-hidden">
                  <motion.div
                    className={cn("h-full rounded-full", item.color)}
                    initial={{ width: 0 }}
                    animate={{ width: `${item.percent}%` }}
                    transition={{ duration: 0.8, delay: idx * 0.1 }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Optimization Suggestions */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center gap-2">
          <Zap className="w-4 h-4 text-risk-medium" />
          <span className="text-sm font-medium text-foreground">优化建议</span>
        </div>
        <div className="divide-y divide-border">
          {suggestions.map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: idx * 0.05 }}
              className="px-4 py-3 flex items-center gap-3"
            >
              <div className={cn(
                "p-1.5 rounded",
                item.severity === "high" ? "bg-[oklch(0.62_0.21_32/0.15)]" :
                item.severity === "medium" ? "bg-[oklch(0.75_0.15_85/0.15)]" : "bg-surface-3"
              )}>
                {item.severity === "high" ? (
                  <AlertTriangle className="w-4 h-4 text-risk-high" />
                ) : item.severity === "medium" ? (
                  <AlertTriangle className="w-4 h-4 text-risk-medium" />
                ) : (
                  <Zap className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-foreground">{item.title}</span>
                <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
              </div>
              <button className="flex items-center gap-1 text-xs text-ai-blue hover:underline">
                {item.action}
                <ArrowRight className="w-3 h-3" />
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
