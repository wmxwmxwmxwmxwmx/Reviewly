#!/usr/bin/env node
/**
 * Docker 模式开发：npm run dev（Linux）
 * 启动 deploy/docker-compose.yml 中的 web + gateway + postgres
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extraArgs = process.argv.slice(2);

if (process.platform === "win32") {
  console.error("Docker 全栈开发仅支持 Linux。请使用 WSL，或在本机热重载: npm run dev:local");
  process.exit(1);
}

const result = spawnSync("bash", [path.join(root, "scripts", "dev-docker.sh"), ...extraArgs], {
  stdio: "inherit",
  cwd: root,
});

process.exit(result.status ?? 1);
