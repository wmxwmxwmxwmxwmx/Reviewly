#!/usr/bin/env bash
# 新机一条龙：检查/安装 Docker → 部署 PRism（仅需 git clone 后的项目目录 + bash）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=lib/common.sh
source "$ROOT/deploy/lib/common.sh"

prism_parse_deploy_args "$@"

echo ""
prism_color green "=========================================="
prism_color green "  PRism 新机引导部署"
prism_color green "=========================================="
echo ""

# 新机默认 stub，避免 C++ 编译失败阻断首次体验
if [ -z "$PRISM_DEPLOY_STUB_ENGINE" ]; then
  PRISM_DEPLOY_STUB_ENGINE=1
fi

if ! prism_check_docker; then
  if [ "$(uname -s)" = "Linux" ]; then
    echo ""
    read -r -p "是否现在自动安装 Docker? [y/N] " install_docker
    case "${install_docker:-N}" in
      y|Y|yes|YES)
        bash "$ROOT/deploy/install-docker.sh"
        echo ""
        prism_color yellow "Docker 安装后请重新登录，再执行: bash deploy/bootstrap.sh"
        exit 0
        ;;
      *)
        exit 1
        ;;
    esac
  else
    exit 1
  fi
fi

if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then
  prism_color yellow "未检测到 curl/wget，健康检查可能跳过；建议: sudo apt install -y curl"
fi

# 先配置 GitHub OAuth（交互式），再静默构建
export PRISM_DEPLOY_YES=1
if [ ! -f "$ROOT/deploy/.env" ]; then
  cp "$ROOT/deploy/.env.example" "$ROOT/deploy/.env"
  PRISM_FIRST_DEPLOY=1
  prism_merge_gateway_env
  prism_sanitize_placeholders
  prism_autofill_deploy_env
fi
if ! prism_ensure_github_oauth; then
  exit 1
fi

exec bash "$ROOT/deploy/deploy.sh" -y --stub-engine
