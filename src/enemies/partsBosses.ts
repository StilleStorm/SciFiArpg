/** Boss bodies: Prototyp (every part), Weryfikacja (a captcha), Hipoteza (a bear, a dragon and a wish). */
import { box, circ, ell, hatchRect, pl, poly, rectPath, mergeArt, type BodyPart } from './partsBase';
import { bearArt, bearLegs, dragonTail, dragonWings } from './partsGenerated';

const proto: BodyPart = {
  id: 'proto',
  family: 'urzadzenia',
  tier: 0,
  w: 48,
  h: 60,
  neck: { x: 0, y: -55 },
  anchors: { topL: { x: -14, y: -40 }, topR: { x: 14, y: -40 }, back: { x: -18, y: -15 }, front: { x: -4, y: -12 }, side: { x: 18, y: -15 } },
  variants: 1,
  rise: 0,
  headChance: 1,
  boss: 'prototyp',
  ranged: { range: 230, cooldown: 2.4, speed: 150, damageMul: 0.9, type: 'mechaniczny' },
  draw: () => ({
    art: {
      line:
        // fridge below, router slab above it, a speaker on top
        box(-18, -30, 18, 0) +
        pl(-18, -20, 18, -20) +
        pl(13, -28, 13, -22.5) +
        pl(13, -17.5, 13, -5) +
        box(-23, -40, 23, -30) +
        pl(-10, -52, -10, -40) +
        pl(10, -52, 10, -40) +
        ell(0, -52, 10, 3) +
        // antennas, paper tray, paper curl, camera stalk
        pl(-18, -40, -21, -56) +
        circ(-21.4, -57.4, 1.6) +
        pl(18, -40, 22, -55) +
        circ(22.4, -56.4, 1.6) +
        poly(-23, -34, -34, -38.5, -36.5, -30.5, -23, -31.5) +
        'M18-8Q28-6 26 0' +
        pl(23, -35, 30, -35, 30, -42) +
        box(30, -47, 39, -38, 0.5) +
        ell(39.5, -42.5, 1.8, 4.5),
      thin:
        box(-12, -27, 4, -22, 0.5) +
        pl(-14, -3.5, 14, -3.5) +
        circ(-17, -35, 1.3) +
        circ(-12.5, -35, 1.3) +
        circ(-8, -35, 1.3) +
        box(8, -37.5, 11, -32.5, 0.4) +
        box(14, -37.5, 17, -32.5, 0.4) +
        ell(0, -52, 6, 1.7) +
        pl(-31, -36, -26, -37.4) +
        pl(-31, -33.4, -25, -34.6) +
        hatchRect(7, -19, 17.5, -6, 2.6),
      hatch: rectPath(-11, -26, 3, -23),
      ink: circ(-12.5, -35, 0.8) + circ(-8, -35, 0.8) + circ(39.8, -42.5, 0.9) + circ(5, -55.5, 0.9),
    },
    hips: [-14, 0, 14],
  }),
};

const captcha: BodyPart = {
  id: 'captcha',
  family: 'powiadomienia',
  tier: 0,
  w: 50,
  h: 54,
  neck: null,
  anchors: { topL: { x: -20, y: -54 }, topR: { x: 20, y: -54 }, back: { x: -25, y: -27 }, front: { x: 0, y: -27 }, side: { x: 25, y: -27 } },
  variants: 1,
  rise: 0,
  headChance: 0,
  boss: 'weryfikacja',
  draw: () => ({
    art: {
      line:
        box(-25, -54, 25, 0) +
        pl(-25, -44, 25, -44) +
        box(-19, -36, -4, -21, 0.8) +
        circ(-11.5, -10, 5.5) +
        // the pointer
        poly(9, -24, 9, -8, 13, -12, 17, -4, 20, -5.4, 16, -13.5, 21, -14),
      thin:
        pl(1, -31, 20, -31.4) +
        pl(1, -26, 15, -26.2) +
        pl(-25, -5, 25, -5.2) +
        pl(2, -3, 20, -3.2) +
        'M-7.6-12.5l2.6 1.2l-0.8-2.9' +
        'M-15.4-7.6l-2.6-1.2l0.8 2.9' +
        hatchRect(-24, -5.8, 24, -0.8, 3),
      hatch: rectPath(-24, -53, 24, -45),
    },
    hips: [-12, 12],
  }),
};

function hipotezaArt() {
  const bear = bearArt(2);
  const wings = dragonWings(1);
  const tail = dragonTail();
  return mergeArt(bear, wings, tail, {
    // two more eyes, wrongly placed
    ink: circ(23, -39.5, 1) + circ(30.5, -39, 1) + circ(-2, -29, 1.2),
    line: ell(-2, -29, 3.4, 2.4),
  });
}

const hipoteza: BodyPart = {
  id: 'hipoteza',
  family: 'wygenerowane',
  tier: 0,
  w: 64,
  h: 54,
  neck: null,
  anchors: { topL: { x: -12, y: -32 }, topR: { x: 6, y: -33 }, back: { x: -22, y: -16 }, front: { x: -4, y: -17 }, side: { x: 14, y: -16 } },
  variants: 1,
  rise: 0,
  headChance: 0,
  dotted: 0.6,
  boss: 'hipoteza',
  ownLegLen: 17,
  ownLegs: bearLegs,
  draw: () => ({ art: hipotezaArt(), hips: [-15, -8, 10, 17] }),
};

export const BOSS_BODIES: readonly BodyPart[] = [proto, captcha, hipoteza];
