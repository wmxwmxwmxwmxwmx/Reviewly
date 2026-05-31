#!/usr/bin/env node
/**
 * 跨平台入口：调用 deploy/uninstall 脚本（仅清理 Reviewly 白名单资源）
 */
import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const purge = process.argv.includes("--purge")

const isWin = process.platform === "win32"

if (isWin) {
  const ps1 = join(root, "deploy", "uninstall.ps1")
  if (!existsSync(ps1)) {
    console.error("未找到 deploy/uninstall.ps1")
    process.exit(1)
  }
  const args = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps1]
  if (purge) args.push("-Purge")
  const r = spawnSync("powershell", args, { stdio: "inherit", cwd: root })
  process.exit(r.status ?? 1)
}

const sh = join(root, "deploy", "uninstall.sh")
if (!existsSync(sh)) {
  console.error("未找到 deploy/uninstall.sh")
  process.exit(1)
}
const args = ["bash", sh]
if (purge) args.push("--purge")
const r = spawnSync(args[0], args.slice(1), { stdio: "inherit", cwd: root, shell: false })
process.exit(r.status ?? 1)
