"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react"
import type { GithubAccountInfo } from "@reviewly/shared"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/features/prism/contexts/auth-context"
import { fetchGithubAccount } from "@/lib/api/auth"
import { PrismApiError } from "@/lib/api/client"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"

interface GithubAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function tokenStatusLabel(status: GithubAccountInfo["tokenStatus"]): string {
  if (status === "valid") return zh.accountMenu.tokenValid
  if (status === "missing") return zh.accountMenu.tokenMissing
  return zh.accountMenu.tokenExpired
}

function tokenStatusClass(status: GithubAccountInfo["tokenStatus"]): string {
  if (status === "valid") return "text-risk-low border-risk-low/30 bg-risk-low/10"
  if (status === "missing") return "text-risk-medium border-risk-medium/30 bg-risk-medium/10"
  return "text-risk-high border-risk-high/30 bg-risk-high/10"
}

function formatSyncedAt(iso: string | null | undefined): string {
  if (!iso) return zh.accountMenu.neverSynced
  try {
    return new Date(iso).toLocaleString("zh-CN")
  } catch {
    return iso
  }
}

export function GithubAccountDialog({ open, onOpenChange }: GithubAccountDialogProps) {
  const { switchAccount } = useAuth()
  const [account, setAccount] = useState<GithubAccountInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadAccount = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchGithubAccount()
      setAccount(data)
    } catch (e: unknown) {
      setError(e instanceof PrismApiError ? e.message : "加载失败")
      setAccount(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      void loadAccount()
    }
  }, [open, loadAccount])

  const handleReauthorize = () => {
    onOpenChange(false)
    void switchAccount()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-panel border-border sm:max-w-md gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="text-foreground">{zh.accountMenu.githubAccountTitle}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {zh.accountMenu.githubAccountDesc}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto p-4 space-y-3">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-ai-blue" />
              加载中…
            </div>
          )}

          {error && !loading && (
            <div className="rounded-md border border-risk-high/30 bg-risk-high/10 p-3 text-sm text-risk-high">
              {error}
            </div>
          )}

          {account && !loading && (
            <>
              <div className="flex items-center gap-3 rounded-md border border-border bg-surface-2 p-3">
                <Avatar className="h-12 w-12 rounded-md border border-border">
                  {account.avatarUrl ? <AvatarImage src={account.avatarUrl} alt="" /> : null}
                  <AvatarFallback className="rounded-md bg-gradient-to-br from-ai-blue to-ai-purple text-sm font-semibold text-white">
                    {account.login.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground truncate">{account.login}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {account.email || "—"}
                  </div>
                </div>
                {account.tokenStatus === "valid" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-risk-low" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-risk-medium" />
                )}
              </div>

              <div className="rounded-md border border-border overflow-hidden divide-y divide-border">
                <InfoRow label={zh.accountMenu.accountId} value={account.githubId} mono />
                <InfoRow
                  label={zh.accountMenu.syncedRepoCount}
                  value={`${account.syncedRepoCount} ${zh.accountMenu.reposUnit}`}
                />
                <InfoRow
                  label={zh.accountMenu.lastSyncedAt}
                  value={formatSyncedAt(account.lastSyncedAt)}
                />
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <span className="text-sm text-muted-foreground">{zh.accountMenu.tokenStatus}</span>
                  <span
                    className={cn(
                      "text-[11px] px-2 py-0.5 rounded-full border",
                      tokenStatusClass(account.tokenStatus),
                    )}
                  >
                    {tokenStatusLabel(account.tokenStatus)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="border-t border-border px-4 py-4 flex-col sm:flex-col gap-2">
          <button
            type="button"
            onClick={handleReauthorize}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-ai-blue px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {zh.accountMenu.reauthorize}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
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
