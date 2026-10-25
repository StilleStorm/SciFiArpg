/** The Pralka's quirk, blad programu: every 10th hit taken fires a random skill for free. */
import { t } from '../../i18n';
import { hasEffect } from '../../items/sets';
import { installedSkills, padOf } from '../loadout';
import type { HeroQuirk } from '../module';
import { castSkill } from '../skills';

export const HITS_PER_ERROR = 10;
/** «Awaria», three pieces: the rule passive doubles, every 5th hit (items/sets.ts). */
export const HITS_PER_ERROR_AWARIA = 5;

export const quirk: HeroQuirk = {
  onHit(s, bus) {
    s.hero.hitsTaken++;
    if (s.hero.hitsTaken % (hasEffect(s.player, 'regula-podwojona') ? HITS_PER_ERROR_AWARIA : HITS_PER_ERROR) !== 0) return false;
    bus.emit('footnote', { text: t('heroes.pralka.quirkNote') });
    // a random installed skill, on the pads or not: it is cast through its pad, so the pads are shuffled for the one cast and put back
    const installed = installedSkills(s);
    const skill = installed[s.rngs.combat.int(0, installed.length - 1)] ?? 0;
    const slot = padOf(s, skill);
    if (slot !== null) return castSkill(s, bus, slot, true);
    const saved = s.hero.pads[0];
    s.hero.pads[0] = skill;
    const fired = castSkill(s, bus, 0, true);
    s.hero.pads[0] = saved;
    return fired;
  },
};
