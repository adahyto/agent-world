# Agent World: stan prac

Aktualizacja 2026-10-10 (wieczór). Historia decyzji i makiet: `docs/design-brief.md`; schematy zdarzeń: `docs/hook-events.md`.

## Gdzie jesteśmy

| Etap | Stan |
|---|---|
| 0–1: hooki + collector | **Na żywo.** 13 hooków w `~/.claude/settings.json`, collector jako `systemctl --user agent-world.service` (127.0.0.1:7777). |
| Wywiad A–E | **Zamknięty.** Świat: watacha dzików (pięć makiet, v5 wybrana). D: panel ze zdarzeniami, promptem, wiadomością, transkryptem i osią czasu. E: https://dziki.doner.cloud za Cloudflare Access, laptop + telefon + TV. |
| 1.5: fundament | **Zrobiony.** SSE `/stream`, stan w `~/.agent-world/state.json`, `web/` serwowane przez collector, tryb na żywo w silniku, dynamiczne barłogi projektów. |
| 2: frontend produkcyjny | **Zrobiony.** 2.1 panel, 2.4 układy (TV `?tv`, telefon, legenda zwijana, tytuł z liczbą czekających), 2.3 oś czasu (`/history`), 2.2 transkrypt (`/transcript`). |
| 2.5: odświeżenie UI (2026-10-10) | **Zrobione.** Pasek u góry (tytuł, plakietka „na żywo”, licznik czekających, pełny ekran, ustawienia w wysuwanym okienku: pora roku/dnia, motyw auto/jasny/ciemny, podpisy, symulacja), paleta pergamin/las, karty sesji po polsku z czasem w stanie i pulsowaniem przy pozwoleniu/pytaniu, panel 360 px bez ucinania, podpisy sesji na mapie bez nakładania, oś czasu z unikalnymi nazwami i przewijana na telefonie, legenda w karcie. Mapa (forest-map.js): las w trzech planach z drzewami rzędami (głębia), cień pod ścianą lasu, plamy tonów trawy, kępy, kamyki, grzyby, krzaki, brzegi i trzciny strumienia, łaty i studzienka na drodze, żywopłot i ławka na przedmieściach. |
| Pokaz (2026-11-12) | **Na żywo.** Konto bez sesji i bez tokenu widzi symulację z paskiem „Pokaz” i plakietką „pokaz · udawane dziki” (bez osi czasu i transkryptu); pierwsza sesja, token albo odznaczenie „symulacji” kończy pokaz (`web/live.js`). Udawane projekty mają zmyślone nazwy i polecenia (`SESSIONS` w `engine.js`). |
| 3: sterowanie z przeglądarki | Nie planowane (brak tmux; wymagałoby Agent SDK). |

## Pliki

- `collector/server.js` — zdarzenia → stan, SSE, zapis, `/agents`, `/events`, `/history`, `/transcript`, statyka z `web/`, weryfikacja tokenu Cloudflare Access dla ruchu z brzegu (`X-Agent-World-Edge`).
- `web/engine.js` — silnik (pętla, ruch, dymki, symulacja, tryb na żywo `AW.live`, projekty `AW.projects`).
- `web/forest-map.js` — teren i pory roku; `web/forest-life.js` — dziki, baza, ludzie z osiedla, życie na mapie.
- `web/live.js` (SSE), `web/panel.js` (panel), `web/timeline.js` (oś czasu), `web/ui.js` (TV, telefon, legenda), `web/index.html`.
- `docs/concepts/index.html` — makieta z symulacją na tych samych plikach (`../../web/*.js`).
- Serwer: `/home/debian/agent-world-wdrozenie.sh` (hooki + usługa), `/home/debian/dziki-wdrozenie.sh` (domena), `apache-staging/dziki-*.conf`, `prompts/dziki-cloudflare-*.md`.

## Pomysły na później (nie wdrażać bez zgody)

- Nazwy sesji z `/rename` (`session_title` już jest preferowany w collectorze).
- Cichy sygnał dźwiękowy przy pozwoleniu, włączany przełącznikiem.
- Wykrywanie przerwania Esc i odmowy pozwolenia (brak hooków): znacznik `[Request interrupted by user…]` w transkrypcie.
- Dźwięk/animacje przy `Bash` według komendy (git = skarbiec, testy = …), kolejka TodoWrite jako liczba na mapie.
