#!/usr/bin/env bash
# 通过 bash 调用内层脚本，避免仅 chmod 根目录 deploy.sh 时出现 Permission denied
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
exec bash "$ROOT/deploy/deploy.sh" "$@"
