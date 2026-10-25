/** The Pralka's quirk, blad programu: every 10th hit taken fires a random skill for free. Her later passives and running skills tick from here. */
import { t } from '../../i18n';
import { hasEffect } from '../../items/sets';
import { installedSkills, padOf } from '../loadout';
import type { HeroQuirk } from '../module';
import { castSkill } from '../skills';
import { WERSJA_HITS } from './numbers';
import { hasWersja, runOf, tickPralka } from './running';

export const HITS_PER_ERROR = 10;
/** «Awaria», three pieces: the rule passive doubles, every 5th hit (items/sets.ts). */
export const HITS_PER_ERROR_AWARIA = 5;

/** Hits between two errors: 10, or 7 with passive 8 (Wersja 1.1); a worn Awaria set halves it. */
export function hitsPerError(awaria: boolean, wersja: boolean): number {
  const base = wersja ? WERSJA_HITS : HITS_PER_ERROR;
  return awaria ? Math.ceil(base / 2) : base;
}

export const quirk: HeroQuirk = {
  onHit(s, bus) {
    const every = hitsPerError(hasEffect(s.player, 'regula-podwojona'), hasWersja(s));
    const step = runOf(s).eco ? 2 : 1; // Tryb oszczedny: a hit on her counts double for the rule
    s.hero.hitsTaken += step;
    if (Math.floor(s.hero.hitsTaken / every) === Math.floor((s.hero.hitsTaken - step) / every)) return false;
    bus.emit('footnote', { text: t('heroes.pralka.quirkNote') });
    // a random installed skill, on the pads or not: it is cast through its pad, so the pads are shuffled for the one cast and put back
    // (Zmiana programu has nothing to change before the first cast of the run, so it is left out of the draw until then)
    const installed = installedSkills(s).filter((i) => i !== 8 || s.hero.lastCast !== null);
    const skill = installed[s.rngs.combat.int(0, installed.length - 1)] ?? 0;
    const slot = padOf(s, skill);
    if (slot !== null) return castSkill(s, bus, slot, true);
    const saved = s.hero.pads[0];
    s.hero.pads[0] = skill;
    const fired = castSkill(s, bus, 0, true);
    s.hero.pads[0] = saved;
    return fired;
  },
  tick(s, bus) {
    tickPralka(s, bus);
  },
};
