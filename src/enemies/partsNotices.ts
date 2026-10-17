/** Powiadomienia: push notifications with legs. One body per escalation tier, each bigger than the last. */
import { box, circ, ell, pl, poly, rectPath, type BodyPart, type DecoPart } from './partsBase';

const FAM = 'powiadomienia' as const;

/**
 * Thin running legs. style 0 strides, style 1 hops (both legs bend outward and straighten together).
 * One path per leg; the count never depends on the phase.
 */
export function runnerLegs(hips: readonly number[], len: number, phase: 0 | 1, style: number): string[] {
  return hips.map((hx, i) => {
    const out = hx < 0 ? -1 : 1;
    if (style === 1) {
      const bend = phase === 0 ? 5 : 1.5;
      const kx = hx + out * bend;
      return `M${hx} 0L${kx} ${len * 0.5}L${hx + out * 1} ${len}l${out * 3.5} 0` + circ(kx, len * 0.5, 1.1);
    }
    const sg = (i + phase) % 2 === 0 ? 1 : -1;
    const kx = hx + sg * 3.2;
    const fx = hx + sg * 7.5;
    return `M${hx} 0L${kx} ${len * 0.45}L${fx} ${len}l${sg * 3.2} 0` + circ(kx, len * 0.45, 1.1);
  });
}

const legsFor =
  (hips: readonly number[], len: number) =>
  (v: number, phase: 0 | 1): string[] =>
    runnerLegs(hips, len, phase, v % 2);

const card: BodyPart = {
  id: 'card',
  family: FAM,
  tier: 1,
  w: 40,
  h: 26,
  neck: null,
  anchors: { topL: { x: -16, y: -26 }, topR: { x: 18, y: -25 }, back: { x: -20, y: -13 }, front: { x: 0, y: -13 }, side: { x: 20, y: -13 } },
  variants: 2,
  rise: 4,
  headChance: 0,
  ownLegLen: 30,
  ownLegs: legsFor([-7, 7], 30),
  draw: () => ({
    art: {
      line: 'M-16 0Q-20 0-20-4L-20-22Q-20-26-16-26L16-26Q20-26 20-22L20-4Q20 0 16 0Z' + box(-17, -23, -9.5, -15.5, 0.5),
      thin:
        'M-13.2-21.4Q-15.6-21.2-15.6-18.6L-16.2-17.2L-10.6-17.2L-11.2-18.6Q-11.2-21.2-13.2-21.4' +
        circ(-13.4, -16, 0.6) +
        pl(-6, -21, 14, -21.6) +
        pl(-17, -11.5, 10, -12) +
        pl(-17, -8, 3, -8.2) +
        'M5-5.6Q11-1.8 17-6.6' +
        pl(8, -4.4, 8.6, -6.4) +
        pl(11.4, -3.2, 11.8, -5.4) +
        pl(14.4, -3.8, 14.7, -6),
    },
    hips: [-7, 7],
  }),
};

const envelope: BodyPart = {
  id: 'envelope',
  family: FAM,
  tier: 2,
  w: 44,
  h: 28,
  neck: null,
  anchors: { topL: { x: -18, y: -28 }, topR: { x: 21, y: -27 }, back: { x: -22, y: -14 }, front: { x: 0, y: -14 }, side: { x: 22, y: -14 } },
  variants: 2,
  rise: 5,
  headChance: 0,
  ownLegLen: 32,
  ownLegs: legsFor([-8, 8], 32),
  draw: () => ({
    art: {
      line: box(-22, -28, 22, 0) + pl(-22, -28, 0, -14, 22, -28) + ell(0, -7.5, 10.5, 5.2),
      thin:
        pl(-9.6, -10.6, -7.6, -5.6, -5.6, -11.2, -3.6, -5.2, -1.6, -11.6, 0.4, -5, 2.4, -11.6, 4.4, -5.2, 6.4, -11.2, 8.4, -5.6, 10, -10.4) +
        pl(-19, -5, -14, -5.2) +
        pl(13, -4.6, 19, -4.8),
      hatch: poly(-19.5, -27, 0, -15.5, 19.5, -27),
    },
    hips: [-8, 8],
  }),
};

