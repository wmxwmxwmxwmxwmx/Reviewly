"use client"

import { useCallback, useEffect, useRef, useState } from "react"

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
  const analyzeAbort = useRef<AbortController | null>(null)

  const cached = repoId
    ? repos.find((r) => r.id === repoId)?.aiArchitectureAnalysis?.content
    : undefined

  useEffect(() => {
    setContent(cached ?? "")
  }, [repoId, cached])

  useEffect(() => {
    return () => {
      analyzeAbort.current?.abort()
    }
  }, [])

  const analyze = useCallback(async () => {
    if (!repoId) return

    analyzeAbort.current?.abort()
    const ac = new AbortController()
    analyzeAbort.current = ac

    setLoading(true)
    setError(null)
    setContent("")

    let accumulated = ""

    try {
      await streamArchitectureAnalyze(repoId, {
        signal: ac.signal,
        onDelta: (delta) => {
          accumulated += delta
          setContent((prev) => prev + delta)
        },
        onError: (msg) => setError(msg),
      })

      if (ac.signal.aborted) return

      if (accumulated.trim()) {
        await saveRepoArchitectureAnalysis(repoId, {
          content: accumulated,
          model: settings.model,
          provider: settings.provider,
        })
        await refreshRepos()
      }
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return
      setError(e instanceof Error ? e.message : "分析失败")
    } finally {
      if (!ac.signal.aborted) {
        setLoading(false)
      }
    }
  }, [repoId, settings.model, settings.provider, refreshRepos])

  return { content, loading, error, analyze }
}
