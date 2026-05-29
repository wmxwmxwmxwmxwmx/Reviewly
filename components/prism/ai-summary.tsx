"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  BrainCircuit,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Database,
  Lock,
  Zap,
  GitBranch,
  Package,
  BarChart3,
  AlertOctagon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { mockAISummary } from "@/components/prism/mock-data"

interface Section {
  key: string
  icon: React.ElementType
  label: string
  content: string
  severity?: "critical" | "warning" | "info"
  confidence: number
}

const sections: Section[] = [
  { key: "purpose", icon: GitBranch, label: "PR 核心目的", content: "重构支付服务缓存层，将单节点 Redis 升级为 6 节点集群方案（3主3从），引入一致性哈希分片，目标 QPS 从 50K 提升至 200K+。", confidence: 98 },
  { key: "business", icon: BarChart3, label: "业务影响", content: "影响支付主链路（下单→扣款→回调），预计上线后缓存命中率提升 35%，但 Breaking Change 将影响 billing-service 和 reconcile-service，需协同发版。", severity: "warning", confidence: 92 },
  { key: "arch", icon: Package, label: "架构变更", content: "新增 L1 本地缓存（sync.Map）+ L2 Redis Cluster 两级缓存架构。引入 hystrix-go 熔断器。移除单点 Redis 依赖，新增一致性哈希路由层。", confidence: 95 },
  { key: "api", icon: Zap, label: "API 变更", content: "PaymentCallback v2 响应结构移除 legacy_txn_id 字段（Breaking）。新增 /internal/cache/flush 管理接口（需鉴权）。", severity: "critical", confidence: 99 },
  { key: "db", icon: Database, label: "数据库影响", content: "本次变更不涉及数据库 Schema 修改。新增 6 条 Redis 集群配置键。支付状态缓存 TTL 从 300s 调整为 600s，需关注缓存过期期间的状态一致性。", confidence: 88 },
  { key: "security", icon: Lock, label: "权限与安全", content: "发现 2 处 Critical 安全问题：SQL 注入漏洞（CVSS 9.8）+ JWT 算法降级漏洞（CVSS 8.1）。建议本次 Merge 前强制修复，不可豁免。", severity: "critical", confidence: 97 },
  { key: "breaking", icon: AlertOctagon, label: "Breaking Changes", content: "1. PaymentCallback.legacy_txn_id 字段移除\n2. Redis 连接字符串配置格式变更（集群模式）\n3. 缓存 Key 命名空间前缀变更（payment: → pay:v2:）", severity: "critical", confidence: 99 },
]

function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        if (line.startsWith('## ')) {
          return <h3 key={i} className="text-xs font-semibold text-foreground mt-2 first:mt-0">{line.slice(3)}</h3>
        }
        if (line.startsWith('> ')) {
          return (
            <div key={i} className="flex items-start gap-2 px-3 py-2 rounded bg-[oklch(0.55_0.22_27/0.08)] border border-[oklch(0.55_0.22_27/0.2)] text-[11px] text-risk-high">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              <span>{line.slice(2)}</span>
            </div>
          )
        }
        if (line.startsWith('- ')) {
          return (
            <div key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground pl-2">
              <span className="mt-1 w-1 h-1 rounded-full bg-muted-foreground shrink-0" />
              <span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground font-medium">$1</strong>') }} />
            </div>
          )
        }
        if (line.trim() === '') return null
        return (
          <p
            key={i}
            className="text-[11px] text-muted-foreground leading-relaxed"
            dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground font-medium">$1</strong>').replace(/`(.*?)`/g, '<code class="px-1 py-0.5 rounded bg-surface-3 text-[10px] font-mono text-ai-blue">$1</code>') }}
          />
        )
      })}
    </div>
  )
}

interface StreamingTextProps {
  text: string
  streaming: boolean
}

