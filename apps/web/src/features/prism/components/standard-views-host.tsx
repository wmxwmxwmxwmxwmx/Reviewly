"use client"

import { useEffect, useState } from "react"

import { ErrorBoundary } from "@/components/error-boundary"
import type { NavView } from "@/features/prism/components/sidebar"
import { StandardView } from "@/features/prism/components/view-registry"
import { cn } from "@/lib/utils"

type StandardViewId = Exclude<NavView, "ai-review">

function toStandardView(view: NavView): StandardViewId | null {
  return view === "ai-review" ? null : view
}

/** Keep visited standard views mounted to avoid remount storms when switching sidebar modules. */
export function StandardViewsHost({ activeView }: { activeView: NavView }) {
  const [mounted, setMounted] = useState<Set<StandardViewId>>(() => {
    const initial = toStandardView(activeView)
    return new Set(initial ? [initial] : ["dashboard"])
  })

  useEffect(() => {
    const view = toStandardView(activeView)
    if (!view) return
    setMounted((prev) => {
      if (prev.has(view)) return prev
      const next = new Set(prev)
      next.add(view)
      return next
    })
  }, [activeView])

  const activeStandard = toStandardView(activeView)

  return (
    <main className="flex-1 overflow-y-auto min-h-0">
      {Array.from(mounted).map((view) => (
        <div
          key={view}
          className={cn("min-h-full", activeStandard !== view && "hidden")}
          aria-hidden={activeStandard !== view}
        >
          <ErrorBoundary section={view}>
            <StandardView view={view} />
          </ErrorBoundary>
        </div>
      ))}
    </main>
  )
}
