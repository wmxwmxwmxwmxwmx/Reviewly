"use client"

import { motion } from "framer-motion"
import { User, Github } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/features/prism/contexts/auth-context"
import { zh } from "@/lib/i18n/zh"

function formatLastLogin(iso: string | null | undefined): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString("zh-CN")
  } catch {
    return iso
  }
}

export function ProfileView() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 rounded bg-surface-2 animate-pulse" />
        <div className="h-40 rounded-lg bg-surface-2 animate-pulse" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">{zh.sidebar.notLoggedIn}</p>
      </div>
    )
  }

  const displayName = user.name || user.login || user.username

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">{zh.accountMenu.profileTitle}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{zh.pageSubtitle.profile}</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border border-border overflow-hidden"
      >
        <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center gap-2">
          <User className="w-4 h-4 text-ai-blue" />
          <span className="text-sm font-medium text-foreground">{zh.accountMenu.profileTitle}</span>
        </div>

        <div className="p-4 flex items-center gap-4 border-b border-border">
          <Avatar className="h-14 w-14 rounded-md border border-border">
            {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
            <AvatarFallback className="rounded-md bg-gradient-to-br from-ai-blue to-ai-purple text-base font-semibold text-white">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="text-base font-medium text-foreground truncate">{displayName}</div>
            <div className="text-sm text-muted-foreground truncate">{user.email || "—"}</div>
          </div>
        </div>

        <div className="divide-y divide-border">
          <ProfileRow label={zh.accountMenu.displayName} value={displayName} />
          <ProfileRow label={zh.accountMenu.githubUsername} value={user.login || user.username} mono />
          <ProfileRow label={zh.accountMenu.email} value={user.email || "—"} />
          <ProfileRow label={zh.accountMenu.accountId} value={user.githubId} mono />
          <ProfileRow label={zh.accountMenu.lastLogin} value={formatLastLogin(user.lastLoginAt)} />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mt-4 rounded-lg border border-border overflow-hidden"
      >
        <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center gap-2">
          <Github className="w-4 h-4 text-risk-low" />
          <span className="text-sm font-medium text-foreground">{zh.sidebar.githubConnected}</span>
        </div>
        <div className="px-4 py-3 text-sm text-muted-foreground">
          @{user.login || user.username}
        </div>
      </motion.div>
    </div>
  )
}

function ProfileRow({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="px-4 py-3 flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`text-sm text-foreground truncate max-w-[60%] text-right ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </span>
    </div>
  )
}
