/**
 * Procedural assembly: a seed picks the parts of one contraption. Pure and deterministic, no DOM:
 * the same (seed, family, tier) always gives the same Assembly, and `layoutAssembly` turns it into path data.
 */
import { createRng } from '../core/rng';
import { clamp } from '../core/vec';
import { BOSS_OF, DEFECT_IDS, type BossId, type DefectId, type FamilyId } from './ids';
import {
  bodiesOf,
  bodyById,
  decoById,
  decosOf,
  headById,
  HEADS,
  LEGS,
  legById,
  type AnchorId,
  type Art,
  type BodyPart,
  type PartText,
  type RangedSpec,
} from './parts';

/** Figure height limits for common enemies, in world units (the player is ~64). */
export const HEIGHT_MIN = 56;
export const HEIGHT_MAX = 80;
/** Every enemy figure is drawn this much larger on screen (and collides with the same factor), for the phone. */
export const ENEMY_SCALE = 1.2;

export interface Assembly {
  family: FamilyId;
  tier: number;
  body: string;
  /** Seeded variant handed to the body's `draw`. */
  variant: number;
  /** Separate legs (Urzadzenia); null when the body has its own. */
  legs: string | null;
  head: string | null;
  decos: { id: string; anchor: AnchorId }[];
  /** Hip to ground, in unscaled units. */
  legLen: number;
  /** Whole-figure scale (bosses, small variation). */
  scale: number;
  /** 0..1 dottedness of the pen. */
  dotted: number;
  defect?: DefectId;
  serial: string;
  boss?: BossId;
  ranged?: RangedSpec;
  /** Total figure height, unscaled, ground to the top of the highest part. */
  height: number;
  /** Collision radius in world units (scale applied). */
  radius: number;
  /** Full figure width, unscaled. */
  width: number;
}

const SERIAL_LETTERS = 'ABCDEFGHJKLMNPRSTUWZ';

/** "4471-B": the number printed in footnotes. Stable per seed. */
export function serialOf(seed: number): string {
  const r = createRng(seed).fork('serial');
  return `${r.int(1000, 9999)}-${SERIAL_LETTERS.charAt(r.int(0, SERIAL_LETTERS.length - 1))}`;
}

function excessOf(body: BodyPart, top: number): number {
  return Math.max(0, -top - body.h);
}

export function assemble(seed: number, family: FamilyId, tier = 1): Assembly {
  const root = createRng(seed).fork(`asm:${family}`);
  const t = family === 'powiadomienia' ? clamp(Math.round(tier), 1, 4) : Math.max(1, Math.round(tier));
  const pool = bodiesOf(family);
  const found = family === 'powiadomienia' ? pool.find((b) => b.tier === t) : undefined;
  const body = found ?? root.fork('body').pick(pool);
  const variant = root.fork('variant').int(0, 11);
  const ownLegs = body.ownLegs !== undefined;
  const lenR = root.fork('len');

  // parts that change the silhouette
  let leg = ownLegs ? null : root.fork('legs').pick(LEGS);
  let head = !ownLegs && body.neck && root.fork('headchance').chance(body.headChance) ? root.fork('head').pick(HEADS) : null;
  const decoRng = root.fork('decos');
  const allDecos = decosOf(family);
  const wanted =
    family === 'powiadomienia' ? 1 + (decoRng.chance(0.5) ? 1 : 0) : family === 'wygenerowane' ? decoRng.int(1, 2) : 1 + (t > 1 ? 1 : 0) + (decoRng.chance(0.5) ? 1 : 0);
  const free: AnchorId[] = ['topL', 'topR', 'back', 'front', 'side'];
  let decos: { id: string; anchor: AnchorId }[] = [];
  const shuffled = [...allDecos];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = decoRng.int(0, i);
    const a = shuffled[i];
    const b = shuffled[j];
    if (a && b) {
      shuffled[i] = b;
      shuffled[j] = a;
    }
  }
  // the badge is what makes a notification a notification
  const order = family === 'powiadomienia' ? [...shuffled].sort((a, b) => (a.id === 'badge' ? -1 : b.id === 'badge' ? 1 : 0)) : shuffled;
  for (const d of order) {
    if (decos.length >= wanted) break;
    const anchor = d.anchors.find((a) => free.includes(a));
    if (!anchor) continue;
    free.splice(free.indexOf(anchor), 1);
    decos.push({ id: d.id, anchor });
  }

  const topRise = (): number => {
    let m = body.rise;
    if (head && body.neck) m = Math.max(m, excessOf(body, body.neck.y - head.h));
    for (const d of decos) {
      const part = decoById(d.id);
      if (!part || part.slot !== 'top') continue;
      m = Math.max(m, excessOf(body, body.anchors[d.anchor].y - part.rise));
    }
    return m;
  };
  const legMin = leg ? leg.lenMin : (body.ownLegLen ?? 0);
  const legMax = leg ? leg.lenMax : (body.ownLegLen ?? 0);
  if (!ownLegs) {
    if (body.h + topRise() + legMin > HEIGHT_MAX) head = null;
    if (body.h + topRise() + legMin > HEIGHT_MAX) decos = decos.filter((d) => decoById(d.id)?.slot !== 'top');
    if (body.h + topRise() + legMax < HEIGHT_MIN && !head && body.neck) head = headById('screen') ?? HEADS[0] ?? null;
    if (body.h + topRise() + legMax < HEIGHT_MIN) leg = legById('stilts') ?? leg;
  }
  const lo = leg ? leg.lenMin : legMin;
  const hi = leg ? leg.lenMax : legMax;
  const target = lenR.range(60, 74);
  const legLen = ownLegs ? legMax : clamp(target - body.h - topRise(), lo, hi);

  const height = body.h + topRise() + legLen;
  const scale = family === 'wygenerowane' ? Math.min(lenR.range(0.92, 1.06), (HEIGHT_MAX - 0.5) / height) : 1;
  const width = body.w + (decos.some((d) => d.anchor === 'back') ? 6 : 0);
  const a: Assembly = {
    family,
    tier: t,
    body: body.id,
    variant,
    legs: leg ? leg.id : null,
    head: head ? head.id : null,
    decos,
    legLen,
    scale,
    dotted: body.dotted ?? 0,
    serial: serialOf(seed),
    height,
    radius: clamp(Math.round(body.w * (family === 'powiadomienia' ? 0.34 : 0.36) * scale * ENEMY_SCALE), 14, 26),
    width,
  };
  if (body.ranged) a.ranged = body.ranged;
  if (family === 'urzadzenia') a.defect = root.fork('defect').pick(DEFECT_IDS);
  return a;
}

