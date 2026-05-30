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
  "repos",
  "ai-review",
  "findings",
  "settings",
  "pull-requests",
  "security",
  "performance",
  "architecture",
  "governance",
  "team",
]

export type FindingsTab = "all" | "security" | "performance"

function isNavView(value: string | null): value is NavView {
  return value !== null && (NAV_VIEWS as string[]).includes(value)
}

function isLegacyDemoPrId(prId: string | null | undefined): boolean {
  return prId === LEGACY_DEMO_PR_ID
}

function legacyViewRedirect(view: NavView): { view: NavView; tab?: FindingsTab } | null {
  if (view === "security") return { view: "findings", tab: "security" }
  if (view === "performance") return { view: "findings", tab: "performance" }
  return null
}

export type NavParams = {
  prId?: string
  repoId?: string
  file?: string
  line?: string
  tab?: FindingsTab
  findingId?: string
  status?: string
  /** Open AI review list without restoring last reviewed PR from session. */
  aiReviewList?: boolean
  /** Review center sub-tab: dashboard | pending | all | rules | stats | settings */
  reviewTab?: string
}

interface NavigationContextValue {
  activeView: NavView
  prId: string | null
  repoId: string | null
  reviewTab: string | null
  findingsTab: FindingsTab
  findingId: string | null
  navigate: (view: NavView, params?: NavParams) => void
}

const NavigationContext = createContext<NavigationContextValue | null>(null)

function resolvePrId(
  view: NavView,
  params: NavParams | undefined,
  _lastReviewedPrId: string | null,
): string | null {
  if (view !== "ai-review") {
    return null
  }
  if (params?.aiReviewList) {
    return null
  }
  const candidate = params?.prId ?? null
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

  if (params?.repoId) qs.set("repoId", params.repoId)
  if (params?.file) qs.set("file", params.file)
  if (params?.line) qs.set("line", params.line)
  if (params?.tab) qs.set("tab", params.tab)
  if (params?.findingId) qs.set("findingId", params.findingId)
  if (params?.status) qs.set("status", params.status)
  if (params?.reviewTab) qs.set("reviewTab", params.reviewTab)

  return qs.toString()
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { lastReviewedPrId, clearLastReviewedPrIdIfLegacy } = useAIReviewSession()

  const rawViewParam = searchParams.get("view")
  const legacy = rawViewParam && isNavView(rawViewParam) ? legacyViewRedirect(rawViewParam) : null

  const viewParam = legacy?.view ?? rawViewParam
  const activeView = isNavView(viewParam) ? viewParam : DEFAULT_VIEW
  const urlPrId = searchParams.get("prId")
  const repoId = searchParams.get("repoId")
  const tabParam = searchParams.get("tab")
  const findingsTab: FindingsTab =
    tabParam === "security" || tabParam === "performance" ? tabParam : "all"
  const findingId = searchParams.get("findingId")
  const reviewTab = searchParams.get("reviewTab")

  const prId =
    activeView === "ai-review" && urlPrId && !isLegacyDemoPrId(urlPrId) ? urlPrId : null

  useEffect(() => {
    clearLastReviewedPrIdIfLegacy()
  }, [clearLastReviewedPrIdIfLegacy])

  useEffect(() => {
    if (legacy) {
      const qs = new URLSearchParams(searchParams.toString())
      qs.set("view", legacy.view)
      if (legacy.tab) qs.set("tab", legacy.tab)
      router.replace(`/?${qs.toString()}`)
    }
  }, [legacy, router, searchParams])

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
    () => ({ activeView, prId, repoId, reviewTab, findingsTab, findingId, navigate }),
    [activeView, prId, repoId, reviewTab, findingsTab, findingId, navigate],
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
