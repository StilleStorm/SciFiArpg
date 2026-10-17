# SPRAWOZDANIE Z EKSPEDYCJI — design brief

Working title: **Sprawozdanie** ("The Report"). A browser ARPG for one thumb on a phone,
played in Polish, written in the spirit of Stanisław Lem's *Dzienniki gwiazdowe* (bureaucratic
absurdity, planets with one stupid law, time loops) and *Cyberiada* (constructor robots,
pompous machine kingdoms, probabilistic beasts). Setting takes two things from the
"space fantasy" tradition (Starfinder-ish): classes with a hard identity, and hard tech plus one
inexplicable weird thing. Nothing else is borrowed. No clones.

This document is the source of truth for every agent working on the game. Read it whole.
Language of code, comments and docs: English. Language of the game: Polish, through i18n.

---

## 1. Pillars

1. **Diablo loop, honestly.** Kill, loot, compare, equip, level, bigger numbers, boss. It must be
   fun with the absurdity switched off.
2. **Absurdity reaches every system.** Not only the writing. Combat, loot, progression, death,
   economy, narration and the world itself each carry one absurd rule that is also a real mechanic.
3. **It looks like a book, not like a game.** Ink on paper. See §3. This is the pillar most at risk.
4. **One thumb, in bed.** Portrait. Tap to move. Nothing requires two hands or precision.
5. **Polish first, i18n from day one.** Every string lives in a language file. Procedural text
   is grammar-aware (gender agreement).

---

## 2. Platform and controls

- Mobile browser, portrait, installable PWA, works offline after first load.
- Tap on the page = walk there. Hold = keep walking toward the finger.
- Auto-attack the nearest enemy in range when standing still or when an enemy is adjacent.
- Three skill buttons at the bottom right, reachable by the right thumb. A fourth button
  bottom left opens the inventory (the "Załączniki" sheet). Left-handed mirror in settings.
- Walking over loot picks it up. Tapping an item on the ground shows its plate first.
- No virtual joystick. No pinch. No double-tap. No long menus mid-run.
- Must run at 60 fps on a mid-range phone with ~60 moving SVG elements. Keep the DOM small:
  entities are `<g>` with a `transform`, never rebuilt per frame. Filters are applied to a few
  group nodes, never per element.

---

## 3. Visual anchor and the ban list

### 3.1 Anchor
Polish Lem editions of the 1960s–70s: Daniel Mróz's ink drawings for *Cyberiada* (spindly,
assembled, hatched contraptions with too many small parts), typewritten expedition reports,
rubber stamps, footnotes, numbered plates ("Ryc. 14"), marginal notes, paper that has been
handled. The game is the **report** of the expedition. The player is literally walking across
its pages.

### 3.2 Rules (hard)
- **Paper, not screen.** Background is cream paper (`#f3ecd8` family, with faint noise and
  slightly darker edges). Night edition: dark sepia paper (`#2a2420` family), pale ink. Never
  pure black, never pure white, never neon.
- **Ink only.** Everything on the page is stroked line art: black ink (`#1b1711`), stroke
  widths 1.25–2.5 px at 1× scale. Fills are allowed only as hatching (pattern) or as solid ink
  blots. No gradients. No glow. No drop shadows. No alpha-blended transparent fills.
- **One accent: stamp red** (`#b3261e`, slightly desaturated when "dried"). Used for stamps,
  "skreślono", the player's own HP ink, and nothing else. No second accent color.
- **Hand-drawn wobble.** A single `feTurbulence` + `feDisplacementMap` filter on the world group
  makes strokes waver like a pen. Keep scale small (1–2). Re-seed the turbulence slowly
  (every ~0.5 s), never per frame.
- **Things get drawn, not spawned.** An enemy appears by having its strokes drawn in
  (`stroke-dasharray` / `stroke-dashoffset` animation, 200–400 ms). Loot appears as a plate
  sketched into the margin.
- **Things get crossed out, not exploded.** A dead enemy is struck through by the editor's pen
  (two quick strokes), gets a handwritten "skreślono" and fades as if erased. No particle burst.
