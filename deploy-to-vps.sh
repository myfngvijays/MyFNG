#!/bin/bash
# ============================================================================
#  MyFNG -> Hostinger VPS deploy
#  Usage:  ./deploy-to-vps.sh
#  Will prompt for SSH password (root@72.61.224.186) twice (for SSH itself
#  and for the heredoc session). Set up `ssh-copy-id` to avoid prompts.
# ============================================================================
#
#  SAFETY GUARANTEES:
#   1. Sirf `myfng-web` PM2 process touch hota hai.
#      `backend`/`frontend` (dusra project — projectsinindia) untouched.
#   2. `.env.local` ko NEVER overwrite karta — VPS pe jo hai wahi raha.
#   3. Build fail = pm2 untouched = site purane version pe live rahegi.
#   4. Cluster mode pe already chal raha ho to `pm2 reload` (zero-downtime).
#      Pehli baar / fork mode se aa raha ho to delete + start.
#
#  CHANGE THESE TO TUNE CAPACITY:
#   - WORKERS         : kitne PM2 cluster workers (default 3 of 4 vCPU)
#   - MEMORY_CAP      : worker is much se upar gaya to auto-restart
#   - NODE_OLD_SPACE  : V8 heap cap per worker (MB)
# ============================================================================

set -euo pipefail

# ---------- Config (edit only if infra changes) ----------
VPS_IP="${VPS_IP:-72.61.224.186}"
VPS_USER="${VPS_USER:-root}"
VPS_PROJECT_PATH="${VPS_PROJECT_PATH:-/home/myfng-app/MyFNG}"
APP_NAME="myfng-web"
WORKERS="${WORKERS:-3}"           # leave 1 vCPU for OS + projectsinindia
MEMORY_CAP="${MEMORY_CAP:-2500M}" # per worker
NODE_OLD_SPACE="${NODE_OLD_SPACE:-2200}"

# ---------- Colors ----------
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}============================================================${NC}"
echo -e "${YELLOW}  MyFNG VPS Deploy (cluster mode, safe)${NC}"
echo -e "${YELLOW}============================================================${NC}"
echo "  Target  : ${VPS_USER}@${VPS_IP}:${VPS_PROJECT_PATH}"
echo "  App     : ${APP_NAME}"
echo "  Workers : ${WORKERS}  (memory cap ${MEMORY_CAP} each)"
echo "  Heap    : ${NODE_OLD_SPACE}MB per worker"
echo ""
echo -e "${YELLOW}  Will NOT touch:${NC} backend, frontend (projectsinindia), .env.local"
echo ""
read -r -p "Continue? [y/N] " confirm
case "$confirm" in
  [yY]|[yY][eE][sS]) ;;
  *) echo "Aborted."; exit 0 ;;
esac

# ---------- SSH and run deploy on VPS ----------
ssh -o StrictHostKeyChecking=accept-new "${VPS_USER}@${VPS_IP}" \
  APP_NAME="${APP_NAME}" \
  VPS_PROJECT_PATH="${VPS_PROJECT_PATH}" \
  WORKERS="${WORKERS}" \
  MEMORY_CAP="${MEMORY_CAP}" \
  NODE_OLD_SPACE="${NODE_OLD_SPACE}" \
  bash -s <<'REMOTE'
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
say() { echo -e "${YELLOW}>>${NC} $*"; }
ok()  { echo -e "${GREEN}OK${NC} $*"; }
die() { echo -e "${RED}FAIL${NC} $*"; exit 1; }

# Sanity checks before we touch anything
[ -d "${VPS_PROJECT_PATH}" ] || die "Project not found at ${VPS_PROJECT_PATH}"
command -v pnpm >/dev/null   || die "pnpm not installed on VPS"
command -v pm2  >/dev/null   || die "pm2 not installed on VPS"

cd "${VPS_PROJECT_PATH}"

say "Stashing local changes (if any)"
git stash -u || true

say "Pulling latest from origin/main"
git pull origin main

cd apps/web

say "pnpm install (frozen lockfile)"
pnpm install --frozen-lockfile