function StreamingText({ text, streaming }: StreamingTextProps) {
  const [displayed, setDisplayed] = useState("")
  const idx = useRef(0)

  useEffect(() => {
    if (!streaming) { setDisplayed(text); return }
    idx.current = 0
    setDisplayed("")
    const timer = setInterval(() => {
      if (idx.current < text.length) {
        setDisplayed(text.slice(0, idx.current + 3))
        idx.current += 3
      } else {
        clearInterval(timer)
      }
    }, 12)
    return () => clearInterval(timer)
  }, [text, streaming])

  return (
    <div className={cn(streaming && displayed.length < text.length && "streaming-cursor")}>
      <SimpleMarkdown text={displayed} />
    </div>
  )
}

interface SectionItemProps {
  section: Section
  streaming: boolean
  defaultOpen?: boolean
}

function SectionItem({ section, streaming, defaultOpen = false }: SectionItemProps) {
  const [open, setOpen] = useState(defaultOpen)

  const severityStyle = {
    critical: "text-risk-critical border-l-risk-critical",
    warning: "text-risk-high border-l-risk-high",
    info: "text-ai-blue border-l-ai-blue",
  }

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-accent transition-colors",
          open ? "bg-surface-2" : "bg-transparent"
        )}
        onClick={() => setOpen(!open)}
      >
        <section.icon className={cn("w-3.5 h-3.5 shrink-0", section.severity ? severityStyle[section.severity]?.split(" ")[0] : "text-muted-foreground")} />
        <span className="flex-1 text-xs font-medium text-foreground">{section.label}</span>
        {section.severity && (
          <span className={cn(
            "text-[9px] px-1.5 py-0.5 rounded border",
            section.severity === "critical" ? "text-risk-critical bg-[oklch(0.55_0.22_27/0.1)] border-[oklch(0.55_0.22_27/0.3)]" : "text-risk-high bg-[oklch(0.65_0.18_46/0.1)] border-[oklch(0.65_0.18_46/0.3)]"
          )}>
            {section.severity === "critical" ? "严重" : "警告"}
          </span>
        )}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-muted-foreground">{section.confidence}%</span>
          {open ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={cn("px-3 py-2.5 border-t border-border", section.severity && "border-l-2", section.severity === "critical" && "border-l-risk-critical", section.severity === "warning" && "border-l-risk-high")}>
              <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-line">{section.content}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface AISummaryProps {
  streaming: boolean
  model?: string
  generatedSummary?: string
  error?: string | null
}

export function AISummary({ streaming, model = "claude-opus-4.6", generatedSummary, error }: AISummaryProps) {
  const [fullOpen, setFullOpen] = useState(Boolean(generatedSummary || error))

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="rounded-lg border border-border bg-card overflow-hidden"
    >
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-accent transition-colors"
        onClick={() => setFullOpen(!fullOpen)}
      >
        <div className="flex items-center gap-2.5 flex-1">
          <div className="relative">
            <BrainCircuit className="w-4 h-4 text-ai-blue" />
            {streaming && (
              <motion.div
                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-ai-blue"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
          </div>
          <span className="text-sm font-semibold text-foreground">AI 摘要分析</span>
          {streaming && (
            <div className="flex items-center gap-1 ml-1">
              <div className="thinking-dot w-1.5 h-1.5 rounded-full bg-ai-blue" />
              <div className="thinking-dot w-1.5 h-1.5 rounded-full bg-ai-blue" />
              <div className="thinking-dot w-1.5 h-1.5 rounded-full bg-ai-blue" />
            </div>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0">{model}</span>
        {fullOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>

      <AnimatePresence>
        {fullOpen && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 pt-1 border-t border-border">
              {error ? (
                <div className="flex items-start gap-2 px-3 py-2 rounded bg-risk-critical/10 border border-risk-critical/25 text-[11px] text-risk-critical">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : (
                <StreamingText text={generatedSummary || mockAISummary} streaming={streaming} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sections */}
      <div className="px-4 pb-4 space-y-1.5 border-t border-border pt-3">
        {sections.map((s, i) => (
          <SectionItem key={s.key} section={s} streaming={streaming} defaultOpen={i < 2} />
        ))}
      </div>
    </motion.div>
  )
}
