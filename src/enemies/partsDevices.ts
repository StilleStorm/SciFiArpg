/** Urzadzenia: smart devices drawn as Mroz contraptions. Bodies, legs, heads, decorations. */
import {
  box,
  circ,
  ell,
  hatchRect,
  pl,
  poly,
  rectPath,
  type BodyPart,
  type DecoPart,
  type HeadPart,
  type LegPart,
} from './partsBase';

const FAM = 'urzadzenia' as const;

// ---------- bodies ----------

const fridge: BodyPart = {
  id: 'fridge',
  family: FAM,
  tier: 0,
  w: 30,
  h: 45,
  neck: { x: 0, y: -45 },
  anchors: { topL: { x: -10, y: -45 }, topR: { x: 10, y: -45 }, back: { x: -15, y: -24 }, front: { x: -3, y: -17 }, side: { x: 15, y: -24 } },
  variants: 1,
  rise: 0,
  headChance: 0.85,
  draw: () => ({
    art: {
      line: box(-15, -45, 15, 0) + pl(-15, -30, 15, -30) + pl(10.5, -41, 10.5, -34) + pl(10.5, -27, 10.5, -14),
      thin:
        box(-10, -41, 5, -35, 0.5) +
        pl(-13, -5, 13, -5) +
        pl(-10, -9, 5, -9) +
        hatchRect(7.5, -28, 14.5, -6.5, 2.6),
      hatch: rectPath(-9, -39.5, 4, -36.5),
      ink: circ(7.5, -38, 0.9),
    },
    hips: [-9, 9],
  }),
};

const vacuum: BodyPart = {
  id: 'vacuum',
  family: FAM,
  tier: 0,
  w: 44,
  h: 31,
  neck: { x: 7, y: -30 },
  anchors: { topL: { x: -13, y: -30 }, topR: { x: 14, y: -26 }, back: { x: -22, y: -14 }, front: { x: -8, y: -16 }, side: { x: 22, y: -14 } },
  variants: 1,
  rise: 3,
  headChance: 0.85,
  draw: () => ({
    art: {
      line:
        'M-19 0Q-22 0-22-4L-22-20Q-22-26-16-26L16-26Q22-26 22-20L22-4Q22 0 19 0Z' +
        'M-12-26Q-12-30 0-30Q12-30 12-26' +
        pl(-3, -30, -3, -33) +
        'M-3-33Q0-35 3-33' +
        pl(3, -33, 3, -30),
      thin:
        'M-22-11Q0-7 22-11' +
        circ(5, -18, 4) +
        circ(5, -18, 1.5) +
        pl(-17, -3, -6, -3) +
        pl(12, -3, 19, -3) +
        hatchRect(8, -10, 20.5, -1.4, 2.7),
      ink: circ(-11, -17, 0.9),
    },
    hips: [-14, 14],
  }),
};

const speaker: BodyPart = {
  id: 'speaker',
  family: FAM,
  tier: 0,
  w: 26,
  h: 38,
  neck: { x: 0, y: -37 },
  anchors: { topL: { x: -8, y: -35 }, topR: { x: 8, y: -35 }, back: { x: -13, y: -18 }, front: { x: -3, y: -16 }, side: { x: 13, y: -18 } },
  variants: 1,
  rise: 0,
  headChance: 0.7,
  ranged: { range: 190, cooldown: 2.6, speed: 130, damageMul: 0.7, type: 'egzystencjalny' },
  draw: () => {
    let dots = '';
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) dots += circ(-10 + c * 3.3 + (r % 2) * 1.6, -27 + r * 4.8, 0.5);
    return {
      art: {
        line: pl(-13, -33, -13, -3) + pl(13, -33, 13, -3) + 'M-13-3Q0 4 13-3' + ell(0, -33, 13, 4),
        thin: ell(0, -33, 8.5, 2.4),
        hatch: 'M3-30.6L13-30L13-3Q8-0.6 3-1.4Z',
        ink: dots + circ(10, -33, 0.9),
      },
      hips: [-8, 8],
    };
  },
};

