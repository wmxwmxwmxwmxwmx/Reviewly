#!/usr/bin/env bash
# Linux 智能安装 Docker Engine + Compose（按发行版选择策略）
set -euo pipefail

PRISM_DEPLOY_YES="${PRISM_DEPLOY_YES:-0}"
while [ $# -gt 0 ]; do
  case "$1" in
    -y|--yes) PRISM_DEPLOY_YES=1; shift ;;
    -h|--help)
      cat <<'EOF'
用法: bash deploy/install-docker.sh [-y]

按 /etc/os-release 自动选择安装策略：
  apt_distro   Kali/Parrot 及不受官方源支持的 Debian 系 → docker.io
  apt_official Ubuntu/Debian（受支持代号）→ get.docker.com
  dnf          Fedora/RHEL/CentOS 等 → get.docker.com
  pacman       Arch 系 → 官方仓库 docker
  zypper       openSUSE → docker + compose
  getdocker    其它可识别 Linux → get.docker.com
EOF
      exit 0
      ;;
    *) shift ;;
  esac
done

if [ "$(uname -s)" != "Linux" ]; then
  echo "install-docker.sh 仅适用于 Linux。"
  echo "其他系统请安装 Docker Desktop: https://www.docker.com/products/docker-desktop/"
  exit 1
fi

prism_have_docker() {
  command -v docker >/dev/null 2>&1 || return 1
  if docker info >/dev/null 2>&1; then
    docker compose version >/dev/null 2>&1
    return
  fi
  if command -v sudo >/dev/null 2>&1 && sudo docker info >/dev/null 2>&1; then
    sudo docker compose version >/dev/null 2>&1
    return
  fi
  return 1
}

if prism_have_docker; then
  echo "Docker 已安装: $(docker --version)"
  exit 0
fi

# ---- 读取系统信息 ----
PRISM_OS_ID=""
PRISM_OS_ID_LIKE=""
PRISM_OS_NAME=""
PRISM_OS_VERSION_CODENAME=""
PRISM_OS_VERSION_ID=""

if [ -f /etc/os-release ]; then
  # shellcheck disable=SC1091
  . /etc/os-release
  PRISM_OS_ID="${ID:-}"
  PRISM_OS_ID_LIKE="${ID_LIKE:-}"
  PRISM_OS_NAME="${NAME:-}"
  PRISM_OS_VERSION_CODENAME="${VERSION_CODENAME:-}"
  PRISM_OS_VERSION_ID="${VERSION_ID:-}"
fi

# Linux Mint / Pop 等有时把代号放在 UBUNTU_CODENAME
if [ -z "$PRISM_OS_VERSION_CODENAME" ] && [ -n "${UBUNTU_CODENAME:-}" ]; then
  PRISM_OS_VERSION_CODENAME="$UBUNTU_CODENAME"
fi

prism_log() {
  echo "[install-docker] $*"
}

prism_need_sudo() {
  if [ "$(id -u)" -eq 0 ]; then
    SUDO=""
  else
    SUDO="sudo"
  fi
}

prism_ensure_curl() {
  command -v curl >/dev/null 2>&1 && return 0
  prism_log "安装 curl..."
  if command -v apt-get >/dev/null 2>&1; then
    $SUDO apt-get update -qq
    $SUDO apt-get install -y curl
  elif command -v dnf >/dev/null 2>&1; then
    $SUDO dnf install -y curl
  elif command -v yum >/dev/null 2>&1; then
    $SUDO yum install -y curl
  elif command -v pacman >/dev/null 2>&1; then
    $SUDO pacman -Sy --noconfirm curl
  elif command -v zypper >/dev/null 2>&1; then
    $SUDO zypper -n install curl
  else
    prism_log "请先手动安装 curl"; exit 1
  fi
}

prism_remove_broken_docker_apt_repo() {
  [ -f /etc/apt/sources.list.d/docker.list ] || return 0
  grep -q 'download.docker.com' /etc/apt/sources.list.d/docker.list 2>/dev/null || return 0
  if grep -qiE 'kali-rolling|parrot|rolling|unstable|sid' /etc/apt/sources.list.d/docker.list 2>/dev/null; then
    prism_log "移除不兼容的 Docker 官方 apt 源..."
    $SUDO rm -f /etc/apt/sources.list.d/docker.list
  fi
}

