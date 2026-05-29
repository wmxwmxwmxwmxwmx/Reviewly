"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
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

interface AIReviewSessionContextValue {
  lastReviewedPrId: string | null
  getSession: (prId: string) => AIReviewSession
  patchSession: (prId: string, patch: AIReviewSessionPatch) => void
  clearSession: (prId: string) => void
  hasCachedSession: (prId: string) => boolean
  setLastReviewedPrId: (prId: string) => void
}

const AIReviewSessionContext = createContext<AIReviewSessionContextValue | null>(
  null,
)

export function AIReviewSessionProvider({ children }: { children: ReactNode }) {
  const sessionsRef = useRef<Map<string, AIReviewSession>>(new Map())
  const [lastReviewedPrId, setLastReviewedPrIdState] = useState<string | null>(null)

  const getSession = useCallback((prId: string): AIReviewSession => {
    return sessionsRef.current.get(prId) ?? emptySession()
  }, [])

  const patchSession = useCallback((prId: string, patch: AIReviewSessionPatch) => {
    const prev = sessionsRef.current.get(prId) ?? emptySession()
    sessionsRef.current.set(prId, {
      ...prev,
      ...patch,
      hydratedAt: patch.hydratedAt ?? Date.now(),
    })
    setLastReviewedPrIdState(prId)
  }, [])

  const clearSession = useCallback((prId: string) => {
    sessionsRef.current.delete(prId)
  }, [])

  const hasCachedSession = useCallback((prId: string) => {
    const session = sessionsRef.current.get(prId)
    return session ? hasSessionData(session) : false
  }, [])

  const setLastReviewedPrId = useCallback((prId: string) => {
    setLastReviewedPrIdState(prId)
  }, [])

  const value = useMemo<AIReviewSessionContextValue>(
    () => ({
      lastReviewedPrId,
      getSession,
      patchSession,
      clearSession,
      hasCachedSession,
      setLastReviewedPrId,
    }),
    [
      lastReviewedPrId,
      getSession,
      patchSession,
      clearSession,
      hasCachedSession,
      setLastReviewedPrId,
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
