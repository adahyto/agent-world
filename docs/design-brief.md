# Agent World — design brief

Stan: 2026-10-10, po pięciu rundach makiet. Świat: **watacha dzików** (zastąpił pałac z 2026-10-09). Makieta: `docs/concepts/` (`engine.js` + `forest-map.js` + `forest-life.js`), podgląd: https://claude.ai/artifact/UhrHW8kyn1VQiXRjP6He5k. Kod makiety jest podstawą Etapu 2.

Najważniejsze kryterium użytkownika: **wygląd ma mu się podobać**. Decyzje wizualne pokazujemy jako makiety, nie opisy.

## A. Ogólna koncepcja świata

- **Metafora: watacha dzików.** Każda sesja Claude Code to dzik, narzędzia to miejsca żerowania, użytkownik to **druid-strażnik** przy bramie **bazy dzików**. Przedmieścia na dole to „świat ludzi”, z którego przychodzą kłopoty (błędy).
- Historia: runda 1 (roboty, kolej, Rzym, kosmos) i runda 2 (fabryka, gród Polan, pałac, anime) odrzucone; pałac wybrany 2026-10-09, porzucony i zastąpiony dzikami 2026-10-10 z inicjatywy użytkownika. Nie proponować powrotu do pałacu.
- **Układ mapy (640×360, top-down, 32-bitowa estetyka, piksele 3×):**
  - **Las** u góry z falistą ścianą (`FOREST.edgeY`). Pięć małych barłogów projektów w zatokach lasu, **każdy inny**: w symulacji (od 2026-11-12 zmyślone nazwy): sklep pod wykrotem, blog w paprociach, api-pogody pod głazem, notatki w jałowcach, raport pod świerkiem. Tabliczka leśna i wstążka w kolorze projektu. Nazwa projektu nad barłogiem.
  - **Baza dzików** pod świętym dębem na skraju lasu: ziemianka z wejściem, palisada z bramą i pochodniami, kosz ogniowy, wieża strażnicza z wartownikiem (warchlak w hełmie), sztandar z szablami, totem, stos żołędzi. Druid stoi przy bramie.
  - **Polana** (ponad połowa mapy): łąki z wysoką trawą, wrzosowisko, piaszczysko, ścieżka od bazy do drogi, samotna brzoza i sosna, głazy, kłoda, kretowiska, strumień z kładką. Dużo wolnej przestrzeni do chodzenia.
  - **Przedmieścia** (wąski pas na dole): droga z przystankiem, płot (drewniany z dziurami przy działkach, siatka z furtkami przy domach), trzy grządki ze szklarnią, wiata śmietnikowa, **tylko dwa domy**, samochód, skrzynka na listy, kot na płocie.
- **Bez surrealizmu** (wyspa, drzwi donikąd, latające ryby, ślimak z latarnią itp. — wypróbowane w v4 i wycofane na prośbę użytkownika 2026-10-10).
- **Liczba agentów:** ma dobrze wyglądać do ok. 10 naraz (dziś 2–4 sesje plus subagenci).

## B. Postać agenta

- **Wygląd zależy od modelu:** Opus = odyniec (największy, najciemniejszy, wysoki kłąb, duże szable), Sonnet = locha (średnia, małe szable), Haiku = przelatek (mniejszy, rudawy, bez szabli), subagent = warchlak w paski. Każdy osobnik tej samej rasy ma trochę inny odcień.
- **Kolor projektu:** obroża telemetryczna na karku + kolczyk w uchu; tabliczka i wstążka przy barłogu; nazwa projektu pod dzikiem.
- **Szczegóły sprite'a (v5):** ciemniejszy brzuch i nogi, jasne końcówki szczeciny na grzbiecie, jasne „baki” przy ryju, duże spiczaste uszy, tylne nogi ze stawem skokowym, szable z fajkami, oko z błyskiem i brwią, ogon z kitą. Rozmiary płótna: odyniec 40×32, locha 36×32, przelatek 32×32, warchlak 28×32.
- **Pozy:** stoi (strzyże uszami), idzie (nogi naprzemiennie, ogon macha), ryje (ryj przy ziemi), czujny (głowa i ogon w górę, szczecina najeżona), kuli się (przy błędzie).
- **Status → miejsce i czynność:**

  | Status / narzędzie | Miejsce | Co się dzieje |
  |---|---|---|
  | idle, czeka na polecenie, done | własny barłóg | leży; done: „z” i blednie |
  | thinking | babrzysko | tapla się, dymek „…” |
  | Bash | buchtowisko | ryje, grudy ziemi lecą |
  | Read | tropy | węszy, ślady pojawiają się po kolei |
  | Grep, Glob | dęby | żołędzie spadają |
  | Edit | działki (przez dziurę w płocie) | ryje w grządkach, sałata fruwa |
  | Write, NotebookEdit | nowy barłóg | ściele warstwa po warstwie |
  | WebSearch | wzgórze z drogowskazem | węszy wiatr |
  | WebFetch | śmietniki (przez dziurę w płocie) | kubły otwarte, śmieci lecą, wrona ucieka |
  | TodoWrite | czochradło | znaczy sosnę, drzewo się trzęsie |
  | MCP (`mcp__*`) | paśnik | przychodzą sarna i lis |
  | Agent | gąszcz | krzaki się trzęsą, wychodzą warchlaki |
  | inne narzędzia | strumień | pije przy kładce |
  | czeka: pozwolenie | brama bazy | staje czujnie z „!”; druid unosi kostur, kosz ogniowy bucha, pochodnie i proporce w kolorze projektu, wartownik czujny, barłóg pulsuje na czerwono |
  | czeka: pytanie | brama bazy | żółty „?” |
  | czeka: bezczynność | barłóg | zielony dymek |
  | error | zostaje w miejscu | z jednego z domów wychodzi człowiek (szlafrok z latarką / miotła / wałek / dzieciak z telefonem), podchodzi, woła „SIO!”; dzik się kuli; gdy błąd mija, człowiek wraca |
