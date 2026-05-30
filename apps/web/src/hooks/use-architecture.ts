"use client"

import { useCallback, useEffect, useState } from "react"

import { PrismApiError } from "@/lib/api/client"
import {
  fetchArchitectureGraph,
  postArchitectureScan,
  type ArchitectureGraph,
} from "@/lib/api/architecture"

export function useArchitecture(repoId: string | null) {
  const [graph, setGraph] = useState<ArchitectureGraph | null>(null)
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!repoId) {
        setGraph(null)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const data = await fetchArchitectureGraph(repoId, signal)
        setGraph(data)
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === "AbortError") return
        setError(e instanceof PrismApiError ? e.message : "加载失败")
      } finally {
        setLoading(false)
      }
    },
    [repoId],
  )

  useEffect(() => {
    const ac = new AbortController()
    void load(ac.signal)
    return () => ac.abort()
  }, [load])

  const scan = useCallback(async (): Promise<ArchitectureGraph | null> => {
    if (!repoId) return null
    setScanning(true)
    setError(null)
    try {
      const data = await postArchitectureScan(repoId)
      setGraph(data)
      return data
    } catch (e: unknown) {
      setError(e instanceof PrismApiError ? e.message : "扫描失败")
      return null
    } finally {
      setScanning(false)
    }
  }, [repoId])

  const refetch = useCallback(() => load(), [load])

  return {
    graph,
    metrics: graph?.metrics ?? null,
    loading,
    scanning,
    error,
    scan,
    refetch,
  }
}
