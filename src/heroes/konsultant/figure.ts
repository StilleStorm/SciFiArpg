/** The Konsultant's drawing and his auto-attack animation: the throwing arm, the ticket, the lash of the headset cable. */
import { n2 } from '../../render/svg';
import { easeOut } from '../../render/tween';
import type { Summon, Zone } from '../../entities/types';
import { circlePath, hide, setPart, type DriveCtx, type FigureDef, type HeroFigure } from '../figureKit';
import { clamp01, keyframes, LASH_BACK_MS, LASH_OUT_MS, neutralPose, smooth, THROW_DEG, type HeroPose } from '../poseKit';

/** a helpline consultant who left the queue, still wearing the headset and dragging the cable */
export const figureDef: FigureDef = {
  scale: 1.35,
  body: [
    'M-6.5-26A6.5 6.5 0 0 1 6.5-26', // headband
    'M-8.5-27H-6V-22H-8.5Z', // ear cup
    'M-7.5-22Q-8-17-2.5-17', // boom
    'M-2-24.2h.01M2-24.2h.01M-1.5-21.3H1.5', // face
    'M0-18.5V-16',
    'M-8-16L8-16L9.5 3L-9.5 3Z', // jacket
    'M-8-16L0-7.5L8-16', // lapels
    'M0-16L-1.8-13L0-3L1.8-13Z', // tie
    'M8-15L13-8L12-1', // arm with cable
    'M-6.5-10H-2.5V-8H-6.5Z', // name plate
    'M-5-29Q0-32 5-29', // hair
  ],
  hatch: ['M-1.6-13L0-3L1.6-13Z', 'M3.5-14L8.5-15L9.5 3L4 3Z'],
  circles: [
    [0, -24, 5.5],
    [-2, -17, 1.2],
  ],
  parts: {
    // the throwing arm, and the ticket in its hand (it leaves the hand in the throw)
    arm: { body: ['M-8-15L-14-8L-13-1'] },
    ticket: { body: ['M-20-6L-11-8L-9 4L-18 6Z', 'M-18-3L-12-4.5M-17.5 0L-11.5-1.5'] },
    // the headset cable: from the boom down the chest to the hand, and its loose end with the plug (the lash in the attack)
    cable: { body: ['M-2.5-17Q8-13 6-6Q5-1.5 12-1'], tail: ['M12-1Q22 3 15 9Q8 14 20 17M20 16h3v3h-3Z'] },
  },
  legs: [
    ['M-4.5 3L-5 12L-6.5 19H-2', 'M4.5 3L5.5 12L8 19H12'],
    ['M-4.5 3L-2.5 12L-4 19H0.5', 'M4.5 3L8 12L9.5 19H14'],
  ],
};

/** Where the arm turns, in figure units. */
const PIVOT = { arm: [-8, -15] } as const;

export function pose(t: number): HeroPose {
  const pose = neutralPose();
  const p = clamp01(t / 160);
  pose.arm = keyframes(p, [[0, 0], [0.15, 30], [0.4, -THROW_DEG], [1, 0]]);
  // the ticket leaves the hand and comes back once the cable has snapped home
  pose.ticketOut = t >= 24 && t < LASH_OUT_MS + LASH_BACK_MS - 5;
  pose.lash = t <= 0 ? 0 : t < LASH_OUT_MS ? easeOut(t / LASH_OUT_MS) : t < LASH_OUT_MS + LASH_BACK_MS ? 1 - smooth((t - LASH_OUT_MS) / LASH_BACK_MS) : 0;
  pose.card = t >= LASH_OUT_MS && t < LASH_OUT_MS + LASH_BACK_MS - 10;
  return pose;
}

function drive({ e, p, pose, a, t, side, fx }: DriveCtx): void {
  const tf = `rotate(${n2(pose.arm * side)} ${PIVOT.arm[0]} ${PIVOT.arm[1]})`;
  setPart(p, 'arm', p.named.arm, tf);
  setPart(p, 'ticket', p.named.ticket, tf);
  const ticket = p.named.ticket;
  if (ticket) hide(ticket, pose.ticketOut);
  // the loose end of the cable is the lash while it is out
  if (p.tail) hide(p.tail, pose.lash > 0);
  // the hand: (12, -1) in the figure's frame, mirrored with the way it faces
  const hand = { x: (e.x ?? a.x) + (e.facing ?? 1) * 12 * p.scale, y: (e.y ?? a.y) - p.scale };
  fx.driveLash(a, pose, t, hand);
}

