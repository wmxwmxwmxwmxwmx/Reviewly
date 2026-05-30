"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import type { PullRequestListItem } from "@reviewly/shared"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { patchPullRequest } from "@/lib/api/pull-requests"
import { PrismApiError } from "@/lib/api/client"
import { zh } from "@/lib/i18n/zh"

interface EditPRDialogProps {
  pr: PullRequestListItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}

export function EditPRDialog({ pr, open, onOpenChange, onSaved }: EditPRDialogProps) {
  const { toast } = useToast()
  const [displayName, setDisplayName] = useState("")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && pr) {
      setDisplayName(pr.displayName ?? "")
      setNote(pr.note ?? "")
    }
  }, [open, pr])

  const save = useCallback(async () => {
    if (!pr || saving) return
    setSaving(true)
    try {
      await patchPullRequest(pr.id, {
        displayName: displayName.trim() || undefined,
        note: note.trim() || undefined,
      })
      toast({ title: zh.aiReview.editSaved })
      onSaved?.()
      onOpenChange(false)
    } catch (e) {
      toast({
        title: zh.aiReview.editFailed,
        description: e instanceof PrismApiError ? e.message : undefined,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }, [pr, saving, displayName, note, toast, onSaved, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-panel border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{zh.aiReview.editDialogTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {zh.aiReview.displayNameLabel}
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={pr?.title ?? ""}
              className="w-full h-9 px-3 text-sm rounded-md border border-border bg-surface-2 text-foreground outline-none focus:ring-1 focus:ring-ai-blue"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {zh.aiReview.noteLabel}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder={zh.aiReview.notePlaceholder}
              className="w-full px-3 py-2 text-sm rounded-md border border-border bg-surface-2 text-foreground outline-none focus:ring-1 focus:ring-ai-blue resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {zh.common.cancel}
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {zh.aiReview.saveLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
