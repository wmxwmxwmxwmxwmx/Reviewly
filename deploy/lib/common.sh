#!/usr/bin/env bash
# shellcheck disable=SC2034
# 部署脚本共享函数（deploy.sh / bootstrap.sh 引用）

PRISM_DEPLOY_YES="${PRISM_DEPLOY_YES:-0}"
PRISM_DEPLOY_STUB_ENGINE="${PRISM_DEPLOY_STUB_ENGINE:-}"

prism_is_yes_mode() {
  [ "$PRISM_DEPLOY_YES" = "1" ]
}

prism_log_step() {
  prism_is_yes_mode && return 0
  prism_color yellow "$1"
}

prism_log_ok() {
  prism_is_yes_mode && return 0
  prism_color green "$1"
}

prism_log_warn() {
  prism_is_yes_mode && return 0
  prism_color yellow "$1"
}

prism_color() {
  local c="$1" msg="$2"
  case "$c" in
    red)    echo -e "\033[0;31m${msg}\033[0m" ;;
    green)  echo -e "\033[0;32m${msg}\033[0m" ;;
    yellow) echo -e "\033[1;33m${msg}\033[0m" ;;
    *)      echo "$msg" ;;
  esac
}

prism_rand_hex() {
  local n="${1:-32}"
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$n"
  else
    head -c "$((n / 2))" /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

prism_http_ok() {
  local url="$1"
  if command -v curl >/dev/null 2>&1; then
    curl -sf "$url" >/dev/null 2>&1
  elif command -v wget >/dev/null 2>&1; then
    wget -q -O /dev/null "$url" 2>/dev/null
  else
    return 1
  fi
}

prism_sed_inplace() {
  local expr="$1" file="$2"
  if [[ "${OSTYPE:-}" == darwin* ]]; then
    sed -i '' "$expr" "$file"
  else
    sed -i "$expr" "$file"
  fi
}

prism_set_env_key() {
  local file="$1" key="$2" value="$3"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    prism_sed_inplace "s|^${key}=.*|${key}=${value}|" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >>"$file"
  fi
}

# 本地 services/gateway/.env 用于 npm run dev；以下键仅 deploy/.env 保留 Docker 内网地址
_PRISM_DEPLOY_ONLY_KEYS="DATABASE_URL ENGINE_GRPC_ADDR API_URL PRISM_REPO_CACHE_DIR"

prism_merge_gateway_env() {
  local gateway_env="$ROOT/services/gateway/.env"
  local deploy_env="$ROOT/deploy/.env"
  [ -f "$gateway_env" ] || return 0
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%%#*}"
    line="$(echo "$line" | xargs)"
    [ -z "$line" ] && continue
    [[ "$line" != *=* ]] && continue
    local key="${line%%=*}"
    local value="${line#*=}"
    key="$(echo "$key" | xargs)"
    for skip in $_PRISM_DEPLOY_ONLY_KEYS; do
      if [ "$key" = "$skip" ]; then
        continue 2
      fi
    done
    prism_set_env_key "$deploy_env" "$key" "$value"
  done <"$gateway_env"
}

prism_fix_docker_deploy_env() {
  local f="$ROOT/deploy/.env"
  [ -f "$f" ] || return 0
  prism_set_env_key "$f" "DATABASE_URL" "postgresql+psycopg://prism:prism@postgres:5432/prism"
  prism_set_env_key "$f" "ENGINE_GRPC_ADDR" "engine:50051"
  prism_set_env_key "$f" "API_URL" "http://gateway:3001"
}

prism_autofill_deploy_env() {
  local f="$ROOT/deploy/.env"
  [ -f "$f" ] || return 0
  if grep -q '^JWT_SECRET=<generate>' "$f" || grep -q '^JWT_SECRET=$' "$f"; then
    prism_set_env_key "$f" "JWT_SECRET" "$(prism_rand_hex 32)"
    prism_log_warn "  已自动生成 JWT_SECRET"
  fi
  if grep -q '^SETTINGS_ENCRYPTION_KEY=<generate>' "$f" || grep -q '^SETTINGS_ENCRYPTION_KEY=$' "$f"; then
    prism_set_env_key "$f" "SETTINGS_ENCRYPTION_KEY" "$(prism_rand_hex 32)"
    prism_log_warn "  已自动生成 SETTINGS_ENCRYPTION_KEY"
  fi
  if [ -n "$PRISM_DEPLOY_STUB_ENGINE" ]; then
    prism_set_env_key "$f" "PRISM_STUB_ENGINE" "$PRISM_DEPLOY_STUB_ENGINE"
  elif grep -q '^PRISM_STUB_ENGINE=0' "$f" && [ "${PRISM_FIRST_DEPLOY:-0}" = "1" ]; then
    prism_set_env_key "$f" "PRISM_STUB_ENGINE" "1"
    prism_log_warn "  首次部署已设 PRISM_STUB_ENGINE=1（跳过 C++ 编译，稳定后可改回 0）"
  fi
}

prism_oauth_is_configured() {
  local f="$ROOT/deploy/.env"
  [ -f "$f" ] || return 1
  local cid sec
  cid="$(grep '^GITHUB_OAUTH_CLIENT_ID=' "$f" 2>/dev/null | head -1 | cut -d= -f2- || true)"
  sec="$(grep '^GITHUB_OAUTH_CLIENT_SECRET=' "$f" 2>/dev/null | head -1 | cut -d= -f2- || true)"
  cid="${cid// /}"
  sec="${sec// /}"
  [ -n "$cid" ] && [ -n "$sec" ] || return 1
  case "${cid,,}" in
    *"<your-"*|*"your-client"*) return 1 ;;
  esac
  case "${sec,,}" in
    *"<your-"*|*"your-client"*) return 1 ;;
  esac
  return 0
}

