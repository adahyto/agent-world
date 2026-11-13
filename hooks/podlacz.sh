#!/usr/bin/env bash
# Agent World (dziki.doner.cloud): podłącza Claude Code na tym komputerze do Twojej mapy dzików.
#
#   Podłącz:  curl -fsSL __INGEST_URL__/podlacz.sh | bash -s -- TOKEN [status|full]
#   Odłącz:   curl -fsSL __INGEST_URL__/podlacz.sh | bash -s -- --usun
#
# Co robi: zapisuje hook w ~/.agent-world-remote/ i dopisuje go do ~/.claude/settings.json (inne hooki
# zostają, kopia pliku obok). Hook wysyła zdarzenia sesji (start, narzędzie, prośba o zgodę, koniec) na
# __INGEST_URL__ i nigdy nie blokuje Claude: działa w tle, z limitem 3 s, błędy są ciche.
# Tryb "status" (domyślny): przed wysłaniem zostają same stany, nazwy narzędzi i nazwa folderu projektu.
# Tryb "full": także ostatni prompt, początek odpowiedzi i skrót komendy albo nazwa pliku.
# Działa na macOS i Linuksie (Windows: WSL). Do zmian w settings.json potrzebny jest python3 albo jq.

set -u
URL="__INGEST_URL__"
DIR="$HOME/.agent-world-remote"
SET="$HOME/.claude/settings.json"
HOOK="$DIR/emit.sh"
EVENTS="SessionStart UserPromptSubmit PreToolUse PermissionRequest PermissionDenied PostToolUse PostToolUseFailure Notification SubagentStart SubagentStop Stop StopFailure SessionEnd"

say() { printf '%s\n' "$*"; }
fail() { say "Błąd: $*"; say "Nic nie zostało zmienione w ~/.claude/settings.json."; exit 1; }

have() { command -v "$1" >/dev/null 2>&1; }
TOOL=""
if have python3; then TOOL=python3; elif have jq; then TOOL=jq; fi

# Dopisuje albo usuwa nasze wpisy w settings.json. Inne hooki zostają; plik niepoprawny = bez zmian.
edit_settings() { # $1 = add | remove
  mkdir -p "$HOME/.claude"
  [ -s "$SET" ] || printf '{}\n' > "$SET"
  local tmp="$SET.agent-world.tmp"
  if [ "$TOOL" = python3 ]; then
    python3 -I - "$SET" "$HOOK" "$EVENTS" "$1" > "$tmp" <<'PY' || { rm -f "$tmp"; return 1; }
import json, sys
path, hook, events, mode = sys.argv[1], sys.argv[2], sys.argv[3].split(), sys.argv[4]
with open(path) as f:
    d = json.load(f)
if not isinstance(d, dict):
    sys.exit(1)
h = d.get('hooks') or {}
for e in events:
    keep = []
    for m in h.get(e, []):
        hs = [x for x in m.get('hooks', []) if hook not in str(x.get('command', ''))]
        if hs:
            m['hooks'] = hs
            keep.append(m)
    if mode == 'add':
        keep.append({'hooks': [{'type': 'command', 'command': hook, 'async': True}]})
    if keep:
        h[e] = keep
    else:
        h.pop(e, None)
if h:
    d['hooks'] = h
else:
    d.pop('hooks', None)
print(json.dumps(d, indent=2, ensure_ascii=False))
PY
  elif [ "$TOOL" = jq ]; then
    jq --arg c "$HOOK" --arg mode "$1" --arg ev "$EVENTS" '
      . as $root
      | ($ev | split(" ")) as $events
      | (.hooks // {}) as $h0
      | (reduce $events[] as $e ($h0;
          .[$e] = (((.[$e] // []) | map(.hooks |= map(select((.command // "") | tostring | contains($c) | not))) | map(select((.hooks | length) > 0)))
                   + (if $mode == "add" then [{hooks: [{type: "command", command: $c, async: true}]}] else [] end))))
      | with_entries(select(.value | length > 0)) as $h
      | if ($h | length) > 0 then $root + {hooks: $h} else ($root | del(.hooks)) end
    ' "$SET" > "$tmp" 2>/dev/null || { rm -f "$tmp"; return 1; }
  else
    return 2
  fi
  [ -s "$tmp" ] || { rm -f "$tmp"; return 1; }
  cp "$SET" "$SET.przed-agent-world-$(date +%Y%m%d-%H%M%S)-$$"
  # cat instead of mv: keeps the file's permissions, and a symlinked settings.json stays a symlink
  cat "$tmp" > "$SET" && rm -f "$tmp"
}

# ---- odłączenie -------------------------------------------------------------------------
if [ "${1:-}" = "--usun" ]; then
  if [ -f "$SET" ]; then
    edit_settings remove
    case $? in
      0) say "Hooki Agent World usunięte z ~/.claude/settings.json (kopia obok).";;
      2) say "Brak python3 i jq: usuń ręcznie z ~/.claude/settings.json wpisy z poleceniem $HOOK.";;
      *) say "~/.claude/settings.json nie jest poprawnym JSON-em, nie zmieniam go. Usuń ręcznie wpisy z $HOOK.";;
    esac
  fi
  rm -rf "$DIR"
  say "Pliki hooka usunięte. Unieważnij jeszcze token na stronie (Podłącz komputer → Twoje komputery)."
  say "Działające sesje Claude Code przestaną wysyłać zdarzenia po ponownym uruchomieniu."
  exit 0
