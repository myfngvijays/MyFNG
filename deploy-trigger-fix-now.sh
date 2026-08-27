#!/bin/bash
# Non-interactive deploy of message-trigger fix to myfng.in VPS.
# Usage: ./deploy-trigger-fix-now.sh
# You will be prompted for the VPS SSH password.
set -euo pipefail

VPS_IP="${VPS_IP:-72.61.224.186}"
VPS_USER="${VPS_USER:-root}"
VPS_PROJECT_PATH="${VPS_PROJECT_PATH:-/home/myfng-app/MyFNG}"
APP_NAME="myfng-web"
WORKERS="${WORKERS:-3}"
MEMORY_CAP="${MEMORY_CAP:-2500M}"
NODE_OLD_SPACE="${NODE_OLD_SPACE:-2200}"

echo "Deploying message-trigger fix to ${VPS_USER}@${VPS_IP} ..."
echo "Commit on GitHub: f1df618 (trigger always assign + reassign)"
echo ""

ssh -o StrictHostKeyChecking=accept-new "${VPS_USER}@${VPS_IP}" \
  APP_NAME="${APP_NAME}" \
  VPS_PROJECT_PATH="${VPS_PROJECT_PATH}" \
  WORKERS="${WORKERS}" \
  MEMORY_CAP="${MEMORY_CAP}" \
  NODE_OLD_SPACE="${NODE_OLD_SPACE}" \
  bash -s <<'REMOTE'
set -euo pipefail
say() { echo ">> $*"; }
die() { echo "FAIL $*"; exit 1; }

[ -d "${VPS_PROJECT_PATH}" ] || die "Project not found at ${VPS_PROJECT_PATH}"
command -v pnpm >/dev/null || die "pnpm missing"
command -v pm2  >/dev/null || die "pm2 missing"

cd "${VPS_PROJECT_PATH}"
say "Stash local changes"
git stash -u || true
say "Pull origin/main"
git pull origin main
echo "HEAD=$(git rev-parse --short HEAD) $(git log -1 --oneline)"

cd apps/web
say "pnpm install"
pnpm install --frozen-lockfile
say "Clear leftover Next standalone cache"
rm -rf .next/cache \
       .next/standalone/apps/web/.next/cache \
       .next/standalone/.next/cache
say "pnpm build"
pnpm run build

STANDALONE_DIR="${VPS_PROJECT_PATH}/apps/web/.next/standalone/apps/web"
[ -f "${STANDALONE_DIR}/server.js" ] || die "standalone server.js missing"

say "Copy static/public/env into standalone"
mkdir -p "${STANDALONE_DIR}/.next"
cp -r .next/static "${STANDALONE_DIR}/.next/" 2>/dev/null || true
cp -r public "${STANDALONE_DIR}/" 2>/dev/null || true
for envfile in .env .env.local .env.production .env.production.local; do
  [ -f "${envfile}" ] && cp "${envfile}" "${STANDALONE_DIR}/${envfile}" && echo "  copied ${envfile}"
done

CURRENT_MODE=$(pm2 describe "${APP_NAME}" 2>/dev/null | grep -E "exec mode" | head -1 | awk '{print $5}' || echo "missing")
if [ "${CURRENT_MODE}" = "cluster_mode" ]; then
  say "pm2 reload ${APP_NAME}"
  pm2 reload "${APP_NAME}" --update-env
else
  say "pm2 start cluster ${APP_NAME}"
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
sleep 2
curl -fsS -o /dev/null -w "health HTTP %{http_code}\n" "http://localhost:3000/" || true
echo "DONE HEAD=$(cd "${VPS_PROJECT_PATH}" && git rev-parse --short HEAD)"
REMOTE

echo ""
echo "Live: https://myfng.in"
echo "Ab WhatsApp se trigger msg test karo — assignee change hona chahiye."
