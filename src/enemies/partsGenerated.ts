/**
 * Wygenerowane: the probable beasts. A dragon, a thing that is mostly legs, an "ewentualny" bear and a hand
 * with seven fingers. The family is drawn with a dotted pen (the dash pattern comes from the existence
 * coefficient, see render/enemyFigures.ts); the strokes here are plain.
 */
import { circ, ell, hatchRect, pl, poly, type Art, type BodyPart, type DecoPart } from './partsBase';

const FAM = 'wygenerowane' as const;
const r1 = (n: number): number => Math.round(n * 10) / 10;

// ---------- dragon ----------

const DRAGON_HIPS = [-17, -9, 9, 17];

export function dragonWings(v: number): Art {
  let line = 'M3-24L-6-47M3-24L10-49M3-24L22-36' + 'M-6-47Q-1-38 10-49Q13-40 22-36' + 'M22-36Q14-32 8-26';
  let thin = '';
  if (v % 3 === 1) thin += 'M-4-25L-13-45M-4-25L-1-46M-13-45Q-9-39-1-46';
  return { line, thin };
}

export function dragonTail(): Art {
  return { line: 'M-19-8C-30-6-36-16-44-12' + poly(-45, -11.5, -52, -8, -47, -4.5) };
}

function dragonArt(v: number): Art {
  const spikes = 4 + (v % 4);
  let thin = 'M-8-14q2-2 4 0q2-2 4 0M-2-9q2-2 4 0q2-2 4 0' + hatchRect(-12, -8.5, 12, -1.2, 2.6);
  const topY = (x: number): number => -(26 - (((x + 2) / 14) ** 2) * 7);
  let line = '';
  for (let i = 0; i < spikes; i++) {
    const x = -15 + (i * 24) / (spikes - 1);
    const y = topY(x);
    line += pl(x - 2, r1(y), x, r1(y - 5.5), x + 2, r1(y + 0.4));
  }
  const wings = dragonWings(v);
  const tail = dragonTail();
  thin += wings.thin ?? '';
  return {
    line:
      'M-20-8C-21-22-2-27 10-22C18-19 19-8 14-3C10 0-12 0-16-1C-19-2-20-5-20-8Z' +
      'M8-23C14-27 17-33 19-41' +
      'M15-9C22-14 24-28 25-35' +
      poly(19, -41, 22, -46, 32, -45, 39, -41, 37, -38, 29, -37.5, 25, -35) +
      'M22-46L19-53L26-47' +
      line +
      (wings.line ?? '') +
      (tail.line ?? ''),
    thin: thin + pl(26, -38.6, 36, -39.2),
    ink: circ(27, -42, 1.1) + circ(36, -40.5, 0.6) + circ(42, -39.5, 0.8) + circ(45, -37.5, 1) + circ(48, -35.5, 1.2),
  };
}

function dragonLegs(_v: number, phase: 0 | 1): string[] {
  return DRAGON_HIPS.map((hx, i) => {
    const k = (i + phase) % 2 === 0 ? 3.2 : -3.2;
    return `M${hx} 0L${r1(hx + k)} 10L${r1(hx + k * 0.3)} 20l2.8 0`;
  });
}

const dragon: BodyPart = {
  id: 'dragon',
  family: FAM,
  tier: 0,
  w: 60,
  h: 53,
  neck: null,
  anchors: { topL: { x: -14, y: -21 }, topR: { x: 6, y: -26 }, back: { x: -20, y: -8 }, front: { x: -2, y: -12 }, side: { x: 14, y: -12 } },
  variants: 6,
  rise: 0,
  headChance: 0,
  dotted: 0.7,
  ownLegLen: 20,
  ownLegs: dragonLegs,
  ranged: { range: 190, cooldown: 2.8, speed: 120, damageMul: 0.8, type: 'egzystencjalny' },
  draw: (v) => ({ art: dragonArt(v), hips: DRAGON_HIPS }),
};

// ---------- the thing that is mostly legs ----------

