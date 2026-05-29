"use client"

import { useCallback, useEffect, useState } from "react"

import { useAISettings } from "@/features/prism/contexts/ai-settings-context"
import { useReposStore } from "@/features/prism/contexts/repos-context"
import { streamArchitectureAnalyze } from "@/lib/api/architecture"
import { saveRepoArchitectureAnalysis } from "@/lib/api/repos"

export function useArchitectureAnalyze(repoId: string | null) {
  const { settings } = useAISettings()
  const { repos, refresh: refreshRepos } = useReposStore()
  const [content, setContent] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cached = repoId
    ? repos.find((r) => r.id === repoId)?.aiArchitectureAnalysis?.content
    : undefined

  useEffect(() => {
    setContent(cached ?? "")
  }, [repoId, cached])

  const analyze = useCallback(async () => {
    if (!repoId) return
    setLoading(true)
    setError(null)
    setContent("")

    let accumulated = ""

    try {
      await streamArchitectureAnalyze(repoId, {
        onDelta: (delta) => {
          accumulated += delta
          setContent((prev) => prev + delta)
        },
        onError: (msg) => setError(msg),
      })

      if (accumulated.trim()) {
        await saveRepoArchitectureAnalysis(repoId, {
          content: accumulated,
          model: settings.model,
          provider: settings.provider,
        })
        await refreshRepos()
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "分析失败")
    } finally {
      setLoading(false)
    }
  }, [repoId, settings.model, settings.provider, refreshRepos])

  return { content, loading, error, analyze }
}