# Docker 官方 apt 源支持的代号（不定期更新；未知代号走发行版 docker.io）
prism_debian_codename_supported() {
  case "${1,,}" in
    bookworm|bullseye|buster|trixie|forky) return 0 ;;
    *) return 1 ;;
  esac
}

prism_ubuntu_codename_supported() {
  case "${1,,}" in
    noble|jammy|focal|bionic|mantic|lunar|kinetic|oracular) return 0 ;;
    *) return 1 ;;
  esac
}

# 返回策略: apt_distro | apt_official | dnf | pacman | zypper | getdocker
prism_detect_docker_strategy() {
  local id="${PRISM_OS_ID,,}"
  local like="$PRISM_OS_ID_LIKE"
  local codename="${PRISM_OS_VERSION_CODENAME,,}"

  case "$id" in
    kali|parrot|pentoo|blackarch|backbox)
      echo apt_distro
      return
      ;;
    arch|manjaro|endeavouros|garuda|arcolinux|cachyos)
      echo pacman
      return
      ;;
    opensuse-leap|opensuse-tumbleweed|opensuse|suse|sles)
      echo zypper
      return
      ;;
    fedora|rhel|centos|rocky|almalinux|alma|ol|amzn|azurelinux|mariner)
      echo dnf
      return
      ;;
    ubuntu)
      if [ -n "$codename" ] && prism_ubuntu_codename_supported "$codename"; then
        echo apt_official
      else
        echo apt_distro
      fi
      return
      ;;
    debian|raspbian|raspi)
      if [ -n "$codename" ] && prism_debian_codename_supported "$codename"; then
        echo apt_official
      else
        echo apt_distro
      fi
      return
      ;;
    linuxmint|pop|pop-os|zorin|elementary|neon|kubuntu|lubuntu|xubuntu|mint)
      if [ -n "$codename" ] && prism_ubuntu_codename_supported "$codename"; then
        echo apt_official
      else
        echo apt_distro
      fi
      return
      ;;
    alpine)
      echo apk
      return
      ;;
  esac

  if [[ "$like" == *debian* ]] || [[ "$like" == *ubuntu* ]]; then
    if [ -n "$codename" ]; then
      if prism_ubuntu_codename_supported "$codename" || prism_debian_codename_supported "$codename"; then
        echo apt_official
        return
      fi
    fi
    if echo "$id $codename ${PRISM_OS_NAME,,}" | grep -qE 'kali|parrot|rolling|sid|unstable|testing'; then
      echo apt_distro
      return
    fi
    echo apt_distro
    return
  fi

  if [[ "$like" == *rhel* ]] || [[ "$like" == *fedora* ]]; then
    echo dnf
    return
  fi

  if [[ "$like" == *arch* ]]; then
    echo pacman
    return
  fi

  if [[ "$like" == *suse* ]]; then
    echo zypper
    return
  fi

  if command -v apt-get >/dev/null 2>&1; then
    echo apt_distro
    return
  fi
  if command -v dnf >/dev/null 2>&1 || command -v yum >/dev/null 2>&1; then
    echo dnf
    return
  fi
  if command -v pacman >/dev/null 2>&1; then
    echo pacman
    return
  fi
  if command -v zypper >/dev/null 2>&1; then
    echo zypper
    return
  fi

  echo getdocker
}

prism_install_apt_distro() {
  prism_remove_broken_docker_apt_repo
  prism_log "策略 apt_distro：使用发行版软件源 (docker.io)..."
  $SUDO apt-get update -qq
  if $SUDO apt-get install -y docker.io docker-compose-plugin 2>/dev/null; then
    :
  elif $SUDO apt-get install -y docker.io docker-compose 2>/dev/null; then
    :
  else
    $SUDO apt-get install -y docker.io
  fi
}

prism_install_apt_official() {
  prism_log "策略 apt_official：${PRISM_OS_NAME:-Linux} (${PRISM_OS_VERSION_CODENAME:-?}) → get.docker.com ..."
  prism_ensure_curl
  curl -fsSL https://get.docker.com | $SUDO sh
}

