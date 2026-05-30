"use client"

import { useCallback, useEffect, useState } from "react"
import { Github, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { validateGitHubPrUrl } from "@/lib/github-pr-url"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"

interface ImportPRDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  importing?: boolean
  onImport: (url: string) => Promise<void>
}

export function ImportPRDialog({
  open,
  onOpenChange,
  importing = false,
  onImport,
}: ImportPRDialogProps) {
  const [url, setUrl] = useState("")
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setUrl("")
      setLocalError(null)
    }
  }, [open])

  const submit = useCallback(async () => {
    const trimmed = url.trim()
    if (!trimmed || importing) return
    const validationError = validateGitHubPrUrl(trimmed)
    if (validationError) {
      setLocalError(validationError)
      return
    }
    setLocalError(null)
    await onImport(trimmed)
  }, [url, importing, onImport])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-panel border-border sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{zh.aiReview.importDialogTitle}</DialogTitle>
          <DialogDescription>{zh.aiReview.importDialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-1">
          <label className="text-xs font-medium text-muted-foreground">
            {zh.common.importPrUrl}
          </label>
          <div
            className={cn(
              "flex items-center gap-2 h-10 px-3 rounded-md border bg-surface-2",
              localError ? "border-risk-high/50" : "border-border",
            )}
          >
            <Github className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                if (localError) setLocalError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void submit()
                }
              }}
              disabled={importing}
              placeholder={zh.common.importPrPlaceholder}
              className="flex-1 bg-transparent text-sm font-mono text-foreground placeholder:text-muted-foreground outline-none min-w-0 disabled:opacity-60"
            />
          </div>
          {localError && <p className="text-[11px] text-risk-high">{localError}</p>}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={importing}
          >
            {zh.common.cancel}
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={importing || !url.trim()}>
            {importing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {zh.common.importingPr}
              </>
            ) : (
              zh.aiReview.importAction
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
