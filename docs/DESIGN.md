# ZGŁOSZENIE NR 48213 — design brief

Working title: **Zgłoszenie** ("The Ticket"). A browser ARPG for one thumb on a phone, played in
Polish. The voice is Stanisław Lem's: the sober clerk who believes in the procedure
(*Dzienniki gwiazdowe*: planets with one stupid law, time loops; *Cyberiada*: constructor
robots, pompous machines, beasts that only probably exist). The **setting is today**: the
bureaucracy is no longer a ministry, it is a helpline chatbot, an app store, a paczkomat, a
cookie banner, a community-standards shadowban. Lem's register applied to 2026 life.
From the "space fantasy" tradition we take two things: classes with a hard identity, and hard
tech plus one inexplicable weird thing. Nothing else is borrowed. No clones.

This document is the source of truth for every agent working on the game. Read it whole.
Language of code, comments and docs: English. Language of the game: Polish, through i18n.

---

## 1. Pillars

1. **Diablo loop, honestly.** Kill, loot, compare, equip, level, bigger numbers, boss. It must be
   fun with the absurdity switched off.
2. **Absurdity reaches every system.** Not only the writing. Combat, loot, progression, death,
   economy, narration and the world itself each carry one absurd rule that is also a real mechanic.
3. **It looks like an annotated printout, not like a game.** Ink on paper. See §3.
4. **One thumb, in bed.** Portrait. Tap to move. Nothing requires two hands or precision.
5. **Polish first, i18n from day one.** Every string lives in a language file. Procedural text
   is grammar-aware (gender agreement).

---

## 2. Platform and controls

- Mobile browser, installable PWA, works offline after first load.
- **Orientation: landscape by default**, portrait as an option. The manifest locks landscape;
  the setting "Orientacja: pozioma / pionowa" switches the lock through the Screen Orientation
  API where the platform allows it (installed app on Android). iOS ignores orientation locks,
  so there the setting only picks the layout and the game follows how the phone is held; the
  settings line says so.
- **Steering: joystick or tap**, setting "Sterowanie: joystick / dotyk". Joystick is the
  default in landscape, tap is the default in portrait; either works in either orientation.
  - *Joystick*: floating. It appears where the thumb lands on the steering half of the screen
    (left half; mirrored for left-handed), drawn as two ink circles (base and knob) with a
    hatched dead zone. Direction steers, distance scales speed (dead zone 12%). Releasing
    stops. Auto-attack keeps working while moving.
  - *Tap*: tap on the page = walk there. Hold = keep walking toward the finger. An ink "x"
    marks the tap.
- **Auto-attack** the nearest enemy in range, always, standing or moving. The player never
  taps enemies.
- **Pads.** Three skill pads under the right thumb, drawn as circled margin notes with a word
  label. The Załączniki (inventory) pad sits bottom-left in tap mode and moves to the top
  right under the HUD in joystick mode, so the steering half stays clear. Left-handed mirror
  swaps halves and pads.
- **Landscape layout.** HUD form top-left (compact, two lines), page header (clause) top
  centre, Załączniki/update line top-right, joystick or tap area on the left half, skill pads
  bottom-right, footnotes bottom-centre on at most two lines (older ones scroll off sooner),
  the inventory and form sheets as two-column pages. **Portrait layout** stays as built: HUD
  top, pads bottom-right, Załączniki bottom-left, footnotes bottom.
- The camera shows the same world height in both orientations (about 700 units) and more
  width in landscape, so landscape is the better ARPG view; enemy entry waves are placed in
  the actual view rect.
- No pinch. No double-tap. No long menus mid-run. Walking over loot picks it up. Tapping an
  item on the ground shows its card first (not built yet).
- Must run at 60 fps on a mid-range phone with ~60 moving SVG elements. Entities are `<g>` with
  a `transform`, never rebuilt per frame. Filters on a few group nodes, never per element.

---

## 3. Visual anchor and the ban list

### 3.1 Anchor
Daniel Mróz's ink drawings for the Polish *Cyberiada* editions (spindly, assembled, hatched
contraptions with too many small parts) and 1960s–70s sci-fi paperback typography
(Microgramma/Eurostile titles, monospaced computer type), applied to **today's objects**:
a paczkomat with legs, a smart fridge, a push notification with a mouth, a captcha. The game is
a **printout of your support ticket** about the planet, annotated by hand in ink. The player
walks across its pages. Modern things drawn in a 1965 hand is the look nobody else has.

### 3.2 Rules (hard)
- **Paper, not screen.** Background is cream paper (`#f3ecd8` family, faint noise, slightly
  darker edges). Night edition: dark sepia paper (`#2a2420` family), pale ink. Never pure black,
  never pure white, never neon.
- **Ink only.** Everything on the page is stroked line art: black ink (`#1b1711`), stroke widths
  1.25–2.5 px at 1× scale. Fills only as hatching (pattern) or solid ink blots. No gradients,
  no glow, no drop shadows, no translucent fills.
