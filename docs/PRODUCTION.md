# Production plan: milestones and slices (brief-ready)

Executed by `/automode` with an Opus lead that pastes briefs and relays reports. Design is
closed: PLAN.md (+ §7, §8), SKILLS.md, ITEMS.md (+ §12), STORY.md, DESIGN §2–§14. This file is the
only plan the lead reads; one slice = one loop iteration between a pickup and a clear.

## Summary
- 7 milestones, 30 slices. **MVP = end of M3** (Akt I playable start to finish with story, roster,
  recovery, items scaled to three planets, the Anomalia finale with its five faces).
- Estimates from observed costs (builder 400k, integrator 300k, voice 110k, story 170k, tester
  220k, look 50k): M1 6.2M · M2 6.6M · M3 6.3M (MVP ≈ 19M + ~1.5M milestone overhead) · M4 6M ·
  M5 3.5M · M6 3.5M · M7 3M. Total ≈ 36M tokens. Treat as ±30%.
- Token rules: the lead reads only the slice entry plus the sections it names (<10k); briefs point
  at doc sections, never restate them (<600 words); two builders only with disjoint owned files;
  `voice` only in slices marked Voice: yes, otherwise once per milestone; `look` on ≤6 flagged PNGs
  per slice, all of `shots/` once per milestone; `tester` one leg per slice (<40 s), one e2e per
  milestone; the `story` agent only in the three story-plan slices and the milestone reviews;
  never the Workflow tool; never read `docs/workflows/` or agent transcripts.

## Standard builder header (the lead pastes this above every builder brief)
> Read your role in .claude/agents/builder.md and follow it. Read CLAUDE.md, docs/WORKFLOW.md
> "Builder protocol", then ONLY the doc sections named under Reads below and the ARCHITECTURE.md
> sections for the files you own. Deliver exactly the numbered items. Gates by exit code:
> `npm run check; echo $?`, `npm run shot; echo $?`, `npm run smoke; echo $?` (and
> `npm run render-audio` if you touched audio) must print 0. Use your own `SHOT_PORT`, `SHOT_OUT`,
> `SHOT_DIR`. Do not commit. Report: files; shared-file edits (exact); new events/fields/APIs;
> SEAM list; unfinished; screenshot verdict against DESIGN §3. Write the report to
> `reports/<slice>-builder-<name>.md` and answer the lead in at most five lines (WORKFLOW.md "Reports").

## Milestones
| id | name | playable result | exit criteria |
|---|---|---|---|
| M1 | Systems core | loadouts with paragraphs, an ultimate per hero on the meter, recovery | e2e: full run per hero with a loadout and an ultimate; recovery and auto-use |
| M2 | Campaign frame | roster of characters, nine planets with priority, items scaled, elites, page content, quests frame | e2e: campaign skeleton at Niski priority, placeholder cards |
| M3 | Akt I + finale (MVP) | planets 1–3 with story, clerks, side tickets, cards, hero lines, Anomalia | e2e: Akt I start to finish skipping cards; faces for all five heroes |
| M4 | Depth | sets, legendary paragraphs, Reklamacja, deliveries, heroes at 10–11 skills | e2e: every skill/paragraph of every hero; a set bonus; a reclamation; a transfer |
| M5 | Akt II | planets 4–6 | e2e: Akt II |
| M6 | Akt III | planets 7–9 | e2e: Akt III and the finale after it |
| M7 | Polish and release | balance, phone feedback, polish bucket, desktop, hosting | e2e: whole campaign; player sign-off |

