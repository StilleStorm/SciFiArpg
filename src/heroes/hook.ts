/** Test hook for window.__game.hero: drive skills, updates, permissions and deaths from tests and shots. */
import type { DeathOutcome } from '../death/outcomes';
import type { Game } from '../game';
import { applyUpgrade, gainXp, xpToNext } from '../progression';
import type { Bus } from '../core/events';
import { createEnemy } from '../entities/factory';
import { applyDamage } from '../systems/combat';
import { nextId } from '../world/run';
import { mountProfile } from '../ui/profile';
import type { Aim } from './aim';
import { castSkill } from './skills';
import { heroDef } from './defs';
import { assignPad } from './loadout';

export interface HeroHook {
  /** Fire skill 1, 2 or 3 now (same as the pad). Returns false on cooldown or if nothing happened. */
  cast(slot: 1 | 2 | 3, aim?: Aim): boolean;
  /** Give the permission the skill wants and install its first rank (skill index 3 or 4); the pads stay as they are. False when it was not installed. */
  installSkill(index: 3 | 4): boolean;
  /** Install skill 3 or 4 if needed and show the update form's step "Przypisz do przycisku" at once; the form closes itself on a choice. */
  openAssign(index: 3 | 4): boolean;
  /** Put skill `index` on pad 1..3 (heroes/loadout.ts assignPad). */
  assignPad(pad: 1 | 2 | 3, index: 0 | 1 | 2 | 3 | 4): boolean;
  /** Add a permission token (a family id: 'urzadzenia', 'powiadomienia', 'wygenerowane'). */
  givePermission(family: string): void;
  /** Give reputacja; may open the update form. */
  grantXp(n: number): void;
  /** Give exactly the reputacja for one level. */
  levelUp(): void;
  /** Open the update form for the current level without leveling. */
  openUpdate(): boolean;
  /** Same as tapping the HUD line: open the queued update now (false if none is queued or a boss is alive). */
  requestUpdate(): boolean;
  /** Press the entry at `index` (0..2) and then "Zainstaluj". False if the form is not open or the entry is locked. */
  pickUpdate(index: number): boolean;
  /** Press "Zglos problem z aktualizacja". */
  report(): boolean;
  /** Kill the player now; the next death will be `outcome` (random if omitted). */
  die(outcome?: DeathOutcome): void;
  /** Mount the hero-select screen directly (the router does this normally). */
  profile(): void;
  /** Put `n` plain enemies in a loose cluster to the right of the player (for shots and tests). */
  spawn(n: number): number;
  /** Plain data for assertions. */
  info(): {
    heroId: string;
    level: number;
    xp: number;
    cd: number[];
    shield: number;
    suspended: boolean;
    summons: number;
    zones: number;
    ranks: number[];
    pads: number[];
    permissions: string[];
    offer: string[];
    status: string;
  } | null;
}

export function createHeroHook(game: Game, bus: Bus): HeroHook {
  const q = <T extends Element>(sel: string): T | null => document.querySelector<T>(sel);
  const install = (index: 3 | 4): boolean => {
    const s = game.state;
    if (!s) return false;
    const need = heroDef(s.player.heroId).skills[index].requires;
    if (need && !s.player.permissions.includes(need)) s.player.permissions.push(need);
    return (s.hero.ranks[index] ?? 0) > 0 || applyUpgrade(s, `skill${index + 1}`);
  };
  return {
    cast(slot, aim) {
      const s = game.state;
      return s ? castSkill(s, bus, (slot - 1) as 0 | 1 | 2, false, aim) : false;
    },
    installSkill: install,
    openAssign(index) {
      const s = game.state;
      if (!s || !install(index)) return false;
      const was = s.status;
      s.status = 'paused';
      game.hero.update.assign(s, index, () => {
        game.hero.update.close();
        s.status = was;
      });
      return true;
    },
    assignPad(pad, index) {
      const s = game.state;
      return s ? assignPad(s, (pad - 1) as 0 | 1 | 2, index) : false;
    },
    givePermission(family) {
      const s = game.state;
      if (s && !s.player.permissions.includes(family)) s.player.permissions.push(family);
    },
    grantXp(n) {
      const s = game.state;
      if (s) gainXp(s, bus, n);
    },
    levelUp() {
      const s = game.state;
      if (s) gainXp(s, bus, xpToNext(s.player.level) / s.hero.mods.xp + 1);
    },
    openUpdate: () => game.hero.openUpdate(),
    requestUpdate: () => game.hero.requestUpdate(),
    pickUpdate(index) {
      const rows = document.querySelectorAll<HTMLButtonElement>('.sheet .entry');
      const row = rows[index];
      const install = q<HTMLButtonElement>('.sheet .install');
      if (!row || !install || row.classList.contains('locked')) return false;
      row.click();
      install.click();
      return true;
    },
    report() {
      const b = q<HTMLButtonElement>('.sheet .report');
      if (!b || b.disabled) return false;
      b.click();
      return true;
    },
    die(outcome) {
      const s = game.state;
      if (!s) return;
      game.hero.forceOutcome(outcome ?? null);
      s.player.shield = 0;
      applyDamage(s, bus, s.player, s.player.hp + 1000, false);
    },
    spawn(n) {
      const s = game.state;
      if (!s) return 0;
      for (let i = 0; i < n; i++) {
        const e = createEnemy(nextId(s), s.player.x + 70 + (i % 3) * 26, s.player.y + ((i % 5) - 2) * 34, 100 + i);
        e.home = { x: e.x, y: e.y };
        s.enemies.push(e);
      }
      return s.enemies.length;
    },
    profile() {
      const ui = q<HTMLElement>('#ui');
      if (ui) mountProfile(ui, () => undefined);
    },
    info() {
      const s = game.state;
      if (!s) return null;
      return {
        heroId: s.player.heroId,
        level: s.player.level,
        xp: s.player.xp,
        cd: [...s.hero.cd],
        shield: s.player.shield,
        suspended: s.player.suspended,
        summons: s.summons.length,
        zones: s.zones.length,
        ranks: [...s.hero.ranks],
        pads: [...s.hero.pads],
        permissions: [...s.player.permissions],
        offer: s.hero.offer ? s.hero.offer.entries.map((e) => e.id) : [],
        status: s.status,
      };
    },
  };
}
