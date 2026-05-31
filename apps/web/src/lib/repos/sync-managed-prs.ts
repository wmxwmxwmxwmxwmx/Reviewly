import type { Repository } from "@reviewly/shared"

import { isAbortError } from "@/lib/abort-utils"
import {
  syncManagedPullRequests,
  syncRepoPullRequests,
  type PrSyncTrigger,
} from "@/lib/api/repos"
import { isRepositoryManaged } from "@/lib/repos/is-repository-managed"
import { repoManagementDisplayOrder } from "@/lib/repos-utils"
import { isPrSyncInFlight, withPrSyncMutex } from "@/lib/pr-sync-mutex"
import { dispatchPrSyncUpdated } from "@/lib/pr-sync-events"

/** Pull open PRs from GitHub for every managed repository (best-effort per repo). */
export async function syncManagedReposPullRequests(
  repos: Repository[],
  signal?: AbortSignal,
  trigger: PrSyncTrigger = "manual",
): Promise<void> {
  const managed = repoManagementDisplayOrder(repos).filter(isRepositoryManaged)
  if (managed.length === 0) return

  if (isPrSyncInFlight()) {
    return
  }

  await withPrSyncMutex(async () => {
    try {
      const stats = await syncManagedPullRequests({ signal, trigger })
      if (!stats.skipped) {
        dispatchPrSyncUpdated({
          at: new Date().toISOString(),
          stats: {
            synced: stats.synced,
            created: stats.created,
            updated: stats.updated,
            closed: stats.closed,
            repos: stats.repos,
          },
        })
      }
      return
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) {
        throw error
      }
      /* fallback: per-repo legacy API */
    }

    for (const repo of managed) {
      if (signal?.aborted) return
      try {
        await syncRepoPullRequests(repo.id, signal)
      } catch (error) {
        if (isAbortError(error) || signal?.aborted) return
        /* skip failed repo */
      }
    }
  })
}
