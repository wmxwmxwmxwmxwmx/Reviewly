"use client"

import { Shield, AlertTriangle, Ban } from "lucide-react"
import { useNavigation } from "@/features/prism/contexts/navigation-context"

export function ReviewCenterRulesView() {
  const { navigate } = useNavigation()

  const rules = [
    {
      icon: Ban,
      title: "高风险拦截",
      description: "当安全评分 < 60 或存在 Critical 级别问题时，禁止批准 PR。",
    },
    {
      icon: Shield,
      title: "安全门禁",
      description: "所有合并前必须通过 AI 规则扫描与人工审批双重确认。",
    },
    {
      icon: AlertTriangle,
      title: "要求修改",
      description: "审批人可提交「要求修改」，PR 状态将变为 CHANGES_REQUESTED。",
    },
  ]

  return (
    <div className="p-5 space-y-6 max-w-3xl">
      <div>
        <h2 className="text-base font-semibold text-foreground">审批规则</h2>
        <p className="text-[12px] text-muted-foreground mt-1">
          企业级 PR 评审门禁与流转策略
        </p>
      </div>

      <div className="space-y-3">
        {rules.map((rule) => (
          <div
            key={rule.title}
            className="flex gap-3 p-4 rounded-lg border border-border bg-card"
          >
            <rule.icon className="w-5 h-5 text-ai-blue shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">{rule.title}</h3>
              <p className="text-[12px] text-muted-foreground mt-1">{rule.description}</p>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => navigate("governance")}
        className="text-[12px] text-ai-blue hover:underline"
      >
        前往工程治理中心配置详细规则 →
      </button>
    </div>
  )
}
