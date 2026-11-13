# Zdarzenia hooków Claude Code: faktyczne schematy

Stan na 2026-10-09, Claude Code 2.1.295. Źródło: surowy log `~/.agent-world/events.jsonl` z prawdziwych sesji (terminal i VSCode) plus nazwy pól z kodu Claude Code dla zdarzeń, które jeszcze nie wystąpiły. Treści promptów, odpowiedzi i wejść narzędzi usunięte.

## Pola wspólne

Każde zdarzenie: `session_id`, `transcript_path`, `cwd`, `scratchpad_dir`, `hook_event_name`. Prawie każde: `prompt_id`, `permission_mode` (`default` / `auto` / …), `effort: { level }`.
W zdarzeniach z wnętrza subagenta dochodzą `agent_id` i `agent_type`. `session_title` nie pojawił się ani razu (sesje bez nazwy).

Katalog projektu przychodzi w nagłówku `X-Project-Dir` (z `$CLAUDE_PROJECT_DIR`), bo `cwd` zmienia się w trakcie sesji.

## Zdarzenie → status w collectorze

| Zdarzenie | Kluczowe pola | Status | Sprawdzone na żywo |
|---|---|---|---|
| `SessionStart` | `source`: `startup`, `clear` (też `resume`, `compact` wg kodu), `model` (brak przy `clear`) | `idle` | tak |
| `UserPromptSubmit` | `prompt`; wynik subagenta w tle przychodzi jako prompt zaczynający się od `<task-notification>` | `thinking` | tak |
| `PreToolUse` | `tool_name`, `tool_input`, `tool_use_id` | `tool`; `AskUserQuestion` / `ExitPlanMode` → `waiting_for_user` | tak |
| `PermissionRequest` | `tool_name`, `tool_input`, `permission_suggestions`; **bez `tool_use_id`**. Przychodzi w chwili pokazania okienka, także dla `AskUserQuestion` | `waiting_for_user`, `waitingFor: permission` (dla `AskUserQuestion`: `question`) | tak |
| `PostToolUse` | `tool_response`, `duration_ms`, `tool_use_id` | `thinking` (albo `tool`, jeśli inne wywołania wciąż trwają) | tak |
| `PostToolUseFailure` | `error` (tekst), `is_interrupt`, `duration_ms`, `tool_use_id` | jak `PostToolUse`; przy `is_interrupt: true` → `idle` | tak (błąd); przerwanie: nie |
| `PermissionDenied` | `tool_name`, `tool_input`, `tool_use_id`, `reason` | jak `PostToolUse` | nie (pola z kodu) |
| `Notification` | `notification_type`: `permission_prompt`, `idle_prompt` (też `elicitation_dialog`, `auth_success` wg kodu), `message` | `waiting_for_user`, ale `permission_prompt` tylko gdy status to wciąż `tool`, a `idle_prompt` tylko gdy `idle` | tak |
| `SubagentStart` | `agent_id`, `agent_type`; **bez `agent_transcript_path`** | `thinking` (nowa postać z `parentId`) | tak |
| `SubagentStop` | `agent_id`, `agent_type`, `agent_transcript_path`, `last_assistant_message` | `done` | tak |
| `Stop` | `last_assistant_message`, `stop_hook_active`, `background_tasks`, `session_crons` | `idle` | tak |
| `StopFailure` | `error`, `error_details`, `last_assistant_message` | `error` | nie (pola z kodu) |
| `SessionEnd` | `reason`: `prompt_input_exit` (`/exit`), `clear` (też `logout`, `resume`, `other` wg kodu) | `done` | tak |

Powód czekania (`waitingFor`, tylko przy `waiting_for_user`): `permission` (`PermissionRequest`, `permission_prompt`, `ExitPlanMode`), `question` (`AskUserQuestion`, `elicitation_dialog`), `input` (`idle_prompt`: tura skończona, agent czeka na następne polecenie).

## Pułapki

