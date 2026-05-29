"use client"

import { motion } from "framer-motion"
import { 
  Network, 
  Box, 
  ArrowRight, 
  AlertTriangle,
  CheckCircle2,
  Layers,
  GitBranch,
  FileCode,
} from "lucide-react"
import { cn } from "@/lib/utils"

const modules = [
  { name: "auth-service", deps: 4, dependents: 8, complexity: "low", health: 92 },
  { name: "api-gateway", deps: 6, dependents: 12, complexity: "high", health: 68 },
  { name: "order-module", deps: 8, dependents: 5, complexity: "medium", health: 75 },
  { name: "user-service", deps: 3, dependents: 10, complexity: "low", health: 88 },
  { name: "notification", deps: 5, dependents: 2, complexity: "low", health: 95 },
]

const circularDeps = [
  { from: "order-module", to: "inventory-service", via: "product-service" },
  { from: "user-service", to: "notification", via: "email-service" },
]

const layerViolations = [
  { file: "src/api/users.ts", violation: "直接访问数据层", suggestion: "通过 Service 层访问" },
  { file: "src/components/OrderList.tsx", violation: "包含业务逻辑", suggestion: "提取到 hooks 或 utils" },
]

export function ArchitectureView() {
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

      {/* Module Health */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center gap-2">
          <Box className="w-4 h-4 text-ai-blue" />
          <span className="text-sm font-medium text-foreground">模块健康度</span>
        </div>
        <div className="divide-y divide-border">
          {modules.map((mod, idx) => (
            <motion.div
              key={mod.name}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: idx * 0.05 }}
              className="px-4 py-3 flex items-center gap-4"
            >
              <div className="w-32">
                <span className="text-sm font-mono text-foreground">{mod.name}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-1">
                <span>依赖: {mod.deps}</span>
                <span>被依赖: {mod.dependents}</span>
                <span className={cn(
                  "px-1.5 py-0.5 rounded",
                  mod.complexity === "low" ? "bg-[oklch(0.62_0.17_148/0.15)] text-risk-low" :
                  mod.complexity === "medium" ? "bg-[oklch(0.75_0.15_85/0.15)] text-risk-medium" : 
                  "bg-[oklch(0.62_0.21_32/0.15)] text-risk-high"
                )}>
                  复杂度: {mod.complexity === "low" ? "低" : mod.complexity === "medium" ? "中" : "高"}
                </span>
              </div>
              <div className="w-24 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-surface-3 overflow-hidden">
                  <motion.div
                    className={cn(
                      "h-full rounded-full",
                      mod.health >= 85 ? "bg-risk-low" : mod.health >= 70 ? "bg-risk-medium" : "bg-risk-high"
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: `${mod.health}%` }}
                    transition={{ duration: 0.6, delay: idx * 0.1 }}
                  />
                </div>
                <span className={cn(
                  "text-xs font-medium",
                  mod.health >= 85 ? "text-risk-low" : mod.health >= 70 ? "text-risk-medium" : "text-risk-high"
                )}>{mod.health}%</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Circular Dependencies */}
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-risk-high" />
            <span className="text-sm font-medium text-foreground">循环依赖</span>
            <span className="text-xs text-risk-high ml-auto">{circularDeps.length} 个问题</span>
          </div>
          <div className="divide-y divide-border">
            {circularDeps.map((dep, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.05 }}
                className="px-4 py-3"
              >
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-foreground">{dep.from}</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  <span className="font-mono text-muted-foreground">{dep.via}</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  <span className="font-mono text-foreground">{dep.to}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Layer Violations */}
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center gap-2">
            <Layers className="w-4 h-4 text-risk-medium" />
            <span className="text-sm font-medium text-foreground">分层违规</span>
          </div>
          <div className="divide-y divide-border">
            {layerViolations.map((v, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.05 }}
                className="px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-mono text-foreground">{v.file}</span>
                </div>
                <div className="mt-1.5 text-xs">
                  <span className="text-risk-medium">{v.violation}</span>
                  <span className="text-muted-foreground"> → {v.suggestion}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
