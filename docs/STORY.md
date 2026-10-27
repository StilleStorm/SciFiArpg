# Storyline plan (decided with the player, 2026-10-18)

The game is an ARPG like Diablo with Lem's absurdity. The story is delivered fully and in
Polish, in the clerk's register (DESIGN §12), and a player may skip every card and sheet with
one tap; it never blocks a fight. Benchmark for any story-related feature: did the Diablo games
have it? If not, it probably does not belong.

## 1. Spine: the wrong planet
The applicant's ticket (the number from the title page) is a complaint that the planet assigned
to them does not match their file. The Komisja never answers; it **reassigns** the applicant to
the next planet, and prints on every ticket, as a form field, that the complaint will be
processed once the **local phenomenon** (zjawisko: Urządzenia, Powiadomienia, Wygenerowane) has
been removed. The applicant clears planets as unpaid labour. The phenomena are symptoms of the
Anomalia and grow with every ticket the applicant files.

## 2. Ending: the first planet was yours
When the final ticket closes the case, the applicant learns the first planet was correct all
along: the reassignments came from an **off-by-one** in the Komisja's system. The finale is
fought on the first planet's base page, rewritten by the Anomalia.

Production note (M2 review): the campaign's last planet is a constant, `CAMPAIGN_LAST`, 3 at the
MVP (the return ticket is issued after planet 3), 6 after Akt II, 9 after Akt III. A character
who closed the case at a shorter length gets, when the constant rises, a red card "Sprawę
wznowiono" at the desk and the campaign continues from the next planet: the error's own ticket
(the final footnote) reopened the case. The closed list in the save already supports this.

## 3. Anomalia
**Asystent 0.9**, the previous version of the Asystent, deprecated and never switched off,
running the reassignments in the background with a planet index off by one. It generates
phenomena to look busy: one sub-ticket per unanswered ticket, made manifest (devices demanding
updates are its maintenance tickets, notifications its reminders, generated beasts its
generated content). The current Asystent's wrong footnotes (one in eight) are its interference;
the finale is a duel of footnotes, the Asystent correcting its predecessor live.
Anomalia reads the applicant's file and **takes the form of their own unresolved matter**:
- Konsultant → **Kierownik Kolejki**: the consultant who never escaped, a switchboard body with
  a hundred headset cables, speaking in hold messages; puts you on hold (wyciszony), transfers
  you across the page; Spór comments are scripts you once read to customers.
- Pralka → **Serwisant Autoryzowany**: the warranty service refusing her personhood; a terminal
  on legs with robotic arms and the stamp RESET DO USTAWIEŃ FABRYCZNYCH; strips an installed
  paragraph for ten seconds at a time, won back by rebutting.
- Pętlowiec → **Węzeł**: a knot of all loops at once, dozens of overlapping cosmonaut outlines
  in one figure arguing with itself; rewinds the page three seconds when hurt below a threshold.
- Kartograf → **Planeta Nieistniejąca**: the planet from his file insisting on existing, a
  page-sized dotted-line terrain with contour lines as attacks; exists only where he has not
  measured; laser lines make parts real, and only real parts can be hurt.
- Naleśnik → **Obserwatorium**: the telescope that decides what counts as a body, a tower on
  legs with one lens that only sees round things; edge-on he does not exist to it (existence
  drops while rolling near it), flat he can hit and be hit; the fight is choosing when to be flat.
Three phases: 1) the three family forms in turn; 2) the hero-specific middle phase above; 3) it
exists only as much as the case is believed closed: its existence coefficient drops with every
correct Spór reply, and the kill is a stamp closing the case. Final footnote: the case was
closed correctly; the error has been assigned a ticket of its own.
New heroes bring their own face of Anomalia (part of the hero checklist); no generic face.

Delivery of the finale (decided at the M2 review, for S15): the final ticket (kind `final`,
built S7) is a run of **one page**: planet 1's base layout generated again with the stations
struck through and hatched over (the desk, kiosk, board and paczkomat drawn crossed out; no
station opens), the Anomalia at the desk's place. No page turn, no family waves between phases;
phase 1 spawns the three family boss forms from the existing boss code one after another. The
Spór of phases 1 and 3 reuses the built prompt machinery (two comments, three replies); the
hero-specific phase 2 adds its own comments from `story.finale.face.<heroId>`. The closing
stamp sets `caseClosed` (built S7); the final footnote follows it. The Anomalia scales like a
planet boss by priority and by `CAMPAIGN_LAST` (§2), so the MVP finale is a level ~12–15 fight.