prism_apply_public_urls() {
  local f="$ROOT/deploy/.env"
  local front="${1:-http://localhost:3000}"
  front="${front%/}"
  local scheme="http" host="localhost"
  if [[ "$front" =~ ^(https?)://([^:/]+)(:([0-9]+))?$ ]]; then
    scheme="${BASH_REMATCH[1]}"
    host="${BASH_REMATCH[2]}"
  fi
  local callback="${scheme}://${host}:3001/api/auth/github/callback"
  prism_set_env_key "$f" "FRONTEND_URL" "$front"
  prism_set_env_key "$f" "APP_URL" "$front"
  prism_set_env_key "$f" "OAUTH_CALLBACK_URL" "$callback"
}

prism_interactive_github_oauth() {
  local f="$ROOT/deploy/.env"
  [ -f "$f" ] || cp "$ROOT/deploy/.env.example" "$f"

  echo ""
  prism_color green "── GitHub OAuth 配置（登录必需）──"
  echo "在 https://github.com/settings/developers 创建 OAuth App → New OAuth App"
  echo ""

  local front="${PRISM_PUBLIC_URL:-}"
  if [ -z "$front" ] && [ -t 0 ]; then
    read -r -p "浏览器访问前端的地址 [http://localhost:3000]: " front
  fi
  front="${front:-http://localhost:3000}"
  prism_apply_public_urls "$front"

  local callback
  callback="$(grep '^OAUTH_CALLBACK_URL=' "$f" | cut -d= -f2-)"
  prism_color yellow "  请在 GitHub OAuth App 中设置 Authorization callback URL 为："
  echo "  $callback"
  echo ""

  local cid sec
  if [ -n "${GITHUB_OAUTH_CLIENT_ID:-}" ] && [ -n "${GITHUB_OAUTH_CLIENT_SECRET:-}" ]; then
    cid="$GITHUB_OAUTH_CLIENT_ID"
    sec="$GITHUB_OAUTH_CLIENT_SECRET"
    prism_color green "  使用环境变量中的 GITHUB_OAUTH_CLIENT_ID / SECRET"
  elif [ -t 0 ]; then
    read -r -p "GitHub OAuth Client ID: " cid
    read -r -s -p "GitHub OAuth Client Secret: " sec
    echo ""
  else
    return 1
  fi

  cid="$(echo "$cid" | xargs)"
  sec="$(echo "$sec" | xargs)"
  if [ -z "$cid" ] || [ -z "$sec" ]; then
    prism_color red "  Client ID / Secret 不能为空"
    return 1
  fi

  prism_set_env_key "$f" "GITHUB_OAUTH_CLIENT_ID" "$cid"
  prism_set_env_key "$f" "GITHUB_OAUTH_CLIENT_SECRET" "$sec"
  prism_set_env_key "$f" "PRISM_AUTH_BYPASS" "0"
  prism_color green "  GitHub OAuth 已写入 deploy/.env"
  return 0
}

# 确保 OAuth 可用：合并 gateway/.env → 环境变量 → 交互输入
prism_ensure_github_oauth() {
  local f="$ROOT/deploy/.env"
  [ -f "$f" ] || cp "$ROOT/deploy/.env.example" "$f"

  prism_merge_gateway_env
  prism_fix_docker_deploy_env
  prism_sanitize_placeholders

  if prism_oauth_is_configured; then
    prism_log_ok "  GitHub OAuth 已就绪（来自 deploy/.env 或 services/gateway/.env）"
    return 0
  fi

  if [ -n "${GITHUB_OAUTH_CLIENT_ID:-}" ] && [ -n "${GITHUB_OAUTH_CLIENT_SECRET:-}" ]; then
    prism_apply_public_urls "${PRISM_PUBLIC_URL:-http://localhost:3000}"
    prism_set_env_key "$f" "GITHUB_OAUTH_CLIENT_ID" "$GITHUB_OAUTH_CLIENT_ID"
    prism_set_env_key "$f" "GITHUB_OAUTH_CLIENT_SECRET" "$GITHUB_OAUTH_CLIENT_SECRET"
    prism_set_env_key "$f" "PRISM_AUTH_BYPASS" "0"
    prism_log_ok "  已从环境变量写入 GitHub OAuth"
    return 0
  fi

  if prism_is_yes_mode; then
    prism_apply_public_urls "${PRISM_PUBLIC_URL:-http://localhost:3000}"
    prism_set_env_key "$f" "PRISM_AUTH_BYPASS" "1"
    prism_log_warn "  一键模式：未检测到 OAuth，已启用 PRISM_AUTH_BYPASS=1"
    return 0
  fi

  if [ -t 0 ]; then
  if prism_interactive_github_oauth; then
      return 0
    fi
    echo ""
    read -r -p "跳过 GitHub 配置并启用开发模式（无 GitHub 登录）? [y/N] " skip_oauth
    case "${skip_oauth:-N}" in
      y|Y|yes|YES)
        prism_set_env_key "$f" "PRISM_AUTH_BYPASS" "1"
        prism_color yellow "  已启用 PRISM_AUTH_BYPASS=1，请使用登录页「开发模式进入」"
        return 0
        ;;
    esac
    prism_color red "  未配置 GitHub OAuth，部署已取消。"
    return 1
  fi

  if prism_is_yes_mode; then
    prism_apply_public_urls "${PRISM_PUBLIC_URL:-http://localhost:3000}"
    prism_set_env_key "$f" "PRISM_AUTH_BYPASS" "1"
    return 0
  fi

  prism_warn_oauth
  return 1
}

prism_sanitize_placeholders() {
  local f="$ROOT/deploy/.env"
  [ -f "$f" ] || return 0
  local key val
  for key in GITHUB_OAUTH_CLIENT_ID GITHUB_OAUTH_CLIENT_SECRET GITHUB_PAT; do
    val="$(grep "^${key}=" "$f" 2>/dev/null | head -1 | cut -d= -f2- || true)"
    case "${val,,}" in
      *"<your-"*|*"your-client"*|*"your-pat"*|*"changeme"*|*"replace-me"*)
        prism_set_env_key "$f" "$key" ""
        ;;
    esac
  done
}

