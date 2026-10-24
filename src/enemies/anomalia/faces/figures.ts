/**
 * The five figures of the Anomalia's middle phase (STORY 3): ink only, drawn in the part library's manner
 * (outline, thin detail, hatch, solid dots; no fills, no gradients). Body ids are `anomalia-<face>`; `figure: true`
 * keeps them out of the random assembly (enemies/parts.ts bodiesOf). Frames as in enemies/partsBase.ts.
 */
import { box, circ, ell, hatchRect, mergeArt, pl, poly, rectPath, type Art, type BodyPart, type BodyArt } from '../../partsBase';

const f1 = (n: number): string => String(Math.round(n * 10) / 10);

/** A cable hanging from (x0, y0) to (x1, y1) with a sag. */
const cable = (x0: number, y0: number, x1: number, y1: number, sag: number): string =>
  `M${f1(x0)} ${f1(y0)}Q${f1((x0 + x1) / 2)} ${f1((y0 + y1) / 2 + sag)} ${f1(x1)} ${f1(y1)}`;

// ---------- Kierownik Kolejki: a switchboard with a hundred headset cables ----------

function kierownikArt(): Art {
  let jacks = '';
  let sockets = '';
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 6; c++) {
      jacks += circ(-20 + c * 8, -52 + r * 8.5, 2.1);
      if ((r + c) % 3 !== 0) sockets += circ(-20 + c * 8, -52 + r * 8.5, 0.9);
    }
  }
  const cables =
    cable(-20, -50, -34, -6, 10) +
    cable(-12, -50, -28, -2, 12) +
    cable(-4, -42, 6, -3, 9) +
    cable(12, -43, 30, -4, 11) +
    cable(20, -52, 36, -10, 8) +
    cable(4, -34, -14, -4, 7);
  return {
    line:
      box(-30, -62, 30, -14) +
      box(-34, -14, 34, 0, 0.8) +
      jacks +
      // the headset: a band over the top, an ear cup, a microphone boom
      'M-14-62Q0-90 18-62' +
      ell(-15, -66, 4.5, 6.5) +
      ell(19, -66, 3.5, 5.5) +
      'M-19-62Q-30-56 -22-50' +
      cables,
    thin:
      sockets +
      pl(-30, -33, 30, -33) +
      pl(-24, -24, 24, -24) +
      pl(-24, -20, 4, -20) +
      cable(-26, -22, -40, -30, 6) +
      cable(26, -22, 42, -26, 6) +
      cable(-30, -58, -44, -40, 8) +
      cable(30, -58, 46, -46, 10),
    hatch: rectPath(-33, -12, 33, -2),
    ink: circ(-16, -68, 1) + circ(24, -48, 1.1),
  };
}

const KIEROWNIK_HIPS = [-18, 18];
function kierownikLegs(_v: number, phase: 0 | 1): string[] {
  return KIEROWNIK_HIPS.map((hx, i) => {
    const k = (i + phase) % 2 === 0 ? 3 : -3;
    return `M${hx} 0L${f1(hx + k)} 12L${f1(hx - k * 0.4)} 25l${hx < 0 ? -5 : 5} 0.6`;
  });
}

// ---------- Serwisant Autoryzowany: a terminal on legs with arms and a stamp ----------

function serwisantArt(): Art {
  return {
    line:
      // the terminal: a monitor, a keyboard slab, a base
      box(-22, -64, 22, -26) +
      box(-17, -58, 17, -34, 0.7) +
      box(-26, -26, 26, -14, 0.8) +
      pl(-8, -34, -8, -26) +
      // a big cross on the screen: the reset
      pl(-10, -54, 10, -38) +
      pl(10, -54, -10, -38) +
      // left arm to a claw
      pl(-26, -22, -40, -30, -46, -14, -42, -8) +
      pl(-42, -8, -47, -5) +
      pl(-42, -8, -38, -3) +
      // right arm to a stamp
      pl(26, -22, 40, -34, 48, -22) +
      box(44, -22, 56, -12, 0.6) +
      pl(50, -22, 50, -28) +
      pl(46, -28, 54, -28),
    thin:
      pl(-22, -18, 22, -18) +
      pl(-18, -21, -10, -21) +
      pl(-4, -21, 4, -21) +
      pl(10, -21, 18, -21) +
      pl(0, -64, 4, -72, 12, -72) +
      circ(13, -72, 1.4) +
      pl(45, -17, 55, -17),
    hatch: rectPath(-16, -57, 16, -35),
    ink: circ(-20, -62, 0.9) + circ(20, -62, 0.9) + circ(-24, -16, 0.9) + circ(24, -16, 0.9),
  };
}

