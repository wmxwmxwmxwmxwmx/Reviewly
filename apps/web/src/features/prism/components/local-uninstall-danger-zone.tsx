"use client"

import { useCallback, useEffect, useState } from "react"
import { motion } from "framer-motion"
import { AlertTriangle, Copy, Loader2, Terminal } from "lucide-react"

import type { LocalDeployResources } from "@/lib/deploy/reviewly-resources"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

type LoadState = "idle" | "loading" | "ready" | "error"

export function LocalUninstallDangerZone() {
  const [open, setOpen] = useState(false)
  const [loadState, setLoadState] = useState<LoadState>("idle")
  const [stats, setStats] = useState<LocalDeployResources | null>(null)
  const [purgeMode, setPurgeMode] = useState(false)

  const fetchStats = useCallback(async () => {
    setLoadState("loading")
    try {
      const res = await fetch("/api/deploy/local-resources", { cache: "no-store" })
      if (!res.ok) throw new Error("fetch failed")
      const data = (await res.json()) as LocalDeployResources
      setStats(data)
      setLoadState("ready")
    } catch {
      setLoadState("error")
    }
  }, [])

  useEffect(() => {
    if (open) {
      void fetchStats()
    }
  }, [open, fetchStats])

  const command = purgeMode
    ? (stats?.purgeCommand ?? "bash deploy/uninstall.sh --purge")
    : (stats?.uninstallCommand ?? "bash deploy/uninstall.sh")

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(command)
      toast({ title: "已复制卸载命令", description: "请在项目根目录终端中执行。" })
    } catch {
      toast({ title: "复制失败", variant: "destructive" })
    }
  }

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border border-risk-high/40 overflow-hidden bg-panel/40"
      >
        <div className="px-4 py-3 bg-risk-high/10 border-b border-risk-high/30 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-risk-high shrink-0" />
          <span className="text-sm font-medium text-foreground">Danger Zone</span>
        </div>
        <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm text-foreground">卸载本地部署</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              仅删除 Reviewly 容器、卷与缓存，不影响其它 Docker 项目或系统环境变量。
            </p>
          </div>
          <Button
            type="button"
            variant="destructive"
            className="shrink-0"
            onClick={() => {
              setPurgeMode(false)
              setOpen(true)
            }}
          >
            卸载本地部署
          </Button>
        </div>
      </motion.section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md bg-panel border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">确认卸载本地部署</DialogTitle>
            <DialogDescription>
              浏览器无法直接执行 Docker 清理。确认后将复制终端命令，请在仓库根目录运行。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            {loadState === "loading" && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                正在检测本地资源…
              </p>
            )}
            {loadState === "error" && (
              <p className="text-risk-medium text-xs">
                无法自动统计（请确认在开发模式且本机已安装 Docker）。仍可复制下方命令。
              </p>
            )}
            {loadState === "ready" && stats && (
              <ul className="grid grid-cols-2 gap-2 rounded-md border border-border bg-surface-2 p-3 text-xs">
                <li>
                  <span className="text-muted-foreground">容器</span>
                  <span className="ml-2 font-mono text-foreground">{stats.containerCount}</span>
                </li>
                <li>
                  <span className="text-muted-foreground">Volume</span>
                  <span className="ml-2 font-mono text-foreground">{stats.volumeCount}</span>
                </li>
                <li className="col-span-2">
                  <span className="text-muted-foreground">Repo Cache</span>
                  <span className="ml-2 font-mono text-foreground">{stats.repoCacheSize}</span>
                </li>
                <li>
                  <span className="text-muted-foreground">日志目录</span>
                  <span className="ml-2 font-mono text-foreground">{stats.logsSize}</span>
                </li>
                <li>
                  <span className="text-muted-foreground">临时缓存</span>
                  <span className="ml-2 font-mono text-foreground">{stats.tmpSize}</span>
                </li>
              </ul>
            )}

            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={purgeMode}
                onChange={(e) => setPurgeMode(e.target.checked)}
                className="rounded border-border"
              />
              彻底删除（--purge / -Purge）：含数据库、配置与 node_modules
            </label>

            <pre
              className={cn(
                "rounded-md border border-border bg-background px-3 py-2",
                "font-mono text-[11px] text-foreground overflow-x-auto",
              )}
            >
              {command}
            </pre>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button type="button" variant="destructive" onClick={() => void copyCommand()}>
              <Copy className="size-4" />
              复制命令并在终端执行
            </Button>
          </DialogFooter>

          <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground -mt-2">
            <Terminal className="size-3.5 shrink-0 mt-0.5" />
            Purge 模式会在终端再次要求 [y/N] 确认，不会删除其它 Docker 项目。
          </p>
        </DialogContent>
      </Dialog>
    </>
  )
}
