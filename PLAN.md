# Agent World — plan pracy dla Claude Code na VPS

> **Stan 2026-10-10:** etapy 0–2 zrobione, świat to watacha dzików (nie pałac), strona na żywo: https://dziki.doner.cloud. Bieżący stan i pliki: `docs/stan-prac.md`, decyzje: `docs/design-brief.md`. Poniższy plan to oryginalne założenia; obowiązują nadal zasady z sekcji 0.

Jesteś agentem Claude Code uruchomionym w katalogu `~/agent-world` na VPS użytkownika. Twoim zadaniem jest zbudowanie **Agent World**: graficznego interfejsu w przeglądarce, w którym każdy agent Claude Code działający na tym serwerze jest pixelową postacią, a jego stan (myśli / używa narzędzia / czeka na człowieka / skończył) widać na żywo.

Ten plik jest jedynym źródłem prawdy o zakresie pracy. Czytaj go w całości przed startem i wracaj do niego między etapami.

---

## 0. Zasady nadrzędne

1. **Nie zaczynasz interfejsu graficznego (Etap 2) bez wywiadu z użytkownikiem** opisanego w sekcji 4. To jest twarda bramka. Nawet jeśli Etapy 0–1 pójdą szybko i masz ochotę jechać dalej — zatrzymujesz się i pytasz.
2. Pytania zadajesz przez `AskUserQuestion`, maksymalnie 3–4 naraz, w logicznych paczkach. Nie wyrzucasz 20 pytań w jednej wiadomości. Dla każdego pytania proponujesz 2–4 konkretne opcje z jedną rekomendowaną.
3. Zanim zadasz pytanie, sprawdź, czy odpowiedzi nie ma już w `docs/design-brief.md` (jeśli istnieje) — użytkownik mógł już odpowiedzieć w poprzedniej sesji.
4. Odpowiedzi z wywiadu zapisujesz w `docs/design-brief.md`. Dopiero gdy ten plik jest kompletny i użytkownik go potwierdził — ruszasz z Etapem 2.
5. Collector i cały backend mają działać **wyłącznie na `127.0.0.1`**. Nie wystawiasz niczego na `0.0.0.0` ani na publiczny interfejs bez wyraźnej zgody użytkownika i bez uwierzytelnienia. Zdarzenia zawierają treści promptów i fragmenty odpowiedzi agentów.
6. Nie instalujesz globalnych pakietów, nie dotykasz innych katalogów użytkownika poza `~/agent-world`, `~/.claude/settings.json` (po kopii zapasowej) i `~/.agent-world/`. Nie modyfikujesz cudzych projektów, nawet jeśli pojawią się jako "agenci" w podglądzie.
7. Każdy etap kończysz krótkim raportem dla użytkownika: co działa, co sprawdziłeś, co dalej. Nie przechodzisz do następnego etapu bez jego "ok".
8. Jeśli czegoś nie wiesz (np. jak wygląda pole w zdarzeniu hooka) — sprawdzasz w surowym logu, nie zgadujesz.
9. Commituj w git po każdym etapie (`git init` jeśli repo nie istnieje). Komunikaty po polsku lub angielsku, krótkie.

---

## 1. Stan wyjściowy

W `~/agent-world` jest gotowy Etap 0/1:

```
hooks/emit.sh              # hook Claude Code → POST do collectora + surowy log ~/.agent-world/events.jsonl
hooks/settings.hooks.json  # fragment "hooks" do ~/.claude/settings.json (9 zdarzeń, wszystkie async)
collector/server.js        # Node bez zależności: POST /events, GET /agents, GET /events?since=, GET / (tabela)
README.md                  # instrukcja instalacji i opis endpointów
PLAN.md                    # ten plik
```

Model danych, który obowiązuje w całym projekcie (nie zmieniaj nazw pól bez powodu — frontend będzie na nich polegał):

```
Agent {
  id, name, project, parentId, kind: "session" | "subagent",
  status: "idle" | "thinking" | "tool" | "waiting_for_user" | "done" | "error",
  waitingFor: null | "permission" | "question" | "input",   // tylko przy waiting_for_user (dodane w Etapie 0–1)
  currentTool, lastMessage, startedAt, updatedAt, toolCalls
}
Event { ts, agentId, type, summary }
```

