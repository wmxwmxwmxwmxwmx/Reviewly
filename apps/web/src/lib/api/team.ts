import type { TeamMember } from "@reviewly/shared"

import { apiFetch } from "./client"

export function fetchTeamMembers(signal?: AbortSignal) {
  return apiFetch<TeamMember[]>("/api/team/members", { signal })
}
