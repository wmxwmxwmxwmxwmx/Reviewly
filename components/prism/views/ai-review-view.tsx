"use client"

import { useState } from "react"
import { Header } from "@/components/prism/header"
import { PROverview } from "@/components/prism/pr-overview"
import { AISummary } from "@/components/prism/ai-summary"
import { DiffViewer } from "@/components/prism/diff-viewer"
import { AIPanel } from "@/components/prism/ai-panel"
import { mockPRData } from "@/components/prism/mock-data"
import { cn } from "@/lib/utils"

interface AIReviewViewProps {
  onMenuClick?: () => void
  aiPanelOpen?: boolean
  onToggleAIPanel?: () => void
}

export function AIReviewView({
  onMenuClick,
  aiPanelOpen = true,
  onToggleAIPanel,
}: AIReviewViewProps) {
  const [analyzing, setAnalyzing] = useState(false)
  const [chunkProgress, setChunkProgress] = useState({ current: 48, total: 48 })

  const handleAnalyze = () => {
    if (analyzing) return
    setAnalyzing(true)
    setChunkProgress({ current: 0, total: 48 })

    let current = 0
    const interval = setInterval(() => {
      current += Math.floor(Math.random() * 4) + 1
      if (current >= 48) {
        current = 48
        clearInterval(interval)
        setTimeout(() => {
          setAnalyzing(false)
          setChunkProgress({ current: 48, total: 48 })
        }, 700)
      }
      setChunkProgress({ current, total: 48 })
    }, 130)
  }

  return (
    <div className="flex flex-1 min-w-0 overflow-hidden">
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <Header
            prData={mockPRData}
            analyzing={analyzing}
            onAnalyze={handleAnalyze}
            onMenuClick={onMenuClick}
            aiPanelOpen={aiPanelOpen}
            onToggleAIPanel={onToggleAIPanel}
          />

          <div className="p-5 space-y-4">
            <PROverview prData={mockPRData} />
            <AISummary streaming={analyzing} />

            <div className="flex items-center justify-between pt-1">
              <h3 className="text-sm font-semibold text-foreground">文件变更</h3>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span>{mockPRData.filesChanged} 文件</span>
                <span className="text-[oklch(0.62_0.17_148)]">+{mockPRData.additions.toLocaleString()}</span>
                <span className="text-[oklch(0.55_0.22_27)]">-{mockPRData.deletions.toLocaleString()}</span>
              </div>
            </div>

            <DiffViewer
              analyzing={analyzing}
              chunkProgress={analyzing ? chunkProgress : undefined}
            />
          </div>
        </main>
      </div>

      <div
        className={cn(
          "shrink-0 transition-all duration-200",
          aiPanelOpen ? "w-[390px]" : "w-0 overflow-hidden",
          "max-xl:fixed max-xl:right-0 max-xl:top-0 max-xl:h-full max-xl:z-40 max-xl:shadow-2xl",
          !aiPanelOpen && "max-xl:w-0 max-xl:overflow-hidden"
        )}
      >
        {aiPanelOpen && <AIPanel analyzing={analyzing} />}
      </div>
    </div>
  )
}
