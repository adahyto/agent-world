#!/usr/bin/env bash
# Claude Code hook: forwards the event JSON from stdin to the local collector.
# Never blocks Claude: always exits 0, short timeouts, failures are silent.
#
# Config (optional):
#   AGENT_WORLD_URL  - collector endpoint (default http://127.0.0.1:7777/events)
#   AGENT_WORLD_LOG  - raw event log for schema discovery. Off by default (events carry prompts,
#                      tool output and file contents); on while ~/.agent-world/raw-log.on exists,
#                      writing to ~/.agent-world/events.jsonl, or always when this is set.

URL="${AGENT_WORLD_URL:-http://127.0.0.1:7777/events}"
LOG="${AGENT_WORLD_LOG:-}"
[ -z "$LOG" ] && [ -e "$HOME/.agent-world/raw-log.on" ] && LOG="$HOME/.agent-world/events.jsonl"

payload="$(cat)"
[ -z "$payload" ] && exit 0

# Raw log: one JSON object per line, so you can inspect what each event really contains.
if [ -n "$LOG" ]; then
  mkdir -p "$(dirname "$LOG")" 2>/dev/null
  printf '%s\n' "$payload" >> "$LOG" 2>/dev/null
fi

# Project dir goes in a header: cwd can change during a session, this one doesn't.
curl -s -m 2 -X POST "$URL" \
  -H 'Content-Type: application/json' \
  -H "X-Project-Dir: ${CLAUDE_PROJECT_DIR:-}" \
  --data-binary "$payload" >/dev/null 2>&1

exit 0
