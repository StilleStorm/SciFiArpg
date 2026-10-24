/**
 * The Anomalia's core (STORY 3, 8.4; contract in `index.ts`): the three phases of the finale and what joins them.
 * Phase 1 (`phase1.ts`): the three family boss forms in turn. Phase 2: the hero's own face (`faces/*.ts` through the registry):
 * `start` when phase 1 ends, `tick` every step, hits multiplied by `damageMul` (`gate.ts`), `stop` when `done` or the racja
 * threshold ends it. Phase 3 (`phase3.ts`): the existence finish and the closing stamp. Each stage is its own body (a new
 * enemy drawn in at the desk, the old one struck), so the figure, the Spor and the x2 window belong to one body each.
 * `tickAnomalia` is called from `tickBoss` for every boss each step; `beginFinale` from `populatePage` of the final ticket.
 */
import { postPromptSpor, promptFromEntry, SPOR_FIRST_S, type SporEntry, type SporReply } from '../../combat/spor';
import { DAMAGE_TYPES, type DamageType } from '../../combat/damage';
import type { Bus } from '../../core/events';
import type { Enemy } from '../../entities/types';
import { t } from '../../i18n';
import type { RunState } from '../../world/run';
import { rtOf } from '../runtime';
import { FACE_END_FRACTION, FACE_HP, finaleScale, flushNotes, makeBody, note, sporRng, swapBody } from './bodies';
import { bodyPoint } from './gate';
import type { AnomaliaFace } from './index';
import { formFallen, nextFormIndex, startForm } from './phase1';
import { closeCase, lastReplied, startLast, tickLast } from './phase3';
import { faceLookup, faceOf, finaleOf, isAnomalia, setFinale, type AnomaliaStage, type Finale } from './state';
import type { HeroId } from '../../heroes';

export { bodyPoint };

const faceFor = faceOf;
/** Text keys of a face (the registry's `faceKeys`): the same strings when the lookup is not filled, so a missing face still reads sensibly in tests. */
const faceKeys = (heroId: HeroId) => (faceLookup()?.faceKeys ?? FALLBACK_KEYS)(heroId);
const FALLBACK_KEYS = (heroId: HeroId) => ({
  name: `story.finale.face.${heroId}.name`,
  meet: `story.finale.face.${heroId}.meet`,
  line: `story.finale.face.${heroId}.line`,
  comment: `story.finale.face.${heroId}.spor.comment`,
  reply: (type: DamageType) => `story.finale.face.${heroId}.spor.reply.${type}`,
  end: `story.finale.face.${heroId}.end`,
});

/** Where the desk stands on the page: the biurko station of the base layout, or the middle of the paper. */
export function deskOf(page: RunState['page']): { x: number; y: number } {
  const st = page.base?.stations.find((x) => x.id === 'biurko');
  return st ? { x: st.x, y: st.y } : { x: page.w / 2, y: page.h * 0.4 };
}

const replyOf = (base: string) => (type: DamageType): SporReply => ({ textKey: `${base}.reply.${type}`, type });

/** The three replies of a comment whose keys are `<base>.comment` and `<base>.reply.<type>`. */
function entryOf(base: string, answer: DamageType): SporEntry {
  const reply = replyOf(base);
  const [a, b, c] = DAMAGE_TYPES;
  return { commentKey: `${base}.comment`, answer, replies: [reply(a ?? 'mechaniczny'), reply(b ?? 'regulaminowy'), reply(c ?? 'egzystencjalny')] };
}

/** The Spor entry of phase 1 and phase 3 (STORY 8.4: the right replies are regulaminowy and egzystencjalny). */
export const PHASE1_SPOR: SporEntry = entryOf('story.finale.phase1.spor', 'regulaminowy');
export const PHASE3_SPOR: SporEntry = entryOf('story.finale.phase3.spor', 'egzystencjalny');

/** The Spor entry of a hero's face; the right reply is the face's `sporAnswer`. */
export function faceSporEntry(heroId: HeroId, answer: DamageType): SporEntry {
  const k = faceKeys(heroId);
  const reply = (type: DamageType): SporReply => ({ textKey: k.reply(type), type });
  const [a, b, c] = DAMAGE_TYPES;
  return { commentKey: k.comment, answer, replies: [reply(a ?? 'mechaniczny'), reply(b ?? 'regulaminowy'), reply(c ?? 'egzystencjalny')] };
}

function postStageSpor(s: RunState, bus: Bus, f: Finale, e: Enemy): void {
  if (f.stage === 'form') postPromptSpor(s, bus, e, 1, { ...promptFromEntry(PHASE1_SPOR, sporRng(s, e, 'p1')), params: { number: s.ticket.number } }); // the comment names the ticket
  else if (f.stage === 'last') postPromptSpor(s, bus, e, 2, promptFromEntry(PHASE3_SPOR, sporRng(s, e, 'p3')));
  else if (f.stage === 'face') {
    const face = faceFor(f.heroId);
    if (face) postPromptSpor(s, bus, e, 2, promptFromEntry(faceSporEntry(f.heroId, face.sporAnswer), sporRng(s, e, 'face')));
  }
}

// ---------- phase 2 ----------