- **Wewnętrzni pomocnicy.** Claude Code uruchamia własne agenty (np. podpowiedź następnego promptu). Wysyłają tylko `SubagentStop` z pustym `agent_type`, bez `SubagentStart`, a w `last_assistant_message` jest przewidywany prompt użytkownika. Collector je pomija.
- **`permission_prompt` jest spóźnione** o ok. 6 s względem okienka. Właściwy sygnał to `PermissionRequest`.
- **Kolejność.** Hooki są `async`, więc `PostToolUse` szybkiego narzędzia może dojść przed `PreToolUse`. Wywołania bywają równoległe. Collector śledzi je po `tool_use_id`.
- **Subagent w tle.** `PreToolUse` → `PostToolUse` narzędzia `Agent` przychodzą od razu, a rodzic dostaje `Stop` (status `idle`), podczas gdy subagent wciąż pracuje. Lista zadań jest w `Stop.background_tasks`.
- **`/clear`** kończy sesję (`SessionEnd` z `reason: clear`) i zaczyna nową z nowym `session_id`.
- **Działające sesje** wczytują zmiany hooków w `~/.claude/settings.json` bez restartu. Po restarcie collectora sesja pojawia się znowu przy swoim następnym zdarzeniu (stan jest tylko w pamięci, do Etapu 1.5).
- **Niesprawdzone: przerwanie Esc w trakcie odpowiedzi i odmowa pozwolenia.** Wg kodu Claude Code dopisuje wtedy do transkryptu `[Request interrupted by user]` / `[Request interrupted by user for tool use]`. Wg dokumentacji hooków `Stop` przy przerwaniu przez użytkownika nie przychodzi. W żadnym z dotychczasowych transkryptów nie ma takiego przypadku.

## Przykłady (po jednym na typ)

### SessionStart

```json
{
  "session_id": "49309b9b…",
  "transcript_path": "~/.claude/projects/<projekt>/<id>.jsonl",
  "cwd": "/home/debian/agent-world",
  "scratchpad_dir": "/tmp/claude-1000/<projekt>/<id>/scratchpad",
  "hook_event_name": "SessionStart",
  "source": "startup",
  "model": "claude-opus-5-5"
}
```

### UserPromptSubmit

```json
{
  "session_id": "49309b9b…",
  "transcript_path": "~/.claude/projects/<projekt>/<id>.jsonl",
  "cwd": "/home/debian/agent-world",
  "scratchpad_dir": "/tmp/claude-1000/<projekt>/<id>/scratchpad",
  "prompt_id": "53fa2878…",
  "permission_mode": "default",
  "hook_event_name": "UserPromptSubmit",
  "prompt": "<usunięte>"
}
```

### PreToolUse

```json
{
  "session_id": "49309b9b…",
  "transcript_path": "~/.claude/projects/<projekt>/<id>.jsonl",
  "cwd": "/home/debian/agent-world",
  "scratchpad_dir": "/tmp/claude-1000/<projekt>/<id>/scratchpad",
  "prompt_id": "53fa2878…",
  "permission_mode": "default",
  "effort": {
    "level": "xhigh"
  },
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "<usunięte>",
    "description": "<usunięte>"
  },
  "tool_use_id": "toolu_01…"
}
```

### PostToolUse

```json
{
  "session_id": "49309b9b…",
  "transcript_path": "~/.claude/projects/<projekt>/<id>.jsonl",
  "cwd": "/home/debian/agent-world",
  "scratchpad_dir": "/tmp/claude-1000/<projekt>/<id>/scratchpad",
  "prompt_id": "53fa2878…",
  "permission_mode": "default",
  "effort": {
    "level": "xhigh"
  },
  "hook_event_name": "PostToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "<usunięte>",
    "description": "<usunięte>"
  },
  "tool_response": "<usunięte>",
  "tool_use_id": "toolu_01…",
  "duration_ms": 48
}
```

### Stop

```json
{
  "session_id": "49309b9b…",
  "transcript_path": "~/.claude/projects/<projekt>/<id>.jsonl",
  "cwd": "/home/debian/agent-world",
  "scratchpad_dir": "/tmp/claude-1000/<projekt>/<id>/scratchpad",
  "prompt_id": "53fa2878…",
  "permission_mode": "default",
  "effort": {
    "level": "xhigh"
  },
  "hook_event_name": "Stop",
  "stop_hook_active": false,
  "last_assistant_message": "<usunięte>",
  "background_tasks": [],
  "session_crons": []
}
```

### SubagentStop (wewnętrzny)

```json
{
  "session_id": "49309b9b…",
  "transcript_path": "~/.claude/projects/<projekt>/<id>.jsonl",
  "cwd": "/home/debian/agent-world",
  "scratchpad_dir": "/tmp/claude-1000/<projekt>/<id>/scratchpad",
  "prompt_id": "53fa2878…",
  "permission_mode": "default",
  "agent_id": "a19a0712…",
  "agent_type": "",
  "effort": {
    "level": "xhigh"
  },
  "hook_event_name": "SubagentStop",
  "stop_hook_active": false,
  "agent_transcript_path": "~/.claude/projects/<projekt>/<id>.jsonl",
  "last_assistant_message": "<usunięte>",
  "background_tasks": [],
  "session_crons": []
}
```

### Notification

