"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

const LEGACY_DEMO_PR_ID = "pr-2847"
import type { AnalysisFinding, AnalysisJob, AnalysisSummary } from "@reviewly/shared"

export type AIReviewPanelTab =
  | "stream"
  | "risks"
  | "merge"
  | "governance"
  | "incidents"

export type AIReviewSession = {
  findings: AnalysisFinding[]
  latest: AnalysisSummary | null
  job: AnalysisJob | null
  generatedSummary?: string
  analysisError?: string | null
  syncLabel?: string
  activePanelTab?: AIReviewPanelTab
  hydratedAt: number
}

export type AIReviewSessionPatch = Partial<
  Omit<AIReviewSession, "hydratedAt">
> & {
  hydratedAt?: number
}

const SUMMARY_STORAGE_PREFIX = "prism:ai-summary:"

function emptySession(): AIReviewSession {
  return {
    findings: [],
    latest: null,
    job: null,
    hydratedAt: 0,
  }
}

function hasSessionData(session: AIReviewSession): boolean {
  return (
    session.findings.length > 0 ||
    session.latest !== null ||
    session.job !== null ||
    Boolean(session.generatedSummary)
  )
}

function readStoredSummary(prId: string): string | undefined {
  if (typeof window === "undefined") return undefined
  try {
    const value = sessionStorage.getItem(`${SUMMARY_STORAGE_PREFIX}${prId}`)
    return value ?? undefined
  } catch {
    return undefined
  }
}

function writeStoredSummary(prId: string, summary: string | undefined) {
  if (typeof window === "undefined") return
  try {
    const key = `${SUMMARY_STORAGE_PREFIX}${prId}`
    if (summary) {
      sessionStorage.setItem(key, summary)
    } else {
      sessionStorage.removeItem(key)
    }
  } catch {
    /* 容量不足或隐私模式时静默降级 */
  }
}

function mergeSessionWithStorage(
  prId: string,
  session: AIReviewSession,
): AIReviewSession {
  const storedSummary = readStoredSummary(prId)
  if (storedSummary && !session.generatedSummary) {
    return { ...session, generatedSummary: storedSummary }
  }
  return session
}

interface AIReviewSessionContextValue {
  lastReviewedPrId: string | null
  getSession: (prId: string) => AIReviewSession
  patchSession: (prId: string, patch: AIReviewSessionPatch) => void
  clearSession: (prId: string) => void
  hasCachedSession: (prId: string) => boolean
  setLastReviewedPrId: (prId: string) => void
  clearLastReviewedPrIdIfLegacy: () => void
}

const AIReviewSessionContext = createContext<AIReviewSessionContextValue | null>(
  null,
)

export function AIReviewSessionProvider({ children }: { children: ReactNode }) {
  const sessionsRef = useRef<Map<string, AIReviewSession>>(new Map())
  const [lastReviewedPrId, setLastReviewedPrIdState] = useState<string | null>(null)

  const getSession = useCallback((prId: string): AIReviewSession => {
    const mem = sessionsRef.current.get(prId) ?? emptySession()
    return mergeSessionWithStorage(prId, mem)
  }, [])

  const patchSession = useCallback((prId: string, patch: AIReviewSessionPatch) => {
    const prev = sessionsRef.current.get(prId) ?? emptySession()
    if ("generatedSummary" in patch) {
      writeStoredSummary(prId, patch.generatedSummary)
    }
    sessionsRef.current.set(prId, {
      ...prev,
      ...patch,
      hydratedAt: patch.hydratedAt ?? Date.now(),
    })
    setLastReviewedPrIdState(prId)
  }, [])

  const clearSession = useCallback((prId: string) => {
    sessionsRef.current.delete(prId)
    writeStoredSummary(prId, undefined)
  }, [])

  const hasCachedSession = useCallback((prId: string) => {
    const session = mergeSessionWithStorage(
      prId,
      sessionsRef.current.get(prId) ?? emptySession(),
    )
    return hasSessionData(session)
  }, [])

  const setLastReviewedPrId = useCallback((prId: string) => {
    if (prId === LEGACY_DEMO_PR_ID) {
      return
    }
    setLastReviewedPrIdState(prId)
  }, [])

  const clearLastReviewedPrIdIfLegacy = useCallback(() => {
    setLastReviewedPrIdState((current) =>
      current === LEGACY_DEMO_PR_ID ? null : current,
    )
  }, [])

  useEffect(() => {
    clearLastReviewedPrIdIfLegacy()
  }, [clearLastReviewedPrIdIfLegacy])

  const value = useMemo<AIReviewSessionContextValue>(
    () => ({
      lastReviewedPrId,
      getSession,
      patchSession,
      clearSession,
      hasCachedSession,
      setLastReviewedPrId,
      clearLastReviewedPrIdIfLegacy,
    }),
    [
      lastReviewedPrId,
      getSession,
      patchSession,
      clearSession,
      hasCachedSession,
      setLastReviewedPrId,
      clearLastReviewedPrIdIfLegacy,
    ],
  )

  return (
    <AIReviewSessionContext.Provider value={value}>
      {children}
    </AIReviewSessionContext.Provider>
  )
}

export function useAIReviewSession() {
  const context = useContext(AIReviewSessionContext)
  if (!context) {
    throw new Error("useAIReviewSession must be used within AIReviewSessionProvider")
  }
  return context
}
