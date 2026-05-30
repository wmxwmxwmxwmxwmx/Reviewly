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

/** Same section order as 仓库管理: owned → managed → external. */
export function repoManagementDisplayOrder(repos: Repository[]): Repository[] {
  const owned: Repository[] = []
  const managed: Repository[] = []
  const external: Repository[] = []
  for (const repo of repos) {
    const category = repoCategory(repo)
    if (category === "owned") owned.push(repo)
    else if (category === "managed") managed.push(repo)
    else external.push(repo)
  }
  return [...owned, ...managed, ...external]
}
