#!/usr/bin/env bash
# Docker 模式开发启动：Web + Gateway + Postgres
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REBUILD=0
for arg in "$@"; do
  case "$arg" in
    --rebuild|-Rebuild) REBUILD=1 ;;
    -h|--help)
      cat <<'EOF'
用法: npm run dev

  通过 Docker 启动 Web (:3000) + Gateway (:3001) + PostgreSQL。

  npm run dev -- --rebuild   强制重新构建镜像
  npm run dev:local          本地 Node/Python 开发（旧模式）
EOF
      exit 0
      ;;
  esac
done

echo ""
echo "[Reviewly] Docker 容器启动（Web + Gateway + Postgres）..."
echo ""

# 释放本地 3000/3001（不停止 Docker 栈，deploy 会接管）
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
kill_port 3000
kill_port 3001

DEPLOY_ARGS=(-y --stub-engine)
if [ "$REBUILD" != "1" ]; then
  DEPLOY_ARGS+=(--skip-build)
fi

bash "$ROOT/deploy/deploy.sh" "${DEPLOY_ARGS[@]}"
exit $?
