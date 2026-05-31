import type { Repository } from "@reviewly/shared"

import { syncRepoPullRequests } from "@/lib/api/repos"
import { isRepositoryManaged } from "@/lib/repos/is-repository-managed"
import { repoManagementDisplayOrder } from "@/lib/repos-utils"

/** Pull open PRs from GitHub for every managed repository (best-effort per repo). */
export async function syncManagedReposPullRequests(repos: Repository[]): Promise<void> {
  const managed = repoManagementDisplayOrder(repos).filter(isRepositoryManaged)
  for (const repo of managed) {
    try {
      await syncRepoPullRequests(repo.id)
    } catch {
      /* skip failed repo */
    }
  }
}
