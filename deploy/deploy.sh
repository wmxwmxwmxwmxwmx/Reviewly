#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
COMPOSE="docker compose -f deploy/docker-compose.yml --env-file deploy/.env"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_port() {
  local port="$1"
  local name="$2"
  if command -v ss >/dev/null 2>&1; then
    if ss -tln | grep -q ":${port} "; then
      echo -e "${RED}Port ${port} (${name}) is already in use. Stop the conflicting process or change the port mapping.${NC}"
      exit 1
    fi
  elif command -v lsof >/dev/null 2>&1; then
    if lsof -iTCP:"${port}" -sTCP:LISTEN -t >/dev/null 2>&1; then
      echo -e "${RED}Port ${port} (${name}) is already in use.${NC}"
      exit 1
    fi
  fi
}

merge_gateway_env() {
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
    if grep -q "^${key}=" "$deploy_env" 2>/dev/null; then
      if [[ "$OSTYPE" == darwin* ]]; then
        sed -i '' "s|^${key}=.*|${key}=${value}|" "$deploy_env"
      else
        sed -i "s|^${key}=.*|${key}=${value}|" "$deploy_env"
      fi
    else
      printf '%s=%s\n' "$key" "$value" >> "$deploy_env"
    fi
  done < "$gateway_env"
}

echo -e "${YELLOW}[1/7] Checking prerequisites...${NC}"
command -v docker >/dev/null 2>&1 || { echo -e "${RED}docker not found${NC}"; exit 1; }
docker compose version >/dev/null 2>&1 || { echo -e "${RED}docker compose not found${NC}"; exit 1; }
command -v curl >/dev/null 2>&1 || { echo -e "${RED}curl not found${NC}"; exit 1; }

check_port 5432 "PostgreSQL"
check_port 3001 "Gateway"
check_port 3000 "Web"

echo -e "${YELLOW}[2/7] Setting up environment...${NC}"
if [ ! -f "deploy/.env" ]; then
  cp deploy/.env.example deploy/.env
  merge_gateway_env
  echo -e "${YELLOW}  deploy/.env created. Review JWT_SECRET / OAuth / encryption keys if needed.${NC}"
  echo -e "${YELLOW}  Press Enter to continue or Ctrl+C to abort...${NC}"
  read -r
fi

echo -e "${YELLOW}[3/7] Building Docker images...${NC}"
$COMPOSE build

echo -e "${YELLOW}[4/7] Starting PostgreSQL...${NC}"
$COMPOSE up -d postgres

echo -e "${YELLOW}[5/7] Waiting for PostgreSQL...${NC}"
for _ in $(seq 1 30); do
  if $COMPOSE exec -T postgres pg_isready -U prism -d prism 2>/dev/null; then
    echo -e "${GREEN}  PostgreSQL is ready.${NC}"
    break
  fi
  sleep 2
done

echo -e "${YELLOW}[6/7] Starting Gateway & Engine...${NC}"
$COMPOSE up -d gateway engine

for _ in $(seq 1 30); do
  if curl -sf http://localhost:3001/health >/dev/null 2>&1; then
    echo -e "${GREEN}  Gateway is healthy.${NC}"
    break
  fi
  sleep 2
done

echo -e "${YELLOW}[7/7] Starting Web...${NC}"
$COMPOSE up -d web

for _ in $(seq 1 20); do
  if curl -sf http://localhost:3000/ >/dev/null 2>&1; then
    echo -e "${GREEN}  Web is healthy.${NC}"
    break
  fi
  sleep 2
done

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  PRism is now running!${NC}"
echo -e "${GREEN}  Frontend:  http://localhost:3000${NC}"
echo -e "${GREEN}  API:       http://localhost:3001${NC}"
echo -e "${GREEN}  API Docs:  http://localhost:3001/docs${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "To view logs:  docker compose -f deploy/docker-compose.yml logs -f"
echo "To stop:       docker compose -f deploy/docker-compose.yml down"
