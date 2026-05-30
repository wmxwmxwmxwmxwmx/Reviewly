"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { zh } from "@/lib/i18n/zh"

interface SwitchAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function SwitchAccountDialog({ open, onOpenChange, onConfirm }: SwitchAccountDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-panel border-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">
            {zh.accountMenu.switchAccountTitle}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            {zh.accountMenu.switchAccountDesc}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-border bg-surface-2 hover:bg-surface-3">
            {zh.common.cancel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-ai-blue text-white hover:opacity-90"
          >
            {zh.accountMenu.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
