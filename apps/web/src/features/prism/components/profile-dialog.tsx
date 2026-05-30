"use client"

import { Github, Loader2, User } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/features/prism/contexts/auth-context"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"

interface ProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatLastLogin(iso: string | null | undefined): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString("zh-CN")
  } catch {
    return iso
  }
}

export function ProfileDialog({ open, onOpenChange }: ProfileDialogProps) {
  const { user, loading } = useAuth()

  const displayName = user ? user.name || user.login || user.username : ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-panel border-border sm:max-w-md gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="text-foreground">{zh.accountMenu.profileTitle}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {zh.pageSubtitle.profile}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto p-4 space-y-3">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-ai-blue" />
              加载中…
            </div>
          )}

          {!loading && !user && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {zh.sidebar.notLoggedIn}
            </p>
          )}

          {!loading && user && (
            <>
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center gap-2">
                  <User className="w-4 h-4 text-ai-blue" />
                  <span className="text-sm font-medium text-foreground">
                    {zh.accountMenu.profileTitle}
                  </span>
                </div>

                <div className="p-4 flex items-center gap-4 border-b border-border">
                  <Avatar className="h-12 w-12 rounded-md border border-border">
                    {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
                    <AvatarFallback className="rounded-md bg-gradient-to-br from-ai-blue to-ai-purple text-sm font-semibold text-white">
                      {displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{displayName}</div>
                    <div className="text-xs text-muted-foreground truncate">{user.email || "—"}</div>
                  </div>
                </div>

                <div className="divide-y divide-border">
                  <ProfileRow label={zh.accountMenu.displayName} value={displayName} />
                  <ProfileRow
                    label={zh.accountMenu.githubUsername}
                    value={user.login || user.username}
                    mono
                  />
                  <ProfileRow label={zh.accountMenu.email} value={user.email || "—"} />
                  <ProfileRow label={zh.accountMenu.accountId} value={user.githubId} mono />
                  <ProfileRow
                    label={zh.accountMenu.lastLogin}
                    value={formatLastLogin(user.lastLoginAt)}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border overflow-hidden">
                <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center gap-2">
                  <Github className="w-4 h-4 text-risk-low" />
                  <span className="text-sm font-medium text-foreground">
                    {zh.sidebar.githubConnected}
                  </span>
                </div>
                <div className="px-4 py-3 text-sm text-muted-foreground">
                  @{user.login || user.username}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
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
        className={cn(
          "text-sm text-foreground truncate max-w-[55%] text-right",
          mono && "font-mono text-xs",
        )}
      >
        {value}
      </span>
    </div>
  )
}