prism_install_dnf() {
  prism_log "策略 dnf：${PRISM_OS_NAME:-Linux} → get.docker.com ..."
  prism_ensure_curl
  curl -fsSL https://get.docker.com | $SUDO sh
}

prism_install_pacman() {
  prism_log "策略 pacman：${PRISM_OS_NAME:-Linux} → 官方仓库 docker / docker-compose ..."
  $SUDO pacman -Sy --needed --noconfirm docker docker-compose 2>/dev/null \
    || $SUDO pacman -Sy --needed --noconfirm docker docker-cli-compose
}

prism_install_zypper() {
  prism_log "策略 zypper：${PRISM_OS_NAME:-Linux} → docker + compose ..."
  $SUDO zypper -n refresh 2>/dev/null || $SUDO zypper -n ref
  $SUDO zypper -n install -y docker docker-compose 2>/dev/null \
    || $SUDO zypper -n install -y docker docker-compose-v2 2>/dev/null \
    || $SUDO zypper -n install -y docker
}

prism_install_apk() {
  prism_log "策略 apk：Alpine → docker + compose ..."
  $SUDO apk add --no-cache docker docker-cli-compose 2>/dev/null \
    || $SUDO apk add --no-cache docker
  $SUDO rc-update add docker boot 2>/dev/null || true
  $SUDO service docker start 2>/dev/null || true
}

prism_install_getdocker() {
  prism_log "策略 getdocker：回退至 get.docker.com ..."
  prism_ensure_curl
  curl -fsSL https://get.docker.com | $SUDO sh
}

prism_add_user_to_docker_group() {
  local target=""
  if [ -n "${SUDO_USER:-}" ]; then
    target="$SUDO_USER"
  elif [ -n "${USER:-}" ] && [ "$USER" != "root" ]; then
    target="$USER"
  fi
  if [ -n "$target" ]; then
    $SUDO usermod -aG docker "$target" 2>/dev/null || true
    prism_log "已将用户 ${target} 加入 docker 组（需重新登录或 newgrp docker）"
  fi
}

prism_start_docker_service() {
  if command -v systemctl >/dev/null 2>&1; then
    $SUDO systemctl enable docker 2>/dev/null || true
    $SUDO systemctl start docker 2>/dev/null || true
  elif command -v service >/dev/null 2>&1; then
    $SUDO service docker start 2>/dev/null || true
  fi
}

# ---- 主流程 ----
prism_need_sudo

STRATEGY="$(prism_detect_docker_strategy)"
prism_log "系统: ${PRISM_OS_NAME:-unknown} (ID=${PRISM_OS_ID:-?}, 代号=${PRISM_OS_VERSION_CODENAME:-?})"
prism_log "选用策略: ${STRATEGY}"

if [ "$PRISM_DEPLOY_YES" != "1" ]; then
  echo "将按「${STRATEGY}」安装 Docker（需要 sudo）。"
  read -r -p "继续? [y/N] " ans
  case "${ans:-N}" in
    y|Y|yes|YES) ;;
    *) echo "已取消"; exit 0 ;;
  esac
fi

case "$STRATEGY" in
  apt_distro) prism_install_apt_distro ;;
  apt_official) prism_install_apt_official ;;
  dnf) prism_install_dnf ;;
  pacman) prism_install_pacman ;;
  zypper) prism_install_zypper ;;
  apk) prism_install_apk ;;
  getdocker) prism_install_getdocker ;;
  *)
    prism_log "未知策略，回退 getdocker"
    prism_install_getdocker
    ;;
esac

prism_add_user_to_docker_group
prism_start_docker_service

if prism_have_docker; then
  echo ""
  if docker info >/dev/null 2>&1; then
    echo "Docker 安装完成: $(docker --version)"
    docker compose version 2>/dev/null || true
  else
    echo "Docker 安装完成: $(sudo docker --version)"
    sudo docker compose version 2>/dev/null || true
  fi
elif command -v docker >/dev/null 2>&1; then
  echo ""
  echo "Docker 已安装但 compose 插件可能缺失: $(docker --version)"
  prism_log "可尝试: sudo apt install docker-compose-plugin  或重新登录后再试"
  exit 0
else
  prism_log "安装后仍无法运行 docker，请检查权限或服务状态。"
  exit 1
fi