prism_warn_oauth() {
  local f="$ROOT/deploy/.env"
  [ -f "$f" ] || return 0
  local cid sec
  cid="$(grep '^GITHUB_OAUTH_CLIENT_ID=' "$f" 2>/dev/null | cut -d= -f2- || true)"
  sec="$(grep '^GITHUB_OAUTH_CLIENT_SECRET=' "$f" 2>/dev/null | cut -d= -f2- || true)"
  if [ -z "${cid// /}" ] || [ -z "${sec// /}" ]; then
    echo ""
    prism_color yellow "  ⚠ GitHub OAuth 未配置：登录 GitHub 会失败。"
    prism_color yellow "    1) 打开 https://github.com/settings/developers → OAuth Apps → New"
    prism_color yellow "    2) Callback URL 填: $(grep '^OAUTH_CALLBACK_URL=' "$f" 2>/dev/null | cut -d= -f2- || echo 'http://localhost:3001/api/auth/github/callback')"
    prism_color yellow "    3) 将 Client ID / Secret 写入 deploy/.env 后重启: docker compose -f deploy/docker-compose.yml restart gateway"
    prism_color yellow "    内网试用可临时设 PRISM_AUTH_BYPASS=1（勿用于公网）"
    echo ""
  fi
}

prism_setup_deploy_env() {
  local created=0
  if [ ! -f "$ROOT/deploy/.env" ]; then
    cp "$ROOT/deploy/.env.example" "$ROOT/deploy/.env"
    PRISM_FIRST_DEPLOY=1
    created=1
    prism_merge_gateway_env
    prism_fix_docker_deploy_env
    prism_sanitize_placeholders
    prism_autofill_deploy_env
    prism_log_warn "  已创建 deploy/.env"
  else
    prism_sanitize_placeholders
    prism_autofill_deploy_env
    prism_fix_docker_deploy_env
  fi

  if ! prism_ensure_github_oauth; then
    exit 1
  fi

  if [ "$created" = "1" ] && [ "$PRISM_DEPLOY_YES" != "1" ]; then
    prism_color yellow "  配置已保存。按 Enter 开始构建镜像，Ctrl+C 取消。"
    read -r
  fi
}