- **Dymki z narzędziem:** zawsze, gdy postać pracuje (do wyłączenia przełącznikiem).
- **Subagenci:** warchlaki biegają obok rodzica (przesunięcie +14, +5), po zakończeniu znikają.

## C. Grafika i styl

- **Źródło grafik:** wszystko rysowane w kodzie (szablony pikselowe + prymitywy), bez zewnętrznych paczek i licencji. Kontur 1 px wokół postaci.
- **Pory roku i dnia z automatu:** wiosna (III–V), lato (VI–VIII), jesień (IX–XI), zima (XII–II) z daty; noc z godziny (wiosna 20–6, lato 21–5, jesień 18–7, zima 17–7). Do nadpisania w ustawieniach (w makiecie: dwa selecty). Zima: śnieg, czapy na świerkach, gołe dęby, zamarznięte babrzysko, para z ryjów. Jesień: złote dęby i brzozy, liście, mgła. Wiosna: kwitnące drzewka, płatki. Noc: nakładka, latarnie, okna, pochodnie i kosz w bazie, latarka sąsiada, świetliki latem i wiosną, oczy sowy w dziupli.
- **Tło niesie dane:** barłóg czekającego projektu pulsuje na czerwono, proporce i pochodnie w bazie pokazują kolory czekających projektów, miejsca ożywają tylko wtedy, gdy ktoś przy nich pracuje.
- **Dźwięk:** nie omówione (propozycja: brak albo cichy sygnał tylko przy pozwoleniu).
- **Życie w tle:** sarna przy paśniku, zając przebiegający przez polanę, wrony na drodze, kot na płocie, dym z kosza.

## D. Informacje i interakcja

Jeszcze nie omówione. W makiecie są: kafelki agentów pod sceną (nazwa, model, status), zaznaczenie postaci kliknięciem, przyciski wymuszania stanów (tylko do makiety).

## E. Technikalia i dostęp

Jeszcze nie omówione. Makieta to czysty canvas + JS bez zależności i bez bundlera, co pasuje do collectora (Node bez zależności). Dostęp: collector tylko na 127.0.0.1:7777; z zewnątrz tylko po domenie za uwierzytelnieniem (zasada użytkownika: bez portów na IP, bez subdomen podglądu).

## Uwagi techniczne zebrane po drodze

- Model jest w zdarzeniach tylko w `SessionStart` (`model: "claude-opus-5-5"`), nie przy `/clear`. Sesje złapane w trakcie i subagenci modelu nie mają. Źródło zapasowe: transkrypt (`transcript_path`, pole `model`). Postać domyślna do tego czasu: locha (Sonnet).
- Powód czekania w polu `waitingFor`: `permission` / `question` / `input`.
- Dwie sesje w tym samym katalogu nazywają się tak samo; do rozstrzygnięcia (nazwa sesji albo krótki identyfikator).
- Makieta zakłada 5 projektów (`AW.SESSIONS`, `AW.TEAM`); w Etapie 2 barłogi mają powstawać dynamicznie dla projektów z collectora (pula wyglądów barłogów: wykrot, paprocie, głaz, jałowce, świerk, dalej np. kłoda, wrzosy, trzcina).