/** The three bosses are assembled by hand: every part, one captcha, one hypothesis. */
export function assembleBoss(boss: BossId, seed = 1): Assembly {
  const serial = serialOf(seed);
  switch (boss) {
    case 'prototyp': {
      const body = must(bodyById('proto'));
      return {
        family: 'urzadzenia',
        tier: 1,
        body: 'proto',
        variant: 0,
        legs: 'stilts',
        head: 'dish',
        decos: [
          { id: 'antenna', anchor: 'topL' },
          { id: 'wifi', anchor: 'topR' },
          { id: 'cable', anchor: 'back' },
          { id: 'smart', anchor: 'front' },
          { id: 'qr', anchor: 'side' },
        ],
        legLen: 24,
        scale: 1,
        dotted: 0,
        serial,
        boss,
        ranged: body.ranged,
        height: 60 + 14 + 24,
        radius: Math.round(26 * ENEMY_SCALE),
        width: 90,
      };
    }
    case 'weryfikacja':
      return {
        family: 'powiadomienia',
        tier: 4,
        body: 'captcha',
        variant: 0,
        legs: 'stilts',
        head: null,
        decos: [],
        legLen: 24,
        scale: 1.3,
        dotted: 0,
        serial,
        boss,
        height: 54 + 24,
        radius: Math.round(30 * ENEMY_SCALE),
        width: 50,
      };
    case 'hipoteza':
      return {
        family: 'wygenerowane',
        tier: 1,
        body: 'hipoteza',
        variant: 0,
        legs: null,
        head: null,
        decos: [{ id: 'signature', anchor: 'side' }],
        legLen: 17,
        scale: 1.4,
        dotted: 0.6,
        serial,
        boss,
        height: 54 + 17,
        radius: Math.round(32 * ENEMY_SCALE),
        width: 64,
      };
  }
}

export function bossOfFamily(family: FamilyId): BossId {
  return BOSS_OF[family];
}

function must<T>(v: T | undefined): T {
  if (v === undefined) throw new Error('missing part');
  return v;
}

// ---------- layout ----------

export interface LayoutLayer {
  /** Transform of this layer relative to the figure's ground point. */
  tf: string;
  art: Art;
  texts: PartText[];
}

export interface Layout {
  /** Back to front: body, head, decorations. */
  layers: LayoutLayer[];
  /** Transform of the leg group (hip level). */
  legTf: string;
  /** Leg paths for the given phase. */
  legs(phase: 0 | 1): string[];
  legCount: number;
}

const f1 = (n: number): string => String(Math.round(n * 10) / 10);

/** Turn an Assembly into path data. Pure. y = 0 is the ground, parts rise into negative y. */
export function layoutAssembly(a: Assembly): Layout {
  const body = must(bodyById(a.body));
  const drawn = body.draw(a.variant);
  const hipY = -a.legLen;
  const bodyTf = `translate(0 ${f1(hipY)})`;
  const layers: LayoutLayer[] = [{ tf: bodyTf, art: drawn.art, texts: drawn.texts ?? [] }];
  const head = a.head ? headById(a.head) : undefined;
  if (head && body.neck) layers.push({ tf: `translate(${f1(body.neck.x)} ${f1(hipY + body.neck.y)})`, art: head.art, texts: [] });
  for (const d of a.decos) {
    const part = decoById(d.id);
    if (!part) continue;
    const at = body.anchors[d.anchor];
    const out = part.draw(a.tier);
    layers.push({ tf: `translate(${f1(at.x)} ${f1(hipY + at.y)})`, art: out.art, texts: out.texts ?? [] });
  }
  const legPart = a.legs ? legById(a.legs) : undefined;
  const legsFn = (phase: 0 | 1): string[] => {
    if (body.ownLegs) return body.ownLegs(a.variant, phase);
    if (legPart) return legPart.draw(drawn.hips, a.legLen, phase);
    return [];
  };
  return { layers, legTf: bodyTf, legs: legsFn, legCount: legsFn(0).length };
}