const SERWISANT_HIPS = [-14, 14];
function serwisantLegs(_v: number, phase: 0 | 1): string[] {
  return SERWISANT_HIPS.map((hx, i) => {
    const k = (i + phase) % 2 === 0 ? 4 : -4;
    // a jointed servo leg: two segments, a knee, a flat foot
    return `M${hx} -14L${hx} 0L${f1(hx + k)} 10L${f1(hx + k * 0.6)} 22l${hx < 0 ? -6 : 6} 0.8`;
  });
}

// ---------- Węzeł: all the loops at once, a crowd of cosmonaut outlines in one figure ----------

function cosmonaut(cx: number, cy: number, s: number): Art {
  const sc = (n: number): number => n * s;
  return {
    line:
      circ(cx, cy - sc(34), sc(8)) +
      ell(cx + sc(2), cy - sc(34), sc(4.4), sc(5)) +
      box(cx - sc(6), cy - sc(25), cx + sc(6), cy - sc(8), 0.4) +
      pl(cx - sc(6), cy - sc(21), cx - sc(15), cy - sc(12)) +
      pl(cx + sc(6), cy - sc(21), cx + sc(14), cy - sc(29)) +
      pl(cx - sc(3), cy - sc(8), cx - sc(6), cy + sc(8)) +
      pl(cx + sc(3), cy - sc(8), cx + sc(7), cy + sc(8)),
    thin: box(cx - sc(3), cy - sc(21), cx + sc(3), cy - sc(16), 0.2),
  };
}

function wezelArt(): Art {
  const loops: [number, number, number][] = [
    [-26, -6, 0.8],
    [-13, -12, 0.85],
    [0, -3, 1],
    [14, -14, 0.82],
    [27, -4, 0.8],
  ];
  const parts = loops.map(([x, y, s]) => cosmonaut(x, y, s));
  // the knot itself: a rope that goes through all of them, and an arrow of the order of the loops, pointing at itself
  const knot: Art = {
    thin: 'M-32-30C-12-58 10-4 32-36',
    ink: circ(-8, -46, 1) + circ(10, -40, 1) + circ(0, -26, 1),
  };
  return mergeArt(...parts, knot);
}

function wezelLegs(_v: number, phase: 0 | 1): string[] {
  // no legs to speak of: the loose ends of the rope, which sway
  const k = phase === 0 ? 3 : -3;
  return [`M-10 0C${f1(-14 + k)} 6 ${f1(-6 - k)} 12 ${f1(-12 + k)} 18`, `M10 0C${f1(14 - k)} 6 ${f1(6 + k)} 12 ${f1(12 - k)} 18`, `M0 0C${f1(k)} 7 ${f1(-k)} 13 ${f1(k * 0.5)} 20`];
}

// ---------- Planeta Nieistniejąca: a surveyed disc with contour lines and a flag ----------

/**
 * Solid strokes throughout, drawn in the thin pen (the figure is drawn twice the size of the others): the outline, the contour
 * lines of the terrain, two closed contour rings, a flag. What does not exist yet is shown by the measuring arcs around it
 * (render/enemyFigures.ts `measuredArcs`: dotted while unmeasured, firm once the laser has measured the sector), not by the body.
 */