const basket: BodyPart = {
  id: 'basket',
  family: FAM,
  tier: 3,
  w: 50,
  h: 40,
  neck: null,
  anchors: { topL: { x: -20, y: -24 }, topR: { x: 22, y: -26 }, back: { x: -22, y: -11 }, front: { x: 0, y: -11 }, side: { x: 20, y: -11 } },
  variants: 2,
  rise: 0,
  headChance: 0,
  ownLegLen: 28,
  ownLegs: legsFor([-9, 9], 28),
  draw: () => ({
    art: {
      line:
        'M-22-22L-17 0L17 0L22-22Z' +
        pl(-25, -22, 25, -22.6) +
        'M-15-24.5Q0-52 15-24.5' +
        'M-12-24.5Q0-45 12-24.5' +
        box(-11, -31, -5, -24.5, 0.4) +
        'M-2-24.5L-2-29Q2-33 6-29L6-24.5' +
        'M-6.5-8.5Q0-14.5 6.5-8.5',
      thin:
        pl(-20, -15, 20, -15.4) +
        pl(-18.5, -8, 18.5, -8.2) +
        pl(-11, -22, -8.5, 0) +
        pl(0, -22, 0, 0) +
        pl(11, -22, 8.5, 0),
      hatch: 'M-22-22L-17 0L-10.5 0L-14-22Z',
      ink: circ(-4.5, -18.5, 1.1) + circ(4.5, -18.5, 1.1),
    },
    hips: [-9, 9],
  }),
};

const telegram: BodyPart = {
  id: 'telegram',
  family: FAM,
  tier: 4,
  w: 36,
  h: 48,
  neck: null,
  anchors: { topL: { x: -17, y: -48 }, topR: { x: 15, y: -42 }, back: { x: -17, y: -24 }, front: { x: 0, y: -28 }, side: { x: 17, y: -24 } },
  variants: 2,
  rise: 3,
  headChance: 0,
  ownLegLen: 28,
  ownLegs: legsFor([-7, 7], 28),
  draw: () => ({
    art: {
      line:
        'M-17-48L17-48L17-3L13 0L9-3L5 0L1-3L-3 0L-7-3L-11 0L-14-2.5L-17 0Z' +
        'M-17-36C-26-40-30-27-38-31C-42-33-44-29-47-31',
      thin:
        pl(-17, -41, 17, -41) +
        pl(-14, -35, 12, -35.4) +
        pl(-14, -30.5, 8, -30.8) +
        pl(-14, -26, 13, -26.3) +
        pl(-14, -21.5, 5, -21.6) +
        box(-9.5, -18, 9.5, -8.5, 0.5) +
        pl(-9.5, -7, 9.5, -7.2),
      hatch: rectPath(-15.5, -46.5, 15.5, -42.5),
    },
    hips: [-7, 7],
    texts: [{ key: 'enemies.deco.stop', x: 0, y: -10.9, size: 8, font: 'monoBold' }],
  }),
};

export const NOTICE_BODIES: readonly BodyPart[] = [card, envelope, basket, telegram];

// ---------- decorations ----------

const BADGE_R = [4.6, 5.6, 7, 8.6];
const BADGE_N = ['1', '3', '12', '99+'];

export const NOTICE_DECOS: readonly DecoPart[] = [
  {
    id: 'badge',
    family: FAM,
    slot: 'top',
    anchors: ['topR'],
    rise: 0,
    draw(tier) {
      const i = Math.min(3, Math.max(0, tier - 1));
      const r = BADGE_R[i] ?? 5;
      return {
        art: { line: circ(0, 0, r), thin: circ(0, 0, r + 1.3) },
        texts: [{ literal: BADGE_N[i] ?? '1', x: 0, y: r * 0.42, size: r * 1.25, font: 'monoBold' }],
      };
    },
  },
  {
    id: 'vibes',
    family: FAM,
    slot: 'side',
    anchors: ['back'],
    rise: 0,
    draw: () => ({ art: { thin: pl(-3, -4, -9, -7) + pl(-4, 0, -11, 0.4) + pl(-3, 4, -9, 7) } }),
  },
];

