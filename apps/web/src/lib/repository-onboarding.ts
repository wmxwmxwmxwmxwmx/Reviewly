import type { OnboardingPhase, RepositoryJob } from "@reviewly/shared"

export const ONBOARDING_PHASES: OnboardingPhase[] = [
  "queued",
  "cloning",
  "scanning",
  "analyzing",
  "completed",
]

export function mapJobToOnboardingPhase(
  job: RepositoryJob | null | undefined,
): OnboardingPhase {
  if (!job) return "queued"
  if (job.status === "failed" || job.status === "cancelled") return "failed"
  if (job.status === "success") return "completed"
  if (job.status === "pending") return "queued"

  const progress = job.progress ?? 0
  if (progress < 20) return "cloning"
  if (progress < 75) return "scanning"
  return "analyzing"
}

export function shouldPromptExternalOnboard(result: {
  repositoryCreated: boolean
  source: string
}): boolean {
  return result.repositoryCreated && result.source === "github_public"
}

export function adoptDismissKey(repoId: string): string {
  return `prism:dismiss-adopt:${repoId}`
}
