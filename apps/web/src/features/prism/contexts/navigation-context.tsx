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

function buildQuery(view: NavView, params?: NavParams, currentPrId?: string | null) {
  const qs = new URLSearchParams()
  qs.set("view", view)

  if (view === "ai-review") {
    qs.set("prId", params?.prId ?? currentPrId ?? DEFAULT_PR_ID)
  }

  if (params?.file) qs.set("file", params.file)
  if (params?.line) qs.set("line", params.line)

  return qs.toString()
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const viewParam = searchParams.get("view")
  const activeView = isNavView(viewParam) ? viewParam : DEFAULT_VIEW
  const prId =
    searchParams.get("prId") ??
    (activeView === "ai-review" ? DEFAULT_PR_ID : null)

  useEffect(() => {
    if (!searchParams.get("view")) {
      router.replace(`/?${buildQuery(DEFAULT_VIEW, { prId: DEFAULT_PR_ID })}`)
    }
  }, [router, searchParams])

  const navigate = useCallback(
    (view: NavView, params?: NavParams) => {
      const query = buildQuery(view, params, prId)
      router.push(`/?${query}`)
    },
    [router, prId],
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
