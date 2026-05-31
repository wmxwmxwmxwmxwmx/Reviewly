#!/usr/bin/env node
/**
 * Linux 卸载入口：调用 deploy/uninstall.sh（仅清理 Reviewly 白名单资源）
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const purge = process.argv.includes("--purge");

if (process.platform === "win32") {
  console.error("卸载脚本仅支持 Linux。请执行: bash deploy/uninstall.sh");
  process.exit(1);
}

const sh = join(root, "deploy", "uninstall.sh");
if (!existsSync(sh)) {
  console.error("未找到 deploy/uninstall.sh");
  process.exit(1);
}

const args = ["bash", sh];
if (purge) args.push("--purge");
const r = spawnSync(args[0], args.slice(1), { stdio: "inherit", cwd: root, shell: false });
process.exit(r.status ?? 1);
