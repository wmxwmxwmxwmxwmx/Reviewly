#!/usr/bin/env node
/**
 * Docker 模式开发：npm run dev
 * 启动 deploy/docker-compose.yml 中的 web + gateway + postgres
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const extraArgs = process.argv.slice(2);

const result = isWin
  ? spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        path.join(root, "scripts", "dev-docker.ps1"),
        ...extraArgs,
      ],
      { stdio: "inherit", cwd: root },
    )
  : spawnSync("bash", [path.join(root, "scripts", "dev-docker.sh"), ...extraArgs], {
      stdio: "inherit",
      cwd: root,
    });

process.exit(result.status ?? 1);
