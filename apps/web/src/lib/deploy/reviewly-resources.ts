/** Reviewly / PRism 本地部署资源白名单（与 deploy/cleanup.* 保持一致） */

export const REVIEWLY_CONTAINER_NAMES = [
  "prism-postgres",
  "prism-gateway",
  "prism-web",
  "prism-engine",
  "reviewly-postgres",
  "reviewly-gateway",
  "reviewly-web",
  "reviewly-engine",
] as const

export const REVIEWLY_VOLUME_NAMES = [
  "prism_pgdata",
  "prism_repo-cache",
  "prism_pg_data",
  "reviewly_pg_data",
  "reviewly_repo_cache",
  "reviewly_logs",
] as const

export type LocalDeployResources = {
  available: boolean
  containerCount: number
  volumeCount: number
  repoCacheSize: string
  logsSize: string
  tmpSize: string
  uninstallCommand: string
  purgeCommand: string
}

export function defaultUninstallCommands(): Pick<
  LocalDeployResources,
  "uninstallCommand" | "purgeCommand"
> {
  return {
    uninstallCommand: "bash deploy/uninstall.sh",
    purgeCommand: "bash deploy/uninstall.sh --purge",
  }
}
