/** The Pralka's drawing and her auto-attack animation: the lurch, the turning drum, the swinging door, the whip of ink. */
import { n2 } from '../../render/svg';
import { setPart, type DriveCtx, type FigureDef, type HeroFigure } from '../figureKit';
import { clamp01, keyframes, LURCH, neutralPose, smooth, WHIP_AT_MS, WHIP_DRAW_MS, WHIP_ERASE_MS, WHIP_HOLD_MS, type HeroPose } from '../poseKit';

/** a washing machine with opinions, a hose and a pending application */
export const figureDef: FigureDef = {
  scale: 1.4,
  body: [
    'M-17-21H17V12H-17Z', // cabinet
    'M-17-13H17', // control panel
    'M3-18.5H13V-15.5H3Z', // detergent slot
    'M-14-9L-8-7.5M14-9L8-7.5', // brows
    'M-5 9.5Q0 7.5 5 9.5', // mouth
    'M0-21V-25M-3-25Q0-28.5 3-25', // lint tuft
    'M-17-6Q-25-5-26 3', // left arm
    'M17-6Q25-8 27-1', // right arm
    'M24-1L33-3L34 9L25 11Z', // application form
    'M26 2.5L32 1.5M26.5 5.5L32.5 4.5', // typed lines
    'M-17 6Q-24 9-22 15Q-20 19-15 17', // hose
    'M-15-19h.01M15-19h.01M-15 10h.01M15 10h.01M7-17h.01M10-17h.01', // rivets and dials
    'M-12 12V14M12 12V14', // adjustable feet
  ],
  hatch: ['M10-12H17V12H10Z'],
  circles: [
    [-11, -17, 2.2],
    [-5, -17, 1.5],
    [-26, 4, 1.6],
    [27, -1, 1.4],
  ],
  parts: {
    // the drum turns in the attack (a sock and a button make the turning visible); the door swings on its hinge
    drum: {
      hatchCircles: [[0, -2, 6]],
      // a striped sock plastered to the drum, heel and toe, and a button
      body: ['M-4.6-5.8L-1-6.8L-0.2-1.8Q0.6 0.9 3.8 1.5L3.4 4.4Q-2 4.6-3.6 0.8Z', 'M-4.2-4.2L-0.7-5M-3.9-2.2L-0.3-3', 'M4.6-3.4h.01'],
    },
    door: { circles: [[0, -2, 8.5], [0, -2, 6.8]], body: ['M-3.5-4.5Q-1-6.5 2-5.5'] }, // porthole, glare on the glass
  },
  legs: [
    ['M-8 12L-9 17.5L-12 18.5', 'M8 12L9 17L12 17'],
    ['M-8 12L-6 17L-9 18.5', 'M8 12L11 17.5L14 18.5'],
  ],
};

/** Where each part turns, in figure units. */
const PIVOT = { drum: [0, -2], door: [-8.5, -2] } as const;

export function pose(t: number): HeroPose {
  const pose = neutralPose();
  // 320 ms: the body surges 16 and holds, the drum turns one full revolution, the door swings open to a sliver and back
  const p = clamp01(t / 320);
  pose.lurch = LURCH * keyframes(p, [[0, 0], [0.28, 1], [0.55, 1], [1, 0]]);
  pose.drum = 360 * smooth(p);
  pose.door = 1 - 0.95 * keyframes(p, [[0, 0], [0.3, 1], [0.65, 1], [1, 0]]);
  // the whip: laid down as the body surges, fully drawn for 180 ms, then rubbed out from its root
  pose.draw = clamp01((t - WHIP_AT_MS) / WHIP_DRAW_MS);
  pose.erase = clamp01((t - WHIP_AT_MS - WHIP_DRAW_MS - WHIP_HOLD_MS) / WHIP_ERASE_MS);
  return pose;
}

function drive({ p, pose, side }: DriveCtx): void {
  setPart(p, 'drum', p.named.drum, `rotate(${n2(pose.drum * side)} ${PIVOT.drum[0]} ${PIVOT.drum[1]})`);
  setPart(p, 'door', p.named.door, `translate(${PIVOT.door[0]} ${PIVOT.door[1]}) scale(${n2(pose.door)} 1) translate(${-PIVOT.door[0]} ${-PIVOT.door[1]})`);
}

export const figure: HeroFigure = {
  def: figureDef,
  wash: { cx: 0, cy: -4, r: 21, seed: 0x4801 },
  attackMs: 320,
  foam: true,
  stroke: 'whip',
  pose,
  drive,
};
