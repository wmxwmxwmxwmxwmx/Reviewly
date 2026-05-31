import { execFile } from "node:child_process"
import { existsSync } from "node:fs"
import { readdir, stat } from "node:fs/promises"
import { join } from "node:path"
import { promisify } from "node:util"

import {
  REVIEWLY_CONTAINER_NAMES,
  REVIEWLY_VOLUME_NAMES,
  defaultUninstallCommands,
  type LocalDeployResources,
} from "@/lib/deploy/reviewly-resources"

export const runtime = "nodejs"

const execFileAsync = promisify(execFile)

function findRepoRoot(): string | null {
  let dir = process.cwd()
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "deploy", "docker-compose.yml"))) {
      return dir
    }
    const parent = join(dir, "..")
    if (parent === dir) break
    dir = parent
  }
  return null
}

async function dockerLines(args: string[]): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync("docker", args, { timeout: 8000 })
    return stdout
      .trim()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

async function dirSizeHuman(root: string, rel: string): Promise<string> {
  const target = join(root, rel)
  if (!existsSync(target)) return "0 B"

  async function walk(dir: string): Promise<number> {
    let total = 0
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        total += await walk(full)
      } else if (entry.isFile()) {
        const info = await stat(full)
        total += info.size
      }
    }
    return total
  }

  try {
    const bytes = await walk(target)
    if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`
    if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(2)} MB`
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${bytes} B`
  } catch {
    return "?"
  }
}

export async function GET(): Promise<Response> {
  const enabled =
    process.env.NODE_ENV === "development" ||
    process.env.PRISM_LOCAL_DEPLOY_TOOLS === "1"

  const commands = defaultUninstallCommands()

  if (!enabled) {
    const body: LocalDeployResources = {
      available: false,
      containerCount: 0,
      volumeCount: 0,
      repoCacheSize: "—",
      logsSize: "—",
      tmpSize: "—",
      ...commands,
    }
    return Response.json(body)
  }

  const root = findRepoRoot()
  if (!root) {
    return Response.json({
      available: false,
      containerCount: 0,
      volumeCount: 0,
      repoCacheSize: "—",
      logsSize: "—",
      tmpSize: "—",
      ...commands,
    } satisfies LocalDeployResources)
  }

  const containerLines = await dockerLines(["ps", "-a", "--format", "{{.Names}}"])
  const volumeLines = await dockerLines(["volume", "ls", "--format", "{{.Name}}"])

  const containerCount = REVIEWLY_CONTAINER_NAMES.filter((name) =>
    containerLines.includes(name),
  ).length

  const volumeCount = REVIEWLY_VOLUME_NAMES.filter((name) =>
    volumeLines.includes(name),
  ).length

  const [repoCacheSize, logsSize, tmpSize] = await Promise.all([
    dirSizeHuman(root, "data/repo-cache"),
    dirSizeHuman(root, "logs"),
    dirSizeHuman(root, "tmp"),
  ])

  const body: LocalDeployResources = {
    available: true,
    containerCount,
    volumeCount,
    repoCacheSize,
    logsSize,
    tmpSize,
    ...commands,
  }

  return Response.json(body)
}