fi

# ---- podłączenie ------------------------------------------------------------------------
TOKEN="${1:-}"
MODE="${2:-status}"
case "$TOKEN" in aw_*) ;; *) fail "podaj token z dziki.doner.cloud (zaczyna się od aw_)";; esac
printf '%s' "$TOKEN" | grep -Eq '^aw_[A-Za-z0-9_-]{20,80}$' || fail "token ma zły format"
case "$MODE" in status|full) ;; *) fail "tryb to status albo full";; esac
have curl || fail "potrzebny jest curl"
[ -n "$TOOL" ] || say "Uwaga: brak python3 i jq. Hook będzie wysyłał zdarzenia bez przycinania (serwer i tak zapisuje tylko to, co wynika z trybu), a wpisy w settings.json trzeba dodać ręcznie."

# Sprawdzenie tokenu, zanim cokolwiek zmienię.
mkdir -p "$DIR" && chmod 700 "$DIR"
(umask 077; printf 'Authorization: Bearer %s\n' "$TOKEN" > "$DIR/auth")
code=$(curl -s -m 10 -o "$DIR/check.json" -w '%{http_code}' -H @"$DIR/auth" "$URL/check")
if [ "$code" != 200 ]; then
  rm -rf "$DIR"
  fail "serwer nie przyjął tokenu (HTTP $code). Utwórz nowy na stronie i spróbuj jeszcze raz."
fi
rm -f "$DIR/check.json"

printf 'AW_URL=%s\nAW_MODE=%s\n' "$URL" "$MODE" > "$DIR/config"

# Filtr zdarzenia: zostają tylko pola potrzebne mapie (w trybie full także krótkie treści).
cat > "$DIR/filter.py" <<'PY'
import json, os, sys
full = sys.argv[1] == 'full'
ev = json.load(sys.stdin)
keep = ['hook_event_name', 'session_id', 'agent_id', 'agent_type', 'tool_name', 'tool_use_id', 'is_interrupt',
        'notification_type', 'source', 'model']
out = {k: ev[k] for k in keep if k in ev}
if ev.get('cwd'):
    out['cwd'] = os.path.basename(str(ev['cwd']).rstrip('/'))
if full:
    for k, n in [('prompt', 300), ('last_assistant_message', 200), ('session_title', 80), ('message', 80), ('reason', 60)]:
        if isinstance(ev.get(k), str):
            out[k] = ev[k][:n]
    if ev.get('error'):
        out['error'] = (ev['error'] if isinstance(ev['error'], str) else json.dumps(ev['error']))[:200]
    i = ev.get('tool_input') if isinstance(ev.get('tool_input'), dict) else {}
    for k in ['command', 'file_path', 'pattern', 'query', 'url', 'description']:
        if isinstance(i.get(k), str) and i[k]:
            out['tool_input'] = {k: os.path.basename(i[k]) if k == 'file_path' else i[k][:80]}
            break