const router: BodyPart = {
  id: 'router',
  family: FAM,
  tier: 0,
  w: 38,
  h: 22,
  neck: { x: 0, y: -22 },
  anchors: { topL: { x: -9, y: -22 }, topR: { x: 9, y: -22 }, back: { x: -19, y: -11 }, front: { x: -9, y: -7 }, side: { x: 19, y: -11 } },
  variants: 1,
  rise: 18,
  headChance: 0.9,
  ranged: { range: 200, cooldown: 2.4, speed: 140, damageMul: 0.7, type: 'regulaminowy' },
  draw: () => ({
    art: {
      line:
        box(-19, -22, 19, 0) +
        pl(-15, -22, -18, -38) +
        pl(15, -22, 18, -37) +
        circ(-18.4, -39.6, 1.7) +
        circ(18.4, -38.6, 1.7),
      thin:
        circ(-11, -13, 1.3) +
        circ(-6.5, -13, 1.3) +
        circ(-2, -13, 1.3) +
        box(8, -15, 11, -10, 0.4) +
        box(13, -15, 16, -10, 0.4) +
        pl(-16, -18, -5, -18) +
        pl(-16, -20, -5, -20) +
        hatchRect(-18, -7, 18, -1.2, 2.7),
      ink: circ(-11, -13, 0.8) + circ(-6.5, -13, 0.8),
    },
    hips: [-12, 12],
  }),
};

const printer: BodyPart = {
  id: 'printer',
  family: FAM,
  tier: 0,
  w: 40,
  h: 28,
  neck: { x: -9, y: -28 },
  anchors: { topL: { x: -16, y: -28 }, topR: { x: 0, y: -28 }, back: { x: -20, y: -12 }, front: { x: 6, y: -14 }, side: { x: 20, y: -14 } },
  variants: 1,
  rise: 14,
  headChance: 0.9,
  ranged: { range: 210, cooldown: 2.2, speed: 150, damageMul: 0.8, type: 'mechaniczny' },
  draw: () => ({
    art: {
      line:
        box(-20, -22, 20, 0) +
        box(-18, -28, 18, -22, 0.7) +
        'M5-28L9-42L21-39L17-28' +
        'M20-9Q29-8 27 0',
      thin:
        box(-16, -19.5, -4, -13, 0.5) +
        circ(0, -16, 1.4) +
        circ(4, -16, 1.4) +
        pl(-20, -8, 20, -8) +
        pl(10.5, -37, 19, -35) +
        pl(10, -34, 18, -32.5) +
        pl(9.5, -31, 15, -30) +
        hatchRect(-18, -6.5, 18, -1.2, 2.7),
      hatch: rectPath(-15, -18.5, -5, -14),
    },
    hips: [-13, 13],
  }),
};

function paczkomatArt() {
  let thin = box(-10, -49, 10, -40, 0.6);
  let hatch = rectPath(-8.5, -47.5, 8.5, -41.5);
  let ink = '';
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) {
      const x0 = -11.5 + c * 7.7;
      const y0 = -37 + r * 8;
      if (r === 1 && c === 2) {
        // an open locker: the door stands ajar
        thin += box(x0, y0, x0 + 7, y0 + 7, 0.3) + poly(x0 + 7, y0, x0 + 11.5, y0 - 1.6, x0 + 11.5, y0 + 5.4, x0 + 7, y0 + 7);
        continue;
      }
      thin += box(x0, y0, x0 + 7, y0 + 7, 0.3);
      if ((r === 2 && c === 0) || (r === 0 && c === 1)) hatch += rectPath(x0 + 0.8, y0 + 0.8, x0 + 6.2, y0 + 6.2);
      else ink += circ(x0 + 5.3, y0 + 3.5, 0.5);
    }
  }
  return { line: box(-14, -52, 14, 0), thin, hatch, ink };
}

const paczkomat: BodyPart = {
  id: 'paczkomat',
  family: FAM,
  tier: 0,
  w: 28,
  h: 52,
  neck: { x: 0, y: -52 },
  anchors: { topL: { x: -9, y: -52 }, topR: { x: 9, y: -52 }, back: { x: -14, y: -26 }, front: { x: 3, y: -20 }, side: { x: 14, y: -26 } },
  variants: 1,
  rise: 0,
  headChance: 0.6,
  ranged: { range: 230, cooldown: 3.2, speed: 105, damageMul: 1.2, type: 'mechaniczny' },
  draw: () => ({ art: paczkomatArt(), hips: [-8, 8] }),
};

