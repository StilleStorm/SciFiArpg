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
  `story.p3.gate.elite`); a new boss body's own lines are `enemies.boss.<id>.*` (planet 6, §8.10);
- added S24 (outside `story`): `screens.cards.stampReopened` "WZNOWIONO" and
  `screens.cards.kind.reopened` (the red card's stamp and kind), `enemies.elite.<id>.*` for the two
  Akt II affixes, `enemies.claim.oddzwaniam`, `enemies.claimStep.<family>.<id>.1|2` (the two-step
  bracket, built mechanically from the claim text);
- to add at S25 (voice): `story.p5.boss.solved` (a variant's solved line, §8.9, M5 review §8.12) and
  the one-word fix of `story.p6.boss.spor2.reply.egzystencjalny` (§8.12);
- added S25: `story.p7|p8|p9.*` in the same scheme (§8.13–8.15), `story.p8.gate.elite`; no
  `story.p9.boss.variant` (planet 9 has its own body) and no hint or solved override in Akt III;
  outside `story`: `enemies.elite.niepotwierdzony.*` and `enemies.elite.polubiony.*` (S26),
  `enemies.boss.wizualizacja.*` and `enemies.claim.boss.wizualizacja` (S27), §8.16.
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
(§8.8–8.11, S22; what M5 shipped and the review's rulings, §8.12), planets 7–9 and the Akt III
decisions (§8.13–8.16, S25). Planet numbers in the names run
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
  (always "II"), a rope queue on posts (centrum's `sznur`, cross-type reuse as `tasmociag` was),
  a numbered-ticket dispenser (reused), a window with a closed blind. Page shape: rooms cut by
  partitions as on planet 3, but the boss hall is the appeals counter: a long counter with the
  captcha grid in front of it. *As built (S23) and ruled at the M5 review (§8.12):* the pages are
  planet 3's biuro as it stands; the extra props are an S28 item on the shared `BIURO` spec (they
  also appear on planets 3 and 9, which is allowed as the storefront props are on planet 4); the
  wall plate "INSTANCJA DRUGA" is **dropped** (words in a drawing, and false on the other biuro
  planets); the lift's "II" is a floor, not an instance, so it stays.

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
"Zaznacz wszystkie kratki z koszykami." (a key override on the variant). *Changed at the M5
review (§8.12):* the solved line does **not** stay the family's; the shared line says "hydranty"
over a grid of carts, which is an error, not a joke. `BossVariant.solvedKey` mirrors `hintKey`
(S26, the builder who touches bosses.ts) and `story.p5.boss.solved` reads "Wszystkie koszyki
zaznaczono. Weryfikację wstrzymano." (S25 voice). Racja as the family has it (220; the one data
change is the part). Spór:
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
  pewnoscSiebie 75, upor 45; the balance pass at the end of S24 tunes them. *As built (S24):*
  hp **300** after the bot (at 240 it was the shortest boss fight of the act; now 23 s against
  planet 5's 25 s), the other numbers as suggested; the star boxes are **static** part art. The
  fill is an S28 render item (§8.12): filled stars = `floor(5 × (1 − racja/max))`, one attribute
  per frame on the figure, so the survey rates the beating it gets and dies at five stars; the
  paper feed, which reads as a chimney, is redrawn in the same item.
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
  (`enemies.boss.ankieta.*`, voiced S24; the final lines): meet "Napotkano Ankietę. Prosi o ocenę
  rozmowy, która się nie odbyła."; hint "Oceń rozmowę w skali od 1 do 5. Ocena 1 podlega
  rozpatrzeniu. Za ocenę 5 dziękujemy."; filed "Złożono ocenę negatywną. Ankietę wstrzymano do
  rozpatrzenia."; thanked "Dziękujemy za ocenę. Ocenę zaliczono na poczet racji Ankiety.";
  reminder "Przypominamy o ankiecie. Przypomnienie wysłano w dwóch egzemplarzach."; half "Ankieta
  jest obowiązkowa. Ocena nie jest." As built, the row is sent 4 s after arrival and then every 8 s
  after an answer, 135–210 units from the boss toward the player; phase 2 draws it round the
  player every 6 s; the bot never stands in a square, so its fight times are rough.
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
    istnieje, nie przyjmuje nagrań. Nagranie wraca do wnioskodawcy wraz z ankietą." (story.json
    has "do nadawcy razem z ankietą"; the M5 review rules for **wnioskodawcy**, §8.12: the sender
    of a recorded hotline call is the hotline, so "nadawca" hands the Ankieta its own win, and the
    survey following the applicant is the set's hook. S25 voice, one line.) Wrong
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
    PRZEPISANO slot; built S24 as `screens.cards.stampReopened`, kind `reopened`, shown once ahead
    of the planet 4 chapter card and never over the finale card)
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

### 8.12 Decisions at the M5 review (what Akt II fixed for Akt III; S25 reads this with §8.6–8.7)
What shipped against §8.8–8.11 is in DESIGN §4.2 "What M5 added". The rulings:
- **Planets 4–6 shipped as planned** with these deviations, all ratified: planet 4's biuro pages
  are planet 3's drawings (the second-instance props are S28, the wall plate dropped, §8.8); planet
  5's storefront props were built by S24 on the shared `MIASTO` spec and so also stand on planet 4
  (§8.9 allowed it); planet 5's set piece is rolled from the character seed when the ticket's
  reward is sent, not fixed by the builder (ITEMS §12.14); the Ankieta's racja is 300 and its face
  is static (§8.10); the bus shelter is an ordinary miasto prop, not placed by the stop.
- **Variant overrides are text, never lies.** A variant that redraws a part also overrides every
  footnote that names the part (planet 5: hint *and* solved line). `BossVariant.solvedKey` joins
  `hintKey` (S26), `story.p5.boss.solved` is written at S25. S25 applies the rule to any Akt III
  variant that spends its change on a part.
- **Elite affixes accumulate by act** (Diablo's monster modifiers do not retire between acts). The
  two Akt II affixes roll on every planet from 4 on, not 4–6 only: S26 widens `eliteIdsFor` to
  "from planet 4" (`AKT2_PLANETS` becomes a start index) and, if S25 proposes an Akt III pair in the
  Wygenerowane key, that pair rolls from planet 7 on. Bosses and their summons never roll them
  (`makeBoss` clears `elite`; kept). Named elites draw from the same pool (as built).
- **S25 keeps**: planet 7 on jaskinia + równina with Wygenerowane dominant (planet 6's card line 2
  describes it, §8.10); planet 9 reuses archiwum (the reel drawing is enlarged in S28; the
  planet-9 builder may do it when adding Akt III props to `ARCHIWUM`); planet 9's card describes
  planet 1 (§8.0); the "Sprawę wznowiono" card text serves the rise to 9 unchanged (§8.11); the
  finale lines no longer count planets ("na każdej planecie z listy", S24 voice), so S27 adds no
  finale text, only the constant and the final footnote rule of §8.6.
- **Planet 9's new body** (player, 2026-10-19): S25 chooses it as S22 chose the Ankieta (a
  recommendation, built in S27 unless the player objects before S27; alternatives weighed in the
  report), on existing primitives, no finale form, no variant line; Wygenerowane by family unless
  S25 argues for the dominant's boss family. The Ankieta's budget split held (one new body ≈ one
  builder slice with the fight on existing code), so S27 keeps the same shape.
- **Akt II difficulty** is a player question, not a text one (STATUS "Needs the player"). The
  story side is settled: nothing in §8.8–8.11 makes a planet harder or softer, and no planet entry
  will carry a number.
- **No fourth family, no act event** stays the rule for Akt III unless the player asks; at most
  one affix pair as in Akt II.

### 8.13 Planet 7: Planeta Dwudziesta Dziewiąta (Ewentualna) — Akt III
**Record** (`PLANETS[6]`): act 3; dominant Wygenerowane 0.15/0.25/0.6; law pool `czas-wsteczny`,
`parzystosc`, `nie-przeszkadzac`; base layouts lądowisko, wioska; locations jaskinia, równina;
hosted set none (first planet of the act, ITEMS §12.6); pages 5–6; boss Hipoteza. Record edits
for S26 (data only): `headline: 'nie-przeszkadzac'`, `locationSplit: 3` (pages 1–3 jaskinia,
pages 4–6 and the boss page równina). Name `planets.p7.name` "Planeta Dwudziesta Dziewiąta
(Ewentualna)", `loc` "Planecie Dwudziestej Dziewiątej" (the list number continues at 29, §8.5; the
placeholder epithet "Domniemana" is replaced: «Domniemanie» is planet 8's set and *domniemany* an
elite affix, while *ewentualny* is Lem's own word, DESIGN §12, and the family's bear already
carries it).

**Feel.** The verification. The escalation ended without an answer, and the ticket was passed to
the Komisja's wydział weryfikacji, which does not doubt the complaint; it doubts the complainant.
From here on the letters hedge: Akt I was polite, Akt II attached, Akt III writes "wnioskodawca,
o ile istnieje", "do czasu potwierdzenia", "w drodze domniemania". The first planet of the act is
the one planet 6's card described: a cave in which things exist in proportion to their likes,
drawn on the walls by something that has never seen an animal and stepping off them when enough
users agree. Above the cave is a plain the file does not mention, where nothing has been
confirmed: fences that enclose nothing, a signpost with blank arms. The clause is silence: what
is not disturbed does not have to be verified. Violet wash, profile B+C (the act's).

**Locations.**
- *jaskinia* (pages 1–3; new type, reused on planet 8): stalagmites and stalactites as hatched
  cones, boulders, a rock column, wall slabs with cave paintings in dotted line (a bison with six
  legs, a hand with seven fingers: the family's own figures as props), a rope on pitons with
  survey flags, a carbide lamp on a tripod, a ladder against a ledge, a puddle drawn as a coffee
  ring, a heap of bones assembled wrongly (a ribcage with a handle), a crystal cluster, the
  "CISZA" plate (planet 2's reused; here it is the headline clause). Page shape: chambers joined
  by narrow passages (the `rooms` layout with irregular walls; no new layout), a załącznik page
  may branch from a side chamber.
- *równina* (pages 4–6, boss page; new type, reused on planet 8): grass as hatched tufts, a row
  of fence posts that encloses nothing, a gate standing without a fence, a signpost with blank
  arms, a haystack, a well with a windlass, a scarecrow whose gloves have seven fingers, erratic
  boulders, a windsock, power poles with dotted wires, a boundary stone, a tree drawn with its
  branches meeting. Page shape: wide and sparse (the `rows` layout at a low prop count), long
  sight lines; the boss stands in the open, where its outline can be seen whole.

**Law.** Headline clause *Nie przeszkadzać* (skills make noise; the cave carries it). The pool's
`czas-wsteczny`, new to the act, rolls on later tickets here and headlines planet 9. Warunek:
"istoty wygenerowane, niepotwierdzone".

**Boss.** Hipoteza, the first time the campaign meets it as a planet boss. Variant line
`story.p7.boss.variant`: "Hipoteza, wersja robocza, uzupełniona". One data change: racja 260 → 300
(the supplements). The outline, the 0.3 and the confirmation stay the family's, so every family
footnote stays true. Spór:
- spor1 (on arrival): comment "Jestem hipotezą roboczą. Hipotezy roboczej się nie obala.
  Hipotezę roboczą się uzupełnia." Right: **mechaniczny** "Uzupełnienie wnosi się uderzeniem.
  Uderzenie jest faktem. Faktów hipoteza robocza nie przewidziała." Wrong regulaminowy
  "Uzupełnienie wymaga formularza. Formularza dla hipotez nie wydano." Wrong egzystencjalny
  "Hipoteza uzupełniona przestaje być robocza. Przestaje więc być."
- spor2 (confirmed): comment "Potwierdzono mnie. Od tej chwili wątpliwości budzi wyłącznie
  wnioskodawca." Right: **egzystencjalny** "Potwierdzenia dokonał wnioskodawca. Jeżeli
  wnioskodawca budzi wątpliwości, budzi je także potwierdzenie." Wrong mechaniczny "Wątpliwość
  usuwa się tym samym narzędziem co hipotezę." Wrong regulaminowy "Wątpliwości co do
  wnioskodawcy zgłasza się na piśmie. Pisma nie doręczono."

**Base and clerk.** lądowisko or wioska by seed. Clerk `story.p7.clerk`: name "Inspektor ds.
Weryfikacji", role "Komisja do Spraw Zjawisk Lokalnych, wydział weryfikacji, stanowisko
terenowe", look seed 7.
- line0 "Zgłoszenie przekazano do weryfikacji. Weryfikacji podlega wnioskodawca. Zgłoszenie
  wątpliwości nie budzi."
- line1 "Do czasu potwierdzenia wnioskodawcę uznaje się za ewentualnego. Wnioskodawcy
  ewentualnemu przysługują wszystkie obowiązki."
- line2 "W jaskini obowiązuje cisza. Co nie zostało zakłócone, nie wymaga weryfikacji. Proszę
  nie zakłócać."

**Gate.** None (first planet of the act, §8.6).

**Side tickets** (`story.p7.ticket.a|b|c`, ids `h:p7:a..c`):
- a) kill, n 16, family wygenerowane, reward 45 stars + permission wygenerowane. Title
  "Weryfikacja negatywna". Text "Zjawiska wygenerowane weryfikuje się przez skreślenie. Zjawisko
  skreślone uznaje się za niepotwierdzone. Innego wyniku weryfikacji nie przewidziano.
  Zweryfikować {count}." Twist: verification has one possible result.
- b) reach, n 4, reward 40 stars + 1 potwierdzenie. Title "Oględziny wyjścia". Text "Komisja
  wymaga oględzin wyjścia z jaskini, na stronie {count}. Akta wyjścia nie przewidują. Oględzin
  dokonuje się mimo to." Twist: the applicant inspects an exit the file says is not there (page 4
  is the first page of the plain).
- c) fetch, n 5, reward 35 stars. Title "Polubienia". Text "Zjawiska istnieją w stopniu zależnym
  od liczby polubień. Polubienia leżą na stronach. Zebrać {count} i złożyć w depozycie. Polubień
  wycofanych nie zwraca się." Twist: the beasts are starved administratively.

