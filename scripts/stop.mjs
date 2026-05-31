#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (process.platform === "win32") {
  console.error("停止脚本仅支持 Linux。请执行: bash deploy/stop.sh 或 bash stop.sh");
  process.exit(1);
}

const result = spawnSync("bash", [path.join(root, "deploy", "stop.sh")], {
  stdio: "inherit",
  cwd: root,
});

process.exit(result.status ?? 1);