export const DEVICE_BODIES: readonly BodyPart[] = [fridge, vacuum, speaker, router, printer, paczkomat];

// ---------- legs ----------

const stilts: LegPart = {
  id: 'stilts',
  lenMin: 14,
  lenMax: 30,
  draw(hips, len, phase) {
    return hips.map((hx, i) => {
      const k = (i + phase) % 2 === 0 ? 2.8 : -2.8;
      const kx = hx + k;
      const foot = hx < 0 ? -3.6 : 3.6;
      return `M${hx} 0L${kx} ${len * 0.5}L${hx + k * 0.25} ${len}l${foot} 0` + circ(kx, len * 0.5, 1.2);
    });
  },
};

const wheels: LegPart = {
  id: 'wheels',
  lenMin: 12,
  lenMax: 19,
  draw(hips, len, phase) {
    const rw = Math.min(7.5, len * 0.45);
    const cy = len - rw;
    const d = phase === 0 ? rw : rw * 0.71;
    return hips.map((hx) => {
      const spokes = phase === 0 ? pl(hx - d, cy, hx + d, cy) + pl(hx, cy - d, hx, cy + d) : pl(hx - d, cy - d, hx + d, cy + d) + pl(hx - d, cy + d, hx + d, cy - d);
      return pl(hx, 0, hx, cy - rw) + circ(hx, cy, rw) + circ(hx, cy, 1.2) + spokes;
    });
  },
};

const treads: LegPart = {
  id: 'treads',
  lenMin: 11,
  lenMax: 15,
  draw(hips, len, phase) {
    const x0 = Math.min(...hips) - 9;
    const x1 = Math.max(...hips) + 9;
    const y0 = len - 9;
    const loop = `M${x0 + 4.5} ${y0}L${x1 - 4.5} ${y0}A4.5 4.5 0 0 1 ${x1 - 4.5} ${len}L${x0 + 4.5} ${len}A4.5 4.5 0 0 1 ${x0 + 4.5} ${y0}Z`;
    let teeth = '';
    for (let x = x0 + 6 + phase * 2; x < x1 - 4; x += 4) teeth += pl(x, len, x, len + 1.6) + pl(x, y0, x, y0 - 1.6);
    let wheelsD = '';
    const n = 3;
    for (let i = 0; i < n; i++) wheelsD += circ(x0 + 6 + ((x1 - x0 - 12) * i) / (n - 1), len - 4.5, 2.2);
    return [loop + teeth + wheelsD, ...hips.map((hx) => pl(hx, 0, hx, y0))];
  },
};

const spring: LegPart = {
  id: 'spring',
  lenMin: 12,
  lenMax: 24,
  draw(_hips, len, phase) {
    const coilLen = len * (phase === 0 ? 0.86 : 0.64);
    const amp = 4.6;
    const n = 12;
    let d = 'M0 0';
    for (let i = 1; i <= n; i++) d += `L${i % 2 === 1 ? amp : -amp} ${(i / n) * coilLen}`;
    d += `L0 ${coilLen}L0 ${len}` + pl(-4.5, len, 4.5, len);
    return [d];
  },
};

export const DEVICE_LEGS: readonly LegPart[] = [stilts, wheels, treads, spring];

// ---------- heads ----------