const f1 = (v: number): string => String(Math.round(v * 10) / 10);

/**
 * The things his skills leave on the page (S19), as strokes. A Formularz kontaktowy: the dotted rim of its area and a ruled form in the
 * middle (a heading rule, three lines, a checkbox). Muzyka w sluchawce: the dotted rim and three arcs of a stave round him, with two notes.
 * A recording on the floor (passive 9): a speech bubble with its tail.
 */
export function zoneParts(z: Zone): readonly string[] | null {
  const r = z.r;
  if (z.variant === 'formularz') {
    const w = r * 0.62;
    const h = r * 0.5;
    return [
      `~${circlePath(0, 0, r)}`,
      `M${f1(-w)} ${f1(-h)}H${f1(w)}V${f1(h)}H${f1(-w)}Z`,
      `M${f1(-w)} ${f1(-h * 0.45)}H${f1(w)}`,
      `M${f1(-w * 0.8)} ${f1(h * 0.05)}H${f1(w * 0.8)}M${f1(-w * 0.8)} ${f1(h * 0.42)}H${f1(w * 0.3)}`,
      `M${f1(w * 0.45)} ${f1(h * 0.28)}h${f1(w * 0.3)}v${f1(h * 0.3)}h${f1(-w * 0.3)}Z`,
    ];
  }
  if (z.variant === 'stave') {
    const arc = (k: number, from: number, to: number): string => {
      const rr = r * k;
      const a0 = (from * Math.PI) / 180;
      const a1 = (to * Math.PI) / 180;
      return `M${f1(Math.cos(a0) * rr)} ${f1(Math.sin(a0) * rr)}A${f1(rr)} ${f1(rr)} 0 0 1 ${f1(Math.cos(a1) * rr)} ${f1(Math.sin(a1) * rr)}`;
    };
    const note = (a: number, k: number): string => {
      const x = Math.cos((a * Math.PI) / 180) * r * k;
      const y = Math.sin((a * Math.PI) / 180) * r * k;
      return `M${f1(x - 3)} ${f1(y)}a3 2.2 0 1 0 6 0a3 2.2 0 1 0-6 0M${f1(x + 3)} ${f1(y)}V${f1(y - 11)}`;
    };
    return [`~${circlePath(0, 0, r)}`, arc(0.6, -150, 60), arc(0.68, -150, 60), arc(0.76, -150, 60), note(-70, 0.68), note(20, 0.68)];
  }
  if (z.variant === 'nagranie') return ['M-15-10H15V5H5L-1 12V5H-15Z', 'M-10-5H10M-10 0H4'];
  return null;
}

/** A chair (Przerwa techniczna) and a desk phone (Oddzwonimy), drawn about as high as the hero. */
export function summonParts(e: Summon): readonly string[] | null {
  if (e.variant === 'chair') return ['M-11-30V-1H11', 'M-11-1V17M11-1V17', 'M-11-17H9', 'M-14-1H14', '~M-16 20H16'];
  if (e.variant === 'phone') {
    return [
      'M-21 6V-1.5Q-21-12-9-12H9Q21-12 21-1.5V6H12V0Q12-4.5 7.5-4.5H-7.5Q-12-4.5-12 0V6Z',
      'M-24 9H24V18H-24Z',
      'M-9 9V18M9 9V18',
      '~M-15-19Q0-28 15-19',
      '~M-22-27Q0-40 22-27', // the bell, drawn from the first moment: it is going to ring
    ];
  }
  return null;
}

export const figure: HeroFigure = {
  def: figureDef,
  wash: { cx: 0, cy: -7, r: 20, seed: 0x4802 },
  hue: 'ochre',
  attackMs: 230,
  pose,
  drive,
  zoneParts,
  summonParts,
};
