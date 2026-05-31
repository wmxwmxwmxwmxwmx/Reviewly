#!/usr/bin/env bash
# shellcheck disable=SC2034
# 部署脚本共享函数（deploy.sh / bootstrap.sh 引用）

PRISM_DEPLOY_YES="${PRISM_DEPLOY_YES:-0}"
PRISM_DEPLOY_STUB_ENGINE="${PRISM_DEPLOY_STUB_ENGINE:-}"

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
    prism_set_env_key "$deploy_env" "$key" "$value"
  done <"$gateway_env"
}

prism_autofill_deploy_env() {
  local f="$ROOT/deploy/.env"
  [ -f "$f" ] || return 0
  if grep -q '^JWT_SECRET=<generate>' "$f" || grep -q '^JWT_SECRET=$' "$f"; then
    prism_set_env_key "$f" "JWT_SECRET" "$(prism_rand_hex 32)"
    prism_color yellow "  已自动生成 JWT_SECRET"
  fi
  if grep -q '^SETTINGS_ENCRYPTION_KEY=<generate>' "$f" || grep -q '^SETTINGS_ENCRYPTION_KEY=$' "$f"; then
    prism_set_env_key "$f" "SETTINGS_ENCRYPTION_KEY" "$(prism_rand_hex 32)"
    prism_color yellow "  已自动生成 SETTINGS_ENCRYPTION_KEY"
  fi
  if [ -n "$PRISM_DEPLOY_STUB_ENGINE" ]; then
    prism_set_env_key "$f" "PRISM_STUB_ENGINE" "$PRISM_DEPLOY_STUB_ENGINE"
  elif grep -q '^PRISM_STUB_ENGINE=0' "$f" && [ "${PRISM_FIRST_DEPLOY:-0}" = "1" ]; then
    prism_set_env_key "$f" "PRISM_STUB_ENGINE" "1"
    prism_color yellow "  首次部署已设 PRISM_STUB_ENGINE=1（跳过 C++ 编译，稳定后可改回 0）"
  fi
}

prism_setup_deploy_env() {
  local created=0
  if [ ! -f "$ROOT/deploy/.env" ]; then
    cp "$ROOT/deploy/.env.example" "$ROOT/deploy/.env"
    PRISM_FIRST_DEPLOY=1
    created=1
    prism_merge_gateway_env
    prism_autofill_deploy_env
    prism_color yellow "  已创建 deploy/.env"
  else
    prism_autofill_deploy_env
  fi
  if [ "$created" = "1" ] && [ "$PRISM_DEPLOY_YES" != "1" ]; then
    prism_color yellow "  可按需编辑 deploy/.env（OAuth 等），然后继续。"
    prism_color yellow "  按 Enter 继续，Ctrl+C 取消；下次可用: bash deploy/deploy.sh -y"
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
