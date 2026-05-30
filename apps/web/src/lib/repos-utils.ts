import type { Repository } from "@reviewly/shared"

export function repoCategory(repo: Repository): "owned" | "managed" | "external" {
  if (repo.repositoryType === "managed") return "managed"
  if (repo.repositoryType === "external" || repo.managed === false) return "external"
  return "owned"
}

export function isStatsEligibleRepo(repo: Repository): boolean {
  return repoCategory(repo) !== "external"
}

export function isExternalRepo(repo: Repository): boolean {
  return repoCategory(repo) === "external"
}
