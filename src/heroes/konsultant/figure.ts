/** The Konsultant's drawing and his auto-attack animation: the throwing arm, the ticket, the lash of the headset cable. */
import { n2 } from '../../render/svg';
import { easeOut } from '../../render/tween';
import { hide, setPart, type DriveCtx, type FigureDef, type HeroFigure } from '../figureKit';
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

export const figure: HeroFigure = {
  def: figureDef,
  wash: { cx: 0, cy: -7, r: 20, seed: 0x4802 },
  attackMs: 230,
  pose,
  drive,
};