**Chapter card** (`story.p7.card`; title generated "Akt III. Planeta Dwudziesta Dziewiąta
(Ewentualna)"; lines.1 is written to follow either planet 6 directly or the "Sprawę wznowiono"
card, §8.16):
- lines.1 "Zjawiska lokalne w instancji drugiej usunięto. Zgłoszenie przekazano do weryfikacji.
  Weryfikacji podlega wnioskodawca, o ile istnieje."
- lines.2 "Według akt planetę wygenerował model, który nie widział planety. Na miejscu
  stwierdzono jaskinię zjawisk wygenerowanych i równinę nad nią." (describes planet 8)
- lines.3 "Zjawisko lokalne: istoty wygenerowane, niepotwierdzone. Na planecie obowiązuje tryb
  „nie przeszkadzać”. Weryfikację prowadzi się po cichu."
- hero.pralka "Komisja wątpi, czy istnieję. Okazuję numer seryjny i kartę gwarancyjną.
  Osobowość w toku, bęben na miejscu."
- hero.konsultant "W celu weryfikacji proszę podać datę urodzenia. Pytałem o to tysiące razy.
  Odpowiedzi nie sprawdziłem ani razu."
- hero.petlowiec "Zweryfikowano mnie jutro, z wynikiem negatywnym. Dziś jeszcze istnieję, więc
  zdążę."
