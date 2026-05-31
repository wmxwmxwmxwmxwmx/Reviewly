#!/usr/bin/env node
/**
 * 跨平台一键安装/部署：npm run deploy
 * Windows：由 bootstrap 自动安装/启动 Docker Desktop；macOS 需已安装并启动 Docker Desktop
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";

const result = isWin
  ? spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        path.join(root, "deploy", "bootstrap.ps1"),
      ],
      { stdio: "inherit", cwd: root },
    )
  : spawnSync("bash", [path.join(root, "deploy", "bootstrap.sh"), "-y", "--stub-engine"], {
      stdio: "inherit",
      cwd: root,
    });

process.exit(result.status ?? 1);
