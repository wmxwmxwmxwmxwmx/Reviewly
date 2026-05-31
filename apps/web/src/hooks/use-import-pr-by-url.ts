"use client"

import { useCallback, useState } from "react"

import type { ImportPullRequestResult } from "@reviewly/shared"

import { useNavigation } from "@/features/prism/contexts/navigation-context"
import { useReposStore } from "@/features/prism/contexts/repos-context"
import { debugApiError, debugApiLog } from "@/lib/debug-api-log"
import { importPullRequestByUrl } from "@/lib/api/pull-requests"
import { formatImportErrorMessage } from "@/lib/api/client"
import { zh } from "@/lib/i18n/zh"

export const PENDING_AUTO_ANALYZE_KEY = "prism:pending-auto-analyze"

export type { ImportPullRequestResult }

interface UseImportPrByUrlOptions {
  currentPrId?: string
  onBeforeImport?: () => void
  onImportSuccess?: (result: ImportPullRequestResult) => void
  onImportError?: (message: string) => void
  onSamePrImport?: () => void
}

export function useImportPrByUrl(options: UseImportPrByUrlOptions = {}) {
  const { currentPrId, onBeforeImport, onImportSuccess, onImportError, onSamePrImport } =
    options
  const { navigate } = useNavigation()
  const { refresh: refreshRepos } = useReposStore()
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  const handleImportUrl = useCallback(
    async (url: string) => {
      debugApiLog("useImportPrByUrl", {
        currentPrId: currentPrId ?? "(none)",
        url,
      })
      setImporting(true)
      setImportError(null)
      onBeforeImport?.()
      try {
        const result = await importPullRequestByUrl(url)
        debugApiLog("useImportPrByUrl success", {
          prId: result.prId,
          repoId: result.repoId,
          source: result.source,
          repositoryCreated: result.repositoryCreated,
        })
        await refreshRepos()
        onImportSuccess?.(result)

        if (currentPrId && result.prId === currentPrId) {
          onSamePrImport?.()
        } else {
          sessionStorage.setItem(PENDING_AUTO_ANALYZE_KEY, result.prId)
          navigate("ai-review", { prId: result.prId })
        }
      } catch (error) {
        debugApiError("useImportPrByUrl", error)
        const message = formatImportErrorMessage(error, zh.common.importFailed)
        setImportError(message)
        onImportError?.(message)
      } finally {
        setImporting(false)
      }
    },
    [
      currentPrId,
      navigate,
      onBeforeImport,
      onImportError,
      onImportSuccess,
      onSamePrImport,
      refreshRepos,
    ],
  )

  return {
    importing,
    importError,
    setImportError,
    handleImportUrl,
  }
}