- hero.kartograf "Jaskinia figuruje w aktach, równina nie. Równinę zmierzę. Akta poprawi ktoś,
  kto je widział."
- hero.nalesnik "Komisja wątpi, czy jestem. Moja wątpi od czterech miliardów lat, czy jestem
  planetą. Mam wprawę."
- rewritten.1 "Sprawę przepisano. Wnioskodawcę uznano za potwierdzonego, a potwierdzenie za
  ewentualne."
- rewritten.2 "Wnioskodawca wraca do jaskini. Zjawiska zweryfikowano negatywnie. Polubiono
  nowe."

**Stop posts.** In *jaskinia* the post stands in a chamber and reads as a survey marker; on
*równina* it is the plain's one post that points somewhere. No flavour needed.

**Hosted set.** None (first planet of the act). Systems: campaign record (headline, split),
locations registry (jaskinia and równina new, both owned by this planet's builder because planet 8
reuses them), clerk, side tickets, boss variant table (racja), cards. Slice: **S26** (builder
`planet-7`).

### 8.14 Planet 8: Planeta Trzydziesta (Wygenerowana) — Akt III
**Record** (`PLANETS[7]`): act 3; dominant Wygenerowane 0.2/0.2/0.6; law pool `czas-wsteczny`,
`grawitacja`, `oplata-serwisowa`; base layouts wioska, miasteczko; locations wyżyna, równina,
jaskinia; hosted set «Domniemanie»; pages 5–6; boss Hipoteza. Record edits for S26: `headline:
'grawitacja'`, locations reordered to `['rownina', 'jaskinia', 'wyzyna']` with `locationSplit:
[2, 4]` (pages 1–2 równina, pages 3–4 jaskinia, pages 5–6 and the boss page wyżyna), the gate
below. Name "Planeta Trzydziesta (Wygenerowana)", loc "Planecie Trzydziestej" (the placeholder
epithet kept).