function planetaArt(): Art {
  return {
    line: circ(0, -48, 46),
    thin:
      // contour lines across the terrain
      'M-38-66C-24-74-8-66 2-72C14-78 28-70 38-62' +
      'M-44-48C-30-56-14-42 0-50C14-58 30-44 44-50' +
      'M-42-32C-28-40-14-28 2-36C16-44 28-32 40-36' +
      'M-30-14C-12-20 6-12 28-18' +
      // two closed contour rings: a hill and a hollow
      'M-26-58C-22-66-6-66-4-58C-2-50-22-48-26-58Z' +
      'M10-42C14-48 28-46 28-40C28-34 12-34 10-42Z' +
      // a survey flag stuck where nobody has been
      pl(24, -92, 24, -110) +
      poly(24, -110, 38, -106, 24, -102),
    hatch: poly(-30, -18, -12, -22, 8, -18, 24, -22, 30, -18, 22, -10, -22, -10),
    ink: circ(-15, -58, 1.1) + circ(19, -40, 1.1) + circ(4, -64, 1.1) + circ(24, -92, 1.2),
  };
}

// ---------- Obserwatorium: a tower on legs with one lens that only sees round things ----------

function obserwatoriumArt(): Art {
  return {
    line:
      // the tower
      poly(-20, 0, 20, 0, 14, -62, -14, -62) +
      // the dome, open with a slit
      'M-18-62C-18-92 18-92 18-62Z' +
      pl(-3, -90, -3, -66) +
      pl(3, -90, 3, -66) +
      // the telescope tube out of the slit, one great lens at its end
      pl(10, -78, 44, -96) +
      pl(14, -70, 46, -88) +
      circ(48, -92, 9) +
      circ(48, -92, 5.5),
    thin:
      pl(-17, -40, 17, -40) +
      pl(-15, -52, 15, -52) +
      box(-5, -34, 5, -18, 0.4) +
      // cross-hairs in the lens, and its rim ticks
      pl(40, -92, 56, -92) +
      pl(48, -100, 48, -84) +
      hatchRect(-14, -34, -7, -4, 2.4),
    hatch: rectPath(8, -34, 15, -4),
    ink: circ(48, -92, 1.6) + circ(0, -26, 1),
  };
}

function obserwatoriumLegs(_v: number, phase: 0 | 1): string[] {
  const k = phase === 0 ? 2 : -2;
  return [`M-16 0L${f1(-30 + k)} 14L${f1(-36 + k)} 30l-7 0.8`, `M0 0L${f1(-k)} 16L${f1(-k * 0.5)} 30l0 0.8`, `M16 0L${f1(30 - k)} 14L${f1(36 - k)} 30l7 0.8`];
}

// ---------- the bodies ----------

const anchors = (w: number, h: number): BodyPart['anchors'] => ({
  topL: { x: -w / 3, y: -h },
  topR: { x: w / 3, y: -h },
  back: { x: -w / 2, y: -h / 2 },
  front: { x: 0, y: -h / 2 },
  side: { x: w / 2, y: -h / 2 },
});

function figure(id: string, w: number, h: number, art: Art, hips: number[], legs: BodyPart['ownLegs'], legLen: number, dotted = 0): BodyPart {
  const body: BodyArt = { art, hips };
  return {
    id,
    family: 'wygenerowane',
    tier: 0,
    w,
    h,
    neck: null,
    anchors: anchors(w, h),
    variants: 1,
    rise: 0,
    headChance: 0,
    figure: true,
    ...(dotted > 0 ? { dotted } : {}),
    ...(legs ? { ownLegs: legs } : {}),
    ownLegLen: legLen,
    draw: () => body,
  };
}

export const FIGURE_IDS = {
  kierownik: 'anomalia-kierownik',
  serwisant: 'anomalia-serwisant',
  wezel: 'anomalia-wezel',
  planeta: 'anomalia-planeta',
  obserwatorium: 'anomalia-obserwatorium',
} as const;

export const FACE_FIGURES: readonly BodyPart[] = [
  figure(FIGURE_IDS.kierownik, 92, 90, kierownikArt(), KIEROWNIK_HIPS, kierownikLegs, 25),
  figure(FIGURE_IDS.serwisant, 112, 72, serwisantArt(), SERWISANT_HIPS, serwisantLegs, 22),
  figure(FIGURE_IDS.wezel, 74, 70, wezelArt(), [-10, 0, 10], wezelLegs, 20),
  figure(FIGURE_IDS.planeta, 96, 110, planetaArt(), [], undefined, 0),
  figure(FIGURE_IDS.obserwatorium, 112, 100, obserwatoriumArt(), [-16, 0, 16], obserwatoriumLegs, 30),
];
