"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { readViewState, writeViewState } from "@/lib/view-state-storage"

export function usePersistedViewState<T extends Record<string, unknown>>(
  viewKey: string,
  initial: T,
): [T, (patch: Partial<T> | ((prev: T) => T)) => void] {
  const initialRef = useRef(initial)
  const [state, setState] = useState<T>(() => {
    const stored = readViewState<T>(viewKey)
    return stored ? { ...initialRef.current, ...stored } : initialRef.current
  })

  useEffect(() => {
    const t = setTimeout(() => writeViewState(viewKey, state), 200)
    return () => clearTimeout(t)
  }, [viewKey, state])

  const setPersisted = useCallback((patch: Partial<T> | ((prev: T) => T)) => {
    setState((prev) => {
      if (typeof patch === "function") {
        return (patch as (p: T) => T)(prev)
      }
      return { ...prev, ...patch }
    })
  }, [])

  return [state, setPersisted]
}