**Feel.** The planet drawn by a model that has never seen a planet (§4). The list needed a planet
in this position, none had been observed, so one was generated from a spoken description, and the
wydział presumes it exists because a presumption is cheaper than an observation. The topography
shows it: the cave is entered from the plain and comes out on the highland, so the highest point
is reached by going down; gravity (the headline clause) is a recommendation because nobody
ordered it from the model. The applicant is treated the same way: admitted "w drodze
domniemania". The set «Domniemanie» is the planet's subject, a doubt held as a rule: the clerk's
line, the gate's lift and the boss's first comment name it. Violet wash, profile B+C.

**Locations.**
- *równina* (pages 1–2): planet 7's drawings reused as they stand.
- *jaskinia* (pages 3–4): planet 7's drawings reused as they stand; the gate is on its last page.
- *wyżyna* (pages 5–6, boss page; new type, owned by this planet's builder): escarpments as long
  hatched bars with gaps (the ramps), rock spires, cairns, a wooden triangulation tower, striped
  survey poles, a cable-car pylon without a cable, a weather cage on legs, a wind-bent tree, a
  box for the summit book, a bench facing nothing, and the model's errors as props: a cloud
  lying on the ground as a hatched ellipse, a flight of steps that ends in the air, a door
  standing free in its frame, a second horizon ruled across the page. Page shape: terraces (the
  `rows` layout, the rows being escarpments with gaps); the boss page is the summit, open, with
  the escarpment round its rim.
  No drawing on any Akt III type carries words that are false on another planet (§8.12).

**Law.** Headline clause *Grawitacja doradcza*. Warunek: "istoty istniejące w drodze
domniemania".

**Boss.** Hipoteza, variant line `story.p8.boss.variant`: "Hipoteza, wygenerowana ponownie,
anatomia poprawiona". One data change, spent on a part as planets 3 and 5 did: a long arm ending
in a **hand with seven fingers** (`BossVariant.arm: 'dlon'`, the family's `hand` art on an arm,
one drawing in render/enemyFigures.ts; the body stays) and attackRange 42 → 60 (planet 3's rule:
the reach is the part). Override check (§8.12): no family footnote names the hand or the reach
(`enemies.boss.hipoteza.meet` and `.confirmed` name the outline and the 0,3 only), so no
`hintKey` or `solvedKey` is registered; the planet's own Spór comments replace the family's
"dwanaście palców". Racja as the family has it (260). Spór:
- spor1 (on arrival): comment "Istnieję w drodze domniemania. Domniemanie obowiązuje do czasu
  dowodu przeciwnego. Dowodu nie przewidziano." Right: **regulaminowy** "Domniemanie obala się
  dowodem. Dowód wnosi się na miejscu, do rąk własnych. Rąk jest dość." Wrong mechaniczny
  "Domniemanie ma siedem palców. Palce się łamie." Wrong egzystencjalny "Co istnieje w drodze
  domniemania, nie istnieje żadną inną drogą. Drogę zamknięto." (the set's hook, ITEMS §4.1
  «Domniemanie»)
- spor2 (confirmed): comment "Potwierdzono mnie. Dłoń ma siedem palców. Tak mnie wygenerowano
  i tak zostaje." Right: **mechaniczny** "Palce nadliczbowe odejmuje się ręcznie. Odejmowanie
  w toku." Wrong regulaminowy "Liczbę palców reklamuje się w ciągu czternastu dni od
  wygenerowania. Termin minął." Wrong egzystencjalny "Palce, których nikt nie liczył, nie mają
  liczby."

**Base and clerk.** wioska or miasteczko by seed. Clerk `story.p8.clerk`: name "Rzeczoznawca ds.
Domniemań", role "Komisja do Spraw Zjawisk Lokalnych, wydział weryfikacji, punkt domniemań
(wygenerowany)", look seed 8.
- line0 "Planetę wygenerowano, ponieważ lista wymagała planety na tej pozycji. Model planety
  nie widział. Opisano mu ją ustnie."
- line1 "Istnienie przyjmuje się tu w drodze domniemania. Domniemanie jest tańsze od obserwacji
  i nie zależy od pogody." (the set's hook line)
- line2 "Grawitacja ma charakter zalecenia. U modelu jej nie zamówiono. Zalecamy."

**Gate** (`story.p8.gate`): **page 4** (0-based 3; jaskinia, the page whose exit comes out on the
highland). Kind `elite`, the default hatched tape band across the exit corner, with a figure
"Rachmistrz" at it (look seed 84). Condition: the page's forced named elite, titled "Użytkownik
Potwierdzający" (`story.p8.gate.elite`, as planets 3 and 5), is struck. On the lift the band is
struck through and the Rachmistrz walks off the page.
- note "Przejście wymaga głosu użytkownika potwierdzającego. Użytkownik przebywa na tej stronie.
  Głos oddaje się przez skreślenie."
- figure (tap) "Nie potwierdzam. Liczę."
- lift "Użytkownika potwierdzającego skreślono. Odsetek potwierdzających spadł do 86%. Przejście
  wolne w drodze domniemania."

**Side tickets** (`story.p8.ticket.a|b|c`; ticket a is the planet's one item ticket, §8.7,
ITEMS §12.14):
- a) deliver, n 1, reward 45 stars + item: one piece of «Domniemanie» (`reward.item: { set:
  'domniemanie' }`, rolled from the character seed when the reward is sent). Title
  "Zaświadczenie o istnieniu". Text "Komisja wymaga zaświadczenia, że wnioskodawca istnieje.
  Zaświadczenie wystawia wnioskodawca, na druku z pierwszej strony. Wynieść druk, wrócić,
  doręczyć Rzeczoznawcy ds. Domniemań. Zaświadczenie przyjmuje się w drodze domniemania." Twist:
  the applicant certifies their own existence and it is accepted as a presumption; the reward
  arrives by awizo with the paczkomat's built line.
