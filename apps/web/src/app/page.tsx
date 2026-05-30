"use client"

import { Suspense, useState } from "react"
import { Menu } from "lucide-react"
import { Sidebar } from "@/features/prism/components/sidebar"
import { AISettingsProvider } from "@/features/prism/contexts/ai-settings-context"
import { SecuritySettingsProvider } from "@/features/prism/contexts/security-settings-context"
import { SessionLockOverlay } from "@/features/prism/components/session-lock-overlay"
import { AIReviewSessionProvider } from "@/features/prism/contexts/ai-review-session-context"
import { ReposProvider } from "@/features/prism/contexts/repos-context"
import { RunningTasksProvider } from "@/features/prism/contexts/running-tasks-context"
import { DashboardProvider } from "@/features/prism/contexts/dashboard-context"
import { NavigationProvider, useNavigation } from "@/features/prism/contexts/navigation-context"
import { AiReviewWorkspace } from "@/features/prism/views/ai-review-workspace"
import { StandardView } from "@/features/prism/components/view-registry"
import { Toaster } from "@/components/ui/toaster"
import { ErrorBoundary } from "@/components/error-boundary"
function PRismPageContent() {
  const { activeView, prId, reviewTab, navigate } = useNavigation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleViewChange = (view: typeof activeView) => {
    if (view === "ai-review") {
      navigate("ai-review", { aiReviewList: true })
    } else {
      navigate(view)
    }
    setSidebarOpen(false)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar
        activeView={activeView}
        onViewChange={handleViewChange}
        className="hidden lg:flex"
      />

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <Sidebar
            activeView={activeView}
            onViewChange={handleViewChange}
            className="relative z-10 h-full shadow-2xl"
            onClose={() => setSidebarOpen(false)}
            mobile
          />
        </div>
      )}

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {activeView !== "ai-review" && (
          <div className="flex items-center gap-3 h-12 px-4 border-b border-border bg-[oklch(0.125_0.004_264/0.95)] shrink-0 lg:hidden">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent transition-colors"
              aria-label="打开菜单"
            >
              <Menu className="w-5 h-5 text-foreground" />
            </button>
            <span className="text-sm font-semibold text-foreground">PRism</span>
          </div>
        )}

        {activeView === "ai-review" ? (
          <ErrorBoundary section="AI 评审" key={`ai-review-${prId ?? "workspace"}`}>
            <AiReviewWorkspace
              prId={prId}
              reviewTab={reviewTab}
              onMenuClick={() => setSidebarOpen(true)}
            />
          </ErrorBoundary>
        ) : (
          <main className="flex-1 overflow-y-auto">
            <ErrorBoundary section="当前视图" key={activeView}>
              <StandardView view={activeView} />
            </ErrorBoundary>
          </main>
        )}
      </div>

    </div>
  )
}

export default function PRismPage() {
  return (
    <AISettingsProvider>
      <SecuritySettingsProvider>
        <Toaster />
        <Suspense
          fallback={
            <div className="flex h-screen items-center justify-center bg-background text-muted-foreground text-sm">
              加载中…
            </div>
          }
        >
          <AIReviewSessionProvider>
            <RunningTasksProvider>
              <ReposProvider>
                <DashboardProvider>
                <NavigationProvider>
                  <ErrorBoundary section="PRism">
                    <PRismPageContent />
                    <SessionLockOverlay />
                  </ErrorBoundary>
                </NavigationProvider>
                </DashboardProvider>
              </ReposProvider>
            </RunningTasksProvider>
          </AIReviewSessionProvider>
        </Suspense>
      </SecuritySettingsProvider>
    </AISettingsProvider>
  )
}