prism_print_docker_install_linux() {
  prism_color red "未检测到 Docker（新机需先安装）。"
  echo ""
  echo "任选一种方式："
  echo ""
  echo "  A) 自动安装（推荐，需 sudo）："
  echo "     bash deploy/install-docker.sh"
  echo "     安装后注销并重新登录，再执行: bash deploy/deploy.sh"
  echo ""
  echo "  B) 一条命令完成「装 Docker + 部署」（需 sudo）："
  echo "     bash deploy/bootstrap.sh"
  echo ""
  echo "  C) 手动安装："
  echo "     https://docs.docker.com/engine/install/"
  echo ""
}

prism_check_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    if [ "$(uname -s)" = "Linux" ]; then
      prism_print_docker_install_linux
    else
      prism_color red "未检测到 docker。请安装 Docker Desktop 并确保已启动。"
      echo "  macOS/Windows: https://www.docker.com/products/docker-desktop/"
    fi
    return 1
  fi
  if ! docker compose version >/dev/null 2>&1; then
    prism_color red "未检测到 docker compose（Compose v2）。"
    return 1
  fi
  if ! docker info >/dev/null 2>&1; then
    prism_color red "Docker 未运行或当前用户无权限。"
    if [ "$(uname -s)" = "Linux" ] && ! groups 2>/dev/null | grep -q docker; then
      echo "  将用户加入 docker 组: sudo usermod -aG docker \"\$USER\"  然后重新登录"
    fi
    return 1
  fi
  return 0
}

prism_stop_existing_stack() {
  if ! command -v docker >/dev/null 2>&1; then
    return 0
  fi
  if [ -f "$ROOT/deploy/docker-compose.yml" ]; then
    docker compose -f "$ROOT/deploy/docker-compose.yml" down --remove-orphans >/dev/null 2>&1 || true
  fi
  if [ -f "$ROOT/docker-compose.yml" ]; then
    docker compose -f "$ROOT/docker-compose.yml" down --remove-orphans >/dev/null 2>&1 || true
  fi
}

prism_ensure_docker_session() {
  if docker info >/dev/null 2>&1; then
    return 0
  fi
  if command -v sudo >/dev/null 2>&1 && sudo docker info >/dev/null 2>&1; then
    # shellcheck disable=SC2329
    docker() { sudo docker "$@"; }
    export -f docker
    return 0
  fi
  return 1
}

prism_check_port() {
  local port="$1" name="$2"
  if command -v ss >/dev/null 2>&1; then
    if ss -tln | grep -q ":${port} "; then
      prism_color red "端口 ${port}（${name}）已被占用"
      return 1
    fi
  elif command -v lsof >/dev/null 2>&1; then
    if lsof -iTCP:"${port}" -sTCP:LISTEN -t >/dev/null 2>&1; then
      prism_color red "端口 ${port}（${name}）已被占用"
      return 1
    fi
  fi
  return 0
}

prism_parse_deploy_args() {
  while [ $# -gt 0 ]; do
    case "$1" in
      -y|--yes) PRISM_DEPLOY_YES=1; shift ;;
      --stub-engine) PRISM_DEPLOY_STUB_ENGINE=1; shift ;;
      --with-engine) PRISM_DEPLOY_STUB_ENGINE=0; shift ;;
      -h|--help)
        cat <<'EOF'
用法: bash deploy/deploy.sh [选项]

  -y, --yes         不询问，自动生成 .env 与密钥后直接部署
  --stub-engine     使用 Python 引擎 stub（不构建 C++，推荐新机）
  --with-engine     构建并启动 C++ gRPC 引擎
  -h, --help        显示帮助

新机推荐:
  bash deploy/bootstrap.sh          # 可选安装 Docker + 部署
  bash deploy/deploy.sh -y --stub-engine
EOF
        exit 0
        ;;
      *) shift ;;
    esac
  done
}
