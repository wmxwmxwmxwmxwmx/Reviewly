#!/usr/bin/env bash
# 停止 PRism 全部服务（Docker 生产栈 + 根目录开发用 Postgres + 本地 3000/3001 进程）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Stopping PRism Docker stack (deploy/docker-compose.yml)...${NC}"
if [ -f "deploy/docker-compose.yml" ]; then
  docker compose -f deploy/docker-compose.yml down --remove-orphans 2>/dev/null || true
fi

echo -e "${YELLOW}Stopping dev PostgreSQL (docker-compose.yml)...${NC}"
docker compose -f docker-compose.yml down --remove-orphans 2>/dev/null || true

kill_port() {
  local port="$1"
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" 2>/dev/null || true
  elif command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)"
    [ -n "$pids" ] && kill -9 $pids 2>/dev/null || true
  fi
}

echo -e "${YELLOW}Releasing ports 3000 (Web) and 3001 (Gateway)...${NC}"
kill_port 3000
kill_port 3001

echo -e "${GREEN}All PRism services stopped.${NC}"
