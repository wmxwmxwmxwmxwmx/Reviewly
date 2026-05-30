import type { PullRequest } from "@reviewly/shared"

/** Whether the PR's repository still needs onboarding / adoption. */
export function prNeedsAdoption(pr: PullRequest | null | undefined): boolean {
  if (!pr?.repoId) return false
  if (pr.managed === true && pr.repositoryType === "managed") return false
  return pr.managed === false || pr.repositoryType !== "managed"
}