Użytkownik uruchamia agentów tak: `ssh` na VPS → `claude` w terminalu (zwykle w tmux). Nie używa Agent SDK. Źródłem zdarzeń są więc hooki Claude Code.

---

## 2. Etap 0–1: uruchomienie i weryfikacja (bez pytań o wygląd)

Cel: zdarzenia z prawdziwych sesji Claude Code docierają do collectora, a tabela pod `http://127.0.0.1:7777/` pokazuje poprawne statusy.

Zadania:

1. `chmod +x hooks/emit.sh`. Sprawdź, że `curl` i `node` są dostępne.
2. Zrób kopię `~/.claude/settings.json` (jeśli istnieje) do `~/.claude/settings.json.bak-agentworld`. Scal klucz `hooks` z `hooks/settings.hooks.json` z istniejącą zawartością — **nie nadpisuj innych ustawień użytkownika**. Jeśli użytkownik ma już jakieś hooki, dopisz nasze obok, nie zamiast. Pokaż użytkownikowi diff przed zapisem.
3. Uruchom collector w tle (na próbę: `nohup node collector/server.js > ~/.agent-world/collector.log 2>&1 &`; docelowo usługa systemd `--user` wg README — zrób to dopiero po potwierdzeniu, że spike działa).
4. Poproś użytkownika, żeby w drugim oknie uruchomił `claude` i wykonał 2–3 proste polecenia (np. "wylistuj pliki", "przeczytaj README", coś co wymaga pozwolenia na Bash). Ty w tym czasie obserwuj `~/.agent-world/events.jsonl` i `/agents`.
5. **Zweryfikuj pola zdarzeń względem surowego logu.** Dokumentacja hooków nie podaje wszystkich pól, a `collector/server.js` zgaduje w kilku miejscach:
   - `Notification`: jak nazywa się pole z typem powiadomienia (`notification_type`? `type`? tylko `message`?). Status `waiting_for_user` musi zapalać się przy prośbie o pozwolenie i przy bezczynności.
   - `SubagentStart` / `SubagentStop`: czy przychodzi `agent_id`, `agent_type`, `agent_transcript_path`.
   - `SessionEnd`: wartości pola `reason`.
   - `PostToolUse`: czy jest `tool_response` (przyda się w Etapie 3).
   Popraw `applyEvent()` w `server.js` tak, by zgadzał się z rzeczywistością. Zanotuj faktyczne schematy w `docs/hook-events.md` (po jednym przykładzie na typ zdarzenia, z usuniętymi treściami promptów).
6. Sprawdź przypadki brzegowe: dwie sesje naraz w różnych katalogach, subagent uruchomiony przez sesję, sesja zakończona przez `/exit`, restart collectora w trakcie pracy agenta (hook nie może blokować ani wywalać błędu widocznego w terminalu użytkownika).
7. Raport dla użytkownika + commit. Zapytaj, czy przechodzić do wywiadu.

Kryterium ukończenia: użytkownik patrzy na tabelę i potwierdza, że statusy zgadzają się z tym, co widzi w terminalu, a hooki nie przeszkadzają w normalnej pracy z `claude`.

---

## 3. Etap 1.5: fundament pod frontend (bez decyzji wizualnych)

Rzeczy, które trzeba zrobić niezależnie od tego, jak świat będzie wyglądał. Możesz je zrobić przed wywiadem lub zaraz po — ale nie dotykaj jeszcze grafiki.

1. Dodaj do collectora **WebSocket** (`/ws`) pushujący zdarzenia i zmiany stanu, zamiast odpytywania co sekundę. Jeśli chcesz uniknąć zależności — Server-Sent Events (`/stream`) są w zupełności wystarczające i nie wymagają żadnej biblioteki. Wybierz SSE, chyba że Etap 3 będzie wymagał komunikacji w obie strony (wtedy WS).
2. Dodaj trwałość stanu w SQLite (`better-sqlite3` lub wbudowany `node:sqlite`, jeśli wersja Node na to pozwala) — tak, żeby restart collectora nie gubił listy agentów i ostatnich N zdarzeń. Jeśli to wprowadza zależności natywne, które nie kompilują się na VPS — zostań przy JSON-owym pliku dumpowanym co kilka sekund.
3. Serwowanie statycznego frontendu z `web/` przez collector (żeby był jeden proces i jeden port).
4. Struktura repo:
   ```
   agent-world/
     collector/   # backend
     hooks/       # hook + fragment settings
     web/         # frontend (pixelowy świat) — na razie pusty szkielet
     shared/      # typy/stałe wspólne (statusy, typy zdarzeń)
     docs/        # design-brief.md, hook-events.md
   ```