- b) kill, n 16, family wygenerowane, reward 45 stars + permission wygenerowane. Title "Dowód
  przeciwny". Text "Domniemanie istnienia obala się dowodem przeciwnym. Dowód przeprowadza się
  na miejscu, przez skreślenie. Przeprowadzić {count}." Twist: the proof is the strike.
- c) reach, n 5, reward 40 stars + 1 potwierdzenie. Title "Punkt najwyższy". Text "Komisja
  wymaga stwierdzenia, że planeta ma górę i dół. Stwierdzenia dokonuje się w punkcie najwyższym,
  na stronie {count}. Do punktu najwyższego schodzi się przez jaskinię." Twist: the generated
  topography (page 5 is the first highland page).

**Chapter card** (`story.p8.card`; "Akt III. Planeta Trzydziesta (Wygenerowana)"):
- lines.1 "Zjawisko na planecie poprzedniej zweryfikowano negatywnie. Wnioskodawcy nie
  zweryfikowano. Zgłoszenie przekazano na planetę następną w drodze domniemania."
- lines.2 "Według akt planeta jest obserwatorium Komisji, chwilowo niedostępnym. Na miejscu
  stwierdzono planetę wygenerowaną. Na wyżynę schodzi się tu przez jaskinię." (describes
  planet 9)
- lines.3 "Zjawisko lokalne: istoty istniejące w drodze domniemania. Grawitacja ma charakter
  zalecenia. U modelu jej nie zamówiono."
- hero.pralka "Planetę wygenerowano bez instrukcji obsługi. Mnie wyprodukowano z instrukcją.
  Żadna z nas jej nie czytała."
- hero.konsultant "Model nie widział planety. Ja nie widziałem klienta. Obsługa przebiegała
  prawidłowo."
- hero.petlowiec "Planetę wygenerowano po moim przybyciu. Wcześniej stałem tu na niczym.
  Pamiętam, że było równiej."
- hero.kartograf "Planeta wygenerowana figuruje w nawigacji. Planeta z moich akt również.
  Zmierzę obie. Na razie stoję na tej."
- hero.nalesnik "Model nie widział planety i narysował kulę. Mnie by nie narysował. Płaskich nie
  ma w zbiorze uczącym."
- rewritten.1 "Sprawę przepisano. Planetę uznano za zaobserwowaną, a obserwację za domniemaną."
- rewritten.2 "Wnioskodawca wraca na wyżynę. Wyżynę wygenerowano ponownie. Jest w tym samym
  miejscu, o stronę dalej."

**Stop posts.** On *wyżyna* the post reads as a trail marker beside a cairn; on the two reused
types as planet 7.

**Hosted set.** «Domniemanie» (drops as built: boss 35%, Sklep 10%, elites by post; ticket a
pays one piece by awizo). Systems: campaign record (headline, location order and split, gate),
locations registry (wyżyna new; równina and jaskinia reused from the planet-7 builder),
clerk, side tickets (one `QuestReward.item`), boss variant table (`arm: 'dlon'` + attackRange: the
`arm` union widened in enemies/bosses.ts, one drawing in enemyFigures.ts), gate (elite kind,
default band), cards. Slice: **S26** (builder `planet-8`).

### 8.15 Planet 9: Planeta Trzydziesta Pierwsza (Niedostępna) — Akt III

