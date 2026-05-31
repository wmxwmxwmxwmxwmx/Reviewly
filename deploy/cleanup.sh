#!/usr/bin/env bash
# Reviewly / PRism 卸载共享函数（仅操作白名单资源）
# 由 uninstall.sh 引用；禁止 docker system/volume prune。

# shellcheck disable=SC2034
REVIEWLY_CONTAINERS=(
  prism-postgres
  prism-gateway
  prism-web
  prism-engine
  reviewly-postgres
  reviewly-gateway
  reviewly-web
  reviewly-engine
)

REVIEWLY_VOLUMES=(
  prism_pgdata
  prism_repo-cache
  prism_pg_data
  reviewly_pg_data
  reviewly_repo_cache
  reviewly_logs
)

REVIEWLY_NETWORKS=(
  prism_prism-net
  prism-net
  reviewly-network
  reviewly_prism-net
)

REVIEWLY_LOCAL_DIRS=(
  data/repo-cache
  logs
  tmp
)

reviewly_log_ok() {
  echo "[✓] $1"
}

reviewly_log_info() {
  echo "[INFO] $1"
}

reviewly_dir_size_human() {
  local path="$1"
  if [ ! -e "$path" ]; then
    echo "0"
    return
  fi
  if command -v du >/dev/null 2>&1; then
    du -sh "$path" 2>/dev/null | awk '{print $1}'
  else
    echo "?"
  fi
}

reviewly_docker_available() {
  command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1
}

reviewly_container_exists() {
  local name="$1"
  docker ps -a --format '{{.Names}}' 2>/dev/null | grep -Fxq "$name"
}

reviewly_stop_container() {
  local name="$1"
  if ! reviewly_docker_available; then
    return 0
  fi
  if reviewly_container_exists "$name"; then
    docker stop "$name" >/dev/null 2>&1 || true
  else
    reviewly_log_info "Container not found"
  fi
}

reviewly_remove_container() {
  local name="$1"
  if ! reviewly_docker_available; then
    return 0
  fi
  if reviewly_container_exists "$name"; then
    docker rm -f "$name" >/dev/null 2>&1 || true
  else
    reviewly_log_info "Container not found"
  fi
}

reviewly_volume_exists() {
  local name="$1"
  docker volume ls --format '{{.Name}}' 2>/dev/null | grep -Fxq "$name"
}

reviewly_remove_volume() {
  local name="$1"
  if ! reviewly_docker_available; then
    return 0
  fi
  if reviewly_volume_exists "$name"; then
    docker volume rm "$name" >/dev/null 2>&1 || true
  else
    reviewly_log_info "Volume not found"
  fi
}

reviewly_network_exists() {
  local name="$1"
  docker network ls --format '{{.Name}}' 2>/dev/null | grep -Fxq "$name"
}

reviewly_remove_network() {
  local name="$1"
  if ! reviewly_docker_available; then
    return 0
  fi
  if reviewly_network_exists "$name"; then
    docker network rm "$name" >/dev/null 2>&1 || true
  else
    reviewly_log_info "Network not found"
  fi
}

reviewly_compose_down() {
  local compose_file="$1"
  if ! reviewly_docker_available; then
    return 0
  fi
  if [ ! -f "$compose_file" ]; then
    return 0
  fi
  docker compose -f "$compose_file" down --remove-orphans >/dev/null 2>&1 || true
}

reviewly_remove_local_dirs() {
  local root="$1"
  local rel
  for rel in "${REVIEWLY_LOCAL_DIRS[@]}"; do
    local target="$root/$rel"
    if [ -e "$target" ]; then
      rm -rf "$target"
    fi
  done
}

reviewly_confirm_purge() {
  cat <<'EOF'
================================
即将永久删除：

Reviewly 数据库
Reviewly 缓存
Reviewly 配置

是否继续？

[y/N]
================================
EOF
  local answer
  read -r -p "> " answer
  case "${answer:-N}" in
    y|Y|yes|YES) return 0 ;;
    *) return 1 ;;
  esac
}

reviewly_purge_project_files() {
  local root="$1"
  local rel path
  local env_targets=(
    deploy/.env
    deploy/.env.production
    .env
    .env.production
    services/gateway/.env
    services/gateway/.env.production
  )
  for rel in "${env_targets[@]}"; do
    path="$root/$rel"
    if [ -f "$path" ]; then
      rm -f "$path"
    fi
  done

  local dir_targets=(
    apps/web/.next
    apps/web/node_modules
    node_modules
    services/gateway/.venv
    .venv
    venv
    deploy/.next
  )
  for rel in "${dir_targets[@]}"; do
    path="$root/$rel"
    if [ -e "$path" ]; then
      rm -rf "$path"
    fi
  done

  if reviewly_docker_available && [ -f "$root/deploy/docker-compose.yml" ]; then
    local ids
    ids="$(docker compose -f "$root/deploy/docker-compose.yml" images -q 2>/dev/null || true)"
    if [ -n "$ids" ]; then
      # shellcheck disable=SC2086
      docker rmi -f $ids >/dev/null 2>&1 || true
    fi
  fi
}
