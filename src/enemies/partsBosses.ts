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

/**
 * Ankieta (STORY 8.10): a tall clipboard on two long stilts. The sheet's head band is the header "OCEN NASZA OBSLUGE" (drawn as ruled
 * lettering strokes, no words here: the plate text is the boss caption), five hatched star boxes down the front are its face, a pencil on a
 * string its one arm, the clip at the top a brow, a paper feed curling out of the top.
 */
function stars(y: number): string {
  // a five-point star outline centred on (0, y), radius 3.1
  let d = '';
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? 3.1 : 1.3;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    d += `${i === 0 ? 'M' : 'L'}${(Math.cos(a) * rad).toFixed(1)} ${(y + Math.sin(a) * rad).toFixed(1)}`;
  }
  return d + 'Z';
}

const ankieta: BodyPart = {
  id: 'ankieta',
  family: 'powiadomienia',
  tier: 0,
  w: 40,
  h: 64,
  neck: null,
  anchors: { topL: { x: -14, y: -62 }, topR: { x: 14, y: -62 }, back: { x: -20, y: -32 }, front: { x: 0, y: -32 }, side: { x: 20, y: -32 } },
  variants: 1,
  rise: 6,
  headChance: 0,
  boss: 'ankieta',
  draw: () => ({
    art: {
      line:
        // the board and the sheet on it
        box(-20, -64, 20, 0) +
        box(-17, -58, 17, -3, 0.7) +
        // the header band
        pl(-17, -48, 17, -48) +
        // the clip: a brow across the top
        poly(-8, -68, 8, -68, 8, -62, -8, -62) +
        pl(-5, -68, -5, -72, 5, -72, 5, -68) +
        // five star boxes down the front, the face
        box(-8, -44, 8, -37, 0.4) +
        box(-8, -35, 8, -28, 0.4) +
        box(-8, -26, 8, -19, 0.4) +
        box(-8, -17, 8, -10, 0.4) +
        box(-8, -8, 8, -1.4, 0.4) +
        // the pencil on a string: hangs from the left edge, the one arm
        'M-20-40Q-30-38 -30-26L-30-8L-27.5-3L-25-8L-25-26Q-25-34 -20-34' +
        // the paper feed curling out of the top
        'M-3-72Q-10-84 -2-88Q6-92 4-80Q2-74 6-72',
      thin:
        pl(-14, -53, -6, -53) +
        pl(-2, -53, 8, -53) +
        pl(-14, -50.5, 3, -50.5) +
        pl(13, -53, 15, -53) +
        pl(-30, -22, -25, -22) +
        pl(-30, -18, -25, -18) +
        pl(11, -62, 11, -58) +
        pl(-1, -76, 3, -79) +
        [-40.5, -31.5, -22.5, -13.5, -4.7].map(stars).join(''),
      hatch: rectPath(-16, -57, 16, -49) + rectPath(-27.5, -29, -26.5, -6),
      ink: circ(-11, -4.5, 0.8) + circ(11, -4.5, 0.8) + circ(11, -67, 0.8),
    },
    hips: [-9, 9],
  }),
};

export const BOSS_BODIES: readonly BodyPart[] = [proto, captcha, hipoteza, ankieta];