(S27 voice rewrote the Wizualizacja hint and post lines: the player stands *on* the post. src/i18n/pl/enemies.json is the text of record; the drafts below are kept as the plan.)
**Record** (`PLANETS[8]`): act 3; dominant Wygenerowane 0.15/0.15/0.7; law pool `czas-wsteczny`,
`weryfikacja-dwuetapowa`, `parzystosc`, `ciasteczka`; base layouts miasteczko, lądowisko;
locations archiwum, biuro; hosted set «Awaria»; pages 6–6. Record edits for S27: `boss:
'wizualizacja'` (the act's new body, below; `BOSS_OF[dominant]` would give Hipoteza), `headline:
'czas-wsteczny'` (already `lawPool[0]`, named for clarity), `locationSplit: 3` (pages 1–3
archiwum, pages 4–6 and the boss page biuro), the gate below. Name "Planeta Trzydziesta Pierwsza
(Niedostępna)", loc "Planecie Trzydziestej Pierwszej" (the placeholder "Nieznana" replaced: the
planet is the Komisja's observatory, "chwilowo niedostępne z powodu awarii", and the applicant
is sent there all the same).

**Feel.** The Observatory (§4): the organ of the Komisja that settles by observation what
exists, and the last position on the list. It has been down since it opened. While the breakdown
lasts, observations are replaced by visualizations, which is where the generated ones come from
and why no file matches its planet: the pictures in the files were never taken, they were drawn.
The archive holds the observation records of every planet on the list and, for the first time
within reach, the applicant's own file; the office behind it is the wydział's seat, with an empty
frame on the wall. After 17:00 time runs backwards (the headline clause), and the observatory
works only after 17:00: a telescope shows what was. What the file here describes is planet 1.
The pool's two Akt I clauses (ciasteczka, parzystość) are read the same way: the observatory
applies the regulamin of the planet in its file. Hosted set «Awaria»: the clerk's line and the
boss's second comment name it. The Naleśnik's unresolved matter is shelved in this building
(his card line); the finale's Obserwatorium face (§3) is the Anomalia taking this shape, so the
telescope itself is never an enemy here. Violet wash, profile B+C.

**Locations.**
- *archiwum* (pages 1–3): planet 6's drawings reused with the violet wash (the reels read as
  observation films; the planet-9 builder may enlarge them, §8.12), plus the observatory's props
  on the shared `ARCHIWUM` spec (they will also stand on planet 6, which is allowed): glass plates
  in a rack, star charts rolled in tubes, a light table with a plate on it, an observation log
  on a lectern, a crate of lenses, an instrument under a dust sheet. No word plates.
- *biuro* (pages 4–6, boss page): planet 3's drawings reused with this wash, plus on the shared
  `BIURO` spec: a telescope on a tripod under a drape, a wall clock without digits whose hands
  are drawn twice, a drawing board with a half-drawn planet, a ladder to a dome hatch drawn as an
  arc on the floor, an empty picture frame on a wall hook. Page shape as built; the boss hall is
  the comparison room, an open room with the empty frame on its far wall.

**Law.** Headline clause *Czas wsteczny*. Warunek: "wizualizacje zastępujące obserwację".

**Boss: Wizualizacja** (the act's new body, player 2026-10-19; proposed here, drawn and built in
S27 unless the player objects first; alternatives in §8.16). The picture that stands in a file in
place of an observation: the applicant's planet as the model drew it. Polish knows the word from
developers' brochures: "wizualizacja ma charakter poglądowy".
- *Body (for the S27 builder, ink only, DESIGN §3).* A large framed picture on a three-legged
  easel (the Urządzenia stilts part reused, three legs). The frame is a double ruled rectangle
  in solid ink; inside it, in dotted line (the family's `dotted`), a planet drawn wrongly: the
  horizon runs through the disc, a ring passes in front of it on both sides, there are three
  moons of which one is square, and on top of the disc stands an oversized suburb house with a
  picket fence and a dish (planet 1's props: the picture in the file is of planet 1). A caption
  strip of hatched lines hangs under the frame on two strings. No arms, no face; it strikes by
  tipping the frame forward. Size between Hipoteza and Prototyp. Claim bubble: "Zdjęcie
  poglądowe" (`enemies.claim.boss.wizualizacja`). Family Wygenerowane (resists egzystencjalny,
  weak to mechaniczny), `claimType: 'mechaniczny'`. Suggested `BOSSES.wizualizacja`: hp 320,
  speed 34, dmg 6–9, attackRange 44, attackCooldown 1.3, pewnoscSiebie 80, upor 45; the balance
  pass at the end of S27 tunes them.
- *Fight (existing primitives only: Hipoteza's confirm circle detached from the body as the
  Ankieta's row was detached from the grid, the existence pin, the summon code with a family
  argument, zablokowany, the phase model).* Unobserved, it exists at **0,4** (pinned: hits count
  at 0.4 both ways). 4 s after arrival, and 8 s after each answer, it marks an **observation
  post** (stanowisko obserwacyjne) on the floor: a solid ink circle of `CONFIRM_R` with a
  cross-hair, 135–210 units from the boss toward the player (the Ankieta's placement). Standing
  in it 2 s is an observation: the Wizualizacja is compared with the facts, exists at 1 for 6 s
  and is **zablokowany** for the first 3. A post left unanswered for 6 s is filled in instead: it
  summons two Wygenerowane of tier 1 ("szczegóły", cap 6) and marks the next post. At half racja,
  phase 2, the instrument breaks down: every 6 s **two** posts are marked round the player, one
  solid (true) and one dotted with its cross-hair off centre (generated). 2 s in the true one
  observes as before; 2 s in the generated one confirms the picture: it regains 10% racja and
  both posts vanish. The second Spór comment is posted at the phase change. Footnotes
  (`enemies.boss.wizualizacja.*`, drafts, voiced in S27): name "Wizualizacja"; meet "Napotkano
  Wizualizację. Przedstawia planetę wnioskodawcy według akt. Ma charakter poglądowy i istnieje
  w stopniu 0,4."; hint "Wizualizację porównuje się ze stanem faktycznym ze stanowiska
  obserwacyjnego. Stanowisko wyznaczono na podłodze."; observed "Dokonano obserwacji. Stan
  faktyczny różni się od wizualizacji. Wizualizację wstrzymano."; details "Obserwacji nie
  dokonano. Wizualizację uzupełniono o szczegóły, w dwóch egzemplarzach."; half "Awaria
  przyrządu. Wyznaczono dwa stanowiska obserwacyjne. Jedno z nich wygenerowano."; false
  "Obserwacji dokonano ze stanowiska wygenerowanego. Wizualizację uznano za zgodną ze stanem
  faktycznym."
- *Variant line.* None (the body is its own, as planet 6); `story.p9.boss.variant` is not
  written. No finale form: phase 1 of the Anomalia cycles the three family bosses (§3).
- Spór (`story.p9.boss.spor1|spor2`):
  - spor1 (on arrival): comment "Przedstawiam planetę wnioskodawcy zgodnie z aktami.
    Wizualizacja ma charakter poglądowy. Stan faktyczny może się różnić." Right:
    **egzystencjalny** "Stan faktyczny nie różni się od siebie. Różni się wizualizacja. Różnicę
    zapisuje się na jej rachunek." Wrong mechaniczny "Obraz zdejmuje się ze sztalugi. Sztaluga
    ma trzy nogi, wystarczy jedna." Wrong regulaminowy "Charakter poglądowy wymaga oznaczenia
    w rogu. Oznaczenia nie umieszczono."
  - spor2 (half racja): comment "Wystąpiła awaria przyrządu. Do czasu jej usunięcia obserwację
    zastępuję ja. Przyczyny nie ustalono." Right: **regulaminowy** "Zastępstwo trwa do usunięcia
    awarii. Awaria jest zjawiskiem lokalnym. Zjawiska lokalne usuwa wnioskodawca, łącznie
    z zastępstwem." Wrong mechaniczny "Przyrząd naprawia się uderzeniem w obudowę. Obudowy nie
    zaobserwowano." Wrong egzystencjalny "Awaria bez przyczyny nie ma skutków. Wizualizacja jest
    skutkiem, więc jej nie ma." (the set's hook, ITEMS §4.1 «Awaria»: "Przyczyny nie ustalono")

**Base and clerk.** miasteczko or lądowisko by seed. Clerk `story.p9.clerk`: name "Koordynator
ds. Awarii", role "Komisja do Spraw Zjawisk Lokalnych, obserwatorium, chwilowo niedostępne",
look seed 9.
- line0 "Obserwatorium jest chwilowo niedostępne z powodu awarii. Do czasu jej usunięcia
  obserwacje zastępuje się wizualizacjami. Chwila trwa od dnia otwarcia."
- line1 "Awaria działa prawidłowo. Przyczyny nie ustalono, ponieważ ustalenie wymaga
  obserwacji." (the set's hook line)
- line2 "Akta wnioskodawcy leżą w archiwum. Proszę nie porównywać ich z planetą. Do porównań
  służy obserwatorium."

**Gate** (`story.p9.gate`): **page 3** (0-based 2; archiwum, the last page before the office).
Kind `teczka` with the forced key folder (`keyTeczka`, as planets 2 and 6), the default hatched
tape band with a figure "Dyżurny" at it (look seed 93). Condition: the teczka "akta
wnioskodawcy", which the page always places, is opened: the one time in the campaign the
applicant holds the file. The lift says what it describes and draws no conclusion; the conclusion
is the final footnote's (§8.4).
- note "Wyjście z archiwum wymaga okazania akt wnioskodawcy. Akta leżą na tej stronie,
  w teczce. Wnioskodawca nie miał dotąd do nich wglądu."
- figure (tap) "Awarii nie usuwam. Dyżuruję."
- lift "Akta okazano. Opisują przedmieście z urządzeniami. Na miejscu stwierdzono archiwum.
  Niezgodność odnotowano po raz dziewiąty. Przejście wolne."

**Side tickets** (`story.p9.ticket.a|b|c`; no item ticket, as planet 6):
- a) kill, n 18, family wygenerowane, reward 50 stars + permission wygenerowane. Title
  "Skutki awarii". Text "Na czas awarii obserwacje zastąpiono wizualizacjami. Wizualizacje
  opuściły akta. Usunąć {count}. Usunięcie skutków nie jest usunięciem awarii."
  Twist: the applicant removes consequences; the cause stays unestablished.
- b) reach, n 4, reward 40 stars + 1 potwierdzenie. Title "Zgłoszenie awarii". Text "Awarię
  zgłasza się osobiście w biurze obserwatorium, na stronie {count}. Zgłoszenia awarii przyjmuje
  się po jej usunięciu." Twist: the report is accepted once there is nothing to report.
- c) fetch, n 6, reward 40 stars. Title "Klisze". Text "Obserwacje sprzed awarii utrwalono na
  kliszach. Klisze rozłożono na stronach do wyschnięcia. Zebrać {count}. Wszystkie przedstawiają
  pierwszą planetę z listy. Innych nie obserwowano." Twist: the only planet ever really observed
  is planet 1 (the spine, planted as §8.1 ticket b planted the luggage).

**Chapter card** (`story.p9.card`; "Akt III. Planeta Trzydziesta Pierwsza (Niedostępna)"):
- lines.1 "Zjawisko na planecie poprzedniej usunięto. Wnioskodawcę przyjęto w drodze domniemania
  i skierowano na ostatnią planetę z listy. Planeta jest chwilowo niedostępna."
- lines.2 "Według akt planeta jest spokojnym przedmieściem z urządzeniami. Na miejscu
  stwierdzono obserwatorium Komisji w stanie awarii." (describes planet 1, §8.0)
- lines.3 "Zjawisko lokalne: wizualizacje zastępujące obserwację. Po 17:00 czas płynie wstecz.
  Obserwatorium pracuje wyłącznie po 17:00."
- hero.pralka "Awaria. Procedurę znam: wyłączyć, odczekać, włączyć. Obserwatorium nie ma
  wyłącznika. Ja mam i nie pozwalam go dotykać."
- hero.konsultant "Z powodu awarii czas oczekiwania może się wydłużyć. Czytałem to z kartki
  codziennie. Awarii wtedy nie było."
- hero.petlowiec "Po siedemnastej czas płynie wstecz. U mnie od rana. Pierwszy raz jestem zgodny
  z regulaminem."
- hero.kartograf "W archiwum leżą akta wszystkich planet z listy. Każdy opis pasuje do planety
  sąsiedniej. Błąd jest stały, więc nie jest błędem pomiaru."
- hero.nalesnik "Obserwatorium. Tu odłożono mój wniosek. Leży na półce, której teleskop nie
  obejmuje."
- rewritten.1 "Sprawę przepisano. Awarię uznano za usuniętą, a obserwatorium za dostępne
  w godzinach, które minęły."
- rewritten.2 "Wnioskodawca wraca do archiwum. Akta leżą na miejscu. Opis nadal dotyczy planety
  pierwszej."

**Stop posts.** On *archiwum* and *biuro* as planets 6 and 4.

**Hosted set.** «Awaria» (as built; its hook is spoken by the clerk, the gate figure and the
boss). Closing this planet at `CAMPAIGN_LAST` 9 issues the return ticket (§2); the return's card
is §8.4's, unchanged. Systems: campaign record (boss id, headline, split, gate), new boss body
(`BossId` 'wizualizacja' in enemies/ids.ts with `BOSS_FAMILY` wygenerowane, `BOSSES.wizualizacja`,
its tick in bosses.ts on the detached confirm circle, its figure in partsBosses.ts and
enemyFigures.ts, its Spór table from `story.p9.boss.*`, its footnotes and claim in enemies.json),
locations registry (both types reused, props added to the shared specs), gate (teczka kind,
default band), clerk, side tickets, cards, `CAMPAIGN_LAST` 9. Slice: **S27** (builder
`planet-9`).

### 8.16 Akt III decisions and texts outside the planet entries (S25)
- **Planet 9's body: Wizualizacja** (recommended; §8.15). Weighed and not recommended:
  *Wnioskodawca wzorcowy* (a generated applicant that matches the file; Diablo 3 fought a shadow
  of the hero, but here it would spend the finale's hero-specific face, §3, one planet early, and
  needs five drawings or a composite); *Akta* (the file itself as a body; the final footnote
  needs the file intact and correct "o jedną pozycję dalej", so the applicant must not strike
  it); *Społeczność* (the 87% as a crowd whose existence follows the number of living summons;
  the reward runs backwards, since striking the adds makes the boss harder to hurt, and the bot
  would stall); an Urządzenia *Teleskop* (the Obserwatorium is the Naleśnik's face). The player
  may object before S27 starts; planet 9's entry is otherwise independent of the choice except
  the two Spór comments and the body's lines.
- **Hipoteza on two planets, the new body on the third**, as Akt II did with Weryfikacja: planet
  7 a number (racja 300), planet 8 a part (the seven-fingered arm, reach 60), planet 9
  Wizualizacja. `BOSS_OF[dominant]` stays the rule; planet 9's record names its boss.
- **No act event, no fourth family** (§8.12; the player has not asked). The act's theme,
  existence and likes (§4), is carried by the family's coefficient, the two affixes below and the
  two bosses; it gets **no new clause**. The three headline clauses come from the pools as they
  stand (Nie przeszkadzać, Grawitacja doradcza, Czas wsteczny); a clause about likes would be a
  builder item and nothing in the act waits for it.
- **One pair of elite affixes in the Wygenerowane key**, rolling from planet 7 on (pools
  accumulate, §8.12), elite-system data plus one small hook each, never on bosses or their
  summons, not shared with pack minions:
  - *niepotwierdzony* (m niepotwierdzony, f niepotwierdzona, n and pl niepotwierdzone): every
    6 s it stops being confirmed and for 2 s exists at 0.3 (the existence pin on any family's
    body: hits count at 0.3 both ways; a hero's "potwierdzić istnienie" overrides it). Diablo 3's
    shielding monster. Effect line `enemies.elite.niepotwierdzony.effect`: "Co sześć sekund
    traci potwierdzenie i przez dwie sekundy istnieje w stopniu 0,3. Trafienia, zadane i
    przyjęte, także." (S26 voice: no gendered word, every family's noun reads it)
  - *polubiony* (m polubiony, f polubiona, n and pl polubione): it takes 10% less damage for
    every other living enemy within 200 units, 40% at most (the damage hook beside *poufny*):
    strike the audience first. Diablo's pack that shields its leader. Effect line
    `enemies.elite.polubiony.effect`: "Za każdego innego przeciwnika w pobliżu przyjmuje o 10%
    mniej obrażeń, najwyżej o 40%. Oglądalność ma działanie ochronne." (S26 voice)
- **Gates**: planet 7 none; planet 8 an elite gate at the default band (cave page 4, "Użytkownik
  Potwierdzający", figure Rachmistrz); planet 9 a teczka gate at the default band (archive page
  3, "akta wnioskodawcy", figure Dyżurny). No new gate kind and no new gate look.
- **`CAMPAIGN_LAST` 9, the cards.** Nothing new is written. "Sprawę wznowiono" (`story.reopened.*`,
  §8.11) serves a case closed at 3 or at 6 unchanged, shown once ahead of the planet 7 chapter
  card; planet 7's lines.1 reads correctly after it and after planet 6. The return card
  (`story.finale.card.*`) and every finale line stand (they count no planets, §8.12), and the
  final footnote stays the 235-character text (§8.6). Recommendation on the open STATUS question:
  the red return card is shown **once per `CAMPAIGN_LAST`**, so a case reopened from a shorter
  campaign sees it again before its second return (a two-line change where `cards.finale` is
  remembered, S27); the player decides.
- **The file in the archive** (planet 9's gate) and the Kartograf's planet-9 line are the last
  plants before the finale; neither names the shift or Asystent 0.9. The reveal stays the final
  footnote's.
- **Hero lines**: five per card as before. Akt III belongs to no hero's trade; instead three
  lines point at the hero's finale face (§3): the Naleśnik's shelved application on planet 9, the
  Kartograf's two planets in the navigation on planet 8, the Pralka's switch on planet 9.
- **Zgłoszenia dodatkowe after Akt III** (texts in S27, STORY §5): the act gives the Komisja's
  case against the applicant its subject without new story: the case concerns whether the
  applicant exists, and every extra is one more observation in it. A direction for the S27 voice
  pass, not a text.
- **Keys added to §7**: `story.p7|p8|p9.*` in the p4–p6 scheme, `story.p8.gate.elite`;
  no `story.p9.boss.variant`, no hint or solved override on planets 7–9; outside `story`:
  `enemies.elite.niepotwierdzony.*`, `enemies.elite.polubiony.*` (S26), `enemies.boss.wizualizacja.*`
  and `enemies.claim.boss.wizualizacja` (S27).
- **For the S25 voice pass, besides planets 7–9**: write `story.p5.boss.solved` "Wszystkie
  koszyki zaznaczono. Weryfikację wstrzymano." and change
  `story.p6.boss.spor2.reply.egzystencjalny` to end "Nagranie wraca do wnioskodawcy wraz
  z ankietą." (§8.9, §8.10, §8.12); replace `planets.p7–p9` in place and drop the file's `_todo`.
