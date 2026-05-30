"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react"
import { useRouter, useSearchParams } from "next/navigation"
import type { NavView } from "@/features/prism/components/sidebar"
import { useAIReviewSession } from "@/features/prism/contexts/ai-review-session-context"

/** Legacy demo PR id — never use as default navigation target. */
export const LEGACY_DEMO_PR_ID = "pr-2847"

const DEFAULT_VIEW: NavView = "dashboard"

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

function isLegacyDemoPrId(prId: string | null | undefined): boolean {
  return prId === LEGACY_DEMO_PR_ID
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
  lastReviewedPrId: string | null,
): string | null {
  if (view !== "ai-review") {
    return null
  }
  const candidate = params?.prId ?? lastReviewedPrId ?? null
  if (isLegacyDemoPrId(candidate)) {
    return null
  }
  return candidate
}

function buildQuery(
  view: NavView,
  params: NavParams | undefined,
  lastReviewedPrId: string | null,
) {
  const qs = new URLSearchParams()
  qs.set("view", view)

  const prId = resolvePrId(view, params, lastReviewedPrId)
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
  const { lastReviewedPrId, clearLastReviewedPrIdIfLegacy } = useAIReviewSession()

  const viewParam = searchParams.get("view")
  const activeView = isNavView(viewParam) ? viewParam : DEFAULT_VIEW
  const urlPrId = searchParams.get("prId")

  const prId =
    activeView === "ai-review"
      ? isLegacyDemoPrId(urlPrId)
        ? null
        : urlPrId ?? (isLegacyDemoPrId(lastReviewedPrId) ? null : lastReviewedPrId)
      : null

  useEffect(() => {
    clearLastReviewedPrIdIfLegacy()
  }, [clearLastReviewedPrIdIfLegacy])

  useEffect(() => {
    const hasView = Boolean(searchParams.get("view"))
    const rawPrId = searchParams.get("prId")
    const needsPrStrip =
      rawPrId && (activeView !== "ai-review" || isLegacyDemoPrId(rawPrId))
    const needsDefaultView = !hasView

    if (needsDefaultView || needsPrStrip) {
      const view = hasView && isNavView(viewParam) ? viewParam! : DEFAULT_VIEW
      const params: NavParams | undefined =
        view === "ai-review" && rawPrId && !isLegacyDemoPrId(rawPrId)
          ? { prId: rawPrId }
          : undefined
      router.replace(`/?${buildQuery(view, params, lastReviewedPrId)}`)
    }
  }, [router, searchParams, activeView, viewParam, lastReviewedPrId])

  const navigate = useCallback(
    (view: NavView, params?: NavParams) => {
      const query = buildQuery(view, params, lastReviewedPrId)
      router.replace(`/?${query}`)
    },
    [router, lastReviewedPrId],
  )

  const contextValue = useMemo(
    () => ({ activeView, prId, navigate }),
    [activeView, prId, navigate],
  )

  return (
    <NavigationContext.Provider value={contextValue}>
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