say "pnpm run build"
pnpm run build

# At this point: build succeeded. Now safe to swap PM2 process.
# If build had failed, set -e would have aborted BEFORE touching pm2.

STANDALONE_DIR="${VPS_PROJECT_PATH}/apps/web/.next/standalone/apps/web"
[ -f "${STANDALONE_DIR}/server.js" ] || die "Standalone server.js missing — Next config 'output: standalone' check karo"

say "Copying static + public into standalone tree"
mkdir -p "${STANDALONE_DIR}/.next"
cp -r .next/static "${STANDALONE_DIR}/.next/" 2>/dev/null || true
cp -r public        "${STANDALONE_DIR}/"        2>/dev/null || true

# Standalone server.js reads .env from its OWN directory (__dirname), not from
# apps/web. So copy env files into the standalone tree, else process.env.*
# (e.g. OPENAI_API_KEY) will be undefined at runtime.
say "Copying .env files into standalone tree (so server.js can read them)"
cp .env.production "${STANDALONE_DIR}/.env.production" 2>/dev/null || true
cp .env.local      "${STANDALONE_DIR}/.env.local"      2>/dev/null || true
cp .env            "${STANDALONE_DIR}/.env"            2>/dev/null || true

# Next.js standalone server.js reads .env files from its OWN directory
# (via __dirname), NOT from --cwd. So we MUST copy env files in, otherwise
# OPENAI_API_KEY / SUPABASE_SERVICE_ROLE_KEY etc. will be missing at runtime.
say "Copying .env files into standalone tree (so Next.js can read them at runtime)"
copied_any_env=0
for envfile in .env .env.local .env.production .env.production.local; do
  if [ -f "${envfile}" ]; then
    cp "${envfile}" "${STANDALONE_DIR}/${envfile}"
    echo "    copied ${envfile}"
    copied_any_env=1
  fi
done
[ "${copied_any_env}" = "1" ] || echo -e "${RED}    WARNING: no .env* files found in apps/web — runtime env will be empty${NC}"

# ---- PM2: zero-downtime reload if already cluster, else fresh cluster start ----
# IMPORTANT: We ONLY touch ${APP_NAME}. Never `pm2 restart all` (that would
# restart backend/frontend of projectsinindia too).

CURRENT_MODE=$(pm2 describe "${APP_NAME}" 2>/dev/null | grep -E "exec mode" | head -1 | awk '{print $5}' || echo "missing")

if [ "${CURRENT_MODE}" = "cluster_mode" ]; then
  say "${APP_NAME} already in cluster mode -> graceful reload (zero downtime)"
  pm2 reload "${APP_NAME}" --update-env
else
  if [ "${CURRENT_MODE}" = "fork_mode" ]; then
    say "${APP_NAME} is in fork mode -> switching to cluster (brief restart)"
  else
    say "${APP_NAME} not running -> starting fresh in cluster mode"
  fi
  pm2 delete "${APP_NAME}" 2>/dev/null || true
  pm2 start "${STANDALONE_DIR}/server.js" \
    --name "${APP_NAME}" \
    --cwd "${VPS_PROJECT_PATH}/apps/web" \
    -i "${WORKERS}" \
    --max-memory-restart "${MEMORY_CAP}" \
    --node-args="--max-old-space-size=${NODE_OLD_SPACE}" \
    --time
fi

pm2 save

echo ""
ok "Deploy complete. PM2 status:"
pm2 list

echo ""
say "Quick health check:"
sleep 2
if curl -fsS -o /dev/null -w "  HTTP %{http_code} in %{time_total}s\n" "http://localhost:3000/" 2>/dev/null; then
  ok "Local app is responding"
else
  echo -e "${RED}  WARNING: localhost:3000 not responding — check 'pm2 logs ${APP_NAME}'${NC}"
fi
REMOTE

echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  Done. Live URL: https://myfng.in${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo "Useful followups (run on VPS):"
echo "  pm2 list"
echo "  pm2 logs ${APP_NAME} --lines 80"
echo "  pm2 monit"
