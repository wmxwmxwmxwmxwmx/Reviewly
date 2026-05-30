"use client"

import { useCallback, useEffect, useState } from "react"

import type { ImportPullRequestResult } from "@reviewly/shared"

import { useNavigation } from "@/features/prism/contexts/navigation-context"
import { useReposStore } from "@/features/prism/contexts/repos-context"
import { debugApiError, debugApiLog } from "@/lib/debug-api-log"
import { importPullRequestByUrl } from "@/lib/api/pull-requests"
import { formatImportErrorMessage } from "@/lib/api/client"
import {
  adoptDismissKey,
  shouldPromptExternalOnboard,
} from "@/lib/repository-onboarding"
import { zh } from "@/lib/i18n/zh"

export const PENDING_AUTO_ANALYZE_KEY = "prism:pending-auto-analyze"
export const PENDING_ONBOARD_REPO_KEY = "prism:pending-onboard-repo-id"

export type { ImportPullRequestResult }

interface UseImportPrByUrlOptions {
  currentPrId?: string
  onBeforeImport?: () => void
  onImportSuccess?: (result: ImportPullRequestResult) => void
  onImportError?: (message: string) => void
  onSamePrImport?: () => void
}

function readPendingOnboardRepoId(): string | null {
  if (typeof sessionStorage === "undefined") return null
  const id = sessionStorage.getItem(PENDING_ONBOARD_REPO_KEY)
  if (!id) return null
  sessionStorage.removeItem(PENDING_ONBOARD_REPO_KEY)
  if (sessionStorage.getItem(adoptDismissKey(id)) === "1") return null
  return id
}

export function useImportPrByUrl(options: UseImportPrByUrlOptions = {}) {
  const { currentPrId, onBeforeImport, onImportSuccess, onImportError, onSamePrImport } =
    options
  const { navigate } = useNavigation()
  const { refresh: refreshRepos } = useReposStore()
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [pendingOnboardRepoId, setPendingOnboardRepoId] = useState<string | null>(null)

  useEffect(() => {
    const id = readPendingOnboardRepoId()
    if (id) setPendingOnboardRepoId(id)
  }, [])

  const clearPendingOnboard = useCallback(() => {
    setPendingOnboardRepoId(null)
  }, [])

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

        if (shouldPromptExternalOnboard(result)) {
          sessionStorage.setItem(PENDING_ONBOARD_REPO_KEY, result.repoId)
          setPendingOnboardRepoId(result.repoId)
        }

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
    pendingOnboardRepoId,
    clearPendingOnboard,
  }
}
