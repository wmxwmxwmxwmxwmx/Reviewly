#!/usr/bin/env bash
# 在 Linux 上安装 Docker Engine + Compose 插件（官方 convenience script）
set -euo pipefail

PRISM_DEPLOY_YES="${PRISM_DEPLOY_YES:-0}"
while [ $# -gt 0 ]; do
  case "$1" in
    -y|--yes) PRISM_DEPLOY_YES=1; shift ;;
    *) shift ;;
  esac
done

if [ "$(uname -s)" != "Linux" ]; then
  echo "install-docker.sh 仅适用于 Linux。"
  echo "其他系统请安装 Docker Desktop: https://www.docker.com/products/docker-desktop/"
  exit 1
fi

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  echo "Docker 已安装: $(docker --version)"
  exit 0
fi

if [ "$PRISM_DEPLOY_YES" != "1" ]; then
  echo "将使用 https://get.docker.com 安装 Docker（需要 sudo）。"
  read -r -p "继续? [y/N] " ans
  case "${ans:-N}" in
    y|Y|yes|YES) ;;
    *) echo "已取消"; exit 0 ;;
  esac
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "安装 curl..."
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update -qq && sudo apt-get install -y curl
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y curl
  else
    echo "请先手动安装 curl 后重试"; exit 1
  fi
fi

curl -fsSL https://get.docker.com | sudo sh

if [ -n "${SUDO_USER:-}" ]; then
  TARGET_USER="$SUDO_USER"
elif [ -n "${USER:-}" ] && [ "$USER" != "root" ]; then
  TARGET_USER="$USER"
else
  TARGET_USER=""
fi

if [ -n "$TARGET_USER" ]; then
  sudo usermod -aG docker "$TARGET_USER"
  echo ""
  echo "已将用户 ${TARGET_USER} 加入 docker 组。"
  echo "请注销并重新登录（或执行 newgrp docker），然后运行:"
  echo "  bash deploy/deploy.sh -y"
fi

sudo systemctl enable docker 2>/dev/null || true
sudo systemctl start docker 2>/dev/null || true

echo ""
echo "Docker 安装完成: $(sudo docker --version)"
