#!/usr/bin/env node
/**
 * 跨平台一键部署入口：npm run deploy
 * 前置条件：已安装并启动 Docker Desktop / Docker Engine
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
        path.join(root, "deploy", "deploy.ps1"),
      ],
      { stdio: "inherit", cwd: root },
    )
  : spawnSync("bash", [path.join(root, "deploy", "deploy.sh")], {
      stdio: "inherit",
      cwd: root,
    });

process.exit(result.status ?? 1);
