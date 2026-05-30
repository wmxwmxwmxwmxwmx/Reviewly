"use client"

import { useNavigation } from "@/features/prism/contexts/navigation-context"
import { useAISettings } from "@/features/prism/contexts/ai-settings-context"
import { Button } from "@/components/ui/button"

export function ReviewCenterSettingsView() {
  const { navigate } = useNavigation()
  const { settings, providerLabel, hasApiKey, monthlyUsage } = useAISettings()

  return (
    <div className="p-5 space-y-6 max-w-2xl">
      <div>
        <h2 className="text-base font-semibold text-foreground">评审中心设置</h2>
        <p className="text-[12px] text-muted-foreground mt-1">AI 模型与评审偏好</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-muted-foreground">AI 提供商</span>
          <span className="text-[12px] font-medium">{providerLabel}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-muted-foreground">默认模型</span>
          <span className="text-[12px] font-mono">{settings.model}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-muted-foreground">API 密钥</span>
          <span className="text-[12px]">{hasApiKey ? "已配置" : "未配置"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-muted-foreground">本月 Token</span>
          <span className="text-[12px] font-mono">{monthlyUsage.totalTokens.toLocaleString()}</span>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => navigate("settings")}>
          打开系统设置
        </Button>
      </div>
    </div>
  )
}
