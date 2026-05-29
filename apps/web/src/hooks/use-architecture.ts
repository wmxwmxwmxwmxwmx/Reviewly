"use client"

import { useEffect, useState } from "react"

import type { ArchitectureGraph } from "@/lib/api/architecture"
import { fetchArchitectureGraph } from "@/lib/api/architecture"
import { PrismApiError } from "@/lib/api/client"

export function useArchitecture(repoId: string | null) {
  const [graph, setGraph] = useState<ArchitectureGraph | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!repoId) {
      setGraph(null)
      setLoading(false)
      setError(null)
      return
    }

    const ac = new AbortController()
    setLoading(true)
    setError(null)
    fetchArchitectureGraph(repoId, ac.signal)
      .then(setGraph)
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return
        setError(e instanceof PrismApiError ? e.message : "加载失败")
      })
      .finally(() => setLoading(false))

    return () => ac.abort()
  }, [repoId])

  return { graph, loading, error }
}