5. Raport + commit.

---

## 4. BRAMKA: wywiad o wyglądzie i działaniu interfejsu

**Przed napisaniem jakiejkolwiek linii frontendu** przeprowadź z użytkownikiem wywiad. Użytkownik wyraźnie powiedział: *"zanim zacznie robić interfejs graficzny, ma mnie wypytać, jak ma wyglądać"*. Szczegóły wyglądu i działania celowo nie są jeszcze ustalone — to jego decyzje, nie Twoje.

Zadawaj pytania paczkami po 3–4 (`AskUserQuestion`), w poniższej kolejności. Każde pytanie z propozycjami i rekomendacją. Jeśli użytkownik mówi "nie wiem, zdecyduj" — zapisujesz w briefie Twoją decyzję z adnotacją "(domyślne, do zmiany)". Jeśli jego odpowiedź rodzi nowe pytanie — dopytuj, ale krótko.

### Paczka A — ogólna koncepcja świata
- **Metafora przestrzeni**: jedna wspólna "scena" (np. biuro / plac / wioska), osobny pokój na każdy projekt/katalog, czy luźne postacie bez mapy?
- **Perspektywa**: top-down (jak stare RPG), widok z boku (platformówka / "tamagotchi w pokoju"), czy izometria?
- **Skala pikseli**: 8-bit (bardzo małe sprite'y, np. 16×16, ostre piksele), 16-bit (32×32, więcej detali), czy większe "chunky" postacie?
- **Rozmiar postaci względem ekranu** i ile agentów naraz ma wyglądać dobrze (2–3? 10? 30?).

### Paczka B — postać agenta
- **Jak odróżniać agentów**: różne postacie losowane z puli, kolor ubrania, nazwa nad głową, ikona projektu, czy kombinacja?
- **Subagenci**: mniejsze postacie przy rodzicu, "zwierzątka" towarzyszące, czy osobne pełne postacie z linią do rodzica?
- **Co postać robi w każdym statusie** — zaproponuj i zapytaj o akceptację/zmiany:
  - `idle` — stoi, oddycha, czasem się rozgląda
  - `thinking` — chmurka z "…", lekkie kołysanie
  - `tool` — animacja pracy zależna od narzędzia (Bash → terminal, Edit → pisanie, WebSearch → lupa…) czy jedna uniwersalna?
  - `waiting_for_user` — wyraźny sygnał: wykrzyknik, machanie, podskakiwanie, miganie — jak bardzo ma "krzyczeć"?
  - `done` — siada / znika po chwili / zostaje wyszarzona?
  - `error` — ?
- **Dymki**: czy pokazywać treść ostatniej akcji (np. "Bash: npm test") nad postacią na stałe, tylko po najechaniu, czy jako krótki dymek przy zmianie?

### Paczka C — grafika i styl
- **Źródło sprite'ów**: darmowe paczki (Kenney, itch.io, LPC / OpenGameArt — z uwzględnieniem licencji), własne narysowane przez Ciebie proceduralnie / w kodzie, czy użytkownik dostarczy swoje?
- **Paleta**: ciepła retro (Game Boy / NES), neonowa cyberpunk, pastelowa, monochromatyczna, czy dopasowana do czegoś, co już ma (np. jego stron)?
- **Tło i otoczenie**: statyczne tło, kafelkowa mapa z meblami/obiektami, dzień/noc wg zegara serwera?
- **Dźwięk**: brak, delikatne "bipy" przy zmianie statusu, dźwięk tylko przy `waiting_for_user`?

### Paczka D — informacje i interakcja
- **Panel boczny / HUD**: czy obok świata ma być lista tekstowa (nazwa, status, projekt, czas), czy świat ma być jedynym widokiem?
- **Klik na postać**: co ma się pokazać — ostatnie zdarzenia, podgląd transkryptu, nic na razie?
- **Sterowanie agentem z UI** (Etap 3): czy w ogóle to chcesz — odpowiadanie na pytania agenta, zatwierdzanie pozwoleń z przeglądarki? (Wymaga tmux `send-keys` lub przejścia części sesji na Agent SDK — opisz wady i zalety.)
- **Historia**: czy ma być "odtwarzanie dnia" / oś czasu, czy tylko stan bieżący?

### Paczka E — technikalia i dostęp
- **Technologia frontendu**: czysty canvas + vanilla JS (zero zależności, spójne z collectorem), PixiJS (wydajne sprite'y, animacje), czy Phaser (gotowe mapy kafelkowe, kamera, fizyka)? Zaproponuj na podstawie odpowiedzi z A–D.
- **Dostęp**: tylko tunel ssh, czy wystawić za reverse proxy z uwierzytelnieniem (np. Cloudflare Access / basic auth)? Z jakich urządzeń będzie oglądał (laptop / telefon / TV na ścianie)?
- **Build**: bez bundlera (ES modules prosto z `web/`) czy Vite?

Po zebraniu odpowiedzi: zapisz `docs/design-brief.md` (sekcje A–E, decyzje + uzasadnienia), pokaż użytkownikowi streszczenie i **zapytaj o potwierdzenie**. Dopiero po "ok" idziesz dalej.

---

## 5. Etap 2: pixelowy świat

Realizujesz dokładnie to, co w `docs/design-brief.md`. Kolejność pracy — od szkieletu do detali, z podglądem dla użytkownika po każdym kroku:

1. Szkielet `web/`: płótno, pętla renderowania, połączenie z `/stream` (lub `/ws`), odwzorowanie listy agentów na obiekty w świecie. Na początek postacie jako kolorowe prostokąty z nazwą — użytkownik ma zobaczyć, że dane płyną, zanim zaczniesz rysować.
2. Sprite'y i animacje per status (zgodnie z Paczką B). Jedna postać, jeden status naraz — pokaż, poproś o ocenę.
3. Spawn / despawn: nowy agent pojawia się (wchodzi, teleportuje, wyrasta — wg briefu), zakończony znika wg briefu.
4. Subagenci i powiązanie z rodzicem.
5. Dymki / HUD / panel (Paczka D).
6. Tło, paleta, dźwięk (Paczka C).
7. Test z prawdziwymi sesjami: 1 agent, 3 agentów, agent z subagentami, agent czekający na pozwolenie. Sprawdź, że `waiting_for_user` jest nie do przeoczenia.
8. Wydajność: 20 postaci przy 60 fps na przeciętnym laptopie, brak wycieku pamięci po godzinie.
9. Commit, raport, pytanie o kolejne poprawki.

Nie dodawaj funkcji, których nie ma w briefie, bez pytania. Jeśli masz pomysł — zaproponuj w raporcie, nie wdrażaj po cichu.

---

## 6. Etap 3: interakcja (tylko jeśli użytkownik chciał w Paczce D)

- Klik na postać → panel z ostatnimi zdarzeniami i (jeśli chciał) podglądem transkryptu z `transcript_path`. Transkrypt czytaj tylko do odczytu; nie wysyłaj go nigdzie poza localhost.
- Odpowiadanie agentowi z UI: najpierw sprawdź, czy sesje faktycznie działają w tmux (`tmux list-panes -a`) i czy da się je powiązać z `session_id` (np. przez `cwd` + PID). Pokaż użytkownikowi, co i jak zamierzasz wstrzykiwać do jego terminala, zanim to zrobisz. Alternatywą jest uruchamianie nowych agentów przez Agent SDK bezpośrednio z collectora — opisz to jako osobną decyzję.

---

## 7. Etap 4: dopieszczanie

Wg życzeń użytkownika: pokoje per projekt, dzień/noc, oś czasu, widok mobilny / TV, usługa systemd, reverse proxy z uwierzytelnieniem.

---

## 8. Jak raportować

Krótko. Po każdym etapie:

- **Zrobione**: 2–4 punkty
- **Sprawdzone**: co przetestowałeś i jak
- **Do decyzji**: pytania, jeśli są (przez `AskUserQuestion`)
- **Dalej**: co proponujesz jako następny krok

Nie opisuj każdego pliku, który ruszyłeś. Użytkownik chce widzieć efekt i podejmować decyzje, nie czytać dziennik.
