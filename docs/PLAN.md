# Plan: from a small concept to a full game

Status: ACCEPTED by the player (2026-10-18) with the decisions in §7; SKILLS.md and ITEMS.md
are accepted with their own decision sections. When accepted, its sections move
into DESIGN.md and the backlog in STATUS.md is re-cut into slices. Each slice must fit between a
pickup and a clear: one builder brief, one integrator pass, one push.

## 1. The feel we are aiming at
Diablo-like choices: few slots, many options, every choice visible on the page. "Much, but not
too many": a hero has about a dozen skills and three ultimates, of which five and one are
equipped. Variety comes from paragraph variants, not from more buttons.

## 2. Skill system (the heart of this plan)

### 2.1 Slots and categories
- Pads: **3 skill pads + 1 ultimate pad** (fourth pad, drawn as a stamp pad), plus auto-attack.
  Loadout chosen at the desk ("Konfiguracja", a form) and at the notice board between runs; in a
  run only through the pause sheet. Keep 3 skill pads for one-thumb play; the ultimate pad sits
  nearest the thumb's resting place.
- Categories per hero, Diablo-3 style, so a loadout always has a shape:
  *podstawowa* (cheap, short cooldown, the bread and butter), *ofensywna* (burst), *obronna*
  (shield, dodge, heal), *użytkowa* (mobility, control, summons), *ostateczna* (ultimate).
  A hero has 2–3 skills per category (≈ 10–12 total) and 2–3 ultimates.
- Rule of three on the pads: at most one of each category among the three equipped skills is
  the *recommended* layout, not enforced; the desk form shows the categories so the choice reads.

### 2.2 Paragraphs (the rune system)
Every skill has **three paragraph variants** (§ 1, § 2, § 3) that change what it does, one active
at a time: a different type (mechaniczny → regulaminowy), a different aim mode, a different
shape (cone → line), an added status, a cost/benefit twist. Unlocked by level (§ 1 at the skill's
unlock, § 2 and § 3 later) or by permissions for the rare ones. This is where "many skills"
really lives: 12 skills × 3 paragraphs = 36 behaviours per hero without 36 buttons.

### 2.3 Ultimates: argument ostateczny
- No mana. Skills run on cooldowns. Ultimates run on the **Argument meter**: it fills from
  rebuttals (matching the claim type) and from kills, drains slowly out of combat. Full meter =
  one ultimate. This rewards playing the claims system, which is the game's own idea.
- Each hero has 2–3 ultimates, one equipped. They are big, short, and visible: a stamp slams, the
  page reacts. Each ultimate has three paragraphs too.
- Boss Spór and the Argument meter interact: a correct reply fills the meter by half.

### 2.4 Passives (cechy)
A pool of ~10 per hero, 4 slots unlocked at levels 10/20/30/40. The existing six per hero are the
seed. Passives are the place for "the hero's absurd rule" (Pralka's program error, Naleśnik's
hydrostatics).

### 2.5 Progression
- Levels 1–40 (MVP: 1–30). Skills unlock on a schedule by category: level 1 podstawowa ×1 +
  obronna ×1; 3, 5, 7, 9 … the rest; first ultimate at 12, second at 24, third at 36.
  Paragraphs: § 2 at skill level + 6, § 3 at + 14, or by permission.
- The *aktualizacja* form stays the level-up moment: it now offers the newly unlocked skill or
  paragraph plus two stat/passive entries, three choices as today.
- Priority of the ticket = difficulty (see 3.2) multiplies XP and loot.

### 2.6 Making a hero cheap to add (the system)
- One folder per hero: `src/heroes/<id>/` with `def.ts` (stats, skills, paragraphs, ultimates,
  passives, unlock schedule, aim modes), `figure.ts` (drawing + poses), `sounds.ts` (recipes),
  `text` keys in `i18n/pl/heroes/<id>.json`, `tests`. A registry file lists heroes; nothing else
  in the code names a hero id (today a few places do: `fireAuto`, `shield.ts`, save checks; the
  refactor removes them).
- Skill effects are composed from a **primitive library** (`heroes/primitives/`): dash, aoe,
  cone, line, projectile, zone, summon, pull/push, status apply, buff, heal, teleport, decoy,
  hitscan. A skill is data + a list of primitives with parameters; a paragraph is a patch on that
  data. New skills are mostly data. Code is written only for a genuinely new primitive.
- `npm run new-hero <id>` scaffolds the folder from a template with TODOs and a checklist
  (figure, auto pose, 10–12 skills with paragraphs, 2–3 ultimates, 10 passives, 4 recipes,
  profile text, upgrade pool, tests, shots, voice pass).
