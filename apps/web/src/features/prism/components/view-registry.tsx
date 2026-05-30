"use client"

import type { NavView } from "@/features/prism/components/sidebar"
import { DashboardView } from "@/features/prism/views/dashboard-view"
import { PRListView } from "@/features/prism/views/pr-list-view"
import { SecurityView } from "@/features/prism/views/security-view"
import { PerformanceView } from "@/features/prism/views/performance-view"
import { ArchitectureView } from "@/features/prism/views/architecture-view"
import { GovernanceView } from "@/features/prism/views/governance-view"
import { ReposView } from "@/features/prism/views/repos-view"
import { TeamView } from "@/features/prism/views/team-view"
import { SettingsView } from "@/features/prism/views/settings-view"

export function StandardView({ view }: { view: Exclude<NavView, "ai-review"> }) {
  switch (view) {
    case "dashboard":
      return <DashboardView />
    case "pull-requests":
      return <PRListView />
    case "security":
      return <SecurityView />
    case "performance":
      return <PerformanceView />
    case "architecture":
      return <ArchitectureView />
    case "governance":
      return <GovernanceView />
    case "repos":
      return <ReposView />
    case "team":
      return <TeamView />
    case "settings":
      return <SettingsView />
  }
}
