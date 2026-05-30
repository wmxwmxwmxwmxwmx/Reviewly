"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { PrismApiError } from "@/lib/api/client"
import {
  fetchArchitectureGraph,
  streamArchitectureScan,
  type ArchitectureGraph,
  type ArchitectureScanProgress,
} from "@/lib/api/architecture"

export function useArchitecture(repoId: string | null) {
  const [graph, setGraph] = useState<ArchitectureGraph | null>(null)
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState<ArchitectureScanProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const scanAbort = useRef<AbortController | null>(null)

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

  useEffect(() => {
    scanAbort.current?.abort()
    setScanProgress(null)
    return () => {
      scanAbort.current?.abort()
    }
  }, [repoId])

  const scan = useCallback(async (): Promise<ArchitectureGraph | null> => {
    if (!repoId) return null

    scanAbort.current?.abort()
    const ac = new AbortController()
    scanAbort.current = ac

    setScanning(true)
    setError(null)
    setScanProgress({ phase: "prepare", percent: 0, message: "开始扫描…" })

    try {
      const data = await streamArchitectureScan(repoId, {
        signal: ac.signal,
        onProgress: (progress) => {
          if (!ac.signal.aborted) setScanProgress(progress)
        },
        onError: (msg) => {
          if (!ac.signal.aborted) setError(msg)
        },
      })

      if (ac.signal.aborted) return null

      setGraph(data)
      setScanProgress({ phase: "done", percent: 100, message: "扫描完成" })
      return data
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return null

      const msg = e instanceof Error ? e.message : "扫描失败"
      setError(msg)

      if (/超时|timeout|502|Gateway/i.test(msg)) {
        try {
          const cached = await fetchArchitectureGraph(repoId)
          if (cached.nodes.length > 0) {
            setGraph(cached)
            setError(null)
            return cached
          }
        } catch {
          /* ignore secondary fetch failure */
        }
      }
      return null
    } finally {
      if (scanAbort.current === ac) {
        setScanning(false)
        setScanProgress(null)
      }
    }
  }, [repoId])

  const refetch = useCallback(() => load(), [load])

  return {
    graph,
    metrics: graph?.metrics ?? null,
    loading,
    scanning,
    scanProgress,
    error,
    scan,
    refetch,
  }
}
