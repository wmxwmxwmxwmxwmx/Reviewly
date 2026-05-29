"use client"

import { useEffect, useState } from "react"

/** True after the component has mounted on the client (avoids SSR/client DOM mismatch). */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  return hydrated
}
