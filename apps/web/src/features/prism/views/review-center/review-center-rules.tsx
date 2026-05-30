"use client"

import { AlertTriangle, ArrowRight, Ban, Shield } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useNavigation } from "@/features/prism/contexts/navigation-context"
import { cn } from "@/lib/utils"

const RULES = [
  {
    icon: Ban,
    title: "高风险拦截",
    description: "当安全评分 < 60 或存在 Critical 级别问题时，禁止批准 PR。",
  },
  {
    icon: Shield,
    title: "安全门禁",
    description: "所有合并前必须通过 AI 规则扫描与人工评审双重确认。",
  },
  {
    icon: AlertTriangle,
    title: "要求修改",
    description: "评审人可提交「要求修改」，PR 状态将变为 CHANGES_REQUESTED。",
  },
] as const

export function ReviewCenterRulesView() {
  const { navigate } = useNavigation()

  return (
    <div className="p-4 sm:p-5 space-y-4 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-4 rounded-lg border border-ai-blue/25 bg-ai-blue/5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">治理规则</h2>
          <p className="text-[11px] text-muted-foreground mt-1">
            统一管理团队研发规范与质量门禁
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="shrink-0 h-8 text-xs bg-ai-blue hover:bg-sky-300"
          onClick={() => navigate("governance")}
        >
          前往工程治理中心
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {RULES.map((rule) => (
          <div
            key={rule.title}
            className={cn(
              "flex gap-2.5 px-3 py-2.5 rounded-md border border-border bg-surface-2/40",
            )}
          >
            <rule.icon className="w-4 h-4 text-ai-blue shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h3 className="text-xs font-semibold text-foreground">{rule.title}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                {rule.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
