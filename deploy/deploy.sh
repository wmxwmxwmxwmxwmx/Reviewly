#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=lib/common.sh
source "$ROOT/deploy/lib/common.sh"

prism_parse_deploy_args "$@"

COMPOSE=(docker compose -f deploy/docker-compose.yml --env-file deploy/.env)

prism_step() {
  if [ "${PRISM_DEPLOY_YES:-0}" = "1" ]; then
    echo "$1"
  else
    prism_color yellow "$1"
  fi
}

prism_step "[1/7] 检查运行环境..."
prism_check_docker
prism_ensure_docker_session || true
prism_stop_existing_stack
prism_check_port 5432 "PostgreSQL" || exit 1
prism_check_port 3001 "Gateway" || exit 1
prism_check_port 3000 "Web" || exit 1

if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then
  prism_color yellow "  未安装 curl/wget，将跳过 HTTP 健康轮询（不影响容器启动）"
fi

prism_step "[2/7] 准备 deploy/.env ..."
prism_setup_deploy_env

# stub 模式下不构建/启动 engine，加快新机首次部署
USE_ENGINE=1
if [ -f deploy/.env ] && grep -q '^PRISM_STUB_ENGINE=1' deploy/.env; then
  USE_ENGINE=0
  prism_color yellow "  PRISM_STUB_ENGINE=1，将跳过 engine 容器"
fi

prism_step "[3/7] 构建 Docker 镜像（首次较慢）..."
if [ "$USE_ENGINE" = "1" ]; then
  "${COMPOSE[@]}" build
else
  "${COMPOSE[@]}" build postgres gateway web
fi

prism_step "[4/7] 启动 PostgreSQL..."
"${COMPOSE[@]}" up -d postgres

prism_step "[5/7] 等待 PostgreSQL 就绪..."
for _ in $(seq 1 30); do
  if "${COMPOSE[@]}" exec -T postgres pg_isready -U prism -d prism 2>/dev/null; then
    prism_color green "  PostgreSQL 已就绪"
    break
  fi
  sleep 2
done

prism_step "[6/7] 启动 Gateway${USE_ENGINE:+ 与 Engine}..."
if [ "$USE_ENGINE" = "1" ]; then
  "${COMPOSE[@]}" up -d gateway engine
else
  "${COMPOSE[@]}" up -d gateway
fi

for _ in $(seq 1 30); do
  if prism_http_ok "http://localhost:3001/health"; then
    prism_color green "  Gateway 已就绪"
    break
  fi
  sleep 2
done

prism_step "[7/7] 启动 Web..."
"${COMPOSE[@]}" up -d web

for _ in $(seq 1 20); do
  if prism_http_ok "http://localhost:3000/"; then
    prism_color green "  Web 已就绪"
    break
  fi
  sleep 2
done

echo ""
prism_color green "========================================"
prism_color green "  PRism 已启动"
prism_color green "  前端:     http://localhost:3000"
prism_color green "  API:      http://localhost:3001"
prism_color green "  API 文档: http://localhost:3001/docs"
prism_color green "========================================"
echo ""
echo "查看日志: docker compose -f deploy/docker-compose.yml logs -f"
echo "停止服务: docker compose -f deploy/docker-compose.yml down"
if [ "$USE_ENGINE" = "0" ]; then
  echo ""
  echo "当前为引擎 stub 模式。需要 C++ 引擎时: 编辑 deploy/.env 设 PRISM_STUB_ENGINE=0 后重新部署。"
fi
