#!/usr/bin/env bash
# 单独配置 GitHub OAuth（已部署后也可运行）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=lib/common.sh
source "$ROOT/deploy/lib/common.sh"
[ -f "$ROOT/deploy/.env" ] || cp "$ROOT/deploy/.env.example" "$ROOT/deploy/.env"
prism_ensure_github_oauth
echo ""
prism_color green "请重启 Gateway: docker compose -f deploy/docker-compose.yml restart gateway"
