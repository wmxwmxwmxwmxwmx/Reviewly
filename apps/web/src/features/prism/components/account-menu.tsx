"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  Github,
  Loader2,
  LogOut,
  RefreshCw,
  Settings,
  User,
  UserRound,
} from "lucide-react"
import type { AuthUser } from "@reviewly/shared"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { GithubAccountDialog } from "@/features/prism/components/github-account-dialog"
import { LogoutDialog } from "@/features/prism/components/logout-dialog"
import { ProfileDialog } from "@/features/prism/components/profile-dialog"
import { SwitchAccountDialog } from "@/features/prism/components/switch-account-dialog"
import type { NavView } from "@/features/prism/components/sidebar"
import { useAuth } from "@/features/prism/contexts/auth-context"
import { useReposStore } from "@/features/prism/contexts/repos-context"
import { useToast } from "@/hooks/use-toast"
import { PrismApiError } from "@/lib/api/client"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"

interface AccountMenuProps {
  user: AuthUser
  onNavigate: (view: NavView) => void
}

export function AccountMenu({ user, onNavigate }: AccountMenuProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { logout, switchAccount } = useAuth()
  const { sync: syncReposAndPrs } = useReposStore()
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)
  const [githubDialogOpen, setGithubDialogOpen] = useState(false)
  const [switchDialogOpen, setSwitchDialogOpen] = useState(false)
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const displayName = user.name || user.login || user.username

  const handleResync = async () => {
    if (syncing) return
    setSyncing(true)
    try {
      const result = await syncReposAndPrs()
      toast({
        title: zh.accountMenu.resyncSuccess,
        description: `${zh.accountMenu.resyncCreated} ${result.created} ${zh.accountMenu.reposUnit} · ${zh.accountMenu.resyncUpdated} ${result.updated} ${zh.accountMenu.reposUnit}`,
      })
    } catch (e: unknown) {
      toast({
        variant: "destructive",
        title: zh.accountMenu.resyncFailed,
        description: e instanceof PrismApiError ? e.message : undefined,
      })
    } finally {
      setSyncing(false)
    }
  }

  const handleLogout = async () => {
    setLogoutDialogOpen(false)
    await logout()
    router.replace("/login")
  }

  const handleSwitchAccount = async () => {
    setSwitchDialogOpen(false)
    await switchAccount()
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors",
              "hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ai-blue",
            )}
          >
            <Avatar className="h-7 w-7 shrink-0 rounded-full border border-border">
              {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
              <AvatarFallback className="rounded-full bg-gradient-to-br from-ai-blue to-ai-purple text-[11px] font-semibold text-white">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11px] font-medium text-foreground">{displayName}</div>
              <div className="truncate text-[10px] text-muted-foreground">
                {zh.sidebar.githubConnected}
              </div>
            </div>
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-risk-low" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          side="top"
          align="start"
          className="w-56 bg-panel border-border"
          sideOffset={8}
        >
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground truncate">{displayName}</span>
              <span className="text-xs text-muted-foreground truncate">{user.email || "—"}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-border" />

          <DropdownMenuItem
            className="cursor-pointer focus:bg-surface-2"
            onSelect={() => setProfileDialogOpen(true)}
          >
            <User className="mr-2 h-3.5 w-3.5" />
            {zh.accountMenu.profile}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer focus:bg-surface-2"
            onSelect={() => setGithubDialogOpen(true)}
          >
            <Github className="mr-2 h-3.5 w-3.5" />
            {zh.accountMenu.githubAccount}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer focus:bg-surface-2"
            disabled={syncing}
            onSelect={(e) => {
              e.preventDefault()
              void handleResync()
            }}
          >
            {syncing ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
            )}
            {syncing ? zh.accountMenu.resyncing : zh.accountMenu.resyncRepos}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer focus:bg-surface-2"
            onSelect={() => setSwitchDialogOpen(true)}
          >
            <UserRound className="mr-2 h-3.5 w-3.5" />
            {zh.accountMenu.switchAccount}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer focus:bg-surface-2"
            onSelect={() => onNavigate("settings")}
          >
            <Settings className="mr-2 h-3.5 w-3.5" />
            {zh.accountMenu.settings}
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-border" />

          <DropdownMenuItem
            className="cursor-pointer text-risk-high focus:bg-risk-high/10 focus:text-risk-high"
            onSelect={() => setLogoutDialogOpen(true)}
          >
            <LogOut className="mr-2 h-3.5 w-3.5" />
            {zh.accountMenu.logout}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProfileDialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen} />
      <GithubAccountDialog open={githubDialogOpen} onOpenChange={setGithubDialogOpen} />
      <SwitchAccountDialog
        open={switchDialogOpen}
        onOpenChange={setSwitchDialogOpen}
        onConfirm={() => void handleSwitchAccount()}
      />
      <LogoutDialog
        open={logoutDialogOpen}
        onOpenChange={setLogoutDialogOpen}
        onConfirm={() => void handleLogout()}
      />
    </>
  )
}
