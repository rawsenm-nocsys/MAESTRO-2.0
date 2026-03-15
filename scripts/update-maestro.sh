#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/maestro"
SERVICE_NAME="maestro"
BRANCH="main"
PORT="3000"
HEALTH_URL="http://127.0.0.1:${PORT}/api/health"

log() {
  echo "[maestro-update] $1"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1"
    exit 1
  }
}

require_cmd git
require_cmd npm
require_cmd curl
require_cmd systemctl
require_cmd date

cd "$APP_DIR"

log "Fetching latest changes from origin/${BRANCH}"
git fetch origin "$BRANCH"

LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse origin/${BRANCH})"

log "Local SHA:  ${LOCAL_SHA}"
log "Remote SHA: ${REMOTE_SHA}"

if [ "$LOCAL_SHA" = "$REMOTE_SHA" ]; then
  log "Already up to date"
  exit 0
fi

PREV_SHA="$LOCAL_SHA"
BUILD_TIME="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
NEW_SHA_SHORT="$(git rev-parse --short origin/${BRANCH})"

log "Updating working tree to origin/${BRANCH}"
git reset --hard "origin/${BRANCH}"

log "Installing dependencies"
npm ci

log "Building frontend"
npm run build

log "Restarting ${SERVICE_NAME}.service"
systemctl restart "${SERVICE_NAME}.service"

log "Waiting for MAESTRO health check"
sleep 8

if curl -fsS "$HEALTH_URL" >/dev/null; then
  log "Health check passed"
  log "Writing runtime environment file"

  sudo mkdir -p /etc/maestro

  sudo tee /etc/maestro/runtime.env >/dev/null <<EOF
MAESTRO_VERSION=$(node -p "require('./package.json').version")
MAESTRO_GIT_SHA=${NEW_SHA_SHORT}
MAESTRO_BUILD_TIME=${BUILD_TIME}
PORT=${PORT}
NODE_ENV=production
EOF

  log "Restarting service with updated runtime metadata"
  systemctl restart "${SERVICE_NAME}.service"
  sleep 5

  if curl -fsS "$HEALTH_URL" >/dev/null; then
    log "Update successful"
    exit 0
  fi
fi

log "Health check failed, rolling back to ${PREV_SHA}"
git reset --hard "${PREV_SHA}"
npm ci
npm run build
systemctl restart "${SERVICE_NAME}.service"

log "Rollback complete"
exit 1