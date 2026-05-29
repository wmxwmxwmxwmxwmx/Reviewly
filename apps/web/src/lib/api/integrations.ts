import { apiFetch } from "./client"

export interface GithubInstallInfo {
  url: string
  status: string
  connected: boolean
  hostLabel: string | null
}

export function fetchGithubInstallInfo(signal?: AbortSignal) {
  return apiFetch<GithubInstallInfo>("/api/integrations/github/install-url", { signal })
}
