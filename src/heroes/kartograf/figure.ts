/** The Kartograf's drawing and his auto-attack animation: the range pole kicks back as the ruled line is struck. */
import { n2 } from '../../render/svg';
import type { Summon, Zone } from '../../entities/types';
import { circlePath, setPart, type DriveCtx, type FigureDef, type HeroFigure } from '../figureKit';
import { clamp01, KICK, neutralPose, type HeroPose } from '../poseKit';

/** a surveyor of planets that only the navigation app confirms; carries the range pole and the map */
export const figureDef: FigureDef = {
  scale: 1.25,
  body: [
    'M-12-25Q0-29 12-25', // brim
    'M-6-26L-5-33H5L6-26', // crown
    'M-5.8-28.5H5.8',
    'M2-21.6h.01',
    'M-5.5-16L5.5-16L9 5L-9 5Z', // coat
    'M0-13h.01M0-9h.01M0-5h.01',
    'M3.5-11l1-1.5', // compass needle
    'M-17-10L-6-5L-7.5-1.5L-18.5-6.5Z', // rolled map
    'M-5.5-15L-10-9',
    'M-12-8.5l1 2.5',
  ],
  hatch: ['M-9 1L9 1L9 5L-9 5Z', 'M2.5-15L5.5-15L9 5L3.5 5Z', 'M-5.8-30H5.8V-28.5H-5.8Z'],
  circles: [
    [0, -21, 4.8],
    [3.5, -11, 2],
  ],
  parts: {
    // arm, range pole, flag and marks: pushed back by the measurement
    instrument: {
      body: ['M5.5-15L11-9L15-8', 'M15-36V20', 'M15-36L24-33L15-30Z', 'M13-24H17M13-14H17M13-4H17M13 6H17M13 16H17'],
      hatch: ['M15-35.4L22.8-33L15-30.6Z'],
    },
  },
  legs: [
    ['M-3 5L-4 13L-5 20H-1', 'M3 5L4.5 13L7 20H11'],
    ['M-3 5L-1 13L-2.5 20H1.5', 'M3 5L7 13L8.5 20H12.5'],
  ],
};

export function pose(t: number): HeroPose {
  const pose = neutralPose();
  // the instrument kicks back 6 units; the ruled line is not part of the pose (drawLaser, in render/attackFx.ts)
  pose.kick = t < 25 ? (KICK * t) / 25 : KICK * (1 - clamp01((t - 25) / 115)) ** 2;
  return pose;
}

function drive({ p, pose, a, t, lux, fx }: DriveCtx): void {
  setPart(p, 'instrument', p.named.instrument, `translate(${n2(-lux * pose.kick)} ${n2(-a.uy * pose.kick)})`);
  fx.driveLaser(a, t);
}

const f1 = (v: number): string => String(Math.round(v * 10) / 10);

/**
 * The things his skills leave on the page (S20), as strokes in the zone's own frame. A survey line (Przekroj, Pomiar kontrolny): a
 * ruled line from the centre along the zone's angle with a tick every 20 units. A border (Granica): two parallel rules across the
 * angle with a cross every 30 units and posts at both ends. The rose (Roza wiatrow): a dotted rim and a four-point star. The strike
 * (Skreslenie z mapy): the ruled rectangle, struck through by its two diagonals.
 */
export function zoneParts(z: Zone): readonly string[] | null {
  const a = z.angle ?? 0;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  if (z.variant === 'przekroj') {
    const ticks: string[] = [];
    for (let d = 20; d < z.r; d += 20) {
      ticks.push(`M${f1(ux * d + uy * 4)} ${f1(uy * d - ux * 4)}L${f1(ux * d - uy * 4)} ${f1(uy * d + ux * 4)}`);
    }
    return [`M0 0L${f1(ux * z.r)} ${f1(uy * z.r)}`, ticks.join('')];
  }
  if (z.variant === 'granica') {
    const r = z.r;
    const off = 3;
    const rule = (k: number): string => `M${f1(-ux * r - uy * k)} ${f1(-uy * r + ux * k)}L${f1(ux * r - uy * k)} ${f1(uy * r + ux * k)}`;
    const posts: string[] = [];
    for (const end of [-1, 1]) posts.push(`M${f1(ux * r * end - uy * 9)} ${f1(uy * r * end + ux * 9)}L${f1(ux * r * end + uy * 9)} ${f1(uy * r * end - ux * 9)}`);
    const crosses: string[] = [];
    for (let d = -r + 18; d < r - 8; d += 30) crosses.push(`M${f1(ux * d - uy * off)} ${f1(uy * d + ux * off)}L${f1(ux * d + uy * off)} ${f1(uy * d - ux * off)}`);
    return [rule(off), rule(-off), posts.join(''), crosses.join('')];
  }
  if (z.variant === 'roza') {
    const r = z.r;
    const s = r * 0.55;
    const w = s * 0.2;
    return [`~${circlePath(0, 0, r)}`, `M0 ${f1(-s)}L${f1(w)} ${f1(-w)}L${f1(s)} 0L${f1(w)} ${f1(w)}L0 ${f1(s)}L${f1(-w)} ${f1(w)}L${f1(-s)} 0L${f1(-w)} ${f1(-w)}Z`, `M-4 ${f1(-s - 7)}V${f1(-s - 19)}L4 ${f1(-s - 7)}V${f1(-s - 19)}`, circlePath(0, 0, w * 0.7)];
  }
  if (z.variant === 'skreslenie') {
    const w = z.r * 0.8;
    const h = z.r * 0.56;
    return [`M${f1(-w)} ${f1(-h)}H${f1(w)}V${f1(h)}H${f1(-w)}Z`, `M${f1(-w)} ${f1(-h)}L${f1(w)} ${f1(h)}M${f1(w)} ${f1(-h)}L${f1(-w)} ${f1(h)}`, `~M${f1(-w + 10)} ${f1(-h + 10)}H${f1(w - 10)}V${f1(h - 10)}H${f1(-w + 10)}Z`];
  }
  return null;
}

/** A benchmark (Punkt odniesienia): a small triangle on its pole over a ground rule, and the radius within which his lines pierce (dotted). */
export function summonParts(e: Summon): readonly string[] | null {
  if (e.variant !== 'benchmark') return null;
  return ['M0-14L11 4H-11Z', 'M0-14V-24', 'M-14 8H14', 'M0 0h.01', `~${circlePath(0, 0, 60)}`];
}

export const figure: HeroFigure = {
  def: figureDef,
  wash: { cx: -1, cy: -7, r: 20, seed: 0x4804 },
  hue: 'green',
  attackMs: 380,
  pose,
  drive,
  zoneParts,
  summonParts,
};
