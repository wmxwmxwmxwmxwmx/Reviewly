"use client"

import { useCallback, useState } from "react"

import { useNavigation } from "@/features/prism/contexts/navigation-context"
import { importPullRequestByUrl } from "@/lib/api/pull-requests"
import { PrismApiError } from "@/lib/api/client"
import { zh } from "@/lib/i18n/zh"

export const PENDING_AUTO_ANALYZE_KEY = "prism:pending-auto-analyze"

export type ImportPrResult = Awaited<ReturnType<typeof importPullRequestByUrl>>

interface UseImportPrByUrlOptions {
  currentPrId?: string
  onBeforeImport?: () => void
  onImportSuccess?: (result: ImportPrResult) => void
  onImportError?: (message: string) => void
  onSamePrImport?: () => void
}

export function useImportPrByUrl(options: UseImportPrByUrlOptions = {}) {
  const { currentPrId, onBeforeImport, onImportSuccess, onImportError, onSamePrImport } =
    options
  const { navigate } = useNavigation()
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  const handleImportUrl = useCallback(
    async (url: string) => {
      setImporting(true)
      setImportError(null)
      onBeforeImport?.()
      try {
        const result = await importPullRequestByUrl(url)
        onImportSuccess?.(result)
        if (currentPrId && result.prId === currentPrId) {
          onSamePrImport?.()
        } else {
          sessionStorage.setItem(PENDING_AUTO_ANALYZE_KEY, result.prId)
          navigate("ai-review", { prId: result.prId })
        }
      } catch (error) {
        const message =
          error instanceof PrismApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : zh.common.importFailed
        setImportError(message)
        onImportError?.(message)
      } finally {
        setImporting(false)
      }
    },
    [currentPrId, navigate, onBeforeImport, onImportError, onImportSuccess, onSamePrImport],
  )

  return {
    importing,
    importError,
    setImportError,
    handleImportUrl,
  }
}
