#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_PORT="3003"
INCLUDE_STUDIO="${VOCTA_DEV_STUDIO:-0}"

if ! command -v osascript >/dev/null 2>&1; then
  echo "macOS osascript is required for the iTerm2 launcher." >&2
  exit 1
fi

if ! osascript -e 'id of application "iTerm2"' >/dev/null 2>&1; then
  echo "iTerm2 is required. Install iTerm2 or run the services manually from docs/development.md." >&2
  exit 1
fi

if [ ! -f "$ROOT_DIR/.env" ] && [ -f "$ROOT_DIR/.env.example" ]; then
  cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
  echo "Created .env from .env.example"
fi

shell_command() {
  local title="$1"
  local command="$2"

  printf 'cd %q && printf "\\033]0;%s\\007" && clear && echo %q && %s' \
    "$ROOT_DIR" \
    "$title" \
    "$title" \
    "$command"
}

WEB_CMD="$(shell_command "Vocta Web :$APP_PORT" "npm run dev")"
WORKER_CMD="$(shell_command "Vocta Worker" "npm run worker:dev")"
REDIS_CMD="$(shell_command "Redis" 'if command -v redis-cli >/dev/null 2>&1 && redis-cli ping >/dev/null 2>&1; then echo "Redis already running on REDIS_URL=${REDIS_URL:-redis://localhost:6379}"; while true; do sleep 3600; done; else redis-server; fi')"
TEST_CMD="$(shell_command "Vitest Watch" "npm run test:watch")"
STUDIO_CMD="$(shell_command "Prisma Studio" "npm run prisma:studio")"

osascript - "$WEB_CMD" "$WORKER_CMD" "$REDIS_CMD" "$TEST_CMD" "$STUDIO_CMD" "$INCLUDE_STUDIO" <<'APPLESCRIPT'
on run argv
  set webCmd to item 1 of argv
  set workerCmd to item 2 of argv
  set redisCmd to item 3 of argv
  set testCmd to item 4 of argv
  set studioCmd to item 5 of argv
  set includeStudio to item 6 of argv

  tell application "iTerm2"
    activate
    set devWindow to (create window with default profile)

    tell current session of devWindow
      write text webCmd
      set workerPane to (split vertically with default profile)
      tell workerPane to write text workerCmd
      set redisPane to (split horizontally with default profile)
      tell redisPane to write text redisCmd

      tell workerPane
        set testPane to (split horizontally with default profile)
        tell testPane to write text testCmd
      end tell

      if includeStudio is "1" then
        tell redisPane
          set studioPane to (split horizontally with default profile)
          tell studioPane to write text studioCmd
        end tell
      end if
    end tell
  end tell
end run
APPLESCRIPT

echo "Started Vocta dev services in one iTerm2 tab."
echo "Web: http://localhost:$APP_PORT"
