#!/usr/bin/env bash
# 一键安装：检查/安装 Docker → 静默部署（无交互提示）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=lib/common.sh
source "$ROOT/deploy/lib/common.sh"

export PRISM_DEPLOY_YES=1
prism_parse_deploy_args "$@"

if [ -z "$PRISM_DEPLOY_STUB_ENGINE" ]; then
  PRISM_DEPLOY_STUB_ENGINE=1
fi

echo "[Reviewly] 一键安装中..."

_docker_ok=0
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  _docker_ok=1
elif command -v sudo >/dev/null 2>&1 && sudo docker info >/dev/null 2>&1; then
  _docker_ok=1
fi

if [ "$_docker_ok" = "0" ]; then
  if [ "$(uname -s)" = "Linux" ]; then
    PRISM_DEPLOY_YES=1 bash "$ROOT/deploy/install-docker.sh" -y
    prism_ensure_docker_session || {
      prism_color red "Docker 安装后当前会话仍无法访问 docker 命令。"
      prism_color red "请注销重新登录后执行: bash deploy/bootstrap.sh"
      exit 1
    }
  else
    prism_check_docker
    exit 1
  fi
else
  prism_ensure_docker_session || true
fi

prism_stop_existing_stack
exec bash "$ROOT/deploy/deploy.sh" -y --stub-engine