elif ev.get('hook_event_name') == 'StopFailure':
    out['error'] = 'error'
print(json.dumps(out))
PY
cat > "$DIR/filter.jq" <<'JQ'
({hook_event_name, session_id, agent_id, agent_type, tool_name, tool_use_id, is_interrupt, notification_type, source, model}
 | with_entries(select(.value != null)))
+ (if .cwd then {cwd: (.cwd | tostring | rtrimstr("/") | split("/") | last)} else {} end)
+ (if $mode == "full" then
     ({prompt: (.prompt // null | if type == "string" then .[0:300] else null end),
       last_assistant_message: (.last_assistant_message // null | if type == "string" then .[0:200] else null end),
       session_title: (.session_title // null | if type == "string" then .[0:80] else null end),
       message: (.message // null | if type == "string" then .[0:80] else null end),
       reason: (.reason // null | if type == "string" then .[0:60] else null end),
       error: (.error // null | if . == null then null elif type == "string" then .[0:200] else tojson[0:200] end)}
      | with_entries(select(.value != null)))
     + ((.tool_input // {}) as $i
        | [ "command", "file_path", "pattern", "query", "url", "description" ] | map(select(($i[.] | type) == "string" and $i[.] != "")) | first as $k
        | if $k then {tool_input: {($k): (if $k == "file_path" then ($i[$k] | split("/") | last) else $i[$k][0:80] end)}} else {} end)
   elif .hook_event_name == "StopFailure" then {error: "error"} else {} end)
JQ
cat > "$HOOK" <<'SH'
#!/usr/bin/env bash
# Agent World: wysyła zdarzenie hooka Claude Code na mapę dzików. Nigdy nie blokuje Claude.
D="$HOME/.agent-world-remote"
[ -f "$D/config" ] && [ -f "$D/auth" ] || exit 0
. "$D/config"
payload="$(cat)"
[ -z "$payload" ] && exit 0
if command -v python3 >/dev/null 2>&1; then
  payload="$(printf '%s' "$payload" | python3 -I "$D/filter.py" "$AW_MODE" 2>/dev/null)" || exit 0
elif command -v jq >/dev/null 2>&1; then
  payload="$(printf '%s' "$payload" | jq -c --arg mode "$AW_MODE" -f "$D/filter.jq" 2>/dev/null)" || exit 0
fi
[ -z "$payload" ] && exit 0
proj="${CLAUDE_PROJECT_DIR:-}"; proj="${proj%/}"; proj="${proj##*/}"
curl -s -m 3 -X POST "$AW_URL" -H @"$D/auth" -H 'Content-Type: application/json' \
  -H "X-Project-Dir: $proj" --data-binary "$payload" >/dev/null 2>&1
exit 0
SH
chmod 700 "$HOOK"

edit_settings add
rc=$?
case $rc in
  0) say "Hooki dopisane do ~/.claude/settings.json (kopia poprzedniej wersji obok).";;
  2) say "Dopisz ręcznie do ~/.claude/settings.json, w \"hooks\", dla każdego z: $EVENTS"
     say "  {\"hooks\": [{\"type\": \"command\", \"command\": \"$HOOK\", \"async\": true}]}"
     say ""
     say "Hook jest zapisany; komputer zacznie wysyłać zdarzenia po dopisaniu tych wpisów."
     say "Odłączenie: curl -fsSL $URL/podlacz.sh | bash -s -- --usun"
     exit 0;;
  *) say "~/.claude/settings.json nie jest poprawnym JSON-em, więc go nie zmieniam."
     say "Popraw go i uruchom to polecenie jeszcze raz."; exit 1;;
esac

say ""
say "Gotowe: ten komputer jest podłączony (tryb: $MODE)."
say "Uruchom claude jak zwykle. Sesje, które już działają, trzeba uruchomić ponownie."
say "Odłączenie: curl -fsSL $URL/podlacz.sh | bash -s -- --usun"