- **Hits are ink.** A hit leaves a small ink blot that dries (darkens then stays, pooled blots are
  cleaned up after ~20). A critical hit is a larger blot with a splatter of 3–5 dots.
- **Stamps are events.** Level up, run start, boss death, death: a rubber stamp slams onto the
  page (scale 1.4→1.0 in 120 ms, slight rotation, red, with uneven ink coverage via a mask).
- **UI is a form.** The HUD is a filled-in form: typewritten labels, underlined blanks, values
  typed in. HP is "Racja", XP is "Staż", currency is "Znaczki". Tooltips are footnotes at the
  bottom of the page, numbered. Item cards are plates with captions ("Ryc. 7. Pieczątka
  służbowa, model «Odmowa»").
- **Typography.** UI/labels/values: `Special Elite` (typewriter). Narration, footnotes, item
  descriptions: `EB Garamond` (regular, italic, semibold). Both are bundled locally in
  `public/fonts/` (OFL). Never load fonts from a CDN. Never use a sans-serif anywhere.
- **Motion is modest.** No screen shake larger than 2 px. No slow-motion. No chromatic
  aberration. No bloom. Camera moves with a slight lag (the page is being turned toward you).
- **Icons are drawings.** Skill buttons are small ink drawings in a circled margin note, labeled
  with a word. No icon font. No emoji anywhere, including in text and in commit messages.

### 3.3 Ban list (if you are about to do one of these, stop)
- Dark/black backgrounds with glowing neon lines; cyan/purple/magenta palettes; any gradient.
- Rounded "glass" cards, blur backdrops, drop shadows, hexagon HUDs, "sci-fi" bracket corners.
- Emoji. Icon fonts. Material icons. Any symbol that looks like a chat app.
- Inter, Roboto, Arial, system sans. Orbitron, Audiowide, any "futuristic" display font.
- Particle bursts, bloom, lens flares, screen flashes, big camera shake.
- Progress bars with rounded ends and gradient fills. Use an inked line that gets struck through
  or a typewritten number with a hand-drawn underline.
- Generic fantasy/sci-fi naming ("Plasma Rifle of the Void"). Item names must read like a 1965
  Polish catalogue entry written by a clerk who has never seen the item.
- Any text written by an AI that sounds like an AI. See §10 voice guide.

### 3.4 How the look is verified
Every agent that touches rendering or UI runs `npm run shot` (Playwright, bundled Chromium)
and inspects the PNGs in `shots/`. The reviewer (lead) rejects any screenshot that violates
§3.2 or §3.3. "It works" is not done. "It looks like the book" is done.

---

## 4. World: the run

- A run = one **planet**, one **law**, 4–6 **pages**, one **boss** on the last page. 10–15 minutes.
- **Pages.** The world is the report. Each page is a rectangular area (roughly 3×4 screens).
  Page edges are walls (the paper simply ends; walking into the edge nudges the character back
  with a tiny marginal note "margines"). An exit on one edge, drawn as a folded page corner,
  turns to the next page: the camera does a page-turn sweep (the old page slides away like a
  sheet, 400 ms), the new page is drawn in. Pages are linear for now; one optional side page
  ("przypis", footnote page) may branch off with a chest or the shop.
- **Obstacles** are inked: blots, coffee rings, a stapled-on note, a torn corner, scribbles.
  Enemies path around them.
- **Planet law** is chosen at run start, printed as the page header of every page, and is a
  real modifier applied through the `laws` module. Initial set (implement at least 6):
  - *Parzystość* — "Na tej planecie wszystko występuje parami, włącznie z nieszczęściem."
    Enemies spawn in pairs. Loot drops in pairs (second item is a worse copy).
  - *Grawitacja doradcza* — "Grawitacja ma tu charakter zalecenia." Move speed +30%, all
    knockback ×3, enemies drift.
  - *Godziny urzędowe* — "Walka odbywa się w godzinach 8–16. Poza nimi prosimy nie umierać."
    The run has a clock; outside hours enemies stand still and are immune, and so are you.
    Hours cycle every 40 s (30 s open, 10 s closed). Shop appears during a lunch break.
  - *Czas wsteczny* — "Po 17:00 czas płynie wstecz." After 5 minutes, enemies walk backwards,
    XP earned is subtracted from the *next* level's requirement instead (net positive, but the
    form says otherwise).
  - *Rejestracja broni* — "Broń niezarejestrowana strzela papierem." Your weapon deals
    bureaucratic damage until you find and file the registration form (drops from first elite).
  - *Cisza nocna* — "Obowiązuje cisza nocna. Hałas podlega karze." Skills double the aggro
    radius; auto-attacks are silent.
  - *Podatek od zwycięstw* — "Każde zwycięstwo podlega opodatkowaniu." Every kill costs 1
    stamp; loot quality +1 tier.
