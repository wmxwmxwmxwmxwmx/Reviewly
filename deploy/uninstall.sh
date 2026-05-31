#!/usr/bin/env bash
# Reviewly (PRism) 安全卸载：仅移除本项目创建的资源
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=cleanup.sh
source "$ROOT/deploy/cleanup.sh"

PURGE=0

while [ $# -gt 0 ]; do
  case "$1" in
    --purge) PURGE=1; shift ;;
    -h|--help)
      cat <<'EOF'
用法: bash deploy/uninstall.sh [选项]

  默认：停止并删除 Reviewly Docker 容器、网络、命名卷与本地缓存目录；
        保留 deploy/.env 等配置以便重新部署。

  --purge   额外删除配置、node_modules、.next、Python venv 等（需确认）

禁止：docker system prune / docker volume prune（本脚本不会调用）
EOF
      exit 0
      ;;
    *) shift ;;
  esac
done

if [ "$PURGE" = "1" ]; then
  if ! reviewly_confirm_purge; then
    echo "已取消。"
    exit 0
  fi
fi

echo "Reviewly Uninstaller"
echo ""

if reviewly_docker_available; then
  reviewly_compose_down "$ROOT/deploy/docker-compose.yml"
  reviewly_compose_down "$ROOT/docker-compose.yml"

  for name in "${REVIEWLY_CONTAINERS[@]}"; do
    reviewly_stop_container "$name"
  done

  for name in "${REVIEWLY_CONTAINERS[@]}"; do
    reviewly_remove_container "$name"
  done

  for net in "${REVIEWLY_NETWORKS[@]}"; do
    reviewly_remove_network "$net"
  done

  for vol in "${REVIEWLY_VOLUMES[@]}"; do
    reviewly_remove_volume "$vol"
  done
else
  reviewly_log_info "Docker 不可用，跳过容器/卷/网络清理"
fi

reviewly_remove_local_dirs "$ROOT"

if [ "$PURGE" = "1" ]; then
  reviewly_purge_project_files "$ROOT"
fi

reviewly_log_ok "Stopped Containers"
reviewly_log_ok "Removed Containers"
reviewly_log_ok "Removed Volumes"
reviewly_log_ok "Removed Cache"
reviewly_log_ok "Removed Logs"
reviewly_log_ok "Completed"

echo ""
echo "Reviewly 运行资源已清理。配置与源码目录${PURGE:+（已 purge）}${PURGE:-仍保留}。"
if [ "$PURGE" != "1" ]; then
  echo "彻底删除数据与配置: bash deploy/uninstall.sh --purge"
fi
