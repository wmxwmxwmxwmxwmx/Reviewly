import type { Repository } from "@reviewly/shared"

import { apiFetch } from "./client"

export function fetchRepos(signal?: AbortSignal) {
  return apiFetch<Repository[]>("/api/repos", { signal })
}
