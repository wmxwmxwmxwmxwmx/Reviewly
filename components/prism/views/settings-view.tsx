"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { User, Bell, Shield, Save, Check } from "lucide-react"
import { cn } from "@/lib/utils"

type SettingItem =
  | { label: string; value: string; type: "text" }
  | { label: string; value: boolean; type: "toggle"; key: string }
  | { label: string; value: string; type: "select" }

const initialSections: { icon: typeof User; title: string; items: SettingItem[] }[] = [
  {
    icon: User,
    title: "账户设置",
    items: [
      { label: "用户名", value: "zhang.wei", type: "text" },
      { label: "邮箱", value: "zhang.wei@company.com", type: "text" },
    ],
  },
  {
    icon: Bell,
    title: "通知设置",
    items: [
      { label: "PR 评审通知", value: true, type: "toggle", key: "pr-notify" },
      { label: "安全告警通知", value: true, type: "toggle", key: "security-notify" },
      { label: "每日摘要邮件", value: false, type: "toggle", key: "daily-digest" },
    ],
  },
  {
    icon: Shield,
    title: "安全设置",
    items: [
      { label: "双因素认证", value: true, type: "toggle", key: "2fa" },
      { label: "会话超时", value: "30 分钟", type: "select" },
    ],
  },
]

export function SettingsView() {
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    "pr-notify": true,
    "security-notify": true,
    "daily-digest": false,
    "2fa": true,
  })
  const [saved, setSaved] = useState(false)

  const handleToggle = (key: string) => {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }))
    setSaved(false)
  }

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-5 space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-foreground">系统设置</h1>
        <p className="text-sm text-muted-foreground mt-0.5">管理您的账户和应用偏好</p>
      </div>

      {initialSections.map((section, idx) => (
        <motion.div
          key={section.title}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.05 }}
          className="rounded-lg border border-border overflow-hidden"
        >
          <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center gap-2">
            <section.icon className="w-4 h-4 text-ai-blue" />
            <span className="text-sm font-medium text-foreground">{section.title}</span>
          </div>
          <div className="divide-y divide-border">
            {section.items.map((item) => (
              <div key={item.label} className="px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-foreground">{item.label}</span>
                {item.type === "text" && (
                  <span className="text-sm text-muted-foreground">{item.value as string}</span>
                )}
                {item.type === "toggle" && (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={toggles[item.key]}
                    onClick={() => handleToggle(item.key)}
                    className={cn(
                      "w-10 h-5 rounded-full transition-colors relative",
                      toggles[item.key] ? "bg-ai-blue" : "bg-surface-4"
                    )}
                  >
                    <motion.div
                      className="w-4 h-4 rounded-full bg-white absolute top-0.5"
                      animate={{ left: toggles[item.key] ? "calc(100% - 18px)" : "2px" }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </button>
                )}
                {item.type === "select" && (
                  <span className="text-sm text-muted-foreground">{item.value as string}</span>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      ))}

      <button
        type="button"
        onClick={handleSave}
        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-ai-blue rounded-md hover:bg-[oklch(0.55_0.19_240)] transition-colors"
      >
        {saved ? (
          <>
            <Check className="w-4 h-4" />
            已保存
          </>
        ) : (
          <>
            <Save className="w-4 h-4" />
            保存设置
          </>
        )}
      </button>
    </div>
  )
}