const legCount = (v: number): number => 7 + (v % 5);
const nogaczHips = (v: number): number[] => {
  const n = legCount(v);
  return Array.from({ length: n }, (_, i) => r1(-8 + (16 * i) / (n - 1)));
};

function nogaczLegs(v: number, phase: 0 | 1): string[] {
  return nogaczHips(v).map((hx, i) => {
    const k = (i + phase) % 2 === 0 ? 2.4 : -2.4;
    const kx = hx * 1.9 + k;
    return `M${hx} 0L${r1(kx)} 14L${r1(hx * 2.4 + k * 0.4)} 27L${r1(hx * 2.5 + k * 0.4 + (hx < 0 ? -2.4 : 2.4))} 36`;
  });
}

const nogacz: BodyPart = {
  id: 'nogacz',
  family: FAM,
  tier: 0,
  w: 40,
  h: 31,
  neck: null,
  anchors: { topL: { x: -6, y: -25 }, topR: { x: 6, y: -25 }, back: { x: -11, y: -14 }, front: { x: -3, y: -8 }, side: { x: 11, y: -14 } },
  variants: 5,
  rise: 0,
  headChance: 0,
  dotted: 0.5,
  ownLegLen: 36,
  ownLegs: nogaczLegs,
  draw: (v) => ({
    art: {
      line:
        'M0-27C-10-27-12-10-9-3C-7 0 7 0 9-3C12-10 10-27 0-27Z' +
        circ(2, -17, 5.5) +
        'M-3.5-19.5Q2-25 7.5-19.5' +
        pl(0, -27, -2, -31) +
        pl(0, -27, 3.5, -31),
      thin: 'M-4-8Q1-5.4 6-8' + pl(-1, -24.5, 6, -25),
      hatch: 'M5-24C9-18 9-8 6-3L2.4-1.4C5.4-8 5.4-18 3-24Z',
      ink: circ(3.4, -17, 2.2),
    },
    hips: nogaczHips(v),
  }),
};

// ---------- ewentualny bear ----------

const BEAR_HIPS = [-15, -8, 10, 17];

export function bearArt(v: number): Art {
  const ears = [1, 2, 3][v % 3] ?? 2;
  const earCenters: [number, number][] = [
    [20, -45.5],
    [28.5, -46.5],
    [24.5, -49],
  ];
  let line =
    'M-22-14C-24-26-14-33-2-33C8-33 14-30 17-26' +
    'M20-20C21-17 19-12 17-8' +
    'M14-4C8-2-4-2-14-3' +
    'M-19-5C-22-8-22-11-22-14' +
    'M17-26C14-33 18-42 26-43C33-43 36-38 35-33C35-29 32-26 28-25' +
    ell(33, -32, 5, 3.6);
  for (let i = 0; i < ears; i++) {
    const c = earCenters[i];
    if (c) line += circ(c[0], c[1], 3.2);
  }
  let fur = '';
  for (let x = -17; x <= 11; x += 5) {
    const y = -33 + (((x + 2) / 22) ** 2) * 8;
    fur += pl(x, r1(y), x - 1.6, r1(y - 3));
  }
  return {
    line,
    thin: fur + 'M30-29Q33-27.5 37-30' + hatchRect(-16, -12, 13, -3.6, 2.7),
    ink: circ(37.6, -33.2, 1.3) + circ(27, -37, 1.1),
  };
}

export function bearLegs(_v: number, phase: 0 | 1): string[] {
  return BEAR_HIPS.map((hx, i) => {
    const k = (i + phase) % 2 === 0 ? 2.4 : -2.4;
    return (
      `M${hx - 2.4} 0L${r1(hx - 2.4 + k)} 9L${r1(hx - 2.6)} 16.5l6.4 0.5` +
      `M${hx + 2.4} -1L${r1(hx + 2.4 + k)} 9L${r1(hx + 3.8)} 17`
    );
  });
}

