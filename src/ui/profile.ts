/** PROFIL UZYTKOWNIKA: one printed profile per hero. The photo is a drawing, the verification is crossed out. */
import { createRng } from '../core/rng';
import { DEFAULT_HERO_ID, HEROES, heroDef, type HeroDef, type HeroId } from '../heroes';
import { noteChosen } from '../heroes/chosen';
import { t } from '../i18n';
import { drawIn } from '../render/ink';
import { buildHeroFigure } from '../render/heroFigures';
import { el, wobblyLine } from '../render/svg';
import { emptyCharacter } from '../save/character';
import { loadMeta, saveMeta } from '../save/save';
import { h } from './dom';
import { openKarta, type KartaSheet } from './karta';
import { attachScrollCue } from './konfiguracja';
import { errorText, NAME_MAX } from './rosterModel';
import type { Result } from './rosterStore';
import './forms.css';

export interface Profile {
  el: HTMLElement;
  /** Show the profiles, starting at the hero saved in MetaState (or the first). */
  show(): void;
  hide(): void;
  /** Remove the screen from the page. */
  destroy(): void;
}

/**
 * The hero pick inside creating a case file (S6): the chosen hero and the typed case number go to `create`; on success the
 * screen is removed and `onCreated` follows, on a refusal the text of the error stands under the number and nothing is lost.
 */
export interface ProfileOptions {
  /** The case number offered in the field. */
  defaultName: string;
  create(heroId: HeroId, name: string): Result<string>;
  onCreated(id: string, heroId: HeroId): void;
  /** "Wróć do wykazu"; absent when there is no roster to return to. */
  onCancel?(): void;
}

let active: Profile | null = null;

const pen = createRng(0x9f11);
const SWIPE = 48;

function frameFor(): SVGGElement {
  const g = el('g', {});
  const edge = (x1: number, y1: number, x2: number, y2: number): SVGPathElement => el('path', { d: wobblyLine(pen, x1, y1, x2, y2, 5, 0.7) });
  g.append(
    edge(-40, -52, 40, -52),
    edge(40, -52, 40, 38),
    edge(40, 38, -40, 38),
    edge(-40, 38, -40, -52),
    edge(-37, -49, 37.5, -49.5),
    edge(37.5, -49.5, 37, 35),
    edge(37, 35, -37.5, 35.5),
    edge(-37.5, 35.5, -37, -49),
  );
  let d = '';
  for (let x = -26; x <= 26; x += 5) d += `M${x} 25.5l-3 3.5`;
  g.append(el('path', { d: `M-28 25H28${d}`, 'stroke-width': 0.7 }));
  return g;
}

function arrow(dir: 1 | -1): SVGSVGElement {
  const svg = el('svg', { viewBox: '0 0 16 10', width: 16, height: 10, 'aria-hidden': 'true' });
  svg.setAttribute('style', 'fill:none;stroke:currentColor;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round;overflow:visible');
  svg.append(el('path', { d: dir > 0 ? 'M1 5H15M10 1L15 5L10 9' : 'M15 5H1M6 1L1 5L6 9' }));
  return svg;
}

/** Take the hero pick off the page, if it is up. */
export function unmountProfile(): void {
  active?.destroy();
}

/**
 * Build the hero-select screen in `root` and show it at once. With a function: choosing a hero saves `heroId` to MetaState,
 * removes the screen and calls it (the hero preview of the test hook). With `ProfileOptions`: creating a case file.
 * Mounting again replaces the previous screen.
 */
export function mountProfile(root: HTMLElement, arg: ((heroId: HeroId) => void) | ProfileOptions): Profile {
  active?.destroy();
  const profile = buildProfile(root, arg);
  active = profile;
  profile.show();
  return profile;
}

