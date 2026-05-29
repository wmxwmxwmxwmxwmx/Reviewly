"use client"

import { useCallback, useState } from "react"

import { PrismApiError } from "@/lib/api/client"
import { importRepository, syncRepositories } from "@/lib/api/repos"

export function useReposSync(onSuccess?: () => void | Promise<void>) {
  const [importing, setImporting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const importRepo = useCallback(
    async (url: string) => {
      const trimmed = url.trim()
      if (!trimmed) {
        setError("请输入 GitHub 仓库 URL")
        return null
      }

      setImporting(true)
      setError(null)
      try {
        const result = await importRepository(trimmed)
        await onSuccess?.()
        return result.repository
      } catch (e: unknown) {
        const message = e instanceof PrismApiError ? e.message : "添加仓库失败"
        setError(message)
        throw e
      } finally {
        setImporting(false)
      }
    },
    [onSuccess],
  )

  const syncRepos = useCallback(async () => {
    setSyncing(true)
    setError(null)
    try {
      const result = await syncRepositories()
      await onSuccess?.()
      return result
    } catch (e: unknown) {
      const message = e instanceof PrismApiError ? e.message : "同步失败"
      setError(message)
      throw e
    } finally {
      setSyncing(false)
    }
  }, [onSuccess])

  const clearError = useCallback(() => setError(null), [])

  return {
    importing,
    syncing,
    error,
    importRepo,
    syncRepos,
    clearError,
  }
}