- **One accent: stamp red** (`#b3261e`). Used for stamps, "skreślono", the player's own Racja
  ink, and nothing else. No second accent color.
- **Hand-drawn wobble.** One `feTurbulence` + `feDisplacementMap` filter on the world group.
  Scale 1–2. Re-seed every ~0.5 s, never per frame.
- **Things get drawn, not spawned.** An enemy appears by having its strokes drawn in
  (`stroke-dasharray`/`dashoffset`, 200–400 ms). Loot appears as a card sketched into the margin.
- **Things get crossed out, not exploded.** A dead enemy is struck through by the editor's pen
  (two quick strokes), gets a handwritten "skreślono" and fades as if erased. No particle burst.
- **Hits are ink.** A hit leaves a small ink blot that dries. A crit is a larger blot with 3–5
  splatter dots. Blots are pooled (max ~20).
- **Stamps are events.** Level up, run start, boss death, death: a rubber stamp slams onto the
  page (scale 1.4→1.0 in 120 ms, slight rotation, red, uneven coverage via mask). Stamp texts
  are modern: ZWERYFIKOWANO, ZAWIESZONO, ZAKTUALIZOWANO, ZGŁOSZENIE PRZYJĘTO.
- **UI is a printed form annotated by hand.** The HUD is a typed form: labels in monospace,
  underlined blanks, values typed in. Racja (HP) is also a hand-drawn ink line that gets struck
  through as it drops. Tooltips are footnotes at the bottom of the page, numbered. Item cards
  are plates with captions ("Ryc. 7. Pieczątka serwisowa, wariant «Odmowa»").
- **Typography.** Titles, stamps, boss names, screen headers: `Michroma` (Microgramma look,
  uppercase, tracked). HUD, labels, values, buttons, forms: `Space Mono` (regular/bold/italic).
  Narration, footnotes, item descriptions, reviews: `EB Garamond` (regular/italic/semibold).
  All bundled in `public/fonts/` (OFL). Never load fonts from a CDN. Never any sans-serif.
- **Motion is modest.** No screen shake over 2 px. No slow-motion. No chromatic aberration.
  No bloom. Camera follows with a slight lag (the page is being turned toward you).
- **Icons are drawings.** Skill buttons are small ink drawings in a circled margin note, labeled
  with a word. No icon font. No emoji anywhere, including text and commit messages.

### 3.3 Ban list (if you are about to do one of these, stop)
- Dark/black backgrounds with glowing neon lines; cyan/purple/magenta palettes; any gradient.
- Rounded "glass" cards, blur backdrops, drop shadows, hexagon HUDs, "sci-fi" bracket corners.
- Emoji. Icon fonts. Material icons. Any symbol that looks like a chat app, **even though the
  content mocks chat apps**: a notification is drawn in ink, never rendered as a real UI toast.
- Inter, Roboto, Arial, system sans. Orbitron, Audiowide, any "futuristic" display font other
  than Michroma.
- Particle bursts, bloom, lens flares, screen flashes, big camera shake.
- Progress bars with rounded ends and gradient fills. Use a struck-through ink line or a typed
  number with a hand-drawn underline.
- Generic fantasy/sci-fi naming ("Plasma Rifle of the Void"). Item names must read like a
  product listing written by a clerk who has never seen the item.
- Any text written by an AI that sounds like an AI, unless it is the Asystent speaking in
  character (§9.3), and even then in Lem's sober register, never in marketing tone.

### 3.4 How the look is verified
Every agent that touches rendering or UI runs `npm run shot` (Playwright, bundled Chromium) and
inspects the PNGs in `shots/`. The lead rejects any screenshot that violates §3.2 or §3.3.
"It works" is not done. "It looks like the annotated printout" is done.

---

## 4. World: the run

- A run = one **planet**, one **regulamin** (its terms of service, one absurd clause that is a
  real modifier), 4–6 **pages**, one **boss** on the last page. 10–15 minutes.
- **Pages.** The world is the printout of your ticket thread. Each page is a rectangular area
  (roughly 3×4 screens). Page edges are walls (the paper simply ends; walking into the edge
  nudges you back with a tiny marginal note "margines"). An exit on one edge, drawn as a folded
  corner, turns to the next page: page-turn sweep (old sheet slides away, 400 ms), new page
  drawn in. Pages are linear for now; one optional side page ("załącznik") may branch off with
  a paczkomat or the shop.
- **Obstacles** are inked: blots, coffee rings, a stapled-on note, a torn corner, a QR code
  drawn by hand (a grid of hatched squares), a sticky note. Enemies path around them.