```json
{
  "session_id": "49309b9b…",
  "transcript_path": "~/.claude/projects/<projekt>/<id>.jsonl",
  "cwd": "/home/debian/agent-world",
  "scratchpad_dir": "/tmp/claude-1000/<projekt>/<id>/scratchpad",
  "prompt_id": "7533fd28…",
  "hook_event_name": "Notification",
  "message": "Claude needs your permission",
  "notification_type": "permission_prompt"
}
```

### SubagentStart

```json
{
  "session_id": "49309b9b…",
  "transcript_path": "~/.claude/projects/<projekt>/<id>.jsonl",
  "cwd": "/home/debian/agent-world",
  "scratchpad_dir": "/tmp/claude-1000/<projekt>/<id>/scratchpad",
  "prompt_id": "54dedab1…",
  "agent_id": "a3398476…",
  "agent_type": "Explore",
  "hook_event_name": "SubagentStart"
}
```

### PreToolUse (w subagencie)

```json
{
  "session_id": "49309b9b…",
  "transcript_path": "~/.claude/projects/<projekt>/<id>.jsonl",
  "cwd": "/home/debian/agent-world",
  "scratchpad_dir": "/tmp/claude-1000/<projekt>/<id>/scratchpad",
  "prompt_id": "54dedab1…",
  "permission_mode": "default",
  "agent_id": "a3398476…",
  "agent_type": "Explore",
  "effort": {
    "level": "xhigh"
  },
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "<usunięte>",
    "description": "<usunięte>"
  },
  "tool_use_id": "toolu_01…"
}
```

### SubagentStop

```json
{
  "session_id": "49309b9b…",
  "transcript_path": "~/.claude/projects/<projekt>/<id>.jsonl",
  "cwd": "/home/debian/agent-world",
  "scratchpad_dir": "/tmp/claude-1000/<projekt>/<id>/scratchpad",
  "prompt_id": "54dedab1…",
  "permission_mode": "default",
  "agent_id": "a3398476…",
  "agent_type": "Explore",
  "effort": {
    "level": "xhigh"
  },
  "hook_event_name": "SubagentStop",
  "stop_hook_active": false,
  "agent_transcript_path": "~/.claude/projects/<projekt>/<id>.jsonl",
  "last_assistant_message": "<usunięte>",
  "background_tasks": [
    {
      "id": "a33984769cef6b00b",
      "type": "subagent",
      "status": "running",
      "description": "<usunięte>",
      "agent_type": "Explore",
      "command": "<usunięte>"
    }
  ],
  "session_crons": []
}
```

### SessionEnd

```json
{
  "session_id": "49309b9b…",
  "transcript_path": "~/.claude/projects/<projekt>/<id>.jsonl",
  "cwd": "/home/debian/agent-world",
  "scratchpad_dir": "/tmp/claude-1000/<projekt>/<id>/scratchpad",
  "prompt_id": "b1b6e06e…",
  "hook_event_name": "SessionEnd",
  "reason": "prompt_input_exit"
}
```

### PermissionRequest

```json
{
  "session_id": "5b91696d…",
  "transcript_path": "~/.claude/projects/<projekt>/<id>.jsonl",
  "cwd": "/home/debian/agent-world",
  "scratchpad_dir": "/tmp/claude-1000/<projekt>/<id>/scratchpad",
  "prompt_id": "55c5513b…",
  "permission_mode": "default",
  "effort": {
    "level": "xhigh"
  },
  "hook_event_name": "PermissionRequest",
  "tool_name": "Read",
  "tool_input": {
    "file_path": "<usunięte>"
  },
  "permission_suggestions": [
    {
      "type": "addRules",
      "rules": [
        {
          "toolName": "Read",
          "ruleContent": "//etc/**"
        }
      ],
      "behavior": "allow",
      "destination": "session"
    }
  ]
}
```

### PostToolUseFailure

```json
{
  "session_id": "ae0076a4…",
  "transcript_path": "~/.claude/projects/<projekt>/<id>.jsonl",
  "cwd": "/home/debian/agent-world",
  "scratchpad_dir": "/tmp/claude-1000/<projekt>/<id>/scratchpad",
  "prompt_id": "dbd90d89…",
  "permission_mode": "auto",
  "effort": {
    "level": "xhigh"
  },
  "hook_event_name": "PostToolUseFailure",
  "tool_name": "Read",
  "tool_input": {
    "file_path": "<usunięte>"
  },
  "tool_use_id": "toolu_01…",
  "error": "File does not exist. Note: your current working directory is /home/debian/agent-world.",
  "is_interrupt": false,
  "duration_ms": 2
}
```
