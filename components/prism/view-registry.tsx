"use client"

import type { NavView } from "@/components/prism/sidebar"
import { DashboardView } from "@/components/prism/views/dashboard-view"
import { PRListView } from "@/components/prism/views/pr-list-view"
import { SecurityView } from "@/components/prism/views/security-view"
import { PerformanceView } from "@/components/prism/views/performance-view"
import { ArchitectureView } from "@/components/prism/views/architecture-view"
import { GovernanceView } from "@/components/prism/views/governance-view"
import { ReposView } from "@/components/prism/views/repos-view"
import { TeamView } from "@/components/prism/views/team-view"
import { SettingsView } from "@/components/prism/views/settings-view"

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