- **Regulamin** is chosen at run start, shown as the "Akceptuję" screen (one button, you cannot
  decline; declining shows the same screen again with the note "Aby kontynuować, zaakceptuj
  regulamin."), printed as the page header of every page, and applied through the `laws`
  module. Implement at least 6:
  - *Parzystość* — "Na tej planecie wszystko występuje parami, włącznie z nieszczęściem."
    Enemies spawn in pairs. Loot drops in pairs (second is a worse "wariant").
  - *Grawitacja doradcza* — "Grawitacja ma tu charakter zalecenia." Move speed +30%, knockback
    ×3, enemies drift.
  - *Godziny konsultanta* — "Konsultant dostępny pon–pt 8–16. Poza godzinami obsługuje Cię
    bot." The run has a clock cycling every 40 s (30 s consultant, 10 s bot). During bot time
    enemies deal no damage and take none, and every player action is answered by a scripted
    bot footnote ("Rozumiem. Czy chodzi o: a) fakturę, b) dostawę, c) inne?").
  - *Czas wsteczny* — "Po 17:00 czas płyni wstecz." After 5 minutes, enemies walk backwards,
    XP is subtracted from the *next* level's requirement instead (net positive; the form says
    otherwise).
  - *Wymagana aktualizacja* — "Twoja broń wymaga aktualizacji." Weapon deals −50% damage until
    you accept the update, which drops from the first elite. The update also installs one
    unwanted feature (a random minor downside affix with a footnote "Nowość!").
  - *Nie przeszkadzać* — "Na planecie obowiązuje tryb nie przeszkadzać." Skills double the aggro
    radius (they make noise); auto-attacks are silent.
  - *Opłata serwisowa* — "Każde zwycięstwo podlega opłacie serwisowej." Every kill costs 1
    gwiazdka; loot quality +1 tier.
  - *Ciasteczka* — "Ta strona używa ciasteczek." Every page starts with a cookie banner over the
    map; "Akceptuję wszystkie" = enemies are "spersonalizowane" (+1 elite, +loot), "Tylko
    niezbędne" = fewer enemies, less loot. The banner reappears if you stand still for 30 s.
  - *Weryfikacja dwuetapowa* — "Wyjście wymaga weryfikacji dwuetapowej." The exit asks for a
    code; the code arrives as a footnote "SMS" 6–12 s after you request it; enemies keep coming.
