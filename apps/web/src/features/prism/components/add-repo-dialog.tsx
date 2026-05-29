"use client"

import { useState } from "react"
import { Loader2, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { zh } from "@/lib/i18n/zh"

interface AddRepoDialogProps {
  importing: boolean
  onImport: (url: string) => Promise<void>
}

export function AddRepoDialog({ importing, onImport }: AddRepoDialogProps) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState("")

  const handleSubmit = async () => {
    try {
      await onImport(url)
      setUrl("")
      setOpen(false)
    } catch {
      /* error surfaced via toast in parent */
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5 border-border bg-surface-2 hover:bg-surface-3"
        >
          <Plus className="w-3.5 h-3.5" />
          {zh.repos.addRepo}
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{zh.repos.addRepo}</DialogTitle>
          <DialogDescription>{zh.repos.addRepoDescription}</DialogDescription>
        </DialogHeader>
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={zh.repos.importPlaceholder}
          className="text-sm bg-surface-2 border-border"
          disabled={importing}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleSubmit()
          }}
        />
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={importing}
          >
            {zh.common.cancel}
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-ai-blue hover:bg-ai-blue/90"
            onClick={() => void handleSubmit()}
            disabled={importing || !url.trim()}
          >
            {importing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
            ) : null}
            {zh.repos.addRepoConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