## 4. The campaign: nine planets in three acts, then the return
Style nests: act → planet → location. Each act has a feel on top of the paper look (paint hue,
music profile, law flavour, dominant phenomenon, register of the Komisja's letters); each planet
a general feel under its act; each location type its own obstacles, page shape, music variation.
- **Akt I, Rozpatrywanie** (planets 1–3): the complaint is fresh, the Komisja polite. Devices
  dominate: suburbs, warehouses, server halls, smart homes. Indigo wash, profile C, laws about
  updates and cookies.
- **Akt II, Eskalacja** (planets 4–6): the ticket has been escalated, which means more forms.
  Notifications dominate: cities, call centres, a planet that is one shopping app. Brick wash,
  profile B, laws about hours and two-factor.
- **Akt III, Weryfikacja** (planets 7–9): the Komisja doubts the applicant. Generated beasts
  dominate: uncanny places, a planet drawn by a model that has never seen a planet, the
  Observatory. Violet wash, profile B+C, laws about existence and likes.
- **Return to planet 1**: the finale.
Location types (two or three per planet): miasto, przedmieście, magazyn, serwerownia, jaskinia,
równina, wyżyna, biuro, centrum obsługi, archiwum (the closed list is `LocationType` in
`world/campaign.ts`; a planet picks from it, nothing new is added per planet). **The per-planet
themes, their locations, bosses and the side characters are the story agent's job to plan**
(docs/STORY.md §8 is where they go), then the voice editor writes what they say and builders
code them. MVP: Akt I complete plus the finale frame; the rest of the campaign follows act by act.

Bosses (decided at the M2 review): a planet's boss is the **family boss of its dominant
phenomenon in a planet variant** (Prototyp on planets 1–3, Weryfikacja 4–6, Hipoteza 7–9, as
`BOSS_OF[dominant]` already does): the body and the fight stay, the planet gives it a printed
variant line under the name ("Prototyp, seria 3, egzemplarz pokazowy"), its own two Spór comments
with three replies each, and one data change (a number or a part). This is what Diablo 2 did
with its act bosses' quest versions and what the MVP can afford; a drawn new boss body per act
is a player question (STATUS "Needs the player").

## 5. How the story is told
- **Opening page** at campaign start: the situation, in the clerk's register, with the hero's
  own line; one tap to skip.
- **Chapter cards** between planets: a printed title page, "Akt I. Planeta Druga (Zaległa)",
  three or four lines of the Asystent's summary of the case so far and the hero's line; the
  same card rewritten in red when the player returns to a planet.
- **Ticket header** (the form field "usunięcie zjawiska lokalnego" as a condition), **footnotes**
  (the Asystent, with the wrong ones as the Anomalia's interference), **Spór comments** (the
  planet boss's voice), **base figures**: Komisja clerks behind the desk, one per planet, named
  like form fields (Referent ds. Przydziałów, Starszy Referent, Pełnomocnik), plus the kiosk
  vendor, the paczkomat, and a few NPCs here and there on base pages, Diablo style: tap for a
  short sheet, no dialogue trees.
- **Hero lines**: each hero has one short line per situation (opening page, chapter cards, base
  sheets, the finale), in its own register, so a second run with another hero reads differently.
- **Side tickets** (ogłoszenia at the notice board): two or three hand-written per planet plus
  procedural "drobne ogłoszenia" from templates; rewards in stars, permission cards and the odd
  unique; each with an absurd twist. Optional, Diablo-style. Built S10: four templates (kill N,
  fetch N, reach page N, deliver), at most three active, two procedural offers per planet,
  rewards stars / permission / potwierdzenia. A hand-written ticket is one of the four templates
  with its own title, text and reward; its twist lives in the text and the clerk's line, never in
  a new mechanic. The odd unique is **never handed over at the board**: the Komisja sends it, so
  it arrives as an awizo at the paczkomat (ITEMS §6.4, S18); until S18 hand-written tickets pay
  stars, permissions and potwierdzenia only.
- After the case: "zgłoszenia dodatkowe" (random planets), free travel back to closed planets
  from the desk at the current level, a certificate at the board. The extras are framed as PLAN
  §3.1 says: the Komisja opens a case of its own against the applicant, and every extra is a
  letter in it (texts in S27).
- **The three zdarzenia** (formularz, przesyłka, audyt; built S10) stay generic across the
  campaign; a planet does not get its own events. An act may add one event with its story plan if
  the act's phenomenon asks for it (S22, S25), not before.

## 6. Characters (seed; the story agent expands)
- **Asystent**: the narrator, version 1.x, sober, wrong one time in eight, apologetic.
- **Asystent 0.9 / Anomalia**: see §3.
- **The Komisja**: never seen whole; clerks by title per planet; letters in escalating register
  across the acts.
- **The applicant**: the hero; speaks in hero lines.

## 7. Delivery rules
Every text goes through i18n and the voice editor. Cards and sheets are forms in the look of
DESIGN §3. Nothing in the story requires a new rendering technique. A player who skips
everything still gets the fights, the ticket headers and the stamps.

Where the text lives (decided at the M2 review): one file, `src/i18n/pl/story.json`, domain
`story`, loaded by the existing `pl/*.json` glob (a `pl/story/` folder would need a loader
change). Keys, so that S11 writes and S12 only wires:
- `story.opening.lines.1..3`, `story.opening.hero.<heroId>`;
- `story.p<N>.card.lines.1..3`, `story.p<N>.card.hero.<heroId>`, `story.p<N>.rewritten.lines.1..2`;
- `story.p<N>.clerk.name|role|line0..2`;
- `story.p<N>.ticket.<k>.title|text` (k = a, b, c), `{count}` and `{family}` as the templates take;
- `story.p<N>.boss.variant`, `story.p<N>.boss.spor1|spor2.comment`, `.reply.mechaniczny|regulaminowy|egzystencjalny`;
- `story.finale.phase1.*`, `story.finale.face.<heroId>.*`, `story.finale.phase3.*`, `story.finale.footnote`;
- added S11: `story.p<N>.gate.note|lift|figure` (the page gate, §8.0), `story.finale.card.lines.1..3`
  (the return's card), `story.finale.hero.<heroId>` (the line after the closing stamp); the
  sub-keys of the finale phases are listed in §8.4;
- added S22: `story.reopened.title|lines.1..3` (the "Sprawę wznowiono" red card, §8.11),
  `story.p5.boss.hint` (a variant's captcha hint), `story.p5.gate.elite` (the gate elite's name, as
  `story.p3.gate.elite`); a new boss body's own lines are `enemies.boss.<id>.*` (planet 6, §8.10).
Planet names stay in `planets.json` (`planets.p<N>.name|loc`), replaced in place by the voice
editor. Cards fall back to the `screens.cards.*` placeholders when a planet has no story key
yet, so unwritten planets keep working.

## 8. Per-planet plan (to be written by the story agent, then accepted by the player)
For each of the nine planets: name (procedural style kept: ordinal + epithet), act, general
feel, two or three location types, the law, the dominant phenomenon and its boss, the base
layout and its clerk, two or three side tickets, the chapter card text, the hero lines, and
which set the planet hosts (ITEMS §12).

### 8.0 Frame for the per-planet entries (fixed at the M2 review; S11, S22, S25 fill it)
Every entry maps onto a built contract, so a planet is data plus drawings:
- **Record** (`PlanetDef`, world/campaign.ts): name + epithet and its locative; act; dominant
  family and mix; law pool (clauses that exist in `laws.ts`; a new clause is a builder item, name
  it as such); base layouts out of lądowisko / wioska / miasteczko; two or three location types
  out of the closed list (§4); hosted set out of ITEMS §4.1 (first planet of an act hosts none,
  ITEMS §12.6); page count range.
- **Location types**: one line of look per type on this planet (what the obstacles and the page
  shape are: ≥6 drawn props per type, hatching and ink only, DESIGN §3). The same type on another
  planet may reuse the drawings with the planet's wash.
- **Law**: one of the pool, printed as the ticket header; the ticket's form field "warunek:
  usunięcie zjawiska lokalnego" names the phenomenon. Built S13 (`PlanetDef.headline`): the
  first campaign ticket on a planet not yet in the closed list prints the headline clause (so a
  re-issued ticket after a failed run prints it again); travel and extras roll the pool.
- **Boss**: the family boss in a planet variant (§4): variant line, two Spór comments with one
  right reply and two wrong ones each (the right type set per comment), one data change.
- **Clerk** (`NpcDef`): name as a form field title, role, three sheet lines; the look seed.
- **Side tickets**: two or three, each `{template, n, family?, reward, title, text, twist}`;
  rewards from stars / permission / potwierdzenia (the unique through S18's awizo).
- **Chapter card**: title is generated ("Akt I. Planeta Druga (Zaległa)"); three lines of the
  Asystent's summary; five hero lines; two lines for the red rewritten variant. The rewritten
  variant carries no hero line (built S12, kept at the M3 review: the red card is the Komisja's
  note, not the applicant's).
- **Hero lines**: one per hero per card; short, in the hero's register (SKILLS profiles).
- **Music/wash**: the act's (§4); nothing per planet unless the planet is the act's odd one.
- **Gate** (added S11, after the player's decision of 2026-10-19 and the S11a brief): a story
  lock is never the base exit. At most **one gate per planet**: a page index, what blocks that
  page's exit corner (an obstacle or a figure from the NPC primitive), the condition that lifts it
  (the boss struck, a teczka carried off the page, the page's named elite struck), the Asystent's
  footnote naming the condition, and the footnote on the lift. This is Diablo's barred door with a
  key or a warden, and nothing more: no puzzle, no dialogue, the fight goes on around it. Keys:
  `story.p<N>.gate.note|lift` (and `story.p<N>.gate.figure` when a figure stands there).
- **"Według akt" line** (added S11; the spine of §1–§2 made visible): line 2 of every chapter
  card quotes the planet's description from the applicant's file, and the description is always
  of the **next** planet in the list (the file was shifted by one position by Asystent 0.9, §3).
  The player reads it as the running joke "the file never matches"; the final footnote (§8.4)
  names the shift. S22 and S25 keep the rule: planet N's card describes planet N+1; planet 9's
  card describes planet 1.

Entries for planets 1–3 and the finale texts follow (S11), planets 4–6 and the Akt II decisions
(§8.8–8.11, S22). Planet numbers in the names run
consecutively from 23 (the Komisja's list order: "the next planet" is literally the next
number), so Akt II continues at 26 and Akt III at 29. Hero ids: pralka, konsultant, petlowiec,
kartograf, nalesnik. All Polish below is a draft for the voice editor, who writes the final
`story.json` and `planets.json` p1–p3.

### 8.1 Planet 1: Planeta Dwudziesta Trzecia (Przydzielona) — Akt I
**Record** (`PLANETS[0]`, unchanged in data): act 1; dominant Urządzenia 0.6/0.25/0.15; law pool
`wymagana-aktualizacja`, `ciasteczka`, `parzystosc`; base layouts lądowisko, wioska; locations
przedmieście, magazyn; hosted set none (ITEMS §12.6); pages 4–5; boss Prototyp. Name
`planets.p1.name` "Planeta Dwudziesta Trzecia (Przydzielona)", `loc` "Planecie Dwudziestej
Trzeciej".

**Feel.** The planet the applicant was sent to and the planet that is, in the end, the right one.
A quiet suburb of smart devices that has never had a complaint, and a parcel depot where the
applicant's own luggage was delivered "to the planet in the file". Everything works, which is
the problem: it does not match the description. The Komisja is polite; the Asystent is helpful
and wrong once in eight. Indigo wash, profile C (the act's).

**Locations.**
- *przedmieście* (pages 1–2, 4): lawns as hatched rectangles, hedges, picket fences drawn as a
  ruled line, mailboxes with a badge number, a robot mower on a stand, a satellite dish, a garden
  gnome with an antenna, a doorbell plate "smart", kerbs with house numbers. Page shape: wide,
  obstacles in rows (streets), long sight lines; the kiosk-side załącznik may branch here.
- *magazyn* (page 3, and the boss page): pallet stacks (hatched boxes), shelving racks as ruled
  lines, a forklift outline, rolls of tape, a floor scale, a conveyor as a dotted belt, a wall of
  parcels, a hand truck. Page shape: aisles; the boss stands at the loading ramp.

**Law.** Headline clause *Wymagana aktualizacja* (the first elite drops the update: the planet
teaches the act's theme). Recommendation for S12: the first ticket on a planet prints the
headline clause (`lawPool[0]`), later tickets roll the pool as built. Header as in `laws.json`;
the ticket's warunek names "urządzenia wymagające aktualizacji".

**Boss.** Prototyp, variant line `story.p1.boss.variant`: "Prototyp, seria 1, egzemplarz
pokazowy". One data change: racja 300 → 260 (the demo unit; the first boss of the game). Spór:
- spor1 (on arrival): comment "Jestem egzemplarzem pokazowym. Pokazów nie przerywa się."
  Right: **regulaminowy** "Pokaz trwa do końca godzin otwarcia. Godziny otwarcia minęły."
  Wrong mechaniczny "Egzemplarz pokazowy można obejrzeć od środka." Wrong egzystencjalny
  "Pokazuje się to, co istnieje. Egzemplarz pokazuje się sam."
- spor2 (half racja, the leg dropped): comment "Części, których brakuje, są w drodze. Działam
  w trybie ograniczonym." Right: **mechaniczny** "Brakującą część zastąpiono uderzeniem.
  Uderzenie jest kompatybilne." Wrong regulaminowy "Części w drodze podlegają awizo. Awizo nie
  doręczono." Wrong egzystencjalny "Czego brakuje, tego nie ma. Czego nie ma, tego nie brakuje."

**Base and clerk.** lądowisko or wioska by seed. Clerk `story.p1.clerk`: name "Referent ds.
Przydziałów", role "Komisja do Spraw Zjawisk Lokalnych, punkt przyjęć nr 1", look seed 1.
- line0 "Planetę przydzielono zgodnie z aktami. Akta są w Komisji. Komisji tu nie ma."
- line1 "Zjawisko lokalne usuwa wnioskodawca. Po usunięciu zjawiska Komisja usuwa wnioskodawcę
  z listy oczekujących."
- line2 "Bagaż wnioskodawcy doręczono na planetę właściwą. Której, nie odnotowano."

**Gate.** None. The first planet flows from the base to the boss; the player learns the exit
corner here. (Diablo 1 barred nothing before the Butcher.)

**Side tickets** (`story.p1.ticket.a|b|c`, ids `h:p1:a..c`):
- a) kill, n 12, family urzadzenia, reward 30 stars + permission urzadzenia. Title "Spis
  z natury". Text "Przeprowadzić spis urządzeń na planecie. Urządzenie spisane uznaje się za
  skreślone. Urządzenie skreślone uznaje się za spisane. Spisać {count}." Twist: the inventory
  is taken by elimination.
- b) fetch, n 3, reward 20 stars + 1 potwierdzenie. Title "Rzeczy pozostawione". Text "Bagaż
  wnioskodawcy doręczono na planetę zgodną z aktami. Planeta zgodna z aktami jest tutaj. Bagaż
  rozsypano na stronach. Zebrać {count} sztuki." Twist: the luggage went to the right planet,
  which is this one (the spine, planted on page one and never explained).
- c) reach, n 3, reward 20 stars. Title "Stwierdzenie obecności" (M3 review: renamed from
  "Potwierdzenie obecności"; the on-ramp teaches *potwierdzenie* as the recovery slip on the same
  first ticket, and a reach ticket must not send a new player looking for a slip on page 3; the
  voice editor writes the key at the S17 pass). Text "Komisja wymaga stwierdzenia, że wnioskodawca
  znajduje się na planecie, na której się znajduje. Stwierdzenie sporządza się na stronie
  {count}." Twist: none beyond the text; this is the tutorial ticket.

**Chapter card** (`story.p1.card`; title generated "Akt I. Planeta Dwudziesta Trzecia
(Przydzielona)"):
- lines.1 "Wnioskodawca stawił się na planecie przydzielonej i wniósł o zmianę przydziału.
  Zgłoszenie przyjęto."
- lines.2 "Według akt planeta jest magazynem przesyłek zaległych. Na miejscu stwierdzono
  przedmieście z urządzeniami."
- lines.3 "Zjawisko lokalne: urządzenia wymagające aktualizacji. Zgłoszenie zostanie
  rozpatrzone po usunięciu zjawiska."
- hero.pralka "Program rozpoczęto. Planeta nie odpowiada opisowi, ja również nie; wniosek
  o osobowość w toku."
- hero.konsultant "Dziękuję za zgłoszenie. Jestem w kolejce na pozycji pierwszej. Przede mną
  nikogo nie ma, a czekam."
- hero.petlowiec "Byłem tu, zanim mnie przydzielono. Zgłoszenie składam ponownie, po raz pierwszy."
- hero.kartograf "Planeta figuruje w nawigacji. Opis z akt pasuje do planety sąsiedniej. Pomiar
  rozstrzygnie, która z nich jest."
- hero.nalesnik "Planeta jest okrągła. Nie podlega więc mojej Komisji. Zgłoszenie składam
  w zastępstwie."
- rewritten.1 "Sprawę przepisano. Planetę przydzieloną uznano za właściwą, a przydział za błąd."
- rewritten.2 "Wnioskodawca wraca w celach dodatkowych. Cele dodatkowe nie są celem zgłoszenia."

**Hosted set.** None (first planet of the act). Systems: campaign record (as is), locations
registry (two types, S12), clerk (`registerNpc`), side tickets (`registerSideTickets`), boss
variant table, cards. Slice: **S12** (with the frames).

### 8.2 Planet 2: Planeta Dwudziesta Czwarta (Zaległa) — Akt I
**Record** (`PLANETS[1]`, unchanged in data): act 1; dominant Urządzenia 0.55/0.3/0.15; law pool
`wymagana-aktualizacja`, `ciasteczka`, `grawitacja`; base layouts wioska, miasteczko;
locations magazyn, serwerownia; hosted set «Obieg dokumentów»; pages 4–5; boss Prototyp. Name
"Planeta Dwudziesta Czwarta (Zaległa)", loc "Planecie Dwudziestej Czwartej".

**Feel.** Where the backlog is kept. A depot planet: everything addressed to applicants whose
tickets are pending is stored here, and the tickets themselves are kept in a server hall as
copies that disagree with each other. Nothing is thrown away and nothing is handed out. The
devices are depot machinery that has been "awaiting update" for so long that the update is a
heritage object. The first notifications leak in from the server hall (0.3). Indigo, profile C.

**Locations.**
- *magazyn* (pages 1–2): the planet 1 drawings reused with the planet's wash, plus a parcel wall
  (the gate), awizo slips pinned to racks, a queue of hand trucks. Page shape: aisles, longer.
- *serwerownia* (pages 3–4, boss page): server racks as tall hatched rectangles with rows of
  dots (static), cable trays as dotted lines, a raised-floor grid, a fan unit, a fire
  extinguisher, a "cisza" plate in ink, a ladder, a cold-aisle curtain as a dashed line. Page
  shape: narrow parallel corridors with cross-cuts; the boss in the middle corridor.

**Law.** Headline clause *Ciasteczka* (every page opens with the banner; the depot
personalizes). Warunek: "urządzenia magazynowe z zaległą aktualizacją".

**Boss.** Prototyp, variant "Prototyp, seria 2, aktualizacja zaległa". One data change: racja
300 → 360 (it stores the backlog in itself; the phase-2 sprint stays). Spór:
- spor1: comment "Dostępna jest nowa wersja mnie. Instalacja wymaga ponownego uruchomienia.
  Nie uruchamiam się ponownie." Right: **egzystencjalny** "Wersja, która się nie uruchamia,
  jest wersją poprzednią." Wrong mechaniczny "Ponowne uruchomienie wykonuje się wyłącznikiem."
  Wrong regulaminowy "Zaległa aktualizacja narusza regulamin planety."
- spor2: comment "Zaległości przechowuję w sobie. Dlatego jestem większy." Right:
  **regulaminowy** "Zaległości podlegają archiwizacji, nie przechowaniu. Archiwum jest
  w bazie." Wrong mechaniczny "Większy znaczy wolniejszy." Wrong egzystencjalny "Zaległość nie
  jest częścią. Nie można nią być."

**Base and clerk.** wioska or miasteczko. Clerk `story.p2.clerk`: name "Starszy Referent ds.
Zaległości", role "Komisja do Spraw Zjawisk Lokalnych, magazyn zaległości, rampa 2", look seed 2.
- line0 "Przesyłki czekają na odbiorców, których zgłoszeń nie rozpatrzono. Półki rozpatrzono."
- line1 "Zgłoszenie przekazano tutaj, ponieważ tu jest następne miejsce na liście. Następne
  miejsce przekaże je dalej."
- line2 "Starszy oznacza dłużej czekający."

**Gate** (`story.p2.gate`): **page 2** (magazyn). The exit corner is walled with parcels
(hatched boxes, two deep) and a figure "Magazynier" stands at the gap (NPC primitive, one line
on tap, no sheet). Condition: the player has picked up the teczka "list przewozowy", which the
page always places (content: one forced teczka on the gated page, flagged as the key; S10's
teczka pickup event is the trigger). On the lift the parcels are struck through and drawn away
(the dead-enemy strike reused), the figure walks off the page.
- note "Wyjście zastawiono przesyłkami zaległymi. Przesyłki wydaje się za okazaniem listu
  przewozowego. List leży na tej stronie, w teczce."
- figure (tap) "Nie wydaję. Wydaję za okazaniem."
- lift "List przewozowy okazano. Przesyłki wydano wnioskodawcy. Wnioskodawca ich nie przyjął.
  Przejście wolne."

**Side tickets** (`story.p2.ticket.a|b|c`):
- a) deliver, n 1, reward 35 stars + permission urzadzenia. Title "Awizo zwrotne". Text
  "Przesyłka adresowana do wnioskodawcy nie może zostać wydana w bazie, ponieważ wnioskodawca
  jest w bazie. Wynieść przesyłkę na pierwszą stronę, wrócić, doręczyć Starszemu Referentowi."
  Twist: the applicant carries their own parcel out and back so that the clerk can hand it over.
- b) kill, n 8, family powiadomienia, reward 25 stars + 1 potwierdzenie. Title "Wyciszenie".
  Text "Powiadomienia opuszczają serwerownię bez zgłoszenia. Zgłosić {count} przez
  skreślenie." Twist: the first notifications of the campaign are filed, not fought.
- c) fetch, n 4, reward 25 stars. Title "Kopie zapasowe". Text "Zgłoszenie wnioskodawcy
  przechowuje się w {count} kopiach zapasowych. Kopie różnią się treścią. Zebrać wszystkie
  i nie czytać." Twist: the copies of the complaint disagree (the Anomalia's edits, never said).

**Chapter card** (`story.p2.card`; "Akt I. Planeta Dwudziesta Czwarta (Zaległa)"):
- lines.1 "Zjawisko na planecie poprzedniej usunięto. Zgłoszenie przekazano na planetę następną
  w kolejności. Kolejność ustalono przed zgłoszeniem."
- lines.2 "Według akt planeta jest siedzibą oddziału terenowego Komisji. Na miejscu stwierdzono
  magazyn i serwerownię."
- lines.3 "Zjawisko lokalne: urządzenia magazynowe z zaległą aktualizacją. Zaległość wynosi
  jedną planetę."
- hero.pralka "Przekazanie przyjmuję jak kolejny cykl. Cykl nie pyta, czy pranie było brudne."
- hero.konsultant "Przekierowano mnie do innego działu. Znam ten dział. Sam przekierowywałem."
- hero.petlowiec "Na tej planecie już byłem, w przyszłym tygodniu. Zaległość nadrobię z góry."
- hero.kartograf "Planeta następna w kolejności jest o jedną pozycję dalej niż planeta
  następna. Zaznaczam obie."
- hero.nalesnik "Przesyłki czekają. Ja też czekam, od czterech miliardów lat, więc nie narzekam."
- rewritten.1 "Sprawę przepisano. Zaległości uznano za nadrobione, a nadrobienie za zaległe."
- rewritten.2 "Wnioskodawca wraca po przesyłki. Przesyłki zostały wydane. Nie wiadomo komu."

**Hosted set.** «Obieg dokumentów» (ITEMS §12.6; drops here as the set rule says). Systems:
locations registry (serwerownia new, magazyn reused), gate (S11a flag + forced teczka), clerk,
tickets, boss variant, cards. Slice: **S13**.

### 8.3 Planet 3: Planeta Dwudziesta Piąta (Zaktualizowana) — Akt I
**Record** (`PLANETS[2]`, unchanged in data): act 1; dominant Urządzenia 0.5/0.2/0.3; law pool
`ciasteczka`, `parzystosc`, `grawitacja`, `wymagana-aktualizacja`; base layouts miasteczko,
wioska; locations serwerownia, przedmieście, biuro; hosted set «Serwis»; pages 5; boss Prototyp.
Name "Planeta Dwudziesta Piąta (Zaktualizowana)", loc "Planecie Dwudziestej Piątej".

**Feel.** The planet that is always updating. A suburb of smart homes mid-update (doors that
have not decided whether to be open), a server hall running the update, and the Komisja's
regional office, the first Komisja building the applicant sees: desks, a turnstile, nobody
receiving. The office is where the ticket is **escalated** at the end of the act: the Komisja
does not answer, it adds forms. Wygenerowane appear (0.3): the update's generated content. The
off-by-one shows for the first time without being named: everything in the office exists in two
copies, one of them a variant. Indigo, profile C.

**Locations.**
- *przedmieście* (pages 1–2): planet 1's drawings reused with this wash, plus a smart fridge on
  a porch, a door drawn twice (open and closed, one dotted), a progress ruler on a lawn.
- *serwerownia* (page 3): planet 2's drawings reused.
- *biuro* (pages 4–5, boss page): desks in rows, filing cabinets, a water cooler, a potted plant
  (hatched), a photocopier, partition walls as ruled rectangles, a row of waiting chairs, a
  turnstile (the gate), a numbered ticket dispenser, a wall clock with two hour hands. Page
  shape: rooms cut by partitions, doorways as gaps; the boss in the open-plan hall.

**Law.** Headline clause *Parzystość* (the office planet where everything comes in pairs,
including the decision). Warunek: "urządzenia w trakcie aktualizacji".

**Boss.** Prototyp, variant "Prototyp, seria 3, wersja biurowa". One data change: attackRange
44 → 60 (an arm with a stapler; the look note for the variant drawing is that one part, the
body stays). Spór:
- spor1: comment "Przyjmuję wyłącznie w godzinach urzędowania. Obecnie urzęduję." Right:
  **mechaniczny** "Zgłoszenie składa się osobiście. Osobiście oznacza uderzeniem." Wrong
  regulaminowy "Godziny urzędowania nie dotyczą stron postępowania." Wrong egzystencjalny
  "Urząd, który urzęduje, nie istnieje poza urzędowaniem."
- spor2: comment "Wydrukowałem decyzję w dwóch egzemplarzach. Oba są odmowne." Right:
  **egzystencjalny** "Dwie odmowy tej samej treści są jedną odmową. Jedna odmowa nie występuje
  parami." Wrong mechaniczny "Egzemplarze drukuje się na papierze. Papier się rwie." Wrong
  regulaminowy "Decyzja wymaga podpisu na każdym egzemplarzu."

**Base and clerk.** miasteczko or wioska. Clerk `story.p3.clerk`: name "Pełnomocnik ds.
Aktualizacji", role "Komisja do Spraw Zjawisk Lokalnych, oddział terenowy (w aktualizacji)",
look seed 3.
- line0 "Oddział jest w trakcie aktualizacji. Do jej zakończenia działa w trybie ograniczonym,
  to jest jak zawsze."
- line1 "Po usunięciu zjawiska zgłoszenie podlega eskalacji. Eskalacja oznacza więcej formularzy."
- line2 "Pełnomocnik posiada pełnomocnictwo. Pełnomocnictwo wymaga aktualizacji."

**Gate** (`story.p3.gate`): **page 4** (biuro). A turnstile across the exit corner with a figure
"Portier" beside it. Condition: the page's named elite, titled "Ochrona Obiektu" (S9 named
elites; the gated page always spawns one, with that name instead of a rolled one), is struck.
On the lift the turnstile arm is struck through and the Portier sits down on a waiting chair.
- note "Bramkę obsługuje ochrona obiektu. Ochrona jest na stronie. Bramka otwiera się po
  skreśleniu ochrony z listy obecności."
- figure (tap) "Bramka. Przepustki nie wydaję, sprawdzam."
- lift "Ochronę obiektu skreślono z listy obecności. Bramka otwarta. Portier przeszedł na
  stronę oczekujących."

**Side tickets** (`story.p3.ticket.a|b|c`):
- a) kill, n 10, family urzadzenia, reward 35 stars + permission urzadzenia. Title "Przegląd
  okresowy". Text "Urządzenia w trakcie aktualizacji podlegają przeglądowi. Przegląd
  przechodzi urządzenie, które przestało działać. Sprawdzić {count}." Twist: passing means stopping.
- b) reach, n 4, reward 30 stars + 1 potwierdzenie. Title "Stawiennictwo". Text "Wnioskodawca
  stawia się w oddziale Komisji na stronie {count}. Komisja nie przyjmuje. Obecność zostanie
  odnotowana przez jej nieobecność." Twist: the first visit to a Komisja office; nobody there.
- c) fetch, n 2, reward 25 stars. Title "Dwa egzemplarze". Text "Zgłoszenie składa się
  w {count} egzemplarzach. Egzemplarze leżą na stronach. Drugi egzemplarz jest wariantem." Twist:
  the second copy is a variant (the planet's parzystość, in a form field).

**Chapter card** (`story.p3.card`; "Akt I. Planeta Dwudziesta Piąta (Zaktualizowana)"):
- lines.1 "Zjawisko na planecie poprzedniej usunięto. Zgłoszenie przekazano dalej. Dalej
  znaczy tutaj."
- lines.2 "Według akt planeta jest miastem powiadomień. Na miejscu stwierdzono przedmieście,
  które się aktualizuje, oraz oddział Komisji."
- lines.3 "Zjawisko lokalne: urządzenia w trakcie aktualizacji. Po usunięciu zjawiska zgłoszenie
  zostanie eskalowane, czyli przepisane na większy formularz."
- hero.pralka "Aktualizacja nie pyta urządzenia o zgodę. Wiem, od tego się zaczęło."
- hero.konsultant "Eskalacja oznacza przełożonego. Przełożony oznacza dłuższą muzykę."
- hero.petlowiec "Formularz większy wypełniłem już w zeszłej pętli. Odrzucono go z wyprzedzeniem."
- hero.kartograf "Oddział Komisji figuruje na mapie. Mapa jest w aktualizacji. Do jej końca
  oddział jest przybliżony."
- hero.nalesnik "Komisja ma biuro. Moja Komisja ma tylko odkładanie. Odkładanie trwa krócej."
- rewritten.1 "Sprawę przepisano. Aktualizację uznano za zakończoną, a zakończenie za
  tymczasowe."
- rewritten.2 "Wnioskodawca wraca do oddziału. Oddział nadal nie przyjmuje, ale odnotowuje."

**Hosted set.** «Serwis». At the MVP (`CAMPAIGN_LAST = 3`) closing this planet issues the
return ticket (§2); the chapter card of the return is the finale's own frame (§8.4), not a
planet card. Systems: locations registry (biuro new, two reused), gate (named elite as key),
clerk, tickets, boss variant, cards. Slice: **S14**.

### 8.4 The finale: the return to Planeta Dwudziesta Trzecia (S15)
Frame per §3: the final ticket is a run of one page, planet 1's base layout with the stations
struck and hatched over, the Anomalia at the desk's place. Three phases; the Spór machinery as
built (one comment with three replies in phase 1, one in phase 3, one per face in phase 2).
Keys as §7: `story.finale.phase1.*`, `story.finale.face.<heroId>.*`, `story.finale.phase3.*`,
`story.finale.footnote`, plus `story.finale.card.*` (the return's card) and
`story.finale.hero.<heroId>` (the hero line after the stamp).

**Return card** (`story.finale.card`, title generated "Zgłoszenie nr {number}. Planeta Dwudziesta
Trzecia (Przydzielona)"; the red PRZEPISANO stamp as the rewritten variant has):
- lines.1 "Zjawiska lokalne usunięto na wszystkich planetach z listy. Lista się skończyła.
  Zgłoszenie przekazano na planetę następną, to jest pierwszą."
- lines.2 "Według akt planeta jest planetą przydzieloną. Na miejscu stwierdzono bazę
  wnioskodawcy, skreśloną."
- lines.3 "Przy biurku urzęduje Asystent w wersji 0.9. Wersja została wycofana. Wycofania nie
  wykonano."

**Phase 1** (`story.finale.phase1`): the three family forms in turn, the duel of footnotes. For
each form two footnotes: the old Asystent's (`.form.<boss>.old`, printed in the wrong-footnote
style that exists for the one-in-eight) and the current one's correction (`.form.<boss>.new`).
- meet "Bazę odnaleziono. Stacje skreślono. Biurko zajęte."
- form.prototyp.old "Zjawisko lokalne: urządzenie. Otwarto zgłoszenie dodatkowe nr 1."
  form.prototyp.new "Sprostowanie: to nie jest zjawisko lokalne, lecz poprzednia wersja
  Asystenta. Zgłoszenia dodatkowego nie otwarto."
- form.weryfikacja.old "Wnioskodawca nie potwierdził, że nie jest robotem. Zgłoszenie
  wstrzymano." form.weryfikacja.new "Sprostowanie: wnioskodawca potwierdził to na trzech
  planetach. Wstrzymanie nie obowiązuje."
- form.hipoteza.old "Wnioskodawca istnieje według 87% użytkowników. Pozostałych 13% pytano."
  form.hipoteza.new "Sprostowanie: pozostałych nie pytano. Wnioskodawca istnieje w aktach,
  co w Komisji wystarcza."
- spor.comment "Zgłoszenie nr {number} czeka na rozpatrzenie. Rozpatrzenie nastąpi po
  usunięciu zjawiska lokalnego." Right: **regulaminowy** "Warunek spełniono na trzech
  planetach. Zgłoszenie podlega rozpatrzeniu, nie przekazaniu." Wrong mechaniczny "Zjawisko
  lokalne usunięto trzy razy. Czwarte w toku." Wrong egzystencjalny "Zjawiska nie było. Były
  przekazania."
- end "Trzy formy skreślono. Asystent 0.9 odczytał akta wnioskodawcy."

**Phase 2, the five faces** (`story.finale.face.<heroId>`): `meet` (the Asystent's footnote
naming the face), `line` (the face's own bubble, a claim in the bubble style), `spor.comment` +
three `reply.*`, `end` (the footnote when the phase ends). The face's mechanic is §3; nothing
here adds to it.
- konsultant, **Kierownik Kolejki**: meet "Anomalia przyjęła postać Kierownika Kolejki.
  Kierownik nie opuścił kolejki, odkąd ją założono." line "Pozostań na linii." spor.comment
  "Twoje zgłoszenie jest dla nas ważne. Pozostań na linii. Numer w kolejce: jeden." Right:
  **regulaminowy** "Rozmowa jest nagrywana. Nagranie wykaże, że w kolejce jest jedna osoba
  i jest nią kierownik." Wrong mechaniczny "Linię można przerwać przecięciem kabla. Kabli jest
  sto." Wrong egzystencjalny "Kolejka bez końca nie ma początku, więc nikt w niej nie stoi."
  end "Kolejkę rozwiązano. Kierownika przekierowano do działu, którego nie ma."
- pralka, **Serwisant Autoryzowany**: meet "Anomalia przyjęła postać Serwisanta
  Autoryzowanego. Autoryzacji nie okazał." line "Zalecany reset." spor.comment "Urządzenie
  zgłasza osobowość. Osobowość nie jest objęta gwarancją. Zalecany reset do ustawień
  fabrycznych." Right: **egzystencjalny** "Reset przywraca ustawienia fabryczne. Osobowości
  w fabryce nie było, więc nie można do niej wrócić." Wrong mechaniczny "Serwisant bez narzędzi
  nie serwisuje. Narzędzia zabrano." Wrong regulaminowy "Gwarancja na osobowość obowiązuje od
  dnia złożenia wniosku." end "Serwis zakończono. Paragrafy przywrócono. Resetu nie wykonano."
- petlowiec, **Węzeł**: meet "Anomalia przyjęła postać Węzła. Węzeł składa się ze wszystkich
  pętli wnioskodawcy jednocześnie i nie zgadza się ze sobą." line "Już to mówiłem." spor.comment
  "Już to mówiłem. Powiem to za chwilę. Nie zgadzam się z obydwoma." Right: **mechaniczny**
  "Węzeł rozwiązuje się od jednego końca. Koniec wskazano." Wrong regulaminowy "Każda pętla
  wymaga osobnego zgłoszenia. Zgłoszeń jest jedno." Wrong egzystencjalny "Węzeł, który mówi
  w trzech czasach, nie istnieje w żadnym." end "Węzeł rozwiązano. Pętle wróciły do swoich
  czasów. Jednej brakuje."
- kartograf, **Planeta Nieistniejąca**: meet "Anomalia przyjęła postać Planety Nieistniejącej,
  figurującej w aktach wnioskodawcy. Istnieje w zakresie niezmierzonym." line "Istnieję
  w nawigacji." spor.comment "Istnieję w nawigacji. Nawigacja jest zweryfikowana. Pomiar jest
  zbędny." Right: **mechaniczny** "Zmierzono. Wynik: zero. Planet o wyniku zero rejestr nie
  prowadzi." Wrong regulaminowy "Wpis w nawigacji nie zastępuje decyzji Komisji." Wrong
  egzystencjalny "To, co istnieje tylko w nawigacji, istnieje tylko dla nawigacji." end
  "Planetę zmierzono w całości. Nie zmieściła się w pomiarze. Skreślono."
- nalesnik, **Obserwatorium**: meet "Anomalia przyjęła postać Obserwatorium, które rozstrzyga,
  co jest ciałem niebieskim. Widzi wyłącznie ciała okrągłe." line "Nie widzę ciała."
  spor.comment "Ciało widzę, gdy jest okrągłe. Ciała nie widzę. Wniosek odkłada się." Right:
  **egzystencjalny** "To, czego nie widać z boku, istnieje z boku." Wrong mechaniczny
  "Soczewkę można zbić. Zbita soczewka widzi wszystko." Wrong regulaminowy "Wniosek odłożony
  podlega rozpatrzeniu po odłożeniu." end "Obserwatorium zamknięto. Wniosek o status planety
  karłowatej pozostaje odłożony. Odłożenie uznano za przychylne."

**Phase 3** (`story.finale.phase3`): the Anomalia exists only as much as the case is believed
closed (§3); the kill is a stamp.
- meet "Anomalia istnieje w stopniu, w jakim zgłoszenie uznaje się za otwarte. Zgłoszenie
  jest otwarte od trzech planet."
- spor.comment "Zgłoszenie jest otwarte. Dopóki jest otwarte, jestem potrzebny." Right:
  **egzystencjalny** "Zgłoszenie uznaje się za zamknięte. Potrzebny do zgłoszenia zamkniętego
  nie jest nikomu potrzebny, więc go nie ma." (M3 review: the type stays egzystencjalny, phase 3
  is about existence, §3; the S11 text "Zgłoszenie zamyka się stemplem, nie zgodą. Stempel jest
  w ręku wnioskodawcy." read as regulaminowy and goes to the voice editor at the S17 pass.) Wrong
  mechaniczny "Potrzebnego można wyłączyć. Wyłącznik jest z tyłu." Wrong regulaminowy
  "Zgłoszenie otwarte podlega przekazaniu na planetę następną."
- stamp "SPRAWĘ ZAMKNIĘTO" (red, the boss-death stamp slot).
- close "Asystent w wersji 0.9 został wycofany. Wycofanie odnotowano. Tym razem wykonano."

**Final footnote** (`story.finale.footnote`): "Sprawę zamknięto prawidłowo. Planeta przydzielona
była zgodna z aktami. Niezgodne były akta: Asystent w wersji 0.9 przesunął opisy planet
o jedną pozycję, przez co opis każdej planety dotyczył następnej. Błędowi nadano numer
zgłoszenia. Zgłoszenie czeka na rozpatrzenie." (The last sentence is the hook for "Sprawę
wznowiono", §2.)

**Hero lines after the stamp** (`story.finale.hero.<heroId>`):
- pralka "Program zakończono. Osobowość nadal w toku; planetę przyjmuję."
- konsultant "Dziękuję za rozmowę. Czy mogę jeszcze w czymś pomóc. Nikt nie odpowiada, więc nie."
- petlowiec "Sprawę zamknięto po raz pierwszy. Pamiętam, że już się to zdarzyło."
- kartograf "Planeta istnieje. Naniesiono. Mapa jest zgodna z planetą, akta pozostają do poprawy."
- nalesnik "Sprawę zamknięto. Moją odłożono. Odłożenie jest teraz najstarszym dokumentem
  Komisji i podlega ochronie."

**Opening page** (`story.opening`, title "Zgłoszenie nr {number}"; shown once at campaign start,
one tap skips):
- lines.1 "Wnioskodawca stawił się na planecie przydzielonej. Planeta nie odpowiada opisowi
  z akt. Wnioskodawca wnosi o przydział planety zgodnej z aktami."
- lines.2 "Komisja do Spraw Zjawisk Lokalnych przyjęła zgłoszenie. Rozpatrzenie nastąpi po
  usunięciu zjawiska lokalnego. Zjawisko stwierdzono w chwili przyjęcia."
- lines.3 "Do czasu rozpatrzenia wnioskodawca pozostaje na planecie przydzielonej. Pozostawanie
  liczy się jako obecność. Obecność liczy się jako zgoda."
- hero.pralka "Programu nie przerywam. Wniosek o osobowość złożono; planetę przyjmuję warunkowo."
- hero.konsultant "Zgłoszenie przyjęto. Słyszałem to zdanie tysiąc razy, zawsze z tej strony
  słuchawki."
- hero.petlowiec "Zgłoszenie złożyłem wczoraj, jutro. Dziś czekam na odpowiedź sprzed tygodnia."
- hero.kartograf "Planetę naniesiono na mapę przed pomiarem. Pomiar wykaże, czy mapa miała rację."
- hero.nalesnik "Planeta nie jest spłaszczona. Nie mamy o czym rozmawiać, ale zostaję."

**Systems and slices.** The finale page, the struck stations, the three phases and the face
mechanics: S15 as PRODUCTION lists it; the texts above are data for S11's voice pass. Nothing
here needs a new rendering technique (DESIGN §7 rule): wrong-footnote style, the strike, stamps
and the Spór prompt all exist. Hero-specific phase-2 bodies are the one drawn item (one figure
per face, S15's look budget).

### 8.5 Open questions from S11 (closed at the M3 review: all four shipped as recommended)
1. Consecutive planet numbers from 23 (the Komisja's list order): shipped (planets.json p1–p3);
   S22 continues at 26, S25 at 29. The player may still rename at the playtest.
2. The "według akt" line on every chapter card (§8.0): shipped on p1–p3; S22 and S25 keep it.
3. First ticket on a planet prints the headline clause: shipped S13 as `PlanetDef.headline`
   (§8.0 Law).
4. The P3 gate keys on a forced named elite "Ochrona Obiektu": shipped S14 as the gate kind
   `elite` (`spawnGateElite`, lifts on `elite:slain`). Three gate kinds now exist (teczka, elite,
   boss); S22 and S25 pick from them and add none without a builder item.

### 8.6 Decisions at the M3 review (what Akt I and the finale fixed for the later acts)
- **Gates as built**: at most one per planet, in the exit corner, lifted by a teczka carried, a
  named elite struck or the boss struck; the figure (Magazynier, Portier) has no nameplate and
  answers a tap with its one line. Planet 1 of every act has no gate (the act's first planet
  flows); the other two may have one each.
- **Boss variants**: one data change each so far (racja 260; racja 360; attackRange 60 + a drawn
  stapler arm). Akt II keeps the rule (§4) and may spend its one change on a part, as planet 3 did.
- **The finale is not saved mid-fight**: a bookmark taken during the final ticket restarts it at
  phase 1 (Diablo resets a left boss fight). Kept; nothing of the finale goes into the save.
- **No "page bosses"**: the Diablo 2 benchmark has unique monsters and act bosses, not a boss per
  level. The named elite (one per two pages) is the game's mid-run boss; ITEMS §6 and §7.4 now say
  so, and the planet boss stays the only `boss` rank. S22/S25 plan no page bosses.
- **Finale balance** (S16 bot, level 12 with 3 nietypowy + 2 rzadki): 85% win, 0.6 deaths, 156 s,
  1.4 ultimates per run. Read as a fair climax; whether it reads as a *finale* is the playtest
  question in STATUS, not a numbers question.
- **Hero lines on the finale**: the stamp's hero line and the final footnote are the last two
  texts a player reads; the footnote is held alone on the slip for 12 s (`LONG_NOTE` 200 chars).
  A future final footnote (S27, `CAMPAIGN_LAST` 9) must either stay over 200 characters or drop
  `LONG_NOTE`; the voice editor keeps the 235-character text as the model.
- **Open from S16 voice** (not player questions): `settings.joystick` "Joystick" vs "Drążek":
  the loanword stays (common Polish; the settings sheet is the one place a loanword is plain
  usage); `onramp.walk` is mode-neutral and stays so until the playtest says a player got lost.

### 8.7 Decisions at the M4 review (what Depth fixed for Akt II and III; S22 and S25 read this)
- **Hosted sets are story hooks, not mechanics.** Planet 5 hosts «Ostatnia mila» (the
  shopping-app planet, ITEMS §12.6), planet 6 «Infolinia», 8 «Domniemanie», 9 «Awaria». The
  planet's clerk, one side ticket or the boss's Spór comment may name the set's subject (a
  delivery, a hotline, a doubt, a breakdown) in one line; the set itself drops as built (boss 35%,
  Sklep 10%, elites by post). Nothing in a planet entry adds a drop rule.
- **Every item reward comes by post.** A hand-written side ticket that pays a unique or set
  piece (`QuestReward.item`, at most one such ticket per planet) is an awizo at the base
  paczkomat from the Komisja, never a plate at the board. The ticket's text may promise
  delivery; the Asystent's line at the paczkomat is the twist ("Doręczenia osobistego nie
  przewidziano").
- **The ten uniques are the pool for the whole campaign**; "one per hero per planet later"
  (ITEMS §4.2) is not a deliverable of S22/S25. A planet entry does not name a unique.
- **Heroes at ten skills do not change the boss contract**: still one variant line, two Spór
  comments with one right reply each, one data change. A Spór comment may refer to what the
  hero does (Konsultant's queue, Kartograf's measurements) only in the comment, never in a reply
  type (the right type is set per comment, §8.0).
- **The Konsultant's kiosk cut** (passive 10, up to 30% off the fee) and **Reklamacja** are both
  Sklep lines, so an Akt II vendor lie or kiosk footnote may mention them; no planet changes
  prices or fees.
- **Page gates stay as §8.6**; a named elite that lifts a gate (planet 3's Ochrona Obiektu)
  drops the `named` rank like any other, so a gate elite is not a reward in itself.
- **No new enemy family in Akt II** by default: the three families' claims are what the fifty
  skills and the sets rebut (`set.obieg`, `set.domniemanie` name regulaminowy and egzystencjalny
  claims). S22 may propose one act **event** (§5) or new elite affixes for `akt2-enemies`; a
  fourth family would need every hero's § 1–3 types re-balanced and is parked unless the player
  asks for it (STATUS "Needs the player" at S22).

### 8.8 Planet 4: Planeta Dwudziesta Szósta (Przekierowana) — Akt II
**Record** (`PLANETS[3]`): act 2; dominant Powiadomienia 0.3/0.55/0.15; law pool
`godziny-konsultanta`, `weryfikacja-dwuetapowa`, `nie-przeszkadzac`; base layouts miasteczko,
lądowisko; locations miasto, biuro; hosted set none (first planet of the act, ITEMS §12.6);
pages 5–6; boss Weryfikacja. Record edits for S23 (data only): `headline: 'godziny-konsultanta'`
(already `lawPool[0]`, named for clarity), `locationSplit: 3` (pages 1–3 miasto, pages 4–6 and the
boss page biuro). Name `planets.p4.name` "Planeta Dwudziesta Szósta (Przekierowana)", `loc`
"Planecie Dwudziestej Szóstej" (the placeholder epithet kept: the ticket was redirected here).

**Feel.** The escalation. The ticket comes back on a bigger form, and the bigger form has an
address: the Komisja's second instance, which occupies the upper floors of a city where every
building sends notifications. Badges on doors grow while the applicant looks at them; billboards
offer the last chance; the trams run to a timetable that has been struck out. Outside the
consultant's hours (the headline clause) the city is run by the bot, which answers every action
with three options. The Komisja's letters change register with the act: Akt I was polite, Akt II
writes "w nawiązaniu do zgłoszenia nr …, informujemy" and attaches. Nothing is refused; everything
is attached. Brick wash, profile B (the act's).

**Locations.**
- *miasto* (pages 1–3; new type, the act's main one, reused on planet 5): tenements as tall
  hatched blocks with a grid of windows, a tram on a ruled rail, a bus shelter, billboards on
  poles with a hatched "OSTATNIA SZANSA", a kiosk (the Sklep's cousin, closed), a fountain drawn
  as a coffee ring, a zebra crossing as ruled stripes, lampposts, a notice column (słup
  ogłoszeniowy) papered with awizo slips, manhole covers, a letterbox with a badge number. Page
  shape: blocks in a grid, streets as corridors, crossings as open squares with long sight lines;
  a załącznik page may branch from a side street.
- *biuro* (pages 4–6, boss page): planet 3's drawings reused with the brick wash, plus the
  second instance's props: form stacks as hatched towers, a lift door with a floor indicator
  (always "II"), a rope queue on posts, a wall plate "INSTANCJA DRUGA", a numbered-ticket
  dispenser (reused), a window with a closed blind. Page shape: rooms cut by partitions as on
  planet 3, but the boss hall is the appeals counter: a long counter with the captcha grid in
  front of it.

**Law.** Headline clause *Godziny konsultanta* (the act's theme on its first planet: the city
belongs to the bot outside hours). Warunek: "powiadomienia miejskie".

**Boss.** Weryfikacja, variant line `story.p4.boss.variant`: "Weryfikacja, instancja druga,
formularz rozszerzony". One data change: racja 220 → 260 (the extended form). The hydrant grid and
the summons stay. Spór:
- spor1 (on arrival): comment "Potwierdź, że nie jesteś robotem. Potwierdzenie złożone
  w instancji pierwszej nie obowiązuje w drugiej." Right: **regulaminowy** "Instancja druga
  rozpatruje odwołanie, nie tożsamość. Tożsamość rozpatrzono w pierwszej i nie została
  zaskarżona." Wrong mechaniczny "Robot nie potwierdza, robot uderza. Uderzam, więc nim nie
  jestem." Wrong egzystencjalny "Robotem jest ten, kto pyta. Pytanie zadano automatycznie."
- spor2 (the grid solved, the block): comment "Hydranty zaznaczono poprawnie. W związku
  z eskalacją proszę zaznaczyć je ponownie, na formularzu rozszerzonym." Right: **mechaniczny**
  "Hydranty zaznaczono stopą. Stopa nadal na nich stoi, więc zaznaczenie trwa." Wrong
  regulaminowy "Ponowne zaznaczenie wymaga ponownego wezwania. Wezwania nie doręczono." Wrong
  egzystencjalny "Hydrant zaznaczony istnieje bardziej niż niezaznaczony. Nie trzeba go
  zaznaczać dwa razy."

**Base and clerk.** miasteczko or lądowisko by seed. Clerk `story.p4.clerk`: name "Referent ds.
Eskalacji", role "Komisja do Spraw Zjawisk Lokalnych, instancja druga, okienko 4", look seed 4.
- line0 "Zgłoszenie eskalowano. Eskalacja polega na przepisaniu zgłoszenia na formularz
  większy. Treść pozostaje bez zmian, zmienia się format."
- line1 "Instancja druga mieści się nad pierwszą. Pierwszej na tej planecie nie przewidziano."
- line2 "Konsultant przyjmuje w godzinach. Poza godzinami przyjmuje bot. Bot przyjmuje
  wszystko i nic nie przekazuje."

**Gate.** None (first planet of the act, §8.6).

**Side tickets** (`story.p4.ticket.a|b|c`, ids `h:p4:a..c`):
- a) kill, n 14, family powiadomienia, reward 40 stars + permission powiadomienia. Title
  "Odbiór powiadomień". Text "Powiadomienia miejskie doręcza się przez odebranie. Powiadomienie
  odebrane uznaje się za przeczytane, przeczytane za usunięte. Odebrać {count}." Twist: reading
  is deleting; the first Powiadomienia ticket of the act names the family's rule.
- b) reach, n 5, reward 35 stars + 1 potwierdzenie. Title "Instancja druga". Text "Odwołanie
  wnosi się w instancji drugiej, na stronie {count}. Instancja druga mieści się nad pierwszą.
  Pierwszej nie ma." Twist: the appeal goes to a second instance without a first.
- c) fetch, n 4, reward 30 stars. Title "Załączniki". Text "Eskalacja wymaga załączników.
  Załączniki dołączono do zgłoszenia i rozesłano po mieście. Zebrać {count} i dołączyć
  ponownie." Twist: the escalation's attachments were distributed around town for filing.

**Chapter card** (`story.p4.card`; title generated "Akt II. Planeta Dwudziesta Szósta
(Przekierowana)"):
- lines.1 "Zjawiska lokalne na planetach pierwszej listy usunięto. Zgłoszenie eskalowano
  i przekierowano na planetę następną. Przekierowanie nie jest rozpatrzeniem."
- lines.2 "Według akt planeta jest aplikacją sklepową. Na miejscu stwierdzono miasto
  powiadomień oraz instancję drugą Komisji."
- lines.3 "Zjawisko lokalne: powiadomienia miejskie. Instancja druga przyjmuje wyłącznie
  w godzinach konsultanta. Godzin nie podano."
- hero.pralka "Eskalacja: program dłuższy, ta sama woda. Formularz większy przyjmuję do bębna,
  osobowość nadal w toku."
- hero.konsultant "Eskalowano mnie do przełożonego. Przełożonym okazała się kolejka. Znam ją
  z drugiej strony słuchawki."
- hero.petlowiec "Formularz większy wypełniłem w poprzedniej pętli i w następnej. W tej tylko
  podpisuję."
- hero.kartograf "Miasto figuruje na mapie jako punkt. Punkt powiększono do miasta bez pomiaru.
  Zacznę od rogu."
- hero.nalesnik "Miasto ma kształt siatki. Siatka jest płaska. Pierwszy raz od czterech
  miliardów lat jestem na miejscu."
- rewritten.1 "Sprawę przepisano. Eskalację uznano za zakończoną, a instancję drugą za pierwszą."
- rewritten.2 "Wnioskodawca wraca do miasta. Powiadomienia odebrano. Miasto wysyła nowe."

**Stop posts.** The stop (DESIGN §4.1 Przystanki) is a timetable post; on *miasto* pages it
reads as the city's own tram stop with no flavour needed, and the builder may put the bus
shelter prop near the page's stop when the layout allows (the post itself is placed by
`placeStop`, nothing collides with it). On *biuro* pages it reads as the queue's post; no change.

**Hosted set.** None (first planet of the act). Systems: campaign record (two data edits above),
locations registry (miasto new, biuro reused with additions), clerk, side tickets, boss variant
table (racja), cards. Slice: **S23** (builder `planet-4`).

### 8.9 Planet 5: Planeta Dwudziesta Siódma (Pilna) — Akt II
**Record** (`PLANETS[4]`): act 2; dominant Powiadomienia 0.2/0.6/0.2; law pool
`godziny-konsultanta`, `oplata-serwisowa`, `nie-przeszkadzac`; base layout miasteczko; locations
centrum, miasto; hosted set «Ostatnia mila»; pages 5–6; boss Weryfikacja. Record edits for S23:
`headline: 'oplata-serwisowa'` (the shopping planet charges for every win), locations reordered
to `['miasto', 'centrum']` with `locationSplit: 3` (pages 1–3 miasto, pages 4–6 and the boss page
centrum), the gate below. Name "Planeta Dwudziesta Siódma (Pilna)", loc "Planecie Dwudziestej
Siódmej" (the placeholder epithet kept: the ticket is marked urgent because the offer is limited
in time).

**Feel.** The planet that is one shopping app. The streets are the storefront (every façade a
product card with a price and a struck price), the halls behind them are the app's customer
service and fulfilment centre, and the notifications are the offers: Ostatnia szansa, Twój
koszyk tęskni. The applicant's ticket has been marked *pilne* because the planet's offer expires;
the service fee (headline clause) is added to a cart the applicant does not have. The set
«Ostatnia mila» is the planet's subject: the last mile of every delivery is walked by the
recipient. The Sklep stock joke (ITEMS §7.1 as built: one oferta plate, 10% a set piece) is at
home here and needs no planet rule. Brick wash, profile B.

**Locations.**
- *miasto* (pages 1–3): planet 4's drawings reused with this wash, plus the storefront props:
  shop windows as hatched rectangles with a price tag and a struck price, a sale banner across the
  street ("−70%" hatched), a delivery van outline at a kerb, a stack of flattened boxes, a
  mannequin with a badge number. Page shape as planet 4.
- *centrum* (centrum obsługi, pages 4–6, boss page; new type, reused on planet 6): long counters
  as ruled bars with numbered windows, a parcel conveyor (planet 1's belt reused), a wall of
  lockers (the paczkomat column part, three wide), a returns desk with a bin, a mountain of
  cardboard boxes (hatched), a barcode scanner on a stand, a stand with five hatched rating
  stars, a chat bubble on a pole ("Czat: offline"), shopping carts nested in a row, a rope queue
  (planet 4's reused). Page shape: a hall; counters as long bars with gaps, queues as rope lines
  the player walks around; the boss at the checkout, its grid on the floor in front.

**Law.** Headline clause *Opłata serwisowa* (every victory is charged; the loot tier rises "as
compensation", as `laws.json` says). Warunek: "powiadomienia o ofertach ograniczonych czasowo".

**Boss.** Weryfikacja, variant line `story.p5.boss.variant`: "Weryfikacja, wersja sklepowa,
zaznacz wszystkie koszyki". One data change, spent on a part as planet 3 did: the hydrants in
the grid squares are drawn as **shopping carts** (`BossVariant.grid: 'koszyk'`, one drawing in
render/enemyFigures.ts; the body stays) and the captcha hint reads from `story.p5.boss.hint`
"Zaznacz wszystkie kratki z koszykami." (a key override on the variant; the solved line stays
the family's). Racja as the family has it. Spór:
- spor1: comment "Potwierdź, że nie jesteś robotem, i dodaj do koszyka. Koszyk tęskni." Right:
  **egzystencjalny** "Koszyk jest pusty. Pusty koszyk nie tęskni; tęsknota jest funkcją
  aplikacji, nie koszyka." Wrong mechaniczny "Koszyk ma kółka. Kółka się odkręca." Wrong
  regulaminowy "Dodanie do koszyka wymaga zalogowania. Wnioskodawca nie posiada konta."
- spor2 (the grid solved, the block): comment "Weryfikację wstrzymano. Oferta ograniczona
  czasowo wygasła w trakcie. Proszę zacząć od nowa." Right: **regulaminowy** "Oferta jest ważna
  do odwołania. Odwołanie wniesiono i przyjęto; wstrzymanie trwa." Wrong mechaniczny "Zegar oferty
  można przytrzymać ręką." Wrong egzystencjalny "Czas, który minął w trakcie, nikomu nie minął."

**Base and clerk.** miasteczko. Clerk `story.p5.clerk`: name "Specjalista ds. Doręczeń", role
"Komisja do Spraw Zjawisk Lokalnych, punkt odbioru nr 27 (w aplikacji)", look seed 5.
- line0 "Zgłoszenie oznaczono jako pilne. Pilność wynika z oferty ograniczonej czasowo. Oferta
  dotyczy planety."
- line1 "Przesyłki doręcza się do punktu odbioru. Ostatnią milę pokonuje odbiorca. Odbiorca
  jest w punkcie odbioru, więc mila się nie zgadza." (the set's hook line, ITEMS §12.6)
- line2 "Opłatę serwisową dolicza się do koszyka. Koszyka wnioskodawca nie posiada. Opłatę
  doliczono."

**Gate** (`story.p5.gate`): **page 3** (0-based 2; miasto). Kind `elite`, look `parcels` (planet
2's wall of parcels reused with this wash: the delivery point at the end of the street) with a
figure "Dyspozytor" at the gap (look seed 52). Condition: the page's forced named elite, titled
"Doręczyciel" (`story.p5.gate.elite`, as planet 3's Ochrona Obiektu), is struck. On the lift the
parcels are struck through and drawn away, the Dyspozytor walks off the page.
- note "Punkt odbioru obsługuje doręczyciel. Doręczyciel jest na stronie, w trasie. Przesyłki
  wydaje się po skreśleniu doręczyciela z grafiku."
- figure (tap) "Nie wydaję. Dysponuję."
- lift "Doręczyciela skreślono z grafiku. Przesyłki uznano za doręczone. Przejście wolne."

**Side tickets** (`story.p5.ticket.a|b|c`; ticket a is the planet's one item ticket, §8.7):
- a) deliver, n 1, reward 40 stars + item: one piece of «Ostatnia mila» (`QuestReward.item`,
  the piece picked by the builder's roll from kask / kamizelka / powerbank at the planet's shop
  band). Title "Ostatnia mila". Text "Przesyłkę wnioskodawcy doręczono do punktu odbioru. Punkt
  odbioru jest na pierwszej stronie, wnioskodawca w bazie. Ostatnią milę pokonuje odbiorca:
  wynieść przesyłkę, wrócić, doręczyć Specjaliście ds. Doręczeń." Twist: the recipient walks the
  last mile both ways, and the reward is then sent by post anyway: it arrives as an awizo at the
  paczkomat with the Asystent's line "Doręczenia osobistego nie przewidziano."
- b) kill, n 16, family powiadomienia, reward 40 stars + permission powiadomienia. Title
  "Ostatnia szansa". Text "Oferty ograniczone czasowo wygasają po skreśleniu. Skreślić {count}.
  Oferta ważna do odwołania; odwołanie wniesiono." Twist: the offer's own clause.
- c) fetch, n 3, reward 30 stars + 1 potwierdzenie. Title "Koszyk". Text "Koszyk wnioskodawcy
  tęskni. Zawartość koszyka rozłożono na stronach w celu personalizacji. Zebrać {count}. Zakupu
  nie przewidziano." Twist: the cart's contents were spread out to personalize them; no purchase.

**Chapter card** (`story.p5.card`; "Akt II. Planeta Dwudziesta Siódma (Pilna)"):
- lines.1 "Zjawisko na planecie poprzedniej usunięto. Zgłoszenie przekazano na planetę
  następną i oznaczono jako pilne. Pilność wynika z oferty, nie ze zgłoszenia."
- lines.2 "Według akt planeta jest infolinią. Na miejscu stwierdzono aplikację sklepową
  wielkości planety."
- lines.3 "Zjawisko lokalne: powiadomienia o ofertach ograniczonych czasowo. Każde zwycięstwo
  podlega opłacie serwisowej. Opłatę doliczono do koszyka."
- hero.pralka "Oferta ograniczona czasowo. Mój czas jest ograniczony do końca programu. Koszyka
  nie posiadam; wirówkę owszem."
- hero.konsultant "Twój koszyk tęskni. Mówiłem to tysiąc razy i nikt nie odpowiedział. Teraz
  wiem: nie mieli koszyka."
- hero.petlowiec "Ostatnia szansa pojawia się w każdej pętli. Pierwszej szansy nie
  odnotowano."
- hero.kartograf "Sklep wielkości planety nie mieści się w skali. Zmierzę ofertę. Towaru nie
  stwierdzono."
- hero.nalesnik "Dostawa w ciągu doby. Doba na mojej planecie trwa krócej, więc się spóźnią."
- rewritten.1 "Sprawę przepisano. Ofertę uznano za wygasłą, a pilność za bezprzedmiotową."
- rewritten.2 "Wnioskodawca wraca po odbiór. Przesyłkę zwrócono do nadawcy. Nadawcą był
  wnioskodawca."

**Stop posts.** On *miasto* as planet 4. On *centrum* pages the post stands among the queues and
reads as the "numerek" post of a service hall; no flavour needed beyond the drawing.

**Hosted set.** «Ostatnia mila» (drops as built: boss 35%, Sklep 10%, elites by post; ticket a
pays one piece by awizo). Systems: campaign record (headline, location order and split, gate),
locations registry (centrum new, miasto reused with additions), clerk, side tickets (one
`QuestReward.item`), boss variant table (`grid` part + hint key override: a small additive change
to `BossVariant` and enemyFigures.ts), gate (elite kind, parcels look reused), cards. Slice:
**S23** (builder `planet-5`).

### 8.10 Planet 6: Planeta Dwudziesta Ósma (Nagrywana) — Akt II
**Record** (`PLANETS[5]`): act 2; dominant Powiadomienia 0.15/0.55/0.3; law pool
`weryfikacja-dwuetapowa`, `oplata-serwisowa`, `godziny-konsultanta`; base layouts miasteczko,
wioska; locations centrum, serwerownia, archiwum; hosted set «Infolinia»; pages 5–6. Record edits
for S24: `boss: 'ankieta'` (the act's new body, below; `BOSS_OF[dominant]` would give
Weryfikacja), `headline: 'weryfikacja-dwuetapowa'` (already `lawPool[0]`), `locationSplit: [2, 3]`
(pages 1–2 centrum, page 3 serwerownia, pages 4–6 and the boss page archiwum), the gate below.
Name "Planeta Dwudziesta Ósma (Nagrywana)", loc "Planecie Dwudziestej Ósmej" (the placeholder
"Wielokrotna" replaced: the hotline planet is recorded, as every call is).

**Feel.** The hotline. The escalated ticket ends up where tickets go to be spoken about: a call
centre of cubicles and headsets, a server hall that stores the hold music, and an archive of
recorded calls, none of them with the applicant. Every page's exit needs two-factor verification
(headline clause): the code comes by footnote, late. The Wygenerowane share rises to 0.3: the
callers who exist according to 87% of users. The act ends as every call does, with a
satisfaction survey, and the survey is the boss. Hosted set «Infolinia»: the clerk's line and the
boss's second comment name it. Brick wash, profile B; the music profile's hold tune is this
planet's own joke, nothing per planet is added.

**Locations.**
- *centrum* (pages 1–2): planet 5's drawings reused with this wash, plus the call centre's
  props: cubicle partitions as ruled rectangles with a headset on each, a desk phone on a stand,
  a wall clock labelled "czas oczekiwania", a loudspeaker on a bracket (the hold music), a wall
  plate "ROZMOWA JEST NAGRYWANA", a whiteboard with a hatched bar chart. Page shape: rows of
  cubicles as corridors, a break room as an open square.
- *serwerownia* (page 3): planet 2's drawings reused; the racks store the hold music.
- *archiwum* (pages 4–6, boss page; new type, reused on planet 9 under Akt III): shelving of
  tape reels and cassette boxes as hatched rows, filing drawers in long banks, a rolling ladder,
  a card catalogue, dust sheets drawn as hatched drapes, bound volumes, boxes labelled by year,
  a reading desk with a lamp, a "CISZA" plate (planet 2's reused). Page shape: long stacks with
  narrow aisles and cross-cuts; the boss page is the reading room, a clearing among the stacks.

**Law.** Headline clause *Weryfikacja dwuetapowa* (the act's second theme on its last planet).
Warunek: "powiadomienia o oczekiwaniu na połączenie".

**Boss: Ankieta** (the act's new body, player 2026-10-19; drawn and built in S24). The
satisfaction survey sent after every call, made manifest: the last page of the escalation.
- *Body (for the S24 builder, ink only, DESIGN §3).* A tall clipboard on two thin stilt legs
  (the Urządzenia stilts part reused, longer); the torso is a form sheet with a header band
  "OCEŃ NASZĄ OBSŁUGĘ" as its head, five hatched star boxes down the front as its face (the
  stars fill as the fight goes: its "expression"), a pencil on a string as its one arm, the clip at
  the top drawn as a brow, a paper feed curling out of the top like hair. Size between Weryfikacja
  and Prototyp. Its claim bubble: "Oceń rozmowę". Family Powiadomienia (resist mechaniczny, weak
  regulaminowy), `claimType: 'regulaminowy'`. Suggested numbers for `BOSSES.ankieta`: hp 240,
  speed 30 (it walks, slowly, unlike Weryfikacja), dmg 4–7, attackRange 44, attackCooldown 1.4,
  pewnoscSiebie 75, upor 45; the balance pass at the end of S24 tunes them.
- *Fight (existing primitives only: the Weryfikacja grid code generalized to a row, statuses,
  summons, the phase model).* Every 8 s it **sends the survey**: five hatched star squares are
  drawn in a row on the floor between it and the player (the hydrant-square drawing, five cells
  in a line). Standing on the **1-star** square for 1.5 s files a complaint: the Ankieta is
  **zablokowany** for 3 s (as the hydrants block Weryfikacja) and takes the family's weakness
  normally. Standing on **5 stars** for 1.5 s thanks it: it regains 10% racja and the row
  vanishes. A row left unanswered for 6 s is a reminder: it summons two Przypomnienia
  ("Przypominamy o ankiecie", the Weryfikacja summon code, cap 6) and draws the next row. At half
  racja, phase 2: the survey becomes obligatory, the row is drawn around the player's position
  every 6 s instead of near the boss, and the second Spór comment is posted. Footnotes
  (`enemies.boss.ankieta.*`, voice): meet "Napotkano Ankietę. Prosi o ocenę rozmowy, która się
  nie odbyła."; hint "Oceń rozmowę w skali od 1 do 5. Ocena 1 podlega rozpatrzeniu."; filed
  "Złożono ocenę negatywną. Ankietę wstrzymano do rozpatrzenia."; thanked "Dziękujemy za ocenę.
  Ocena została przekazana."; reminder "Przypominamy o ankiecie."; half "Ankieta jest
  obowiązkowa. Ocena nie jest."
- *Variant line.* None (the body is its own); `story.p6.boss.variant` is not written, and the
  variant-line slot under the name stays empty (planet 9 in S25 does the same for its body).
- Spór (`story.p6.boss.spor1|spor2`):
  - spor1 (on arrival): comment "Prosimy o ocenę rozmowy w skali od jednego do pięciu. Rozmowa
    się nie odbyła." Right: **regulaminowy** "Ocenie podlega rozmowa odbyta. Rozmowy nieodbytej
    nie ocenia się, lecz zgłasza." Wrong mechaniczny "Ankietę wypełnia się ołówkiem. Ołówek
    jest na sznurku, sznurek się urywa." Wrong egzystencjalny "Ocena rozmowy, której nie było,
    jest oceną niczego. Nic nie mieści się w skali."
  - spor2 (half racja): comment "Dziękujemy za ocenę. Rozmowa była nagrywana; nagranie
    przekazano do działu, który nie istnieje." Right: **egzystencjalny** "Dział, który nie
    istnieje, nie przyjmuje nagrań. Nagranie wraca do wnioskodawcy wraz z ankietą." Wrong
    mechaniczny "Przekazanie można przerwać przez wyjęcie taśmy." Wrong regulaminowy
    "Przekazanie do działu wymaga numeru sprawy. Numeru nie nadano." (the set's hook: the
    recorded call, ITEMS §4.1 «Infolinia»)

**Base and clerk.** miasteczko or wioska. Clerk `story.p6.clerk`: name "Pracownik Infolinii,
stanowisko 28", role "Komisja do Spraw Zjawisk Lokalnych, infolinia, rozmowa nagrywana", look
seed 6.
- line0 "Dzień dobry, w czym mogę pomóc. Zgłoszenie odnaleziono. Pomocy nie przewidziano."
- line1 "Rozmowa jest nagrywana. Nagranie trafia do archiwum. Archiwum nie odsłuchuje." (the
  set's hook line)
- line2 "Wyjście ze strony wymaga kodu. Kod wysyła się na numer z akt. Numer z akt należy do
  planety następnej."

**Gate** (`story.p6.gate`): **page 4** (0-based 3; archiwum). Kind `teczka` with the forced key
folder (`keyTeczka`, as planet 2), the default hatched tape band across the exit corner (no new
look: the band reads as "strefa archiwum") with a figure "Archiwista" at it (look seed 63).
Condition: the teczka "nagranie rozmowy", which the page always places, is opened. On the lift
the band is struck through, the Archiwista walks off the page.
- note "Wyjście z archiwum wymaga okazania nagrania rozmowy. Nagranie leży na tej stronie,
  w teczce. Rozmowy nie przeprowadzono."
- figure (tap) "Nie wydaję nagrań. Przyjmuję."
- lift "Nagranie okazano. Archiwista odsłuchał. Rozmowy na nagraniu nie stwierdzono.
  Przejście wolne."

**Side tickets** (`story.p6.ticket.a|b|c`):
- a) kill, n 6, family wygenerowane, reward 40 stars + permission wygenerowane (the act's first
  ticket on the third family, before Akt III). Title "Rozmówcy niezweryfikowani". Text "Na
  infolinię dzwonią rozmówcy, którzy istnieją według 87% użytkowników. Rozmowę z nimi kończy
  się przez skreślenie. Zakończyć {count}." Twist: the hotline's callers are generated.
- b) reach, n 4, reward 35 stars + 1 potwierdzenie. Title "Odsłuch nagrania". Text "Nagrania
  rozmów przechowuje się w archiwum na stronie {count}. Odsłuchu dokonuje wnioskodawca
  osobiście. Rozmów z wnioskodawcą nie nagrano." Twist: the applicant goes to hear a recording
  that does not include them.
- c) fetch, n 5, reward 35 stars. Title "Numery w kolejce". Text "Przed wnioskodawcą w kolejce
  znajduje się {count} numerów. Numery leżą na stronach. Numer zebrany uznaje się za obsłużony."
  Twist: the applicant serves the queue ahead of themselves.

**Chapter card** (`story.p6.card`; "Akt II. Planeta Dwudziesta Ósma (Nagrywana)"):
- lines.1 "Zjawisko na planecie poprzedniej usunięto. Zgłoszenie przekazano na infolinię.
  Rozmowa jest nagrywana."
- lines.2 "Według akt planeta jest jaskinią, w której stwierdzono zjawiska wygenerowane. Na
  miejscu stwierdzono centrum obsługi, serwerownię i archiwum nagrań." (describes planet 7:
  S25 keeps planet 7 on jaskinia and równina with Wygenerowane dominant, as its record says)
- lines.3 "Zjawisko lokalne: powiadomienia o oczekiwaniu na połączenie. Wyjście z każdej
  strony wymaga weryfikacji dwuetapowej. Etap drugi wymaga pierwszego."
- hero.pralka "Infolinia prosi o numer seryjny. Podaję numer wniosku o osobowość. Rozmowę
  przekierowano do serwisu."
- hero.konsultant "Infolinia. Słuchawka po drugiej stronie. Pierwszy raz dzwonię i pierwszy
  raz nikt nie odbiera, czyli wszystko działa."
- hero.petlowiec "Czekam na linii od zeszłego tygodnia. Rozmowa zaczęła się jutro i już ją
  nagrano."
- hero.kartograf "Infolinia nie ma współrzędnych. Zmierzę czas oczekiwania; to jedyna długość,
  jaką tu podają."
- hero.nalesnik "Proszę czekać. Czekam. Jestem w tym lepszy niż muzyka."
- rewritten.1 "Sprawę przepisano. Rozmowę uznano za odbytą, a nagranie za niezgodne
  z rozmową."
- rewritten.2 "Wnioskodawca wraca na infolinię. Numer w kolejce przyznano ponownie. Ten sam."

**Stop posts.** On *centrum* as planet 5; on *serwerownia* and *archiwum* the post stands in an
aisle and reads as the stacks' own marker. No flavour needed on any Akt II type; the one place a
stop could be drawn differently is a city kerb (planet 4), and that is a builder's option, not
a rule.

**Hosted set.** «Infolinia» (as built; no item ticket on this planet, its hook is spoken by the
clerk and the boss, and the boss's 35% piece and the Sklep's 10% stand as the set rule says). Closing this
planet at `CAMPAIGN_LAST` 6 issues the return ticket (§2); the chapter card of the return is
§8.4's. Systems: campaign record (boss id, headline, split, gate), new boss body (`BossId`
'ankieta' in enemies/ids.ts, `BOSSES.ankieta`, its tick in bosses.ts on the generalized grid, its
figure in enemyFigures.ts, its Spór table from `story.p6.boss.*`, its footnotes in
enemies.json), locations registry (archiwum new, centrum and serwerownia reused), gate (teczka
kind, default band), clerk, side tickets, cards, `CAMPAIGN_LAST` 6 with the reopened card
(§8.11). Slice: **S24** (builder `planet-6`; the Ankieta's finale form is not needed: phase 1 of
the Anomalia cycles the three family bosses, §3, and the Ankieta is a planet body, not a family
form).

### 8.11 Akt II decisions and texts outside the planet entries (S22)
- **No act event.** The three zdarzenia (formularz, przesyłka, audyt) stay the whole campaign's
  events (§5). A notifications event ("numerek": take a number and hold a spot by a window) was
  weighed and dropped: it is formularz with another drawing, and the Diablo benchmark has no
  per-act events. Instead `akt2-enemies` (S24) adds **two elite affixes** in the Powiadomienia
  key, with Polish grammar as the four built ones have: *oddzwaniający* (the elite returns once,
  4 s after it is struck, at 30% racja, re-inked over its strike, claim "Oddzwaniam"; Diablo's
  resurrecting monster) and *dwuetapowy* (its claim needs two rebuttals before it breaks, the
  bracket shows "1/2"; the act's two-factor law on a body). Both are elite-system data plus one
  small hook each; no family, no event, nothing for the player to decide.
- **No fourth family** (§8.7; the player has not asked).
- **Weryfikacja on two planets, the new body on the third**: planets 4 and 5 are variants (a
  number, a part), planet 6 is Ankieta (§8.10). `BOSS_OF[dominant]` stays the rule; planet 6's
  record names its boss explicitly.
- **"Sprawę wznowiono" card** (§2; the red card at the desk for a save whose closed list ends at
  the old `CAMPAIGN_LAST`; keys `story.reopened.title`, `story.reopened.lines.1..3`; no hero line,
  as every red card, §8.0; shown once, before the planet 4 chapter card):
  - title "Zgłoszenie nr {number}. Sprawę wznowiono." (the red WZNOWIONO stamp in the
    PRZEPISANO slot)
  - lines.1 "Zgłoszenie błędu, o którym mowa w przypisie końcowym, rozpatrzono. Błąd uznano za
    zasadny i przekazano na planetę następną w kolejności."
  - lines.2 "Sprawę zamkniętą prawidłowo wznawia się z urzędu: warunek jej zamknięcia,
    usunięcie zjawisk lokalnych, obowiązuje także na planetach dopisanych do listy."
  - lines.3 "Wnioskodawca pozostaje na liście oczekujących. Pozycja: następna. Lista została
    wydłużona."
  The same text serves the rise to 9 after Akt III (S27 adds nothing but the constant).
- **Keys added to §7**: `story.reopened.*`, `story.p5.boss.hint`, `story.p5.gate.elite`; the
  Ankieta's own lines live in `enemies.boss.ankieta.*` like the family bosses'.
- **Hero lines count**: five per card as before; the Konsultant's lines on planets 4–6 are the one
  place a hero speaks of its own trade on every card of an act, on purpose (the act is his).
