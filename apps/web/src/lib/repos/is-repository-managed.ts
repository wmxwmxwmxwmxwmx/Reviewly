import type { PullRequest, Repository } from "@reviewly/shared"

type ManagedEntity = Pick<
  Repository | PullRequest,
  "isManaged" | "managed" | "repositoryType"
>

/** Whether the repository has been adopted into team management. */
export function isRepositoryManaged(entity: ManagedEntity | null | undefined): boolean {
  if (!entity) return false
  if (entity.isManaged !== undefined) return entity.isManaged
  return entity.managed === true || entity.repositoryType === "managed"
}
