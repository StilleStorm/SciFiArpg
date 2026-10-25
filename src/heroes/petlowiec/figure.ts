/** The Petlowiec's drawing and his auto-attack animation: the helmet dips and the remark is scribbled beside it. */
import { el, n2 } from '../../render/svg';
import type { Zone } from '../../entities/types';
import { circlePath, hide, setPart, type BuildExtras, type DriveCtx, type FigureDef, type HeroFigure } from '../figureKit';
import { clamp01, keyframes, neutralPose, type HeroPose } from '../poseKit';

/** a cosmonaut who arrived before departing: a second helmet, dotted, a little behind the first */
export const figureDef: FigureDef = {
  scale: 1.3,
  body: [
    'M-5-12.5H5',
    'M-8-12H8L9 4H-9Z', // suit
    'M-4-9H4V-2H-4Z', // panel
    'M-9 1H9', // belt
    'M-8-10H-13.5V2H-8', // backpack
    'M-13.5-6Q-17-6-17 0', // tube
    'M-8-10L-14-4L-13 3', // arms
    'M8-10L14-5L16 1',
    'M-13.5-6H-8M-13.5-2H-8', // tank ribs
    'M-4 9h.01M4 9h.01', // knee pads
  ],
  hatch: ['M-3.2-8.2H3.2V-2.8H-3.2Z', 'M4-12H8L9 4H4.5Z'],
  circles: [
    [-13, 4, 1.8],
    [16, 2, 1.8],
    [0, -5.5, 1],
  ],
  echo: [[4.5, -24, 9.5]],
  parts: {
    // the helmet dips in the remark
    head: {
      body: ['M-6.5-24Q0-29 6.5-24L6-19Q0-15.5-6-19Z', 'M6-30L9-36', 'M-8.5-22h.01M8.5-22h.01M0-31.5h.01'], // visor, antenna, rivets
      hatch: ['M-6-23.5Q0-27.5 6-23.5L5.6-19.8Q0-17 -5.6-19.8Z'],
      circles: [[0, -22, 9.5], [9.5, -37, 1.3]],
    },
  },
  legs: [
    ['M-4 4L-4.5 12L-8 17H-2.5', 'M4 4L5 11L8.5 17H14'],
    ['M-4 4L-2 12L-4.5 17H1', 'M4 4L8 12L7 17H12.5'],
  ],
};

/** Where the helmet turns, in figure units. */
const PIVOT = { head: [0, -13] } as const;
/** The Petlowiec's remark: a scribbled dash and a scribbled exclamation mark (about 14 units high) beside the helmet. */
const SPEECH = ['M13-22Q15.5-26 18-22.5Q20.5-19.5 23-22.5Q25.5-25.5 28-22', 'M33.6-35.5Q32-31.5 34-28Q34.8-25 33.6-22', 'M33.2-17.5h.01'] as const;

export function pose(t: number): HeroPose {
  const pose = neutralPose();
  const k = keyframes(clamp01(t / 200), [[0, 0], [0.3, 1], [0.7, 1], [1, 0]]);
  pose.dip = 4 * k;
  pose.tilt = 10 * k;
  pose.draw = clamp01(t / 70);
  pose.erase = clamp01((t - 130) / 70);
  return pose;
}

function build(inner: SVGGElement): BuildExtras {
  const speech = el('g', { 'data-part': 'speech' });
  const speechPaths: SVGPathElement[] = [];
  SPEECH.forEach((d, i) => speechPaths.push(el('path', { d, pathLength: 1, 'stroke-width': i === 2 ? 3.4 : 1.9 })));
  speech.append(...speechPaths);
  speech.style.display = 'none';
  inner.append(speech);
  return { speech, speechPaths };
}

function drive({ p, pose, side, fx }: DriveCtx): void {
  setPart(p, 'head', p.named.head, `translate(0 ${n2(pose.dip)}) rotate(${n2(pose.tilt * side)} ${PIVOT.head[0]} ${PIVOT.head[1]})`);
  const speech = p.speech;
  if (speech) {
    const shown = pose.draw > 0 && pose.erase < 1;
    hide(speech, !shown);
    setPart(p, 'speech', speech, side < 0 ? 'scale(-1 1)' : '');
    if (shown) {
      // the dash first, then the mark, then its dot
      p.speechPaths.forEach((path, i) => fx.setStroke(path, Math.max(0, Math.min(1, pose.draw * 3 - i)), pose.erase));
    }
  }
}

const f1 = (v: number): string => String(Math.round(v * 10) / 10);

/**
 * The things his skills leave on the page (S20), as strokes. Paradoks: a clock face as wide as its area, a dotted rim, twelve ticks and
 * two hands. Powtórzenie § 3: the ruled line left standing, dotted, from the zone's centre along its angle, with three crossbars.
 */
export function zoneParts(z: Zone): readonly string[] | null {
  const r = z.r;
  if (z.variant === 'paradoks') {
    let ticks = '';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const from = i % 3 === 0 ? 0.82 : 0.9;
      ticks += `M${f1(Math.cos(a) * r * from)} ${f1(Math.sin(a) * r * from)}L${f1(Math.cos(a) * r)} ${f1(Math.sin(a) * r)}`;
    }
    return [`~${circlePath(0, 0, r)}`, ticks, `M0 0V${f1(-r * 0.52)}`, `M0 0L${f1(r * 0.34)} ${f1(r * 0.17)}`, 'M-2 0h.01'];
  }
  if (z.variant === 'zapis') {
    const a = z.angle ?? 0;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let bars = '';
    for (const k of [0.25, 0.5, 0.75]) bars += `M${f1(dx * r * k + dy * 6)} ${f1(dy * r * k - dx * 6)}L${f1(dx * r * k - dy * 6)} ${f1(dy * r * k + dx * 6)}`;
    return [`~M0 0L${f1(dx * r)} ${f1(dy * r)}`, bars];
  }
  return null;
}

export const figure: HeroFigure = {
  def: figureDef,
  wash: { cx: 0, cy: -10, r: 21, seed: 0x4803 },
  hue: 'violet',
  attackMs: 200,
  pose,
  build,
  drive,
  zoneParts,
};
