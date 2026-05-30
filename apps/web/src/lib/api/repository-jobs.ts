import type { RepositoryJob } from "@reviewly/shared"

import { apiFetch } from "./client"

export function fetchRepositoryJob(jobId: string, signal?: AbortSignal) {
  return apiFetch<RepositoryJob>(`/api/jobs/${jobId}`, { signal })
}

export async function pollRepositoryJob(
  jobId: string,
  options?: {
    intervalMs?: number
    signal?: AbortSignal
    onUpdate?: (job: RepositoryJob) => void
  },
): Promise<RepositoryJob> {
  const intervalMs = options?.intervalMs ?? 600
  const terminal = new Set(["success", "failed", "cancelled"])

  while (true) {
    if (options?.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError")
    }
    const job = await fetchRepositoryJob(jobId, options?.signal)
    options?.onUpdate?.(job)
    if (terminal.has(job.status)) {
      return job
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}
