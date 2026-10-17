Gwiazdki (currency), the Sklep with its service fee and lies, office hours (DESIGN section 9.2). Strings: `i18n/pl/economy.json`.

- `stars.ts`: `addStars`, `spendStars`, `canAfford`.
- `sklep.ts`: stock per visit (`restock`), `buy` (fee +20% at checkout, 1-in-6 lie: wariant or price, revealed in a footnote, never refunded), `reportProblem` (3 reports = store update, new lie rate), own localStorage key `zgloszenie.sklep`.
- `hours.ts`: office-hours state machine (`createHours`, `hoursAt`), `setOfficeOpen(open | null)` for a regulamin clause, bot lines.
- `kiosk.ts`: `openKiosk()` for the page to call when the player reaches the kiosk (sheet when open, bot footnote otherwise), `onOfficeChanged` for `lawHooks.officeChanged`. UI: `ui/sklep.ts` `mountSklep(container, meta, player)`.
