#!/usr/bin/env bash
# 一键安装（同 deploy.sh / bootstrap.sh）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
exec bash "$ROOT/deploy/bootstrap.sh" -y --stub-engine "$@"
