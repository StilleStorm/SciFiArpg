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
- `story.finale.phase1.*`, `story.finale.face.<heroId>.*`, `story.finale.phase3.*`, `story.finale.footnote`.
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
  usunięcie zjawiska lokalnego" names the phenomenon.
- **Boss**: the family boss in a planet variant (§4): variant line, two Spór comments with one
  right reply and two wrong ones each (the right type set per comment), one data change.
- **Clerk** (`NpcDef`): name as a form field title, role, three sheet lines; the look seed.
- **Side tickets**: two or three, each `{template, n, family?, reward, title, text, twist}`;
  rewards from stars / permission / potwierdzenia (the unique through S18's awizo).
- **Chapter card**: title is generated ("Akt I. Planeta Druga (Zaległa)"); three lines of the
  Asystent's summary; five hero lines; two lines for the red rewritten variant.
- **Hero lines**: one per hero per card; short, in the hero's register (SKILLS profiles).
- **Music/wash**: the act's (§4); nothing per planet unless the planet is the act's odd one.
Entries for planets 1–3 and the finale texts go under 8.1–8.4 in S11.