- **Missions.** The planet picks an enemy family mix (§6), like acts in Diablo. The run start
  screen is the ticket header: ticket number, planet name (procedural, e.g. "Planeta
  Dwudziesta Trzecia (Nieprzyjemna)"), regulamin clause, dominant family, "Szacowany czas
  rozpatrzenia: 12 minut".

---

## 5. Combat

Every fight is an argument. HP is **Racja** ("being right"). Damage is an **argument**. A crit
is **argument nie do odparcia** (×2, bigger blot). Healing is **przyznanie się do błędu** (rare).
Death is **utrata racji**. Dodge is **unik od tematu**.

### 5.1 Base numbers (now)
- Three damage types, each with resist/weakness per enemy family:
  **mechaniczny** (hitting things), **regulaminowy** (terms, policies, forms, verification),
  **egzystencjalny** (doubt, arguments about whether something exists).
- Diablo-2-flavored: hit chance from **pewność siebie** (attack rating) vs **upór** (defense),
  damage ranges, resist as percent capped at 75. All formulas in `combat/damage.ts`, unit-tested.

### 5.2 Claims and rebuttals (now)
- Each enemy carries a **claim** (teza): a short text in a hand-drawn speech bubble above its
  head, and a type (one of the three). Claims are from a per-family list, e.g. a notification
  claims "Twój koszyk tęskni" (regulaminowy), a fridge claims "Wymagam aktualizacji"
  (mechaniczny), a generated beast claims "Istnieję według 87% użytkowników" (egzystencjalny).
- A hit whose damage type **matches the claim's type** is a **rebuttal**: it crits (×2) and the
  bubble is struck through. A hit of another type is **nie na temat**: normal damage, a tiny
  marginal note "nie na temat" the first time per enemy. Family resist/weakness still apply on
  top, so the clean play is: match the claim with the type the family is weak to.
- Claims rotate on elites every 8 s (the bubble is redrawn). Common enemies keep one claim.
- The player's claim: a hero has a **default type** (auto-attack) and skills of specific types,
  so matching is a choice of which button to press, not a menu.

### 5.3 Status effects as internet behaviour (now)
- **zablokowany** — stun. The enemy's drawing gets a hand-drawn padlock scribble.
- **wyciszony** — cannot use skills (player) / cannot use special (enemy). Bubble is crossed.
- **zgłoszony** — takes +30% damage for 6 s. A small red "!" is stamped on the drawing.
- **przeczytane, bez odpowiedzi** — taunt: the affected enemy chases only the taunter.
- **do weryfikacji** — slowed 50%; the enemy is drawn with a dotted outline until it "verifies".
- Each is a plain data record `{kind, remaining, source}` in `combat/status.ts`, with a single
  renderer that adds/removes one marker `<g>` per status.

### 5.4 Spór (bosses, planned for the first boss patch; design now, build later)
- At each boss phase the boss posts a **comment** (a bubble with a 1–2 line claim). Three
  **replies** appear as buttons in the margin, each with a type; one matches. A wrong reply
  costs 10% racja and a footnote "Odpowiedź nie na temat". The right reply opens a 5 s window of
  ×2 damage and strikes the comment through. Only bosses, once per phase, skippable by just
  fighting. Interfaces for this are to be left in `combat/spor.ts` as typed stubs.

### 5.5 Existence coefficient (family *Wygenerowane*, §6)
An enemy exists at `e ∈ [0.3, 1]`, changing every few seconds (flicker: stroke opacity and
dasharray follow `e`). Damage dealt to it ×e; damage it deals ×e. A hero skill or item can
"potwierdzić istnienie", setting e=1 for 4 s.

---

## 6. Enemies

Three families; a mission mixes them with one dominant. Every enemy is procedurally assembled
from drawn parts, so no two are identical, but families are recognizable at a glance.

- **Urządzenia** (smart devices; the Cyberiad contraption, today). Bodies: fridge, robot vacuum,
  smart speaker, router, printer, a paczkomat column; legs: stilts, wheels, treads, a single
  spring; heads: a camera lens, a periscope, a small screen drawn as a hatched rectangle;
  decorations: antennas, cables, a tiny "smart" label. Each has a **serial number** and one
  **factory defect** printed in a footnote on first meeting; the defect is its weakness
  ("Wada fabryczna: lewa noga zamontowana w prawo. Skutek: obraca się przy każdym trafieniu.").
  Resist regulaminowy (they do not read the terms). Weak to egzystencjalny (a device told it
  might not exist stops to think). Claims: "Wymagam aktualizacji", "Nie znaleziono sieci",
  "Dostępna nowa wersja". Boss: **Prototyp**, a device with all the parts.
- **Powiadomienia** (notifications). Push notifications with legs, an envelope with a mouth, a
  badge with a number that grows, a telegram that runs. Tiers escalate: *Przypomnienie* →
  *Ostatnia szansa* → *Twój koszyk tęskni* → *Konto zostanie usunięte*. A tier left alive for
  20 s escalates to the next (redrawn, stamp sound). Resist mechaniczny (you cannot punch a
  notification). Weak to regulaminowy (answered with a policy). Claims are their tier names.
  Boss: **Weryfikacja**, a captcha: it asks "Czy jesteś robotem?" and spawns a 3×3 grid of
  hatched squares on the floor; standing on the squares that contain "hydranty" (drawn) for 2 s
  stuns it; otherwise it summons Przypomnienia while alive.
- **Wygenerowane** (the generated ones). Cyberiad's probable beasts, today: creatures that exist
  in proportion to their likes. A dragon drawn in dotted line, a thing that is mostly legs, an
  "ewentualny" bear, a hand with seven fingers. They flicker with the existence coefficient.
  Resist egzystencjalny (used to being doubted). Weak to mechaniczny (a hit makes them real for
  a moment, which is lethal to them). Claims: "Istnieję według 87% użytkowników", "Zweryfikowane
  przez społeczność". Boss: **Hipoteza**, e=0.3 until the player stands in its drawn outline
  for 3 s to "confirm" it, after which it is e=1 and furious.

Elites carry one affix from a small list with Polish grammar (*zweryfikowany*, *sponsorowany*,
*nieuchronny*, *domniemany*) mapped to a mechanic (aura, speed, extra racja, teleport).

---

## 7. Loot and items

Slots: **broń**, **nakrycie głowy**, **odzież**, **przyrząd** (instrument/trinket),
**dokument** (a second trinket slot that only holds papers: terms, certificates, screenshots).

- **Generation.** Base item + 0–3 affixes, tiers: *zwykły*, *nietypowy*, *rzadki*, *unikatowy*
  (hand-written uniques with a story footnote). Names are generated from templates **per
  language with grammatical gender**: `base.gender` + affix forms `{m,f,n,pl}`. Never
  concatenate adjectives without agreement. Polish listing style puts the adjective *after*
  the noun: "pieczątka serwisowa", "stempel serwisowy". Modern base items: pieczątka serwisowa,
  czytnik kodów, ładowarka, kabel (różny), dongle, odkurzacz ręczny, kask kurierski, kamizelka
  odblaskowa, karta lojalnościowa, zrzut ekranu, regulamin (dokument), certyfikat (dokument).
- **Reviews (claimed vs actual).** Every non-unique item shows **opinie**: a star rating and the
  claimed stats ("4.8, 213 opinii zweryfikowanych"). Equipping starts a trial: after N kills
  (5/10/15 by tier) the **faktyczne** stats are revealed and replace the claimed ones. Most
  items are honest ±10%. 15% have bought reviews (worse), 5% are "niedoceniony" (better). A lying
  item gets the footnote "Opinie nie znalazły potwierdzenia w użytkowaniu." The Konsultant
  trials items twice as fast.
- **Compatibility.** Items of tier *rzadki* and up have one **like** and one **dislike** tag
  (tags: *papier*, *metal*, *wątpliwość*, *hałas*, *porządek*, *chaos*). Two items that like
  each other grant a small "zestaw" bonus printed as a joint footnote. Two that dislike each
  other: the newer one is **niekompatybilny** ("Ten przedmiot nie jest kompatybilny z Twoim
  urządzeniem.") and sits in the slot doing nothing until the other is removed or you buy an
  **adapter** (costs gwiazdki, a dongle drawn on the card).
- **Free version (rare affix only).** Items with the affix *w wersji darmowej* are strong, but
  after M kills the trial ends: the item keeps working at −40% and starts **showing ads**: every
  30 s a footnote advertisement appears ("Reklama: Przeglądaj planety bez ograniczeń."). Buying
  the item out (gwiazdki) removes the ads. Never a general rule.
- **Przesyłka (rare).** Some drops are not items but a **delivery notice**: the item has gone to
  the page's paczkomat. Walking to the paczkomat and tapping it requests the code; the code
  arrives as an "SMS" footnote 6–12 s later; enemies keep coming. Rare items only, max 1 per page.
- **Cards.** The inventory ("Załączniki") lists items as numbered plates with small ink drawings
  generated from the base type. Comparison with the equipped item is a two-column typed table
  with deltas handwritten in red.

---

## 8. Progression

- XP is **reputacja**. Level up triggers an **AKTUALIZACJA**: a typed changelog "Poprawki błędów
  i usprawnienia" with three **nowości** (§ 1, § 2, § 3), each a skill or stat upgrade. Pick one;
  the others are "usunięte w przyszłej wersji".
- Some entries **wymagają uprawnień**: an item (permission) that drops from a specific family.
  Without it the entry is visible but greyed and stamped "BRAK UPRAWNIEŃ".
- Once per run you may **zgłosić problem z aktualizacją**: reroll the three entries.
- Skill upgrades per hero are a short list (3 skills × 3 ranks + 6 passives). Stat upgrades:
  +racja, +pewność siebie, +upór, +resist to a type, +trial speed, +gwiazdki per kill.

---

## 9. Death, economy, narration

### 9.1 Death: one of three outcomes, chosen at random when you lose all racja
- **Zgłoszenie.** A ticket form appears: "Twoje zgłoszenie jest dla nas ważne. Szacowany czas
  oczekiwania: 4 minuty." The timer counts down absurdly (4:00 → 3:59 → 7:12 → 0:03 → done in
  ~6 real seconds). You return to base with character and items found so far; the run is
  stamped "ZAMKNIĘTO" and the planet is gone.
- **Pętla.** You return to the start of the current page with full racja, but a **copy of you**
  as you were (same gear, same skills, simplified AI) is left on that page as an enemy. Killing
  it drops one of your own items back. It argues with you via footnotes.
- **Zawieszenie.** You keep playing, shadowbanned. Stamp "ZAWIESZONO" on the HUD with the
  footnote "Przyczyna: naruszenie standardów społeczności (nie podano których)." Enemies
  ignore you (you are invisible to them) but you cannot pick up loot and deal −30% damage,
  until you find and file the appeal form, which the next elite drops. Dying again while
  suspended is a Zgłoszenie.

### 9.2 Economy (base screen between runs)
- Currency: **gwiazdki** (stars, the ratings people leave you). Dropped by enemies as small
  five-pointed scribbles.
- The **Sklep** is an app store drawn in ink. Prices are shown **without** the "opłata
  serwisowa", which is added at checkout (+20%, footnote "Cena nie zawiera opłaty serwisowej").
- The vendor **lies** about 1 in 6 items: you receive a **wariant** (different roll, same base)
  or the price differs. Revealed after purchase in a footnote; gwiazdki not refunded. A
  "Zgłoś problem" button records it; after 3 reports the store "updates" and the lie rate changes.
- **Office hours** inside a run: the Sklep exists on a page only during consultant hours (with
  the *Godziny konsultanta* clause, only during the lunch break; otherwise a fixed 2-minute
  window announced by a footnote). Outside hours a bot kiosk stands there and answers every tap
  with a scripted footnote.

### 9.3 Narration
- **Footnotes** are written by the **Asystent**, the ticket system's assistant. Sober, exact,
  and about 1 in 8 confidently **wrong** (misnames the enemy, miscounts, contradicts an earlier
  note); a later note corrects it: "Przepraszam za nieścisłość w przypisie 2." Triggers: first
  meeting of an enemy, an item picked up, a clause triggering, 40 s without a kill, a death,
  entering a page.
- **Historia zgłoszeń.** At base, past runs are listed as tickets. When the player dies, the
  entry for that run is **rewritten** on the next visit: crossed-out lines, a different outcome
  typed over, a note that the previous version was an error of the system.

---

## 10. Heroes

Four, all available from the start on a hero-select screen styled as a profile printout
("PROFIL UŻYTKOWNIKA", with a hand-drawn avatar frame and a "zweryfikowany" tick that is
crossed out). Each: 1 auto-attack type, 3 skills (typed, see §5.2), 1 passive quirk.

1. **Pralka Emancypowana** — a washing machine whose firmware update gave it opinions; it filed
   for personhood (application pending). Melee tank. Auto: mechaniczny, short, slow.
   - *Wirowanie*: AoE mechaniczny around self, pulls enemies in slightly.
   - *Pranie wstępne*: foam shield for 5 s; enemies touching it are **do weryfikacji**.
   - *Odwirowanie*: dash dragging one enemy, drops it **zablokowany**.
   - Quirk: every 10th hit on her causes a *błąd programu*: a random skill fires for free.
2. **Konsultant Infolinii** — a helpline consultant who escaped the queue. Mid-range control.
   Auto: regulaminowy, thrown ticket, medium range.
   - *Proszę czekać*: target is **zablokowany** 1.5 s; a hand-drawn hourglass over it.
   - *Przekierowuję*: cone; enemies become **zgłoszony** and attack each other for 3 s.
   - *Czy mogę jeszcze w czymś pomóc*: self buff, +crit, every kill during it drops 1 gwiazdka.
   - Quirk: trials items twice as fast; sees devices' defects immediately.
3. **Pętlowiec** — a cosmonaut who arrived before departing. Summoner. Auto: egzystencjalny, a
   pointed remark, short-medium range.
   - *Przybycie przed wyjazdem*: summon a copy of yourself from another loop for 8 s (max 2).
     Copies auto-attack and disagree with you in footnotes.
   - *Spór*: all copies argue, AoE egzystencjalny around each copy.
   - *Pętla*: teleport to where you were 3 s ago, restore the racja you had then.
   - Quirk: on death outcome *Pętla*, the copy left behind is friendly for the first 10 s.
4. **Kartograf Planet Nieistniejących** — maps worlds that the navigation app insists exist.
   Ranged. Auto: mechaniczny, surveying shot, long range, pierces on crit.
   - *Triangulacja*: line shot piercing all enemies, damage grows per enemy passed.
   - *Teren nieistniejący*: mark an area; enemies inside are **do weryfikacji** and, if
     *Wygenerowane*, their existence coefficient drops to 0.3.
   - *Korekta*: short blink to a tapped point, leaves a "błąd pomiaru" decoy with
     **przeczytane, bez odpowiedzi** on nearby enemies.
   - Quirk: the page map is revealed on entry (others see blank paper as fog).

---

## 11. i18n

- `src/i18n/` holds `pl/*.json` (source language) split by domain: `ui.json`, `items.json`,
  `enemies.json`, `heroes.json`, `laws.json`, `narration.json`, `forms.json`, `combat.json`.
  Other languages will be sibling folders. Missing keys fall back to `pl` and log once.
- `t(key, params)` with Polish plurals (one / few / many). Never pluralize with "s" in code.
- **Grammar for generated names**: a base noun carries `gender: "m" | "f" | "n" | "pl"`; an
  affix carries forms per gender. Adjective after the noun in Polish (per-language setting).
- Numbers, dates and the run clock are formatted per locale.
- English is NOT to be written now. Keys are English identifiers; values are Polish.

---

## 12. Voice guide for Polish text

Sober, official, exact, and therefore funny. The narrator (the Asystent) believes in the
procedure and has never once questioned a policy. Humor comes from applying the procedure to
the absurd, never from the text winking at the reader. No exclamation marks except in stamps and
in advertisements. No jokes that explain themselves. Short sentences. Passive voice welcome.
Vocabulary: today's service language in Lem's register — *zgłoszenie, weryfikacja, aktualizacja,
regulamin, konsultant, bot, opinie zweryfikowane, wariant, opłata serwisowa, standardy
społeczności, uprawnienia, kompatybilność, przesyłka, paczkomat, kod odbioru, szacowany czas* —
next to Lem's own: *egzemplarz, aparat, urządzenie, zjawisko, domniemany, ewentualny, kontrapcja*.

Examples of the right register (reuse the tone, not the sentences):

- Item card: „Ryc. 7. Pieczątka serwisowa, wariant «Odmowa». Stempel kauczukowy z rękojeścią.
  Deklarowana siła argumentu: 12. Opinie: 4,8 (213 zweryfikowanych). Opinie nie były
  weryfikowane.”
- Footnote: „¹ Urządzenie nr 4471-B zostało skreślone zgodnie z procedurą. Procedury nie
  odnaleziono.”
- Footnote (wrong, later corrected): „² Napotkano niedźwiedzia.” … „⁴ Przepraszam za
  nieścisłość w przypisie 2. Nie był to niedźwiedź, lecz coś, co według 87% użytkowników nim
  bywa.”
- Regulamin header: „Na Planecie Dwudziestej Trzeciej wszystko występuje parami, włącznie
  z nieszczęściem. Korzystając z planety, akceptujesz ten stan rzeczy.”
- Update form: „AKTUALIZACJA 1.4. Poprawki błędów i usprawnienia. Wybierz jedną nowość.
  Pozostałe zostaną usunięte w przyszłej wersji.”
- Enemy defect: „Wada fabryczna: lewa noga zamontowana w prawo. Podatność: obrażenia
  mechaniczne.”
- Death (zgłoszenie): „Twoje zgłoszenie jest dla nas ważne. Szacowany czas oczekiwania:
  4 minuty. Zgłaszający twierdzi, że zmarł. Zgłoszenie uznano za zasadne.”
- Incompatibility: „Przedmiot nr 14 nie jest kompatybilny z przedmiotem nr 9. Powód: hałas.
  Dostępny adapter.”
- Vendor lie revealed: „Sprostowanie: zamiast czytnika kodów wydano czytnik kodów (wariant).
  Gwiazdek nie zwraca się.”
- Bot hours: „Rozumiem. Czy chodzi o: a) fakturę, b) dostawę, c) inne?”
- Claim bubbles (short, no verbs needed): „Twój koszyk tęskni”, „Wymagam aktualizacji”,
  „Istnieję według 87% użytkowników”.