/** Phase 1 is over: its end note, then the hero's face, or phase 3 directly when no face is registered for the hero. */
function beginFace(s: RunState, bus: Bus, f: Finale, old: Enemy): void {
  note(s, bus, f, t('story.finale.phase1.end'));
  const face = faceFor(f.heroId);
  if (!face) {
    startLast(s, bus, f, old);
    return;
  }
  const e = makeBody(s, f, 'wygenerowane', FACE_HP);
  delete e.existence;
  e.r = faceLookup()?.assemblyOf(face.figure, e.seed).radius ?? e.r;
  swapBody(s, bus, f, old, e, 'face', f.heroId);
  rtOf(e).sporAt = s.time + SPOR_FIRST_S;
  note(s, bus, f, t(faceKeys(f.heroId).meet));
  face.start(s, e, bus);
}

function endFace(s: RunState, bus: Bus, f: Finale, e: Enemy, face: AnomaliaFace | undefined): void {
  face?.stop(s, e, bus);
  note(s, bus, f, t(faceKeys(f.heroId).end));
  startLast(s, bus, f, e);
}

// ---------- the run of the finale ----------

/** The final ticket's page was entered: the Anomalia sits at the desk in its first form. */
export function beginFinale(s: RunState, bus: Bus): Finale {
  const f: Finale = {
    stage: 'form',
    form: 0,
    heroId: s.player.heroId,
    correct: 0,
    scale: finaleScale(s.plan?.priority ?? 'normalny'),
    desk: deskOf(s.page),
    currentId: 0,
    lastWindow: 0,
    queue: [],
    retired: new Set(),
    exist0: 1,
    since: s.time,
  };
  setFinale(s, f);
  s.spawnTimer = Infinity; // no waves between the phases (STORY 3): the Anomalia is all there is
  note(s, bus, f, t('story.finale.phase1.meet'));
  startForm(s, bus, f, 0, null);
  return f;
}

/** Move the finale one stage on from the current body (the thresholds do this by themselves; the test hook forces it). */
export function advanceStage(s: RunState, bus: Bus): boolean {
  const f = finaleOf(s);
  const e = f ? s.enemies.find((x) => x.id === f.currentId) : undefined;
  if (!f || !e) return false;
  if (f.stage === 'form') {
    const n = nextFormIndex(f);
    if (n !== null) startForm(s, bus, f, n, e);
    else beginFace(s, bus, f, e);
  } else if (f.stage === 'face') endFace(s, bus, f, e, faceFor(f.heroId));
  else if (f.stage === 'last') closeCase(s, bus, f, e);
  else return false;
  return true;
}

/** Force the finale to `target` ('face', 'last' or 'end'): the stages in between end at once. Test hook and screenshots. */
export function skipTo(s: RunState, bus: Bus, target: 'face' | 'last' | 'end'): boolean {
  const f = finaleOf(s);
  if (!f) return false;
  const reached = (st: AnomaliaStage): boolean => (target === 'face' ? st !== 'form' : target === 'last' ? st === 'last' || st === 'done' : st === 'done');
  for (let guard = 0; guard < 8 && !reached(f.stage); guard++) if (!advanceStage(s, bus)) return false;
  return reached(f.stage);
}

/**
 * One step of the Anomalia body `e` (called by `tickBoss` first). Returns true when the family boss logic of the body goes on
 * (the phase 1 forms), false when this body is fully ours (the face and phase 3) or no longer the Anomalia.
 */
export function tickAnomalia(s: RunState, e: Enemy, bus: Bus, dt: number): boolean {
  if (!isAnomalia(e)) return true;
  const f = finaleOf(s);
  if (!f || f.currentId !== e.id) return false;
  flushNotes(s, bus, f);
  const rt = rtOf(e);
  if (rt.sporAt !== undefined && s.time >= rt.sporAt) {
    rt.sporAt = undefined;
    postStageSpor(s, bus, f, e);
  }
  // a right reply opens the x2 window of the body it was given to: count it once, at the moment it opens
  const sp = s.spor;
  const w = sp && sp.bossId === e.id ? sp.window : 0;
  if (w > f.lastWindow) {
    f.correct++;
    if (f.stage === 'last') lastReplied(f, e);
  }
  f.lastWindow = w;

  switch (f.stage) {
    case 'form':
      if (formFallen(e)) {
        advanceStage(s, bus);
        return false;
      }
      return true;
    case 'face': {
      const face = faceFor(f.heroId);
      face?.tick(s, e, bus, dt);
      if (!face || face.done(s, e) || e.hp <= e.hpMax * FACE_END_FRACTION || e.hp <= 1) endFace(s, bus, f, e, face);
      return false;
    }
    case 'last':
      tickLast(s, bus, f, e);
      return false;
    case 'done':
      return false;
  }
}

/** Plain data for the test hook and the tests. */
export function finaleInfo(s: RunState): { stage: AnomaliaStage; form: number; correct: number; id: number; hp: number; hpMax: number; existence: number | null; retired: number; heroId: HeroId } | null {
  const f = finaleOf(s);
  if (!f) return null;
  const e = s.enemies.find((x) => x.id === f.currentId);
  return { stage: f.stage, form: f.form, correct: f.correct, id: f.currentId, hp: e?.hp ?? 0, hpMax: e?.hpMax ?? 0, existence: e?.existence ?? null, retired: f.retired.size, heroId: f.heroId };
}
