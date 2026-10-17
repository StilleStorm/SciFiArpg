Items (DESIGN section 7). Public API:

- `rollItem(rng, { tier?, slot?, level, source?: 'common'|'elite'|'boss', tierBonus?, baseId? }) -> Item` (generate.ts). Deterministic per rng state. `number` is 0 until picked up.
- `recomputeStats(player)` (stats.ts): hero `player.baseStats` + equipment (claimed numbers during the trial, actual after, zero while niekompatybilny) -> `player.stats`, `hpMax`, `damageType`, `attackRange`, `attackCooldown`. Call it after changing `baseStats`, `equipment`, or reveal.
- `UNWANTED_FEATURES`, `addAffix(item, affix)`, `installUnwantedFeature(state)` (unwanted.ts, matches `lawHooks.unwantedFeature`).
- `advanceTrial(player, kills)` (reviews.ts; reads `player.trialSpeed ?? 1`), `equipItem / unequipSlot / dropItem / buyAdapter / buyOut / addItem` (inventory.ts, cap 20).
- `nameItem(base, affixes)` (grammar.ts): adjective after the noun, agreement by gender; strings in `i18n/pl/items.json`.
- `installItems(root, bus, getState)` (install.ts): called once from game.ts; binds drops (systems/loot.ts), the Załączniki sheet (ui/inventory.ts), the kiosk, and installs `lawHooks.unwantedFeature` / `lawHooks.officeChanged` if unset.
- Drawings: `render/itemDrawings.ts`. Pickup card: `render/pickupCard.ts`.
