import type { Repository, RepoReviewGroup } from "@reviewly/shared"

/** Fallback when review-center repo-groups is empty: group by repository owner. */
export function groupReposByOwner(repos: Repository[]): RepoReviewGroup[] {
  const map = new Map<string, RepoReviewGroup>()
  for (const repo of repos) {
    const owner = repo.owner?.trim() || repo.fullName.split("/")[0] || "其他"
    const key = owner.toLowerCase()
    let group = map.get(key)
    if (!group) {
      group = {
        id: key,
        label: owner,
        repos: [],
      }
      map.set(key, group)
    }
    group.repos.push({
      id: repo.id,
      name: repo.name,
      fullName: repo.fullName,
      prCount: repo.openPrCount ?? 0,
      language: repo.language,
    })
  }
  return Array.from(map.values())
    .map((g) => ({
      ...g,
      repos: [...g.repos].sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export function resolveDashboardRepoGroups(
  repoGroups: RepoReviewGroup[],
  repos: Repository[],
): RepoReviewGroup[] {
  if (repoGroups.some((g) => g.repos.length > 0)) return repoGroups
  return groupReposByOwner(repos)
}
