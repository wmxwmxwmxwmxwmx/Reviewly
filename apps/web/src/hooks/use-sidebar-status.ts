"use client"

import { useEffect, useState } from "react"

import { fetchGithubInstallInfo, type GithubInstallInfo } from "@/lib/api/integrations"
import { fetchTeamMembers } from "@/lib/api/team"
import type { TeamMember } from "@reviewly/shared"

export interface SidebarStatusState {
  github: GithubInstallInfo | null
  member: TeamMember | null
  ready: boolean
}

const initial: SidebarStatusState = {
  github: null,
  member: null,
  ready: false,
}

export function useSidebarStatus() {
  const [state, setState] = useState<SidebarStatusState>(initial)

  useEffect(() => {
    const ac = new AbortController()

    Promise.all([
      fetchGithubInstallInfo(ac.signal).catch(() => null),
      fetchTeamMembers(ac.signal).catch(() => [] as TeamMember[]),
    ])
      .then(([github, members]) => {
        setState({
          github,
          member: members[0] ?? null,
          ready: true,
        })
      })
      .catch(() => {
        setState({ github: null, member: null, ready: true })
      })

    return () => ac.abort()
  }, [])

  return state
}
