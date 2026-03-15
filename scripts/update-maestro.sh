#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/maestro"
SERVICE_NAME="maestro"
BRANCH="main"
PORT="3000"
HEALTH_URL="http://127.0.0.1:${PORT}/api/health"
STATUS_FILE="/etc/maestro/update-status.json"
RUNTIME_ENV="/etc/maestro/runtime.env"

log() {
  echo "[maestro-update] $1"
}

json_escape() {
  python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$1"
}

write_status() {
  local updating="$1"
  local stage="$2"
  local progress="$3"
  local message="$4"
  local error="${5:-null}"

  mkdir -p /etc/maestro

  cat > "$STATUS_FILE" <<EOF
{
  "updating": ${updating},
  "stage": $(json_escape "$stage"),
  "progress": ${progress},
  "message": $(json_escape "$message"),
  "error": ${error},
  "lastUpdated": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1"
    exit 1
  }
}

fail_with_status() {
  local stage="$1"
  local message="$2"
  write_status false "$stage" 100 "$message" "$(json_escape "$message")"
  log "$message"
  exit 1
}

require_cmd git
require_cmd npm
require_cmd curl
require_cmd systemctl
require_cmd date
require_cmd python3

cd "$APP_DIR"

write_status true "Checking for updates" 5 "Fetching latest changes from GitHub"
log "Fetching latest changes from origin/${BRANCH}"
git fetch origin "$BRANCH"

LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse origin/${BRANCH})"

log "Local SHA:  ${LOCAL_SHA}"
log "Remote SHA: ${REMOTE_SHA}"

if [ "$LOCAL_SHA" = "$REMOTE_SHA" ]; then
  write_status false "Up to date" 100 "No update required"
  log "Already up to date"
  exit 0
fi

PREV_SHA="$LOCAL_SHA"
BUILD_TIME="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
NEW_SHA_SHORT="$(git rev-parse --short origin/${BRANCH})"
NEW_VERSION="$(node -p "require('./package.json').version")"

write_status true "Downloading update" 20 "Updating working tree to origin/${BRANCH}"
log "Updating working tree to origin/${BRANCH}"
git reset --hard "origin/${BRANCH}"

write_status true "Installing dependencies" 40 "Running npm ci"
log "Installing dependencies"
runuser -u nocturnesystems --npm ci

write_status true "Building frontend" 70 "Running npm run build"
log "Building frontend"
runuser -u nocturnesystems -- npm run build

write_status true "Writing runtime metadata" 85 "Updating runtime environment file"
cat > "$RUNTIME_ENV" <<EOF
MAESTRO_VERSION=${NEW_VERSION}
MAESTRO_GIT_SHA=${NEW_SHA_SHORT}
MAESTRO_BUILD_TIME=${BUILD_TIME}
PORT=${PORT}
NODE_ENV=production
EOF

write_status true "Restarting service" 92 "Restarting ${SERVICE_NAME}.service"
log "Restarting ${SERVICE_NAME}.service"
systemctl restart "${SERVICE_NAME}.service"

write_status true "Running health check" 97 "Checking /api/health"
log "Waiting for MAESTRO health check"
sleep 8

if curl -fsS "$HEALTH_URL" >/dev/null; then
  write_status false "Update complete" 100 "Update successful"
  log "Update successful"
  exit 0
fi

write_status true "Rollback" 98 "Health check failed, restoring previous version"
log "Health check failed, rolling back to ${PREV_SHA}"

git reset --hard "${PREV_SHA}"
runuser -u nocturnesystems -- npm ci
runuser -u nocturnesystems -- npm run build

PREV_VERSION="$(node -p "require('./package.json').version")"
PREV_SHA_SHORT="$(git rev-parse --short HEAD)"
ROLLBACK_TIME="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

cat > "$RUNTIME_ENV" <<EOF
MAESTRO_VERSION=${PREV_VERSION}
MAESTRO_GIT_SHA=${PREV_SHA_SHORT}
MAESTRO_BUILD_TIME=${ROLLBACK_TIME}
PORT=${PORT}
NODE_ENV=production
EOF

systemctl restart "${SERVICE_NAME}.service"

if curl -fsS "$HEALTH_URL" >/dev/null; then
  write_status false "Rollback complete" 100 "Update failed and previous version was restored" "$(json_escape "Health check failed after update")"
  log "Rollback complete"
  exit 1
fi

fail_with_status "Rollback failed" "Rollback failed and MAESTRO health check is still failing"