function buildProfile(root: HTMLElement, arg: ((heroId: HeroId) => void) | ProfileOptions): Profile {
  const creating = typeof arg === 'function' ? null : arg;
  const screen = h('div', 'screen paper profile hidden');
  const frame = h('div', 'frame');
  screen.append(frame);

  const title = h('span', 'agency', t('heroes.profile.title'));
  const counter = h('span', '');
  const head = h('div', 'head');
  head.append(title, counter);

  const avatar = el('svg', { class: 'avatar', viewBox: '-40 -52 80 90', 'aria-hidden': 'true' });
  const figureLayer = el('g', {});
  avatar.append(frameFor(), figureLayer);

  const side = h('div', 'side');
  side.append(h('div', '', t('heroes.profile.photo')), h('div', 'photo-note', t('heroes.profile.photoNote')));
  const verified = h('div', 'verified');
  const tickBox = el('svg', { viewBox: '-10 -10 20 20', width: 18, height: 18, 'aria-hidden': 'true' });
  tickBox.setAttribute('style', 'flex:none;width:18px;height:18px');
  tickBox.append(el('path', { d: 'M-8-8L8-8.5L8.5 8L-8 8.5L-8.5-9' }), el('path', { d: 'M-5 0.5L-1.5 5.5L8-8', 'stroke-width': 2 }));
  const verifiedText = h('span', 'verified-text', t('heroes.profile.verified'));
  const strikeSvg = el('svg', { viewBox: '0 0 100 20', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  strikeSvg.setAttribute('style', 'position:absolute;left:-3px;top:0;width:calc(100% + 6px);height:100%;overflow:visible');
  const strike = el('path', { class: 'strike', d: 'M0 13Q40 6 100 9', 'vector-effect': 'non-scaling-stroke' });
  strikeSvg.append(strike);
  verified.append(tickBox, verifiedText, strikeSvg);
  side.append(verified);

  const top = h('div', 'top');
  top.append(avatar, side);

  const name = h('h2', 'name');
  const desc = h('div', 'desc');
  const autoLabel = h('div', 'label', t('heroes.profile.auto'));
  const autoText = h('p', 'quirk');
  const skillsLabel = h('div', 'label', t('heroes.profile.skills'));
  const skills = h('ul', 'skills');
  const quirkLabel = h('div', 'label', t('heroes.profile.quirk'));
  const quirk = h('p', 'quirk');

  const prev = h('button', 'arrow');
  prev.type = 'button';
  prev.append(arrow(-1), document.createTextNode(` ${t('heroes.profile.prev')}`));
  const next = h('button', 'arrow');
  next.type = 'button';
  next.append(document.createTextNode(`${t('heroes.profile.next')} `), arrow(1));
  const choose = h('button', 'choose', t('heroes.profile.choose'));
  choose.type = 'button';
  const nav = h('div', 'nav');
  nav.append(prev, choose, next);
  // the printed chart of the hero shown (DESIGN 10.3): over this screen, from the saved character when it is this hero's
  const kartaLink = h('button', 'karta-link', t('forms.karta.link'));
  kartaLink.type = 'button';
  kartaLink.dataset['profile'] = 'karta';
  let karta: KartaSheet | null = null;
  kartaLink.addEventListener('click', () => {
    const def = heroes[index];
    if (!def || karta) return;
    const saved = loadMeta().character;
    const c = saved && saved.heroId === def.id ? saved : emptyCharacter(def.id);
    karta = openKarta(root, { progress: c, pads: c.pads, specialization: c.specialization ?? null, ...(c.ultimate ? { ultimate: c.ultimate } : {}) }, () => {
      karta?.close();
      karta = null;
    });
  });

  // The case number (creation only): typed over the auto-generated "Sprawa nr N".
  const numberRow = h('div', 'pf-number');
  const nameInput = h('input', 'pf-input');
  nameInput.type = 'text';
  nameInput.maxLength = NAME_MAX;
  nameInput.autocomplete = 'off';
  nameInput.spellcheck = false;
  nameInput.id = 'pf-case-name';
  nameInput.dataset['profile'] = 'name';
  nameInput.value = creating?.defaultName ?? '';
  const nameLabel = h('label', 'pf-label', t('screens.create.nameLabel'));
  nameLabel.htmlFor = nameInput.id;
  const nameNote = h('p', 'pf-note', t('screens.create.nameNote', { max: NAME_MAX }));
  nameNote.setAttribute('role', 'status');
  nameInput.addEventListener('input', () => {
    nameNote.textContent = t('screens.create.nameNote', { max: NAME_MAX });
    nameNote.classList.remove('bad');
  });
  numberRow.append(nameLabel, nameInput, nameNote);

  // The long text scrolls on a small phone; the buttons stay below it.
  // Two blocks: who the hero is, and what the hero does. Stacked in portrait, side by side in landscape (each scrolls with the body).
  const body = h('div', 'pscroll');
  const colA = h('div', 'pcol');
  colA.append(top, name, desc);
  const colB = h('div', 'pcol');
  colB.append(autoLabel, autoText, skillsLabel, skills, quirkLabel, quirk);
  body.append(colA, colB);
  const toRoster = h('button', 'link-btn pf-roster', t('screens.create.toRoster'));
  toRoster.type = 'button';
  toRoster.dataset['profile'] = 'roster';
  toRoster.addEventListener('click', () => creating?.onCancel?.());
  // The Karta link and the case number: stacked in portrait, one row in landscape so the scroll keeps its height.
  const foot = h('div', 'pf-foot');
  foot.append(kartaLink);
  if (creating) foot.append(numberRow);
  frame.append(head, h('hr', 'rule'), body, foot, nav);
  if (creating?.onCancel) frame.append(toRoster);
  root.append(screen);
  const cue = attachScrollCue({ scroll: body }, 'heroes.profile.cue');

  let index = 0;
  const heroes: readonly HeroDef[] = HEROES;

  function render(): void {
    const def = heroes[index] ?? heroDef(DEFAULT_HERO_ID);
    counter.textContent = t('heroes.profile.number', { n: index + 1, total: heroes.length });
    figureLayer.replaceChildren();
    const fig = buildHeroFigure(def.id);
    figureLayer.append(fig);
    drawIn(fig, 700);
    name.textContent = t(def.nameKey);
    desc.replaceChildren(...def.descKeys.map((k) => h('p', '', t(k))));
    autoText.textContent = t(`heroes.${def.id}.auto`);
    skills.replaceChildren(
      ...def.skills.map((sk) => {
        const li = h('li');
        li.append(h('span', 'sn', t(sk.nameKey)), h('span', 'st', t(`heroes.types.${sk.type}`)), h('span', 'sd', t(sk.descKey)));
        return li;
      }),
    );
    quirk.textContent = t(def.quirkKey);
  }
  const go = (delta: number): void => {
    index = (index + delta + heroes.length) % heroes.length;
    render();
  };
  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  choose.addEventListener('click', () => {
    const def = heroes[index];
    if (!def) return;
    if (creating) {
      const res = creating.create(def.id, nameInput.value);
      if (!res.ok) {
        nameNote.textContent = errorText(res.error);
        nameNote.classList.add('bad');
        return;
      }
      if (def.chosenNoteKey) noteChosen(def.id); // the Asystent notes the choice
      profile.destroy();
      creating.onCreated(res.value, def.id);
      return;
    }
    const before = loadMeta();
    if (def.chosenNoteKey && before.character?.heroId !== def.id) noteChosen(def.id); // the Asystent notes the first choice
    saveMeta({ ...before, heroId: def.id });
    profile.destroy();
    if (typeof arg === 'function') arg(def.id);
  });

  let downX: number | null = null;
  frame.addEventListener('pointerdown', (ev) => {
    downX = ev.clientX;
  });
  frame.addEventListener('pointerup', (ev) => {
    if (downX === null) return;
    const dx = ev.clientX - downX;
    downX = null;
    if (Math.abs(dx) > SWIPE) go(dx < 0 ? 1 : -1);
  });

  const profile: Profile = {
    el: screen,
    destroy() {
      karta?.close();
      karta = null;
      cue.dispose();
      screen.remove();
      if (active === profile) active = null;
    },
    show() {
      const saved = creating ? undefined : loadMeta().heroId;
      const at = saved ? heroes.findIndex((x) => x.id === saved) : 0;
      index = at >= 0 ? at : 0;
      render();
      screen.classList.remove('hidden');
      body.scrollTop = 0;
      cue.update();
    },
    hide() {
      screen.classList.add('hidden');
    },
  };
  return profile;
}

