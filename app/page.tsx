"use client"

import { useState, useEffect } from "react"
import { Menu } from "lucide-react"
import { Sidebar, type NavView } from "@/components/prism/sidebar"
import { AISettingsProvider } from "@/components/prism/ai-settings-context"
import { NavigationProvider } from "@/components/prism/navigation-context"
import { AIReviewView } from "@/components/prism/views/ai-review-view"
import { StandardView } from "@/components/prism/view-registry"

export default function PRismPage() {
  const [activeView, setActiveView] = useState<NavView>("ai-review")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [aiPanelOpen, setAiPanelOpen] = useState(true)

  const handleViewChange = (view: NavView) => {
    setActiveView(view)
    setSidebarOpen(false)
  }

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)")
    const syncPanel = () => setAiPanelOpen(mq.matches)
    syncPanel()
    mq.addEventListener("change", syncPanel)
    return () => mq.removeEventListener("change", syncPanel)
  }, [])

  return (
    <AISettingsProvider>
      <NavigationProvider activeView={activeView} navigate={handleViewChange}>
        <div className="flex h-screen overflow-hidden bg-background text-foreground">
          {/* Desktop sidebar */}
          <Sidebar
            activeView={activeView}
            onViewChange={handleViewChange}
            className="hidden lg:flex"
          />

        {/* Mobile sidebar drawer */}
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
            <AIReviewView
              onMenuClick={() => setSidebarOpen(true)}
              aiPanelOpen={aiPanelOpen}
              onToggleAIPanel={() => setAiPanelOpen((open) => !open)}
            />
          ) : (
            <main className="flex-1 overflow-y-auto">
              <StandardView view={activeView} />
            </main>
          )}
        </div>

          {/* Mobile AI panel backdrop */}
          {activeView === "ai-review" && aiPanelOpen && (
            <div
              className="fixed inset-0 z-30 bg-black/40 xl:hidden"
              onClick={() => setAiPanelOpen(false)}
            />
          )}
        </div>
      </NavigationProvider>
    </AISettingsProvider>
  )
}
