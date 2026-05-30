"use client"

import { useEffect, useMemo, useState } from "react"

import { fetchAllSecurityFindings } from "@/lib/api/security"
import { isAbortError } from "@/lib/abort-utils"

/** Map repository-relative file paths to open security finding counts. */
export function useArchitectureSecurityFindings(repoFullName: string | undefined) {
  const [counts, setCounts] = useState<Map<string, number>>(new Map())

  useEffect(() => {
    if (!repoFullName) {
      setCounts(new Map())
      return
    }

    const ac = new AbortController()

    void (async () => {
      try {
        const findings = await fetchAllSecurityFindings({
          repo: repoFullName,
          signal: ac.signal,
        })
        const map = new Map<string, number>()
        for (const f of findings) {
          if (!f.file) continue
          const key = f.file.replace(/\\/g, "/")
          map.set(key, (map.get(key) ?? 0) + 1)
        }
        if (!ac.signal.aborted) setCounts(map)
      } catch (e: unknown) {
        if (!isAbortError(e)) setCounts(new Map())
      }
    })()

    return () => ac.abort()
  }, [repoFullName])

  return useMemo(() => counts, [counts])
}