Wrong register (do not write like this): „Epicki blaster plazmowy! +50 do mocy! Zniszcz
wrogów!” — anything with exclamation marks, superlatives, or that sounds like a shop banner,
except inside an *advertisement* footnote, which is the one place marketing tone is allowed
and is funny precisely because the Asystent reads it out flatly.

---

## 13. Scope for the first playable (tonight) and backlog

### First playable, in build order (each step leaves the game runnable)
1. Scaffold, SVG renderer with paper + ink filter, loop, tap-to-move, camera, one page.
2. Four heroes, auto-attack, three skills each (typed), HUD form, status effects (§5.3).
3. Enemies: three families with procedural assembly, drawn-in spawn, crossed-out death, claims
   and rebuttals (§5.2), defects (Urządzenia), escalation (Powiadomienia), existence
   (Wygenerowane). One boss per family (Weryfikacja's captcha grid may be simplified).
4. Pages, page turn, obstacles, run structure, regulamin (6 clauses minimum), "Akceptuję" screen.
5. Loot: generation with grammar, cards, inventory, equip, reviews/trial, compatibility,
   free-version affix. Przesyłka if time allows.
6. Progression: aktualizacja with permissions and one problem report (reroll).
7. Death outcomes (3), base screen, Sklep with service fee/lies/office hours, Historia zgłoszeń,
   Asystent footnotes with wrong notes and corrections.
8. Save (localStorage), PWA, deploy to GitHub Pages, night edition toggle.

### Planned next (design is final, build after the first playable)
- Spór for bosses (§5.4).
- Przesyłka/paczkomat deliveries if not done.
- Ciasteczka and Weryfikacja dwuetapowa clauses if not in the first 6.

### Backlog
- Branching pages with side załącznik pages.
- Quests as ticket correspondence with the Asystent.
- More clauses, uniques, parts. English and other languages.
- Sound: keyboard clicks, notification ping drawn as a pen scratch, stamp thud. No music yet.
- Leaderboard as "Ranking użytkowników (nieoficjalny)".

---

## 14. Sound (phase after the first playable; design is final, build later)

Same method as the look: real anchors, a ban list, verified against them. Three sources,
mixed per stage: **A** the document's foley, **B** tape-treated hold music, **C** the page as a
punched roll. Conventional adaptive ambient is out.

### 14.1 Where each source is used
- **Menus, forms, footnotes, inventory, store, ticket, base: A only.** Quiet, dry, paper.
- **Combat: A sources with Diablo 3 weight.** A fight that is too quiet is worse than one that
  is too loud. Every combat sound is layered like an action-RPG hit: a **transient** (click,
  crack, pen snap), a **body** (a 60–140 Hz thump or a damped low pluck, 80–200 ms), and a
  **tail** (scratch debris, paper crackle, a short ring). The sources stay absurd (a pen, a
  stapler, a rubber stamp) but the mix gives them mass. Crits add a sub layer and a longer
  tail. Kills add a second, heavier stroke. Short hit-stop (40 ms) on crits and kills.
- **Music: chosen per planet by a sound profile** (see 14.4). B and C are the first two
  profiles; more come later (a heavy-metal planet is explicitly planned; its anchor and ban
  list get written when it is built, not improvised).
- **Mix:** SFX sit in front; music sits under (−10 to −14 dB relative), ducked a further 6 dB
  for 300 ms on kills and boss phases. Everything through one master limiter; nothing clips.

### 14.2 Ban list
Sawtooth or supersaw pads, big reverbs, chiptune square-wave bleeps, "sci-fi" whooshes and
risers, major/minor pop scales, four-on-the-floor loops, orchestral hits, sidechain pumping,
sample packs. No oscillator tone may be heard raw. A combat sound without a body layer.

### 14.3 SFX (all synthesized in Web Audio from noise, clicks and short plucks; no samples)
Menus and page (dry, light):
- footnote: one typewriter key; correction: carriage return "ding + zip".
- stamp (forms, confirmations): rubber stamp thud + tiny paper slap.
- loot card drawn, inventory open/close: paper slide, three quick scratches.
- page turn: a sheet lifted and laid down (two noise sweeps, 400 ms).
- page edge: a dull paper bump. Walking: nothing.
- bot hours: a hold-line beep (one telephone-band sine is the single allowed raw tone).

Combat (weighted, see 14.1):
- hit: pen scratch transient + 90 Hz thump body + scratch-debris tail.
- crit: longer scratch + sub thump (50 Hz) + blot "plop" + splatter dots as tail.
- kill: two heavy strokes (each with body) + pencil scribble tail as the figure is rubbed out.
- player hurt: a paper tear with a low body; low racja: the tear gets a faint hiss bed.
- skills: each hero has three distinct sounds from the same recipe (Pralka: drum spin, foam
  hiss, dragged box; Konsultant: hold beep stab, redirect zip, headset click; Pętlowiec: two
  overlapping remarks, a tape splice, a loop rewind; Kartograf: theodolite click-shot, dashed
  area hum, a pin pulled).
- enemy families: devices clank (metal body), notifications ping dry (damped pluck, never a
  chat-app ping), generated beasts sound like dotted lines: granular ticks with no body until
  confirmed (existence coefficient scales the body layer).
- boss: a low tape-motor hum under the whole fight; each phase a hard splice.

### 14.4 Music profiles (one per planet, chosen from the seed and the family mix)
- **Profile B: hold line.** Hold music the way the Studio Eksperymentalne Polskiego Radia
  (1958–) made tape music: loops, splices, wow and flutter, hiss, filtered noise. Framed as
  "Muzyka na czekanie, utwór nr 7". Default for Powiadomienia-dominant planets.
- **Profile C: punched roll.** The page's obstacle layout read as a piano roll (x = time, y =
  pitch class), so each page plays its own motif. Music box / barrel organ timbre
  (Karplus–Strong plucks, 2-op FM bells, slight detune), then a light tape treatment. Each
  planet picks a strange fixed scale (never major/minor). Default for Urządzenia planets.