export const DEVICE_HEADS: readonly HeadPart[] = [
  {
    id: 'lens',
    h: 15,
    hw: 16,
    art: {
      line: pl(-4, 0, -4, -3) + pl(4, 0, 4, -3) + box(-6, -14, 7, -3) + 'M7-13L14-14.5L14-2.5L7-4' + ell(14, -8.5, 2.2, 6.2),
      thin: ell(14, -8.5, 1, 3) + pl(10.5, -13.7, 10.5, -3.3) + hatchRect(-5, -8, 6, -3.6, 2.6),
      ink: circ(14, -8.5, 0.9) + circ(-3, -11.5, 0.9),
    },
  },
  {
    id: 'periscope',
    h: 20,
    hw: 12,
    art: {
      line: pl(-3, 0, -3, -17, 10, -17) + pl(3, 0, 3, -13, 10, -13) + pl(10, -18.5, 10, -11.5),
      thin: pl(-4.5, -5, 4.5, -5) + pl(-4.5, -8, 4.5, -8) + ell(10, -15, 1.2, 2.5),
      ink: circ(10.6, -15, 0.8),
    },
  },
  {
    id: 'screen',
    h: 17,
    hw: 10,
    art: {
      line: pl(-2, 0, -2, -3) + pl(2, 0, 2, -3) + box(-9, -16, 9, -3),
      thin: box(-7, -14, 7, -5, 0.4) + 'M-3-6.3Q0-8 3-6.3',
      hatch: rectPath(-7, -9.5, 7, -5),
      ink: circ(-2.9, -12.3, 1.2) + circ(2.9, -12.3, 1.2),
    },
  },
  {
    id: 'dish',
    h: 19,
    hw: 12,
    art: {
      line: pl(0, 0, 0, -6) + 'M-8-6Q-3-17 9-14' + 'M-8-6Q4-4 9-14' + pl(1, -10, 9, -18.5) + circ(9.6, -19.6, 1.5),
      thin: 'M-5-7.5Q-1-11 4-11.5',
      hatch: 'M-7.4-6.4Q-3-15.5 8-13.6Q4-5.6-7.4-6.4Z',
    },
  },
];

// ---------- decorations ----------

export const DEVICE_DECOS: readonly DecoPart[] = [
  {
    id: 'antenna',
    family: FAM,
    slot: 'top',
    anchors: ['topL', 'topR'],
    rise: 18,
    draw: () => ({ art: { line: 'M0 0L-1-9L2-15', thin: pl(-1, -9, -5, -13), ink: circ(2.6, -16.6, 1.6) } }),
  },
  {
    id: 'wifi',
    family: FAM,
    slot: 'top',
    anchors: ['topR', 'topL'],
    rise: 12,
    draw: () => ({ art: { line: 'M-3-5Q0-8 3-5M-6-8Q0-14 6-8', ink: circ(0, -2.2, 1.1) } }),
  },
  {
    id: 'cable',
    family: FAM,
    slot: 'side',
    anchors: ['back'],
    rise: 0,
    draw: () => ({
      art: {
        line: 'M0 0C-8 2-11 9-7 15C-4 20-9 24-5 28' + poly(-8, 28, -3, 29.5, -4.2, 33.7, -9.2, 32.2),
        thin: pl(-5.5, 33.5, -5, 36),
      },
    }),
  },
  {
    id: 'smart',
    family: FAM,
    slot: 'side',
    anchors: ['front', 'side'],
    rise: 0,
    draw: () => ({
      art: { line: box(-8, -3.8, 8, 3.8, 0.5), thin: 'M8-3.8Q6.5-1.5 8 0.6' },
      texts: [{ key: 'enemies.deco.smart', x: 0, y: 1.9, size: 6, font: 'mono', rot: -3 }],
    }),
  },
  {
    id: 'qr',
    family: FAM,
    slot: 'side',
    anchors: ['front', 'side', 'back'],
    rise: 0,
    draw: () => ({
      art: {
        line: box(-6, -6, 6, 6, 0.5),
        thin: box(-4.6, -4.6, -1.6, -1.6, 0.2) + box(1.6, -4.6, 4.6, -1.6, 0.2) + box(-4.6, 1.6, -1.6, 4.6, 0.2),
        hatch: rectPath(2, 2, 4.4, 4.4),
        ink: circ(0, 0, 0.8) + circ(-0.2, 3.6, 0.7),
      },
    }),
  },
  {
    id: 'fan',
    family: FAM,
    slot: 'side',
    anchors: ['side', 'front', 'back'],
    rise: 0,
    draw: () => ({
      art: {
        line: circ(0, 0, 6.6),
        thin: 'M0 0Q3.6-3.6 0-6M0 0Q5 3.6 6 0M0 0Q-3.6 3.6 0 6M0 0Q-5-3.6-6 0',
        ink: circ(0, 0, 1.3),
      },
    }),
  },
  {
    id: 'tape',
    family: FAM,
    slot: 'side',
    anchors: ['front', 'back', 'side'],
    rise: 0,
    draw: () => ({
      art: {
        line: poly(-7, -3, 5, 3, 7, 0.4, -5, -5.6) + poly(-7, 3, 5, -3, 7, -0.4, -5, 5.6),
        hatch: poly(-7, -3, 5, 3, 7, 0.4, -5, -5.6),
      },
    }),
  },
];
