import type { Repository } from "@reviewly/shared"

import { isAbortError } from "@/lib/abort-utils"
import { syncRepoPullRequests } from "@/lib/api/repos"
import { isRepositoryManaged } from "@/lib/repos/is-repository-managed"
import { repoManagementDisplayOrder } from "@/lib/repos-utils"

/** Pull open PRs from GitHub for every managed repository (best-effort per repo). */
export async function syncManagedReposPullRequests(
  repos: Repository[],
  signal?: AbortSignal,
): Promise<void> {
  const managed = repoManagementDisplayOrder(repos).filter(isRepositoryManaged)
  for (const repo of managed) {
    if (signal?.aborted) return
    try {
      await syncRepoPullRequests(repo.id, signal)
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) return
      /* skip failed repo */
    }
  }
}
