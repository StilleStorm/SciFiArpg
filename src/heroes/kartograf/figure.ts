/** The Kartograf's drawing and his auto-attack animation: the range pole kicks back as the ruled line is struck. */
import { n2 } from '../../render/svg';
import { setPart, type DriveCtx, type FigureDef, type HeroFigure } from '../figureKit';
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

export const figure: HeroFigure = {
  def: figureDef,
  wash: { cx: -1, cy: -7, r: 20, seed: 0x4804 },
  attackMs: 380,
  pose,
  drive,
};
