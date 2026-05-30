"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { readViewState, writeViewState } from "@/lib/view-state-storage"

export function usePersistedViewState<T extends Record<string, unknown>>(
  viewKey: string,
  initial: T,
): [T, (patch: Partial<T> | ((prev: T) => T)) => void, boolean] {
  const initialRef = useRef(initial)
  const [hydrated, setHydrated] = useState(false)
  const [state, setState] = useState<T>(initialRef.current)

  useEffect(() => {
    const stored = readViewState<T>(viewKey)
    if (stored) {
      setState((prev) => ({ ...prev, ...stored }))
    }
    setHydrated(true)
  }, [viewKey])

  useEffect(() => {
    if (!hydrated) return
    const t = setTimeout(() => writeViewState(viewKey, state), 200)
    return () => clearTimeout(t)
  }, [viewKey, state, hydrated])

  useEffect(() => {
    const flush = () => {
      if (hydrated) writeViewState(viewKey, state)
    }
    window.addEventListener("beforeunload", flush)
    return () => window.removeEventListener("beforeunload", flush)
  }, [viewKey, state, hydrated])

  const setPersisted = useCallback((patch: Partial<T> | ((prev: T) => T)) => {
    setState((prev) => {
      if (typeof patch === "function") {
        return (patch as (p: T) => T)(prev)
      }
      return { ...prev, ...patch }
    })
  }, [])

  return [state, setPersisted, hydrated]
}