- **Missions.** The planet also picks an enemy family mix (see §6), like acts in Diablo.
  Run start screen is a travel order: planet name (procedural, e.g. "Planeta Dwudziesta
  Trzecia (Nieprzyjemna)"), law, dominant family, expected reward.

---

## 5. Combat

- Base: three damage types, each with resist/weakness per enemy family.
  - **mechaniczny** (hitting things)
  - **biurokratyczny** (forms, stamps, citations)
  - **filozoficzny** (arguments, doubt, existence)
- Vocabulary layer (everywhere in UI): HP is **Racja** ("being right"). Damage is an
  **argument**. A crit is **argument nie do odparcia** (×2, bigger blot). Healing is
  **przyznanie się do błędu**. Death is **utrata racji**. Dodge is **unik od tematu**.
- Numbers: Diablo-2-flavored. Attack rating vs defense ("pewność siebie" vs "upór"), damage
  ranges, resist as percent capped at 75. Keep formulas in one file (`combat/damage.ts`),
  unit-tested.
- Existence coefficient (family *Przypuszczalne*, §6): an enemy exists at `e ∈ [0.3, 1]`,
  changing every few seconds (it flickers: stroke opacity and stroke-dasharray follow `e`).
  Damage dealt to it ×e. Damage it deals ×e. A hero skill or an item can "stwierdzić istnienie",
  setting e=1 for 4 s.

---

## 6. Enemies

Three families; a mission mixes them with one dominant. Every enemy is procedurally assembled
from drawn parts, so no two are identical, but families are recognizable at a glance.

- **Kontrapcje** (contraptions). Mróz machines: a body (drum, box, kettle, bell), legs (stilts,
  wheels, treads, a single pogo spring), a head (funnel, periscope, lamp, a smaller kettle),
  decorations (rivets, gauges, a small flag, an antenna with a sock). Each has a **serial
  number** and one **factory defect**, printed in a footnote on first meeting: the defect is its
  weakness ("Wada fabryczna: lewa noga zamontowana w prawo. Skutek: obraca się przy
  każdym trafieniu."). Resist biurokratyczny (they do not read). Weak to filozoficzny (a machine
  told it might not exist stops to think). Boss: **Prototyp**, a contraption with all parts.
- **Korespondencja** (correspondence). Hostile letters, envelopes with legs, a stapler,
  a telegram that runs. Tiers escalate: *Monit* → *Upomnienie* → *Wezwanie* → *Nakaz*. A tier
  left alive for 20 s escalates to the next (drawn-in upgrade, stamp sound). Resist
  mechaniczny (paper absorbs blows). Weak to biurokratyczny (answered with a form). Boss:
  **Kontrola**, which summons Monity while alive.
- **Przypuszczalne** (the probable ones). Cyberiad side. Beasts that only probably exist:
  a dragon drawn in dotted line, a thing that is mostly legs, an "ewentualny" (eventual) bear.
  They flicker with the existence coefficient. Resist filozoficzny (used to being doubted).
  Weak to mechaniczny (a hit makes them real for a moment, which is lethal to them). Boss:
  **Hipoteza**, which exists at e=0.3 until the player "confirms" it by standing in its
  drawn outline for 3 s, after which it is e=1 and furious.

Elites carry one affix from a small list with Polish grammar (e.g. *urzędowy*, *nieuchronny*,
*domniemany*) that maps to a mechanic (aura, speed, extra HP, teleport).

---

## 7. Loot and items

Slots: **broń** (weapon), **nakrycie głowy**, **odzież**, **przyrząd** (instrument/trinket),
**dokument** (document; a second trinket slot that only holds papers).

- **Generation.** Base item + 0–3 affixes, Diablo-style tiers: *zwykły*, *nietypowy*,
  *rzadki*, *unikatowy* (hand-written unique items with a story footnote). Names are generated
  from templates **per language with grammatical gender**: `base.gender` + affix forms
  `{m,f,n,pl}`. Never concatenate adjectives without agreement. Example: *pieczątka* (f) +
  *biurokratyczny* → "pieczątka biurokratyczna"; *stempel* (m) → "stempel biurokratyczny".
- **Audit (claimed vs actual).** Every non-unique item shows **deklarowane** stats on drop.
  Equipping it starts an audit: after N kills (N by tier: 5/10/15) the **faktyczne** stats are
  revealed and replace the claimed ones. Most items are honest ±10%. Some lie: 15% overclaim
  (worse), 5% underclaim (better, "skromny"). A lying item gets the footnote "Deklaracja
  producenta nie znalazła potwierdzenia." The Rewident audits twice as fast.
- **Opinions.** Items of tier *rzadki* and up have one **like** and one **dislike** tag
  (tags: *papier*, *metal*, *doubt*, *hałas*, *porządek*, *chaos*). Equipping two items that
  like each other grants a small "przyjaźń" bonus printed as a joint footnote. Equipping two
  that dislike each other: the newer one **refuses** ("Przedmiot odmawia współpracy z
  przedmiotem nr 14.") and sits in the slot doing nothing until the other is removed or you
  file a *zgoda na współpracę* (costs stamps).
- **Warranty (rare item type only).** Items with the affix *z gwarancją* are strong but the
  warranty expires after M kills, at which point the item **becomes a different item** of the
  same slot (re-rolled, usually worse, with the footnote "Gwarancja wygasła. Przedmiot
  przeistoczył się zgodnie z regulaminem."). Never a general rule.
- **Plates.** The inventory ("Załączniki") lists items as numbered plates with small ink
  drawings generated from the base type (a weapon is drawn, not iconed). Comparison with the
  equipped item is a two-column typewritten table with deltas written by hand in red.

---

## 8. Progression

- XP is **staż** (seniority). Level up opens **WNIOSEK O AWANS**: a typewritten form with three
  **paragraphs** (§ 1, § 2, § 3), each a skill or stat upgrade. Pick one; the others are
  "zarchiwizowane i zapomniane".
- Some paragraphs require an **attachment** (załącznik), an item that drops from a specific
  family. Without it the paragraph is visible but greyed and stamped "BRAK ZAŁĄCZNIKA".
- Once per run you may file an **odwołanie** (appeal): reroll the three paragraphs.
- Skill upgrades per hero are a short list (3 skills × 3 ranks + 6 passives). Stat upgrades:
  +racja, +pewność siebie, +upór, +resist to a type, +audit speed, +stamps per kill.

---

## 9. Death, economy, narration

### 9.1 Death: one of three outcomes, chosen at random when you lose all racja
- **Reklamacja.** Form appears, you "file" it, you return to base with character and items
  found so far; the run is stamped "UNIEWAŻNIONO" and the planet is gone.
- **Pętla.** You return to the start of the current page with full racja, but a **copy of you**
  as you were (same gear, same skills, simplified AI) is left on that page as an enemy. Killing
  it drops one of your own items back. It argues with you via footnotes.
- **Błąd administracyjny.** You keep playing, dead. Status "ZMARŁY" is stamped on the HUD;
  you cannot pick up loot (the dead have no pockets) and deal −30% damage until you find and
  file the correction form, which the next elite drops. Dying again while dead is a reklamacja.

### 9.2 Economy (base screen between runs)
- Currency: **znaczki skarbowe** (stamp duty). Dropped by enemies as small stamps.
- The **Kiosk** (vendor) prices items in **forms**, not numbers: "Cena: 1 formularz A-7,
  2 załączniki." Forms are bought with stamps at fixed, honest rates on a price list.
- The vendor **lies** about 1 in 6 items: the displayed price or the displayed item differs from
  what you get. The lie is revealed after purchase in a footnote, and your stamps are not
  refunded. A "Księga skarg" (complaint book) button records it; after 3 complaints the vendor
  is replaced by a new one with a different lie rate.
- **Office hours** inside a run: the kiosk exists on a page only during the planet's hours
  (if the law is *Godziny urzędowe*, only during the lunch break; otherwise during a fixed
  2-minute window announced by a footnote).

### 9.3 Narration
- **Footnotes.** A footnote area at the bottom of the page shows numbered notes from the
  author of the report. They comment on what just happened (first meeting of an enemy, an
  item picked up, a law triggering, a long time without a kill). About 1 in 8 is **wrong**
  (misnames the enemy, miscounts, contradicts an earlier note) and a later note corrects it.
- **Expedition log.** At base, the log lists past runs as report entries. When the player dies
  in a run, the entry for that run is **rewritten** on the next visit: crossed-out lines, a
  different outcome typed over, a note that the previous version was a clerical error.

---

## 10. Heroes

Four, all available from the start on a hero-select page styled as a personnel file
("AKTA OSOBOWE"). Each: 1 auto-attack type, 3 skills, 1 passive quirk.

1. **Pralka Emancypowana** — a washing machine that evolved beyond its warranty and filed for
   personhood (application pending). Melee tank. Auto-attack: mechaniczny, short range, slow.
   - *Wirowanie*: spin, AoE mechaniczny around self, pulls nearby enemies in slightly.
   - *Pranie wstępne*: foam shield absorbing damage for 5 s, soaks enemies who touch it (slow).
   - *Odwirowanie*: dash, drags one enemy along, drops it stunned.
   - Quirk: every 10th hit on her causes a *program error*: a random skill fires for free.
2. **Rewident Zaoczny** — correspondence auditor of the Cosmic Chamber of Accounts. Mid-range
   control. Auto-attack: biurokratyczny, thrown stamp, medium range.
   - *Odrzucono*: stamp a target, stun 1.5 s, red stamp on the enemy's drawing.
   - *Do poprawy*: cone, enemies lose 25% resist to all types for 6 s.
   - *Zatwierdzono*: self buff, +crit, every kill during it drops 1 stamp.
   - Quirk: audits items twice as fast; sees "faktyczne" stats of enemies' defects immediately.
3. **Pętlowiec** — a cosmonaut who arrived before departing. Summoner. Auto-attack:
   filozoficzny, a pointed remark, short-medium range.
   - *Przybycie przed wyjazdem*: summon a copy of yourself from another loop for 8 s (max 2).
     Copies auto-attack and disagree with you in footnotes.
   - *Spór*: all copies argue, AoE filozoficzny around each copy.
   - *Pętla*: teleport to where you were 3 s ago, restore the racja you had then.
   - Quirk: on death outcome *Pętla*, the copy left behind is friendly for the first 10 s.
4. **Kartograf Planet Nieistniejących** — paid to map worlds that paperwork insists exist.
   Ranged. Auto-attack: mechaniczny, surveying instrument shot, long range, piercing on crit.
   - *Triangulacja*: a line shot that pierces all enemies, damage grows per enemy passed.
   - *Teren nieistniejący*: mark an area; enemies inside are slowed and, if *Przypuszczalne*,
     their existence coefficient drops to 0.3.
   - *Korekta*: short blink to a tapped point, leaves a "błąd pomiaru" decoy that enemies chase.
   - Quirk: the map of the page is revealed fully on entry (others see fog as blank paper).

---

## 11. i18n

- `src/i18n/` holds `pl/*.json` (source language) split by domain: `ui.json`, `items.json`,
  `enemies.json`, `heroes.json`, `laws.json`, `narration.json`, `forms.json`. Other languages
  will be added as sibling folders. Missing keys fall back to `pl` and log once.
- `t(key, params)` with ICU-like plurals for Polish (one / few / many / other). Never
  pluralize with "s" in code.
- **Grammar for generated names**: a base noun carries `gender: "m" | "f" | "n" | "pl"`; an
  affix carries forms per gender. The generator picks the matching form. Position of adjective
  (before or after the noun) is a per-language setting; Polish catalogue style puts the
  adjective *after* the noun ("pieczątka służbowa"), which also sounds more like a clerk.
- Numbers, dates and the run clock are formatted per locale.
- English is NOT to be written now. Keys are English identifiers; values are Polish.

---

## 12. Voice guide for Polish text

Sober, official, exact, and therefore funny. The narrator is a clerk who believes in
procedures and has never once questioned a form. Humor comes from applying the procedure
to the absurd, never from the text winking at the reader. No exclamation marks except in
stamps. No jokes that explain themselves. Short sentences. Passive voice welcome.
Use the vocabulary of 1960s–70s Polish administration and popular science:
*wnioskodawca, zarchiwizowano, zgodnie z regulaminem, w trybie zaocznym, egzemplarz,
nr ewidencyjny, kontrapcja, aparat, urządzenie, zjawisko, domniemany, ewentualny*.

Examples of the right register (reuse the tone, not the sentences):

- Item plate: „Ryc. 7. Pieczątka służbowa, model «Odmowa». Stempel kauczukowy z rękojeścią.
  Deklarowana siła argumentu: 12. Deklaracja producenta nie była audytowana.”
- Footnote: „¹ Kontrapcja nr 4471-B została skreślona zgodnie z procedurą. Procedury nie
  odnaleziono.”
- Footnote (wrong, later corrected): „² Napotkano niedźwiedzia.” … „⁴ Sprostowanie do
  przypisu 2: nie był to niedźwiedź, lecz coś, co prawdopodobnie nim bywa.”
- Planet law header: „Na Planecie Dwudziestej Trzeciej wszystko występuje parami, włącznie
  z nieszczęściem.”
- Level-up form: „WNIOSEK O AWANS. Wnioskodawca prosi o uwzględnienie jednego z poniższych
  paragrafów. Pozostałe zostaną zarchiwizowane i zapomniane.”
- Enemy defect: „Wada fabryczna: lewa noga zamontowana w prawo. Podatność: obrażenia
  mechaniczne.”
- Death (reklamacja): „REKLAMACJA. Zgłaszający twierdzi, że zmarł. Dział reklamacji uznaje
  zgłoszenie za zasadne i przywraca zgłaszającego do stanu sprzed śmierci. Bieg unieważniono.”
- Item refusing: „Przedmiot nr 14 odmawia współpracy z przedmiotem nr 9. Powód: hałas.”
- Vendor lie revealed: „Sprostowanie: zamiast aparatu triangulacyjnego wydano aparat
  triangulacyjny (inny). Znaczków nie zwraca się.”

Wrong register (do not write like this): „Epicki blaster plazmowy! +50 do mocy! Zniszcz
wrogów!” — anything with exclamation marks, superlatives, or that sounds like a shop banner.

---

## 13. Scope for the first playable (tonight) and backlog

### First playable, in build order (each step leaves the game runnable)
1. Scaffold, SVG renderer with paper + ink filter, loop, tap-to-move, camera, one page.
2. Four heroes, auto-attack, three skills each, HUD form.
3. Enemies: three families with procedural assembly, drawn-in spawn, crossed-out death,
   defects (Kontrapcje), escalation (Korespondencja), existence (Przypuszczalne). One boss
   per family.
4. Pages, page-turn, obstacles, run structure, planet laws (6).
5. Loot: generation with grammar, plates, inventory, equip, audit, opinions, warranty affix.
6. Progression: wniosek o awans with attachments and one appeal.
7. Death outcomes (3), base screen, kiosk with forms/lies/office hours, expedition log,
   footnotes with wrong notes.
8. Save (localStorage), PWA, deploy to GitHub Pages, night edition toggle.

### Backlog (do not build now; do not leave hooks for it either unless free)
- Pages as a branching map with side footnote pages.
- Quests as bureaucratic correspondence.
- More laws, more uniques, more parts.
- English and other languages.
- Sound: typewriter keys, stamp thud, pen scratch. (No music yet.)
- Leaderboard as "Dziennik Urzędowy".