Milestone end (automode): tester e2e → look over `shots/` → story plan review (Fable, reads
STATUS + the milestone's reports only, writes decisions into docs, parks player questions) →
integrator folds the milestone's per-slice ARCHITECTURE.md sections into the contract sections
they extend (hook names, events, shots kept; narrative dropped; the file stays under 350 lines) →
gate → push → milestone report.

---

## M1 Systems core

### S1 Hero folders, registry, primitives, new-hero scaffold
Goal: one folder per hero, a registry, a primitives library; every existing skill re-expressed as
data + primitives with no behaviour change; the scaffold script. Depends on: none.
Reads: PLAN §2.6; DESIGN §10.2; SKILLS "Cross-hero rules"; ARCHITECTURE (heroes, aiming, attack animations).
Story gap: none.
#### Builder brief: heroes-refactor
Scope: restructure the hero domain without changing behaviour.
Own: src/heroes/** (new layout: src/heroes/<id>/{def,figure,sounds,index}.ts, src/heroes/primitives/*.ts, src/heroes/registry.ts), scripts/new-hero.mjs, templates under src/heroes/_template/, src/render/heroFigures.ts (becomes a thin re-export of per-hero figures).
Allowed additive: src/entities/types.ts, src/save/character.ts and save.ts (HERO_IDS from the registry), src/audio/bindings.ts (hero keying from the registry), src/render/attackFx.ts (poses from per-hero figure modules), scripts/lint-rules.mjs (new rule: no hero id literal outside src/heroes/<id>/ and tests), package.json (`new-hero` script), src/testHook.ts.
Forbidden: everything else.
Deliverables: (1) registry listing 5 heroes; no hero id literal outside its folder (lint rule green). (2) primitives library: 16 pure primitives (dash, aoe, cone, line, projectile, zone, summon, pull/push, status apply, buff, heal, teleport, decoy, hitscan, cooldown reset, deferred damage, echo), each unit-tested. (3) all 25 existing skills as data + primitive lists, identical effects: a contract test replays every hero × skill × aim kind on a fixed scene and compares to a snapshot captured BEFORE the refactor (capture first, commit the snapshot file). (4) `npm run new-hero <id>` scaffolds a folder with TODOs and the checklist (figure, auto pose, skills, ultimates, passives, 4 recipes, profile text, pool, tests, shots, Anomalia face). (5) README in src/heroes/ describing the folder contract.
Contracts out: `heroes/registry.ts` (`HEROES`, `heroById`), primitives API, the snapshot test.
Tests: primitives; the contract snapshot; lint rule.
Shots: `SHOT_PORT=4181 SHOT_OUT=dist-s1 SHOT_DIR=shots-s1`; run shot-heroes and shot-attacks unchanged.
Voice: no. Look: yes (shot-heroes idle frames, to prove no visual change). Tester leg: every hero casts every skill via the hook; smoke unchanged. Estimate: 1.0M. Risks: snapshot flakiness (pin seeds). Parked: none.

### S2 Paragraphs and the unlock schedule
Goal: § 1–3 on every skill, unlock by level or permission, offered by the update form, switchable at the desk and the pause sheet. Depends on: S1.
Reads: DESIGN §10.2 (Paragraphs, Progression); SKILLS (every hero's § 2/§ 3 columns); PLAN §2.2, §2.5; ARCHITECTURE (progression, pause).
Story gap: none.
#### Builder brief: paragraph-engine
Own: src/heroes/** (paragraph data on every existing skill from SKILLS.md: 25 × 3; patch semantics ≤4 fields; active paragraph per skill in the character; unlock rules: § 2 at skill level +6, § 3 at +14, or a family permission), src/progression/paragraphs.ts (new), src/i18n/pl/heroes/*.json keys for paragraph names/descriptions.
Allowed additive: src/save/character.ts (active paragraphs), src/entities/types.ts, src/testHook.ts (`setParagraph`).
Forbidden: src/ui/**, src/progression/update.ts (the other builder's), everything else.
Deliverables: (1) 75 paragraphs as data with names and one-line descriptions (Polish, register §12). (2) `applyParagraph` patching skill data at cast; tests for each patch kind (type, shape, aim, status, cost). (3) unlock schedule function + tests. (4) character save round-trip with active paragraphs.
Contracts out: `paragraphsOf(heroId, skillId)`, `setActiveParagraph`, `unlockedParagraphs(character)`.
Tests as above. Shots: none needed. 
#### Builder brief: update-form-paragraphs (parallel with paragraph-engine; disjoint)
Own: src/progression/update.ts, src/ui/update.ts, src/ui/pause.ts (a "Paragrafy" line), src/ui/konfiguracja.ts (new minimal sheet: per skill, three § boxes, active one stamped), src/ui/pads.ts (a small "§2"/"§3" tag on a pad), src/i18n/pl/forms.json keys.
Allowed additive: src/main.ts (mount), src/testHook.ts.
Forbidden: src/heroes/**, src/save/**.
Deliverables: (1) the aktualizacja form offers, on level-up, the newly unlocked skill or paragraph plus two stat/passive entries (3 choices). (2) Konfiguracja sheet from the desk with paragraph switching (uses the engine's contracts; stub them if not yet merged and mark `// SEAM:`). (3) pause-sheet entry opening the same sheet in a run. (4) pad tag. Tests: offer selection logic. Shots: `SHOT_PORT=4182 SHOT_OUT=dist-s2 SHOT_DIR=shots-s2` (update form with a paragraph entry; Konfiguracja; a pad tag) in both orientations.
Voice: yes. Look: yes (3 shots). Tester leg: level up → offer shows a paragraph → pick → cast shows the patched effect; switch at the pause sheet. Estimate: 1.3M. Parked: none.

### S3 Argument meter and the first ultimate per hero
Goal: the meter, the ultimate pad, one ultimate per hero with § 1–3. Depends on: S2.
Reads: DESIGN §10.2 (Ultimates); SKILLS (first ultimate of each hero); PLAN §2.3; DESIGN §14.3 (recipe rules); ARCHITECTURE (combat/claims, Spór, pads, audio contract).
#### Builder brief: meter-ultimates
Own: src/heroes/** (category 'ostateczna', 5 ultimates with paragraphs, data + primitives), src/combat/meter.ts (new: fill from rebuttal +X, kill +Y, Spór right reply +50%, drain out of combat; constants exported), src/i18n/pl/heroes/*.json keys.
Allowed additive: src/systems/combat.ts (meter hooks on rebuttal/kill), src/combat/spor.ts (half-fill), src/entities/types.ts (`player.meter`), src/save/character.ts (no persistence of the meter), src/testHook.ts (`fillMeter`).
Forbidden: src/ui/**, src/audio/**.
Deliverables: (1) meter with tests for every source and the drain. (2) 5 ultimates, each ≤8 s, one stamp, one page reaction, radius ≤220 or own path; at most one page-wide per hero and only via a status; tests per ultimate with each paragraph. (3) `castUltimate` consuming a full meter.
#### Builder brief: ultimate-pad-hud (parallel; disjoint)
Own: src/ui/pads.ts (fourth pad as a stamp pad: above the three in portrait, in the arc in landscape, lefty mirror; disabled drawing until full), src/ui/hud.ts (meter as an ink underline that fills, label "Argument"), src/ui/landscape.css and base.css for the pad, src/audio/recipes.ts + levels.ts + bindings.ts (5 ultimate recipes with body layers; keyed by hero via the registry).
Allowed additive: src/core/events.ts (`ultimate:cast`), src/testHook.ts.
Forbidden: src/heroes/**, src/combat/**.
Deliverables: (1) the pad in all layouts, ≥44 px, no overlap (shot-checked). (2) HUD meter. (3) 5 recipes, render-audio green with body bands. Shots: `SHOT_PORT=4183 SHOT_OUT=dist-s3 SHOT_DIR=shots-s3`.
Voice: yes. Look: yes. Tester leg: rebut until full → pad enabled → cast → stamp present → meter empty. Estimate: 1.3M. Parked: none.

### S4 Konfiguracja, categories, Karta uprawnień, specializations
Goal: the loadout form, categories shown, the printed chart with three specializations and capstones. Depends on: S3.
Reads: DESIGN §10.2 (Slots, Categories), §10.3; SKILLS (categories and the three loadouts per hero); PLAN §2.1.
#### Builder brief: specializations
Own: src/heroes/** (category on every skill; 3 specializations per hero named after the SKILLS loadouts, each listing its skills; capstone effects as small data buffs; rule: capstone granted when ≥2 equipped skills belong to the column, one column at a time), src/i18n/pl/heroes/*.json keys.
Allowed additive: src/save/character.ts (loadout: 3 skills + ultimate + active specialization), src/entities/types.ts, src/testHook.ts.
Forbidden: src/ui/**.
Deliverables: (1) categories and specializations as data for 5 heroes. (2) capstone rule + tests. (3) loadout validation (any unlocked skill equippable; recommended one per category is advisory).
#### Builder brief: desk-forms (parallel; disjoint)
Own: src/ui/konfiguracja.ts (full: pads × 3 + ultimate, categories shown, paragraphs, specialization capstone line), src/ui/karta.ts (new: the Karta uprawnień chart: boxes on a form, dotted lines in unlock order, ZATWIERDZONO stamps, BRAK UPRAWNIEŃ grey, three columns with capstones at the foot), src/ui/profile.ts (link to the chart), src/ui/pause.ts (Konfiguracja line), src/i18n/pl/forms.json.
Allowed additive: src/main.ts, src/testHook.ts.
Forbidden: src/heroes/**, src/save/**.
Deliverables: (1) Konfiguracja form in both orientations, every control ≥44 px. (2) the chart, scrollable, for all 5 heroes. (3) loadout changes persist. Shots: `SHOT_PORT=4184 SHOT_OUT=dist-s4 SHOT_DIR=shots-s4`.
Voice: yes. Look: yes. Tester leg: open the desk → change loadout → run → pads match; chart shows unlock state. Estimate: 1.3M. Parked: none.

### S5 Recovery, save safety and the small settings batch
Goal: potwierdzenia as globes with a held stack; persistent storage, export/import; damage numbers, text size, bug button. Depends on: S1 (not S4; may run as the first slice of M1 if play says runs are too punishing).
Reads: PLAN §8 (Recovery, Save safety, Damage numbers, Bug button, Text size); DESIGN §3.2; ARCHITECTURE (pickups, HUD, pause, save).
#### Builder brief: recovery
Own: src/systems/recovery.ts (new), src/entities (a `potwierdzenie` pickup kind), src/render/pickupCard.ts (the slip drawing), src/ui/hud.ts (stack of ≤5 as small stamped slips + a 44 px "Potwierdzenie" note next to Pauza/Tunel in a run), src/i18n/pl/ui.json keys.
Allowed additive: src/systems/loot.ts (drop chance), src/systems/combat.ts (auto-use before a hit drops racja below 15%), src/entities/types.ts, src/save/character.ts (held count), src/core/events.ts, src/testHook.ts, src/audio/bindings.ts (map to existing paperSlide/stamp).
Forbidden: src/ui/settings.ts, src/ui/pause.ts (the other builder's).
Deliverables: (1) drops with vacuum radius 90; instant heal 25% when not full; held when full, cap 5. (2) button use; auto-use rule; Asystent footnote on auto-use. (3) out-of-combat regen 2%/s after 4 s. Tests for all rules.
#### Builder brief: save-settings (parallel; disjoint)
Own: src/save/export.ts (new), src/ui/settings.ts (text size 3 steps; damage numbers toggle), src/ui/pause.ts (bug button: copies a state dump to the clipboard), src/ui/baza.ts (desk lines "Archiwum eksportowe": export file / import file), src/render/damageNumbers.ts (new: handwritten digits in the margin beside the hit, off by default), src/i18n/pl/screens.json keys.
Allowed additive: src/main.ts (`navigator.storage.persist()` on boot, guarded), src/save/save.ts (settings fields), src/render/bindings.ts (hook damage numbers on enemy:hit), src/testHook.ts.
Forbidden: src/systems/**, src/ui/hud.ts.
Deliverables: (1) export/import round-trip with version check and a confirmation form. (2) three settings persisted. (3) bug dump with version, hero, planet, page, last 10 events, settings, device. Shots: `SHOT_PORT=4185 SHOT_OUT=dist-s5 SHOT_DIR=shots-s5`.
Voice: no (milestone pass). Look: yes (HUD stack, damage numbers). Tester leg: drop → heal; full → held; button; auto-use at low racja; export → import equality. Estimate: 1.3M. Parked: none.

M1 end: tester `scripts/e2e-milestone-1.mjs`; look over `shots/`; story plan review; push; report.

---

## M2 Campaign frame

### S6 Character roster, per-character saves, shared Archiwum
Goal: a roster screen replaces "Zmień profil"; each character has its own progress, bag and archive; one shared archive. Depends on: S5.
Reads: PLAN §7 (roster), ITEMS §8, §12 (Archiwum); DESIGN §3; ARCHITECTURE (save, pause and save, base stations).
#### Builder brief: save-roster
Own: src/save/** (SAVE_VERSION 3: `characters[]` each with character, bookmark, history, personal archive 40; `sharedArchive` 40; `activeCharacterId`; migration from v2 wrapping the single character), src/i18n/pl/screens.json keys for errors.
Allowed additive: src/entities/types.ts, src/testHook.ts.
Forbidden: src/ui/**.
Deliverables: (1) schema + migration + tests (v2 → v3 keeps everything, including `Character.potwierdzenia`, the loadout, specialization and paragraphs). (2) APIs: `createCharacter(heroId, name)`, `selectCharacter`, `deleteCharacter`, `moveItem(from, to)` between bag/personal/shared with capacity checks. (3) `save/export.ts` follows: an archive written by S5 (format 1, one character) imports into v3; the export carries every character and the shared archive; the round trip stays byte-identical (test).
#### Builder brief: ui-roster (parallel; disjoint)
Own: src/ui/roster.ts (new: list of characters as case files with hero figure, level, planet; create: hero pick via the existing profile sheet + a name as "nr sprawy" auto-generated or typed; delete with a confirmation form), src/ui/profile.ts (becomes the hero pick inside creation), src/ui/archive.ts (new: personal + shared archive sheet at the desk with transfers), src/ui/baza.ts (desk lines), src/i18n/pl/screens.json.
Allowed additive: src/main.ts (title → roster → base), src/testHook.ts.
Forbidden: src/save/**.
Deliverables: (1) roster screen in both orientations; each case file opens the character's Karta uprawnień (S4 `ui/karta.ts`), which leaves the old profile sheet with it. (2) archive sheet with drag-free transfers (tap source, tap destination). (3) title flow updated; `Zmień profil` removed; the desk's Konfiguracja, Karta uprawnień and Archiwum eksportowe lines keep working per character. Shots: `SHOT_PORT=4186 SHOT_OUT=dist-s6 SHOT_DIR=shots-s6`.
Voice: yes. Look: yes. Tester leg: create two characters → play one → switch → separate progress → transfer an item via the shared archive. Estimate: 1.4M. Parked: none.

### S7 Priority, planet sequence, final ticket, free travel, card frames
Goal: nine planets as data, priority as difficulty, campaign progression per character, the final ticket, free travel after the case, chapter card and opening page frames with placeholders. Depends on: S6.
Reads: PLAN §3.1, §3.2, §7 (replay); STORY §4, §5 (cards); DESIGN §4; ARCHITECTURE (run, ticket, laws, pageTurn).
#### Builder brief: world-campaign
Own: src/world/campaign.ts (new: `PLANETS[9]` with act, name/epithet keys, family mix, law pool, base layout, location types (stub list), boss id, hosted set id; `priority` with scaling tables for enemy racja/damage/tier weights/XP/stars/loot tier; per-character campaign state: current planet, closed planets; final ticket flag; free travel list), src/world/ticket.ts (planet from campaign), src/i18n/pl/laws.json/planets keys.
Allowed additive: src/world/run.ts (planet index, priority on RunState), src/enemies/spawn.ts and families.ts (tier by planet), src/save/character.ts (campaign state), src/core/events.ts (`campaign:advanced`, `case:closed`), src/testHook.ts.
Forbidden: src/ui/**.
Deliverables: (1) data for 9 planets (placeholder names until S11). (2) priority tables + tests. (3) progression rules: the next ticket is the next planet; after planet 9 the return ticket to planet 1 (finale flag); after the case: "zgłoszenia dodatkowe" (random planet, random clause) and free travel to any closed planet at current level. Tests.
#### Builder brief: ticket-and-cards (parallel; disjoint)
Own: src/ui/ticket.ts (planet, act, priority picker with unlock by level, travel list after the case), src/ui/cards.ts (new: opening page and chapter card frames: title, 3–4 summary lines, hero line slot, one tap to skip, red "rewritten" variant), src/ui/base.css, src/i18n/pl/screens.json (frame strings, placeholders marked TODO-story).
Allowed additive: src/main.ts (card before entering a planet's base; opening page on first ticket of a character), src/testHook.ts.
Forbidden: src/world/**.
Deliverables: (1) ticket form with priority. (2) cards in both orientations, skippable, never blocking input after the tap. Shots: `SHOT_PORT=4187 SHOT_OUT=dist-s7 SHOT_DIR=shots-s7`.
Voice: no (placeholders). Look: yes. Tester leg: choose priority → enemies scale → close planet → next planet → card shown → skip. Estimate: 1.3M. Parked: none.

### S8 Items for three planets: affix pool, tiers, grammar, 40 bases, drawing marks
Goal: ITEMS slices a + b + d. Depends on: S1.
Reads: ITEMS §2, §3, §9, §12; DESIGN §7, §11; ARCHITECTURE (items).
#### Builder brief: affix-pool
Own: src/items/affixes.ts, grammar.ts, generate.ts, src/items/tiers.ts (new), src/i18n/pl/items.json.
Allowed additive: src/items/types.ts, src/testHook.ts.
Forbidden: src/render/**, src/items/bases.ts.
Deliverables: (1) 32 affixes with {m,f,n,pl} forms (17 existing + 15 new, 6 absurd with their mechanics), families, grades, slot gates. (2) tiers I–V by ilvl band with magnitude table. (3) name grammar: noun + ≤2 adjectives + "model «…»" from the highest third affix. (4) roll rules per tier with exclusions. Tests: grammar for all genders, roll distribution, exclusions.
#### Builder brief: bases-40 (parallel; disjoint)
Own: src/items/bases.ts (40 bases, 8 per slot, genders, level-1 stats, register lines), src/render/itemDrawings.ts (21 new drawings), src/render/pickupCard.ts and src/ui/itemView.ts (tier marks: stamp mark nietypowy, red thread rzadki, wax seal unikatowy, paperclip reserved for zestaw; absurd-affix small marks), src/i18n/pl/items.json base keys.
Allowed additive: src/testHook.ts.
Forbidden: src/items/affixes.ts, grammar.ts, generate.ts.
Deliverables: (1) 40 bases with drawings. (2) marks per tier on ground and card. Shots: `SHOT_PORT=4188 SHOT_OUT=dist-s8 SHOT_DIR=shots-s8` (a card per slot and tier).
Voice: yes. Look: yes. Tester leg: roll 200 items by seed → names valid Polish grammar (gender checks) → marks present per tier. Estimate: 1.3M. Parked: none.

### S9 Item level, drops, Sklep stock, elite packs and named elites
Goal: ITEMS slice c + PLAN §8 elites. Depends on: S7, S8.
Reads: ITEMS §5, §6, §7.1–7.2; PLAN §8 (Elite packs); DESIGN §6; ARCHITECTURE (loot, enemies, economy).
#### Builder brief: drops-economy
Own: src/items/level.ts (new: ilvl = 5·(planet−1)+1 + page offset + priority bonus, cap 40; budgets per tier; lie magnitude per tier 15/25/35), src/systems/loot.ts (drop tables per family/rank, boss guarantees, permission cards, gwiazdki amounts), src/economy/sklep.ts (stock 6 plates per planet, prices by tier, fee, lie rate), src/i18n/pl/economy.json.
Allowed additive: src/world/run.ts, src/systems/recovery.ts (constants only), src/testHook.ts.
Forbidden: src/enemies/**.
Deliverables: (1) ilvl and budgets + tests. (2) drop tables + tests of expectations by seed; the table includes the potwierdzenia rate per rank (S5 shipped `.1/.5/1` untested) with a target of 1–2 slips per page at Normalny and a seeded test of that expectation. (3) Sklep stock rules + tests.
#### Builder brief: elite-packs (parallel; disjoint)
Own: src/enemies/** (packs: leader + 2–4 minions sharing the aura; named elites with 2–3 affixes, Asystent-recorded names from an i18n generator, ≤1 per two pages, guaranteed nietypowy+ drop; elite affix pool 4 → 10 with grammar forms), src/i18n/pl/enemies.json.
Allowed additive: src/systems/loot.ts (named-elite drop hook; coordinate by a `// SEAM:` if the other builder is mid-edit), src/core/events.ts, src/testHook.ts.
Forbidden: src/items/**, src/economy/**.
Deliverables: (1) packs with tests. (2) named elites with 30 name parts. (3) 6 new elite affixes with mechanics. Shots: `SHOT_PORT=4189 SHOT_OUT=dist-s9 SHOT_DIR=shots-s9` (a pack, a named elite with its footnote).
Voice: yes. Look: yes. Tester leg: planet 3 at Wysoki → ilvl in range → a pack and a named elite appear → drops as guaranteed. Estimate: 1.3M. Parked: none.

### S10 Page content, Karta osobowa, quest and NPC primitives
Goal: teczki, pieczęcie, zdarzenia frame; the character sheet; the quest primitive with the board; NPC figures with sheets. Depends on: S7.
Reads: PLAN §8 (Page content, Karta osobowa); STORY §5 (side tickets, base figures); DESIGN §4.1; ARCHITECTURE (base stations, board, pages).
#### Builder brief: world-content
Own: src/world/content.ts (new: teczki 0–2/page tap-open loot; pieczęcie 0–1/page, pool of 6 timed buffs; zdarzenia frame with 3 events: a form to fill under fire, a lost delivery, an audit), src/render/obstacles.ts (drawings), src/world/pages.ts (placement), src/i18n/pl/world.json.
Allowed additive: src/systems/step.ts, src/core/events.ts, src/testHook.ts, src/audio/bindings.ts (existing recipes).
Forbidden: src/ui/**, src/world/quests.ts.
Deliverables: (1) three content kinds placed by seed with tests. (2) the 6 seals' buffs as statuses/buffs. (3) events frame + 3 events.
#### Builder brief: karta-quests-npc (parallel; disjoint)
Own: src/ui/karta-osobowa.ts (new: stats, damage per type, resists, crit, speed, meter, buffs as stamps, held potwierdzenia, specialization + capstone, permissions; a desk line beside Konfiguracja and Karta uprawnień, built the way `ui/karta.ts` is (pure model + sheet), and from the HUD Reputacja line; not a pause-sheet line, that grid is full at six), src/world/quests.ts (new: templates kill N / deliver / fetch / reach; state per character; rewards), src/ui/board.ts (ogłoszenia list with accept/complete; procedural drobne ogłoszenia 2 per planet), src/world/npc.ts + src/render/npc.ts (figure primitive on base pages: tap → short sheet; one placeholder clerk per base), src/i18n/pl/screens.json keys.
Allowed additive: src/world/base.ts (NPC placement), src/save/character.ts (quest state), src/main.ts, src/testHook.ts.
Forbidden: src/world/content.ts, src/world/pages.ts.
Deliverables: (1) the sheet. (2) quest engine + tests. (3) board UI. (4) NPC primitive. Shots: `SHOT_PORT=4191 SHOT_OUT=dist-s10 SHOT_DIR=shots-s10`.
Voice: yes. Look: yes. Tester leg: open a teczka → loot; step on a seal → buff stamp; accept a quest → complete → reward; tap the clerk → sheet. Estimate: 1.4M. Parked: none.

M2 end: tester `scripts/e2e-milestone-2.mjs`; look; story plan review; push; report.

---

## M3 Akt I and the finale (MVP)

### S11 Story plan for Akt I and the finale texts (no builder)
Goal: STORY.md §8 for planets 1–3 and the finale, then the final Polish. Depends on: S10.
Reads: STORY (all), DESIGN §12, §12.1, SKILLS (hero voices), ITEMS §12 (hosted sets).
Story gap: STORY §8.1–8.4 (planets 1–3 and the finale), on the frame of STORY §8.0.
Agents: `story` (Fable): for each of planets 1–3 an §8.0 entry: name + epithet (and locative), general feel under Akt I, two or three location types from the closed list with one-line looks, the law from the planet's pool, the boss variant (line, 2 Spór comments × 3 replies, one data change), the base layout and its clerk (name, role, 3 sheet lines), 2–3 side tickets on the S10 templates (template, n, family, reward, title, text, twist), chapter card text (3 lines + 2 rewritten), hero lines ×5, hosted set per ITEMS §12.6; the opening page text + 5 hero lines; the Anomalia finale: phase-1/3 shared texts, the five faces' middle-phase lines and Spór comments, the final footnote. Then `voice` (Opus) writes the final Polish into `src/i18n/pl/story.json` (new file, domain `story`, keys exactly as STORY §7) and replaces the placeholder names in `planets.json` p1–p3; reviews the story agent's Polish. No builder. Lead commits docs + json.
Voice: yes. Look: no. Tester: none. Estimate: 0.4M. Parked: anything the story agent marks blocking.

### S12 Planet 1 content and the story frames
Goal: planet 1 fully built, and the per-planet hooks the M2 code still lacks (cards and hero lines by planet and hero, Spór by planet, location types on pages, base layout from the planet record, clerk registration, `CAMPAIGN_LAST`). Depends on: S11.
Reads: STORY §7 (keys), §8.0, §8.1 (planet 1), §2 (CAMPAIGN_LAST); DESIGN §4, §4.1, §4.2, §3.4; ARCHITECTURE (campaign, content, quests, npc, cards, bosses/Spór).
#### Builder brief: planet-1
Own: src/world/planets/p1.ts (new per-planet module: registers the clerk (`registerNpc`), the side tickets (`registerSideTickets`, ids `h:p1:a..c`), the location drawings of its types, the boss variant data; imported once from a `src/world/planets/index.ts` registry), src/render/locations/*.ts (new obstacle/prop drawings for its two or three location types; a `registry.ts` keyed by `LocationType` with the current generic obstacles as the fallback), src/world/planets/index.ts.
Allowed additive (the frames; keyed by planet index so S13/S14 add data only): src/world/pages.ts (`Page.location` picked per page from `PlanetDef.locations` by seed; obstacles from the location registry), src/world/base.ts (`layoutForSeed` picks from `PlanetDef.baseLayouts`), src/ui/cards.ts (lines from `story.p<N>.card.*` / `story.opening.*` with the hero's line by heroId, falling back to the `screens.cards.*` placeholders when the key is missing), src/combat/spor.ts (prompt table keyed by planet when `story.p<N>.boss.spor1` exists, else the family table), src/render/enemyFigures.ts (variant line under the boss name), src/enemies/bosses.ts (one data change per planet from the variant table), src/world/campaign.ts (planet 1 record per STORY §8.1; `CAMPAIGN_LAST = 3`: the return ticket after it, the "Sprawę wznowiono" red card when a save's closed list is shorter than a raised constant), src/testHook.ts.
Forbidden: other planets' data, the rest of src/ui/**, src/i18n/** (voice owns story.json; wire keys only).
Deliverables: (1) two or three location types with ≥6 new drawings each, chosen per page. (2) base layout from the record + planet 1's clerk. (3) 2–3 hand-written side tickets live. (4) chapter card, opening page and hero lines live for planet 1, placeholders elsewhere. (5) boss variant with its Spór comments. (6) `CAMPAIGN_LAST` with a test that closing planet 3 issues the return ticket. Shots: `SHOT_PORT=4192 SHOT_OUT=dist-s12 SHOT_DIR=shots-s12` (each location, the base with the clerk, the card, the boss with its variant line).
Voice: no (done in S11; light milestone pass). Look: yes. Tester leg: opening page → planet 1 base → clerk → side ticket → pages of each location → boss with its comments. Estimate: 1.3M (the frames; S13 and S14 are lighter for it).

### S13 Planet 2 content — as S12 for planet 2 without the frames (own src/world/planets/p2.ts and its drawings; `SHOT_PORT=4193`). Estimate: 1.0M.
### S14 Planet 3 content — as S13 for planet 3 (own src/world/planets/p3.ts; `SHOT_PORT=4194`). Estimate: 1.0M.

### S15 Anomalia: shared phases and the five faces
Goal: the finale on planet 1's rewritten base: phase 1 (family forms), phase 2 per hero, phase 3 (existence drops with correct replies; the closing stamp). Depends on: S14, S3.
Reads: STORY §3 (incl. the delivery note: a one-page run on the rewritten base), §2; DESIGN §5.4, §5.5, §6 (bosses); ARCHITECTURE (bosses, Spór, existence, base, campaign).
#### Builder brief: anomalia-core
Own: src/enemies/anomalia/{core,phase1,phase3}.ts (new), src/world/finale.ts (new: the `final` ticket's run is one page, planet 1's base layout generated with the stations struck through and no station opening; the Anomalia at the desk; the final footnote; the unique drop from those not yet archived, from the existing pool, closing the S9 SEAM in loot.ts), `story.finale.phase1|phase3.*` keys wiring.
Allowed additive: src/world/campaign.ts (the return ticket and `caseClosed` already exist: wire, do not rebuild), src/world/pages.ts (one-page final run), src/world/base.ts (the struck layout), src/enemies/bosses.ts (registration), src/combat/spor.ts (phase comments), src/systems/loot.ts, src/core/events.ts, src/testHook.ts.
Forbidden: the faces files, src/ui/**.
Deliverables: (1) phase 1 cycling the three family boss forms. (2) phase 3 existence-coefficient finish with the ODPOWIEDZIANO/closing stamp logic. (3) finale page + scaling by priority and `CAMPAIGN_LAST`. Tests for phase transitions and the one-page run.
#### Builder brief: anomalia-faces (parallel; disjoint)
Own: src/enemies/anomalia/faces/{kierownik,serwisant,wezel,planeta,obserwatorium}.ts + drawings, `story.finale.face.<heroId>.*` keys wiring.
Allowed additive: src/enemies/anomalia/index.ts (face registry by heroId), src/testHook.ts.
Forbidden: core/phase files.
Deliverables: (1) five middle phases exactly per STORY §3 with their mechanics (hold/transfer; paragraph strip; rewind; measured-real terrain; edge-on existence). (2) five figures in ink. Tests per face mechanic. Shots: `SHOT_PORT=4195 SHOT_OUT=dist-s15 SHOT_DIR=shots-s15` (each face mid-phase).
Voice: yes (face lines check). Look: yes. Tester leg: per hero: reach the finale via the hook → all three phases → case closed → endgame unlocked. Estimate: 1.6M. Risks: the largest slice; integrator may need two rounds.

### S16 MVP pass: on-ramp, balance, Akt I end-to-end
Goal: the first-ticket footnotes, a balance pass from scripted play, the Akt I e2e. Depends on: S15.
Reads: PLAN §3 (MVP shape), STATUS feedback section; ARCHITECTURE (narration).
#### Builder brief: onramp-balance
Own: src/narration/onramp.ts (new: 4 first-ticket footnotes: walk, attack, rebut, update), src/balance/*.ts (new: a single numbers file per domain re-exported where constants live), src/i18n/pl/narration.json keys.
Allowed additive: constants files in heroes/items/enemies to import from balance.
Forbidden: everything else.
Deliverables: (1) on-ramp (a fifth note on the first potwierdzenie, wiring the unused `ui.note.pickup`; `ui.note.firstKill/start` wired or dropped). (2) a `scripts/balance-report.mjs` that runs 20 seeded runs per hero at Normalny through the hook and prints time-to-boss, deaths, potwierdzenia dropped/held/used, ultimates cast, drops by tier, gwiazdki earned, teczki opened, side tickets finished; (3) one tuning pass from its output (recovery constants and the S5 drop rates, meter fill, capstone magnitudes, the S7 PRIORITIES first guesses, the S9 ilvl/tier budgets, quest reward stars, the Anomalia at `CAMPAIGN_LAST` 3) with the changes listed in the report.
Voice: yes (all Akt I text, full pass). Look: all `shots/`. Tester: `scripts/e2e-milestone-3.mjs` = Akt I start to finish skipping cards, both orientations, for two heroes. Estimate: 0.9M.

M3 end = **MVP**: push; milestone report; player playtest; park feedback into STATUS.

---

## M4 Depth

### S17 Sets and legendary paragraphs
Depends on: S9, S2. Reads: ITEMS §4, §12 (uniques rule: +1/+2 ranks, exceed cap, unlock while worn, carries the paragraph); SKILLS (paragraph ids).
Builder `sets-uniques`: own src/items/sets.ts (6 sets on compatibility tags, 2- and 3-piece bonuses), src/items/uniques.ts (10 new uniques with ranks + paragraph + story), src/render/itemDrawings.ts (paperclip mark for zestaw), src/i18n/pl/items.json. Allowed additive: src/heroes/** (rank-from-item hook, unlock-while-worn), src/items/stats.ts, src/systems/loot.ts and src/economy/sklep.ts (close the S9 SEAMs: zestaw 35% from the planet boss of the hosting planet, 10% zestaw offers in the Sklep, the won-Spór tier bonus "Komisja przychyliła się"), src/world/campaign.ts (`hostedSet` per ITEMS §12.6: the first planet of an act hosts none; move `ostatnia-mila` from planet 4 to 5), src/ui/archive.ts (the S6 parked hero note on an archived unique: which hero its paragraph concerns). Deliverables: (1) 6 sets with joint footnotes; (2) 10 uniques; (3) the ranks rule + tests; (4) the three loot seams closed with seeded tests. `SHOT_PORT=4196`. Voice: yes. Look: yes. Tester leg: equip 3 set pieces → bonus; wear a unique → skill unlocked and ranked; the hosting planet's boss drops its set piece by seed. Estimate: 1.2M.

### S18 Reklamacja, sinks, paczkomat deliveries
Depends on: S17, S6. Reads: ITEMS §6.4, §7.3–7.4, §8, §12; DESIGN §7 (Przesyłka).
Builder `reklamacja-paczkomat`: own src/economy/reklamacja.ts (re-roll one affix, once per item per planet, cost curve, Asystent lines), src/ui/sklep.ts (Reklamacja line), src/items/delivery.ts + src/ui/paczkomat.ts (awizo cards, base paczkomat pickup for stars, return after two runs), src/ui/inventory.ts ("Odrzuć do kosza" 10% of list), src/i18n/pl/economy.json. Allowed additive: src/world/base.ts (paczkomat station live), src/save/character.ts, src/systems/loot.ts (the S9 przesyłka SEAM on `dropLoot`), src/world/quests.ts (`QuestReward.item`: a unique or set piece paid as an awizo at the base paczkomat, never into the bag; the S10 parked item rewards). Every sell, bin and reclaim path calls `absurd.disposalRefusal` (S8 rule: wycofany z obiegu can only be dropped). Deliverables: (1) Reklamacja; (2) deliveries end to end, including a side-ticket item reward arriving as an awizo; (3) sinks/sources table checked by a seeded simulation test. `SHOT_PORT=4197`. Voice: yes. Look: yes. Tester leg: reclaim → affix changed once; a rare drop → awizo → pickup; a wycofany item refused at the bin. Estimate: 1.2M.

### S19 Heroes filled: Pralka and Konsultant
Depends on: S4, S17. Reads: SKILLS §1, §2; DESIGN §10.2; §14.3.
Two builders in parallel, disjoint folders `src/heroes/pralka/` and `src/heroes/konsultant/` (+ their i18n files, recipes keyed by hero): each: skills to 10–11 with all paragraphs, ultimates 2 and 3 (levels 24/36, of the two types the first lacks; the Konfiguracja ultimate slot and the meter from S3/S4 take them as data; `HeroSounds.ultimate` becomes a name per ultimate id, a `// SEAM:` for the integrator the first time), passives 7–10, pad drawings for all, 4–6 recipes with body, profile text, upgrade pool, tests per skill × paragraph × aim, shot-heroes frames. Capstones stay small named bonuses (DESIGN §10.3); a mechanical capstone is not a deliverable. `SHOT_PORT=4198/4199`. Voice: yes. Look: yes. Tester leg: every skill with every paragraph. Estimate: 1.5M.

### S20 Heroes filled: Pętlowiec and Kartograf — as S19 (`SHOT_PORT=4181/4182`). Estimate: 1.5M.

### S21 Naleśnik filled, scaffold validation
Depends on: S20. Builder `nalesnik-fill` (as S19 for `src/heroes/nalesnik/`) plus deliverable: scaffold a dummy hero with `npm run new-hero test`, run the contract test, delete it, and report the checklist gaps fixed. `SHOT_PORT=4183`. Estimate: 1.3M.

M4 end: tester `e2e-milestone-4.mjs` (every skill/paragraph, a set, a reclamation, a transfer); look; story review; push.

---

## M5 Akt II (planets 4–6)
### S22 Story plan Akt II (no builder) — as S11 for planets 4–6 (`story` then `voice` appending to src/i18n/pl/story.json). Story review decides whether a new enemy family or one act event is introduced here (parked if it needs the player); the player's answer on boss bodies (STATUS "Needs the player") decides whether S24 draws a new body for planet 6. Estimate: 0.4M.
### S23 Planets 4 and 5 — two builders in parallel, `src/world/planets/p4.ts`, `p5.ts`, own drawings, boss variants (`SHOT_PORT=4184/4185`). Estimate: 1.4M.
### S24 Planet 6 and Akt II systems — builder `planet-6` plus builder `akt2-enemies` (new elite affixes/family if decided; Akt II laws' remaining mechanics; `CAMPAIGN_LAST` to 6 with the "Sprawę wznowiono" card for MVP saves). `SHOT_PORT=4186/4187`. Estimate: 1.5M.
M5 end: e2e Akt II; look; story review; push.

## M6 Akt III (planets 7–9)
### S25 Story plan Akt III (no builder) — as S11 for planets 7–9 (appending to story.json). Estimate: 0.4M.
### S26 Planets 7 and 8 — as S23 (`SHOT_PORT=4188/4189`). Estimate: 1.4M.
### S27 Planet 9, the Observatory planet, finale polish — builder `planet-9` plus builder `finale-polish` (`CAMPAIGN_LAST` to 9, the return-to-planet-1 card in red, endgame "zgłoszenia dodatkowe" texts framed as the Komisja's case against the applicant (STORY §5), certificates at the board). `SHOT_PORT=4191/4192`. Estimate: 1.5M.
M6 end: e2e Akt III + finale; look; story review; push.

## M7 Polish and release
### S28 Polish bucket — builder `render-polish` (landscape clause header top centre, Odwirowanie knockback, appeal-form drawing, cookie-banner paper, simpler Wygenerowane drawings, "Muzyka na czekanie, utwór nr N" line; the M1/M2 look leftovers listed in STATUS "Open polish": the tags, sups, HUD field labels and drawn plate labels still under 11 px, the landscape footnote box out of the play area, the inventory card footnote behind the buttons, the landscape desk scroll) plus builder `audio-polish` (sounds for enemy:miss / offTopic / gwiazdki pickup / elite:named / elite:slain, stereo panning). `SHOT_PORT=4193/4194`. Estimate: 1.4M.
### S29 Phone feedback and desktop — builder `feedback-bucket` (items parked under "Needs the player" that the player answered) plus builder `desktop` (WASD, mouse aim mode). Estimate: 1.2M.
### S30 Release prep — Cloudflare hosting + cloud save design, Play Store TWA assets, privacy policy text, assetlinks: needs the player (parked until they say go). Estimate: 0.8M.

## Still open at planning time (known risks)
- S15 is the largest slice; expect two integrator rounds.
- Story slices (S11, S22, S25) may park questions; the loop continues with items/heroes slices that do not depend on them (S17–S21 can run before S22).
- Estimates are from this project's observed runs; a 30% overrun is normal.
