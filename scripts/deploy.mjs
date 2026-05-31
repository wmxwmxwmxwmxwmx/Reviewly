#!/usr/bin/env node
/**
 * Linux 一键部署：npm run deploy → deploy/bootstrap.sh
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (process.platform === "win32") {
  console.error("安装部署仅支持 Linux。请在 Linux 或 WSL 中执行: bash install.sh");
  process.exit(1);
}

const result = spawnSync("bash", [path.join(root, "deploy", "bootstrap.sh"), "-y", "--stub-engine"], {
  stdio: "inherit",
  cwd: root,
});

process.exit(result.status ?? 1);
