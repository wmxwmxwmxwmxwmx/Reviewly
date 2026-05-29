"use client"

import { useCallback, useState } from "react"

import { streamArchitectureAnalyze } from "@/lib/api/architecture"

export function useArchitectureAnalyze(repoId: string | null) {
  const [content, setContent] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const analyze = useCallback(async () => {
    if (!repoId) return
    setLoading(true)
    setError(null)
    setContent("")
    try {
      await streamArchitectureAnalyze(repoId, {
        onDelta: (delta) => setContent((prev) => prev + delta),
        onError: (msg) => setError(msg),
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "分析失败")
    } finally {
      setLoading(false)
    }
  }, [repoId])

  return { content, loading, error, analyze }
}
