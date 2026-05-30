"use client"

import { ArrowRight, Bot, FolderGit2, ScrollText, Settings } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useNavigation } from "@/features/prism/contexts/navigation-context"
import { useAISettings } from "@/features/prism/contexts/ai-settings-context"
import { cn } from "@/lib/utils"

function QuickLinkCard({
  icon: Icon,
  title,
  description,
  meta,
  onClick,
}: {
  icon: typeof Settings
  title: string
  description: string
  meta?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 w-full p-4 rounded-lg border border-border bg-card text-left transition-colors",
        "hover:border-ai-blue/40 hover:bg-surface-2/80",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai-blue/50",
      )}
    >
      <Icon className="w-4 h-4 text-ai-blue shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{description}</p>
        {meta ? (
          <p className="text-[10px] font-mono text-muted-foreground/80 mt-2 truncate">{meta}</p>
        ) : null}
      </div>
    </button>
  )
}

export function ReviewCenterSettingsView() {
  const { navigate } = useNavigation()
  const { settings, providerLabel, hasApiKey, monthlyUsage } = useAISettings()

  const aiMeta = [
    providerLabel,
    settings.model,
    hasApiKey ? "密钥已配置" : "密钥未配置",
    `${monthlyUsage.totalTokens.toLocaleString()} tok 本月`,
  ].join(" · ")

  return (
    <div className="p-4 sm:p-5 max-w-2xl space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">快捷入口</h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          配置与相关模块入口，不在此页重复表单
        </p>
      </div>

      <div className="space-y-2">
        <QuickLinkCard
          icon={Bot}
          title="AI 模型与密钥"
          description="管理默认模型、API 密钥与 AI 用量偏好"
          meta={aiMeta}
          onClick={() => navigate("settings")}
        />
        <QuickLinkCard
          icon={ScrollText}
          title="工程治理规则"
          description="配置审批门禁、安全扫描与合规策略"
          onClick={() => navigate("governance")}
        />
        <QuickLinkCard
          icon={FolderGit2}
          title="仓库管理"
          description="纳管外部仓库、同步 GitHub 与克隆配置"
          onClick={() => navigate("repos")}
        />
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 text-xs"
        onClick={() => navigate("settings")}
      >
        <Settings className="w-3.5 h-3.5 mr-1.5" />
        打开系统设置
      </Button>
    </div>
  )
}