- A `skills.test.ts` contract test runs every hero's every skill with every paragraph and every
  aim kind against a fixed scene and asserts no throw, a non-zero effect, and a body-layer sound.

### 2.7 Migration of the current ten skills per hero
Current skills become the first entries of the categories (the hero designs in DESIGN §10 map
cleanly: Pralka's Wirowanie = podstawowa, Pranie wstępne = obronna, Odwirowanie = użytkowa).
The Fable skill proposal (docs/SKILLS.md) assigns categories, paragraphs and ultimates per hero.
Existing numbers are kept until the balance pass.

## 3. Game shape

### 3.1 The case file: acts as planets
One ticket number the Komisja keeps reassigning. The campaign is a **sequence of planets**
(proposed: five acts, sixteen planets, docs/STORY.md; no MVP cut), each an act's worth of
play: a base, a clause, a document world, a family mix, four pisma (quest runs), two side
tickets, a boss run, a story chapter. The final ticket closes the case; the Komisja then opens
case 48214 against the hero, which frames the Zgłoszenia dodatkowe. After the campaign
the desk offers "Zgłoszenia dodatkowe": random planets with random clauses, the replayable loop.

### 3.2 Priorytet zgłoszenia (difficulty)
Chosen at the desk per ticket: *Niski*, *Normalny*, *Wysoki*, *Krytyczny* (and later *Nadany
omyłkowo*). Scales enemy racja/damage/tier weights, loot tier bonus, XP, star drops. The Asystent
comments on the choice. Unlocks by level.

### 3.3 Loot depth
- Tiers stay. Add **named sets** (built on the existing compatibility "zestaw": 2–3 items that
  like each other with a named joint footnote and a bonus that changes a skill), and **legendary
  paragraphs** on uniques (a unique item carries a paragraph for one skill, usable without
  unlocking it).
- **Reklamacja** at the kiosk: re-roll one affix for stars (the star sink).
- Item level follows planet and priority.

### 3.4 Enemies depth
Elite affix pool from 4 to 10; one new family per two planets later (after the story plan says
which); boss roster from 3 to one per planet, with Spór comments as story beats.

### 3.5 Session and meta
- Death outcomes stay; Zawieszenie gets its appeal form drawing.
- "Zaświadczenia" (certificates) as achievements, issued by the Komisja, listed at the board.
- Hall of tickets: the history as a browsable archive.

## 4. What is explicitly not in this plan
Endgame systems beyond "Zgłoszenia dodatkowe", multiplayer, English, store release. Far future.

## 5. Slices (each fits between pickup and clear)
1. Hero folder refactor + registry + primitives library extracted from the current skills
   (no behaviour change; the contract test).
2. Paragraph system on existing skills (3 per skill, data only where possible) + unlock schedule
   + the aktualizacja form offering them.
3. Argument meter + ultimate pad + one ultimate per hero.
4. Loadout form at the desk; categories shown.
5. Per-hero skill fill-in to 10–12 + 2–3 ultimates, one hero per slice, from docs/SKILLS.md.
6. Priorytet zgłoszenia + planet sequence + final ticket (needs the story plan for texts).
7. Loot depth: sets, legendary paragraphs, Reklamacja.
8. `npm run new-hero` + template + the hero checklist.
9. Balance pass from play; on-ramp footnotes.

## 6. Open questions for the player
- Ultimates on a meter filled by rebuttals (my pick) or on a long cooldown like any skill?
- Four pads in portrait: the ultimate pad as a stamp above the three, or replacing the inventory
  pad position (inventory moves to the HUD line)?
- Should paragraphs be chosen in a run (at the aktualizacja form) or only at the desk?
  My pick: unlocked in a run, switched at the desk and the pause sheet.
- Priority names: keep the ticket vocabulary (Niski/Normalny/Wysoki/Krytyczny) or Lem-ify them?

## 7. Decisions (player, 2026-10-18)
- Ultimates on the Argument meter. The ultimate pad is a stamp pad above the three in portrait.
  Paragraphs switch at the desk and in the pause sheet. The rule passive is always on and free.
  The three new primitives stay. One page-wide ultimate per hero, through a status. Gated skills
  need the permission for the first rank only. Priority names stay ticket vocabulary.
- **Campaign replay and free travel (Diablo):** after the case is closed, every earlier planet is
  reachable from the desk at the character's current level, drops scale to it, there are no new
  tickets there; the same planets are the ground for later endgame. Replaying a planet at max
  level is how max-level sets are farmed.
- **Character roster screen (Diablo):** a screen to create and pick a character replaces "Zmień
  profil". Each character has its own campaign progress, bag and personal archive; one shared
  Archiwum passes items between characters. Hero choice happens at creation. Goes into the next
  design talk (storyline) as the frame of the first screen, then into the slice order (before
  slice 7).

## 8. Systems added after the review (player, 2026-10-18)
- **Potwierdzenia (racja recovery, Diablo 3 style).** Enemies drop small stamped slips. If racja
  is below max, walking near one restores a share (sucked in from a reasonable radius, ~110
  units). If racja is full, the slip is pocketed: up to 5 on a character, shown as a small
  counter on a new pad/button; tapping uses one. Auto-use: when a hit would take racja below
  15%, one pocketed slip is used automatically. Slow out-of-combat regeneration, "zmiana
  zdania". Persisted with the character.
- **Page contents.** Teczki (folders tapped open for loot), pieczęcie (office seals that stamp a
  temporary buff, the shrine), one zdarzenie per page from a pool (a form under fire, a lost
  delivery, an audit). (Accepted by default; the player did not object.)
- **Elite packs and named elites.** Packs with a leader and minions; named elites with two or
  three affixes and an absurd name the Asystent records; elite affix pool to 10.
- **Karta osobowa.** A character sheet form at the desk and from the HUD: all stats, damage per
  type, resists, the Argument meter, active buffs as stamps.
- **Save safety.** Request persistent storage (`navigator.storage.persist()`); export and import
  of the whole save as a file from the desk ("Archiwum eksportowe"). Cloud saves (Workers + KV
  or D1, sign-in) later, with the Play Store stage.
- **Damage numbers.** Off by default; a setting shows them as small handwritten digits in the
  margin.
- **Bug button.** "Zgłoś problem z grą" in the pause sheet copies a short state dump to the
  clipboard.
- **Text size** setting for footnotes and cards.
- **Desktop controls** (WASD, mouse aim): later, not MVP.

## 8. Systems added after the review (player, 2026-10-18)
- **Recovery of racja, Diablo 3 style.** Enemies drop **potwierdzenia**, stamped slips. Walking
  near one pulls it in (vacuum radius about 90 units). If racja is not full it restores a share
  at once (about 25% of max, scaled by tier); if racja is full it is **kept**, up to 5 per
  character, shown as a stack on the HUD with a button "Potwierdzenie" (a fourth margin note next
  to Pauza/Tunel in a run). Tapping uses one. **Auto-use**: when a hit would drop racja below
  15% and a slip is held, one is used automatically (the Asystent notes it). Slow regeneration
  out of combat, "zmiana zdania", about 2% per second after 4 s without damage. No potions to buy.
- **Elite packs and named elites.** Elite packs: a leader with its affix and 2–4 minions of its
  family sharing the aura. **Named elites** (Diablo 2 unique monsters) with two or three affixes
  and an absurd name the Asystent records ("Monit Zbiorczy, nieodebrany od 2019"), one per
  two pages at most, guaranteed nietypowy+ drop.
- **Karta osobowa** (character sheet): a form at the desk and from the HUD's Reputacja line:
  racja, pewność siebie, upór, damage per type, resists, crit, speed, the Argument meter, active
  buffs and statuses as stamps, held potwierdzenia, permissions.
- **Page content**: **teczki** (folders tapped open for loot, 0–2 per page), **pieczęcie**
  (office seals on the page that stamp a timed buff on the player, the shrine equivalent, 0–1
  per page, pool of 6: +speed, +crit, +meter gain, +loot tier, free paragraphs for 30 s, racja
  regen), and one **zdarzenie** per page from a pool (a form to fill under fire, a lost
  delivery, an audit) later with the story plan.
- **Save safety**: request `navigator.storage.persist()` on install; **export/import** of the
  whole save as a file from the desk ("Archiwum eksportowe"); cloud sync later with Cloudflare
  (Workers + KV/D1) before the Play Store.
- **Damage numbers**: off by default; a setting shows them as small handwritten digits in the
  margin beside the hit.
- **Bug button**: "Zgłoś problem z grą" in the pause sheet copies a short state dump (version,
  hero, planet, page, last 10 events, settings, device) to the clipboard.
- **Text size** setting for footnotes, cards and forms (three steps).
- **Desktop** (later): WASD and a mouse-aim mode; the game already runs with click-to-move.
