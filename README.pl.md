# Agent World — watacha dzików

Podgląd agentów Claude Code na VPS na żywo: każda sesja to dzik, projekt to barłóg, narzędzia to miejsca żerowania. Zero zależności poza Node i `curl`.

```
agent-world/
  hooks/emit.sh              # hook: przekazuje zdarzenie z Claude Code do collectora
  hooks/settings.hooks.json  # fragment do wklejenia w ~/.claude/settings.json
  collector/server.js        # odbiera zdarzenia, trzyma stan (zapis w ~/.agent-world/state.json), SSE /stream, serwuje web/
  web/                       # pixelowy świat: engine.js (silnik), forest-map.js (teren, pory roku), forest-life.js (dziki, życie), live.js (SSE), index.html
  docs/concepts/             # makieta z symulacją (ten sam silnik i świat, index.html bez live.js)
```

Na tym serwerze całość stawia skrypt `/home/debian/agent-world-wdrozenie.sh` (hooki + usługa `systemctl --user agent-world.service`).

## Instalacja (na VPS)

```bash
# 1. Rozpakuj do ~/agent-world
cd ~ && tar xzf agent-world.tar.gz && chmod +x agent-world/hooks/emit.sh

# 2. Dodaj hooki do ~/.claude/settings.json
#    Jeśli plik nie istnieje lub nie ma klucza "hooks" — skopiuj całość:
cp ~/.claude/settings.json ~/.claude/settings.json.bak 2>/dev/null
cp agent-world/hooks/settings.hooks.json ~/.claude/settings.json
#    Jeśli masz już inne ustawienia — dopisz klucz "hooks" (na tym VPS nie ma jq, więc przez node;
#    istniejące hooki zostają, nasze dochodzą obok):
#    node -e 'const fs=require("fs"),f=process.env.HOME+"/.claude/settings.json",c=JSON.parse(fs.readFileSync(f)),a=JSON.parse(fs.readFileSync(process.env.HOME+"/agent-world/hooks/settings.hooks.json")).hooks;c.hooks=c.hooks||{};for(const[e,v]of Object.entries(a)){const l=c.hooks[e]||[];if(!JSON.stringify(l).includes("agent-world/hooks/emit.sh"))l.push(...v);c.hooks[e]=l}fs.writeFileSync(f,JSON.stringify(c,null,2)+"\n")'

# 3. Odpal collector (na próbę w drugim oknie tmux; docelowo jako usługa systemd)
node ~/agent-world/collector/server.js

# 4. W innym oknie uruchom claude jak zwykle i daj mu coś do roboty.
```

Podgląd: collector nasłuchuje tylko na `127.0.0.1:7777`, więc z laptopa wejdź przez tunel:

```bash
ssh -L 7777:127.0.0.1:7777 user@twoj-vps
# potem w przeglądarce: http://localhost:7777
```

Nie wystawiaj go na świat bez uwierzytelnienia — w zdarzeniach są treści promptów i fragmenty odpowiedzi.

## Co dostajesz

- `GET /agents` — JSON z listą agentów: `id, name, status, waitingFor, currentTool, lastMessage, parentId, kind, toolCalls, updatedAt`
- `GET /events?since=<ts>` — znormalizowane zdarzenia (do logu / animacji)
- `GET /stream` — SSE: najpierw `{type:'snapshot', agents}`, potem `{type:'event', event, agents}` przy każdej zmianie (ping co 20 s)
- `GET /` — pixelowy świat z `web/` (tryb na żywo; przełącznik „symulacja” pokazuje udawane sesje). Konto bez sesji i bez podłączonego komputera widzi pokaz (udawane dziki z paskiem „Pokaz”) do pierwszej sesji albo tokenu
- `GET /table` — prosta tabela z Etapu 1

Stan (agenci + 200 ostatnich zdarzeń) zapisuje się do `~/.agent-world/state.json` 2 s po zmianie i wraca po restarcie collectora.

Statusy: `idle` → `thinking` (po prompcie) → `tool` (w trakcie narzędzia) → `waiting_for_user` (prośba o pozwolenie / bezczynność) → `done` (koniec sesji); `error`, gdy tura padła na błędzie API (`StopFailure`). Subagenci pojawiają się jako osobne wpisy z `parentId` wskazującym na sesję.

## Surowy log zdarzeń

`emit.sh` umie zapisywać każde zdarzenie 1:1 do `~/.agent-world/events.jsonl`, ale **domyślnie tego nie robi**: zdarzenia zawierają prompty, wyniki narzędzi i całe przeczytane pliki. Log działa tylko, gdy istnieje plik-znacznik:

```bash
touch ~/.agent-world/raw-log.on   # włącz (np. po aktualizacji Claude Code, żeby sprawdzić nowe pola)
rm ~/.agent-world/raw-log.on      # wyłącz; potem usuń też ~/.agent-world/events.jsonl
```

Faktyczne schematy zdarzeń i to, jak collector mapuje je na statusy: `docs/hook-events.md`. Podgląd logu na żywo (bez jq):

```bash
tail -f ~/.agent-world/events.jsonl | node -e 'require("readline").createInterface({input:process.stdin}).on("line",l=>{const e=JSON.parse(l);console.log(e.hook_event_name,e.tool_name||"",e.agent_type||"",e.notification_type||"")})'
```

## Uruchamianie jako usługa (gdy spike zadziała)

`~/.config/systemd/user/agent-world.service`:

```ini
[Unit]
Description=Agent World collector

[Service]
ExecStart=/usr/bin/env node %h/agent-world/collector/server.js
Restart=always

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload && systemctl --user enable --now agent-world
loginctl enable-linger $USER   # żeby działało po wylogowaniu z ssh
```

## Następne etapy

1. **Etap 1** (ten plik) — potwierdź, że statusy zgadzają się z tym, co widzisz w terminalu.
2. **Etap 2** — pixelowy świat: frontend (PixiJS / canvas) zamiast tabeli; jeden sprite na agenta, animacje per status, dymek z `summary` ostatniego zdarzenia. Warto wtedy dołożyć WebSocket zamiast odpytywania co sekundę.
3. **Etap 3** — klik na postać → transkrypt (`transcript_path` jest w każdym zdarzeniu), wysyłanie odpowiedzi do sesji (przez tmux `send-keys` albo przejście na Agent SDK).