- **Profile B+C** for Wygenerowane planets: the roll played through the hold line, with
  reversed fragments.
- **Variety inside a profile:** tempo, scale, loop length, filter band and splice rate are
  rolled from the seed, so two planets with the same profile do not sound the same.
- **Adaptation** (state → layers, crossfaded over 2–4 s), shared by all profiles:
  calm: sparse. Enemies near (>2): second voice, a fifth below, slightly late. Elite: splices
  begin, a reversed fragment every 8 bars. Boss: tempo ×1.25, hiss up, hard cut per phase.
  Bot hours: telephone band only + hold beep every 4 s. Czas wsteczny: the loop runs
  backwards. Zawieszenie: music ducked −12 dB, as if behind a door. Death: the mechanism
  slows to a stop, no sting. Page turn: a splice.
- **Planned profiles:** heavy metal (own anchor and ban list to be written), others as the
  map themes grow.

### 14.5 Implementation notes
One `AudioContext` unlocked on the first tap ("Akceptuję regulamin" is the natural unlock).
`audio/sfx.ts` (recipes as data: layers with type, frequency, envelope, gain), `audio/music/`
(profiles as modules sharing the adaptation layer), `audio/mix.ts` (buses: sfx, music, master
limiter, ducking). State in, sound out: `setState(flags)` from the run each frame; no sound
code inside game systems beyond emitting events. Everything renders from a seed with the run
rng fork 'music'. An offline render script (`npm run render-audio`) writes a 20 s WAV per
profile and state for inspection: peak and RMS levels, spectrum within band, no clipping,
every combat sound shows a body layer. Taste is judged by the player on the phone. Settings:
music and SFX volume, both persisted; defaults on.

### 12.1 Editorial rules added after the first voice pass
- Enemies are *przeciwnicy* in system text; *wrogowie* only when a form or clause is quoting
  the planet's own regulamin (the regulamin is allowed to be cruder than the Asystent).
- The death form counts every kill as *urządzenie* on purpose: the clerk generalizes.
- A form that DESIGN says lies must keep lying (e.g. *Czas wsteczny*: "reputacja ujemna").
- One-letter words (w, z, i, a, o, u) never end a line. This is a typography rule for the
  renderer (bind them to the next word in `wrapText`/`wrapClaim` and in `t()`), not for the
  JSON, so tests that pin exact text keep passing.
- Skill names are nouns or noun phrases without end punctuation, so they compose into
  "{skill}, ulepszenie {rank}". The Konsultant's question is therefore printed without "?"
  on purpose; the Asystent notes it once as a clerical omission (backlog).
