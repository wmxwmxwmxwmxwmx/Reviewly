"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  type ReactNode,
} from "react"
import { useRouter, useSearchParams } from "next/navigation"
import type { NavView } from "@/features/prism/components/sidebar"
import { useAIReviewSession } from "@/features/prism/contexts/ai-review-session-context"

export const DEFAULT_PR_ID = "pr-2847"
const DEFAULT_VIEW: NavView = "ai-review"

const NAV_VIEWS: NavView[] = [
  "dashboard",
  "pull-requests",
  "ai-review",
  "security",
  "performance",
  "architecture",
  "governance",
  "repos",
  "team",
  "settings",
]

function isNavView(value: string | null): value is NavView {
  return value !== null && (NAV_VIEWS as string[]).includes(value)
}

export type NavParams = {
  prId?: string
  file?: string
  line?: string
}

interface NavigationContextValue {
  activeView: NavView
  prId: string | null
  navigate: (view: NavView, params?: NavParams) => void
}

const NavigationContext = createContext<NavigationContextValue | null>(null)

function resolvePrId(
  view: NavView,
  params: NavParams | undefined,
  currentPrId: string | null,
  lastReviewedPrId: string | null,
): string | null {
  if (params?.prId) return params.prId
  if (currentPrId) return currentPrId
  if (lastReviewedPrId) return lastReviewedPrId
  if (view === "ai-review") return DEFAULT_PR_ID
  return null
}

function buildQuery(
  view: NavView,
  params: NavParams | undefined,
  currentPrId: string | null,
  lastReviewedPrId: string | null,
) {
  const qs = new URLSearchParams()
  qs.set("view", view)

  const prId = resolvePrId(view, params, currentPrId, lastReviewedPrId)
  if (prId) {
    qs.set("prId", prId)
  }

  if (params?.file) qs.set("file", params.file)
  if (params?.line) qs.set("line", params.line)

  return qs.toString()
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { lastReviewedPrId } = useAIReviewSession()

  const viewParam = searchParams.get("view")
  const activeView = isNavView(viewParam) ? viewParam : DEFAULT_VIEW
  const urlPrId = searchParams.get("prId")
  const prId =
    urlPrId ??
    lastReviewedPrId ??
    (activeView === "ai-review" ? DEFAULT_PR_ID : null)

  useEffect(() => {
    if (!searchParams.get("view")) {
      router.replace(
        `/?${buildQuery(DEFAULT_VIEW, { prId: DEFAULT_PR_ID }, null, lastReviewedPrId)}`,
      )
    }
  }, [router, searchParams, lastReviewedPrId])

  const navigate = useCallback(
    (view: NavView, params?: NavParams) => {
      const query = buildQuery(view, params, urlPrId ?? prId, lastReviewedPrId)
      router.push(`/?${query}`)
    },
    [router, urlPrId, prId, lastReviewedPrId],
  )

  return (
    <NavigationContext.Provider value={{ activeView, prId, navigate }}>
      {children}
    </NavigationContext.Provider>
  )
}

export function useNavigation() {
  const context = useContext(NavigationContext)
  if (!context) {
    throw new Error("useNavigation must be used within NavigationProvider")
  }
  return context
}