const bear: BodyPart = {
  id: 'bear',
  family: FAM,
  tier: 0,
  w: 56,
  h: 50,
  neck: null,
  anchors: { topL: { x: -12, y: -32 }, topR: { x: 6, y: -33 }, back: { x: -22, y: -16 }, front: { x: -4, y: -17 }, side: { x: 14, y: -16 } },
  variants: 3,
  rise: 0,
  headChance: 0,
  dotted: 0.6,
  ownLegLen: 17,
  ownLegs: bearLegs,
  draw: (v) => ({ art: bearArt(v), hips: BEAR_HIPS }),
};

// ---------- hand with seven fingers ----------

const HAND_HIPS = [-18, -12, -6, 0, 6, 12, 18];
const FINGER_LEN = [30, 33, 35, 36, 35, 33, 30];

function handLegs(_v: number, phase: 0 | 1): string[] {
  return HAND_HIPS.map((hx, i) => {
    const k = (i + phase) % 2 === 0 ? 3.4 : -3.4;
    const len = FINGER_LEN[i] ?? 32;
    const s1 = k * 0.35;
    const s2 = k * 0.8;
    const s3 = k * 1.2;
    const y1 = len * 0.33;
    const y2 = len * 0.66;
    const l = hx - 1.8;
    const r = hx + 1.8;
    return (
      `M${l} 0L${r1(l + s1)} ${r1(y1)}L${r1(l + s2)} ${r1(y2)}L${r1(l + 0.2 + s3)} ${len}` +
      `Q${r1(hx + s3)} ${r1(len + 2.8)} ${r1(r + s3)} ${len}` +
      `L${r1(r + s2)} ${r1(y2)}L${r1(r + s1)} ${r1(y1)}L${r} 0` +
      pl(r1(l + s1), r1(y1), r1(r + s1), r1(y1)) +
      pl(r1(l + s2), r1(y2), r1(r + s2), r1(y2))
    );
  });
}

const hand: BodyPart = {
  id: 'hand',
  family: FAM,
  tier: 0,
  w: 44,
  h: 38,
  neck: null,
  anchors: { topL: { x: -8, y: -30 }, topR: { x: 8, y: -30 }, back: { x: -21, y: -14 }, front: { x: 0, y: -14 }, side: { x: 21, y: -14 } },
  variants: 1,
  rise: 0,
  headChance: 0,
  dotted: 0.4,
  ownLegLen: 36,
  ownLegs: handLegs,
  draw: () => ({
    art: {
      line:
        'M-21 0C-23-12-21-24-12-28C-5-31 7-31 14-28C22-24 23-12 21 0' +
        pl(-7, -29, -8, -38) +
        pl(7, -29, 8, -38) +
        pl(-10, -38, 10, -38.4),
      thin: 'M-8-12Q0-9 8-12M-10-20Q-2-17 4-21' + hatchRect(-20, -24, -11, -4, 2.6),
    },
    hips: HAND_HIPS,
  }),
};

export const GENERATED_BODIES: readonly BodyPart[] = [dragon, nogacz, bear, hand];

// ---------- decorations ----------

export const GENERATED_DECOS: readonly DecoPart[] = [
  {
    id: 'eye',
    family: FAM,
    slot: 'side',
    anchors: ['front', 'side'],
    rise: 0,
    draw: () => ({
      art: {
        line: ell(0, 0, 5, 3.4) + 'M-4-3.2L-6-6M0-3.8L0-7M4-3.2L6-6',
        ink: circ(0.6, 0, 1.9),
      },
    }),
  },
  {
    id: 'signature',
    family: FAM,
    slot: 'side',
    anchors: ['side', 'back'],
    rise: 0,
    draw: () => ({ art: { thin: 'M-7 2q2-6 4 0t4 0t4 0t3-3' + pl(-8, 4.5, 8, 4) } }),
  },
  {
    id: 'limb',
    family: FAM,
    slot: 'top',
    anchors: ['topL', 'back'],
    rise: 12,
    draw: () => ({
      art: { line: 'M0 0C-3-4-1-8-4-12M0 0C3-5 6-7 8-11', thin: pl(-4, -12, -6, -13.5) + pl(-4, -12, -2.6, -14) + pl(8, -11, 10.6, -11.4) + pl(8, -11, 9.6, -13.6) },
    }),
  },
];
