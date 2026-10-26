// Scaffold a new hero: node scripts/new-hero.mjs <id> [--no-register] [--no-snapshot] [--dry-run]   (npm run new-hero <id>)
// Undo it:             node scripts/new-hero.mjs <id> --remove                                      (npm run new-hero <id> -- --remove)
//
// Makes src/heroes/<id>/ from src/heroes/_template/*.tpl (placeholders compile and play), and does every edit outside the folder
// that a registered hero needs for `npm run check` to pass with placeholders (S21 validation):
//   - src/heroes/registry.ts: the id, the import, the module;
//   - src/i18n/pl/heroes/<id>.json: the text of the template's skills, paragraphs, ultimate and columns;
//   - every i18n map keyed by all the heroes (heroes.json, forms.json, story.json, screens.json, ...): a copy of the first hero's
//     entry for <id>, each string marked "[<id>] ", so the voice editor sees what is still a placeholder;
//   - src/audio/recipes.ts: placeholder recipes between "SCAFFOLD <id>" markers (the sounds of the template name them);
//   - src/enemies/anomalia/faces/: a placeholder face (it borrows the first face's figure) registered in index.ts and heroes.ts;
//   - src/heroes/contract.snapshot.json: regenerated (vitest -u) for the new hero's keys only;
// and prints the checklist. The folder also gets CHECKLIST.md with the same list.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const HEROES = join(ROOT, 'src/heroes');
const TEMPLATE = join(HEROES, '_template');
const I18N = join(ROOT, 'src/i18n/pl');
const FACES = join(ROOT, 'src/enemies/anomalia/faces');
const RECIPES = join(ROOT, 'src/audio/recipes.ts');
const REGISTRY = join(HEROES, 'registry.ts');
const LEVELS = join(ROOT, 'src/audio/levels.ts');
/** vitest keeps the result of `import.meta.glob` in src/i18n/index.ts here; a new or removed i18n file is not seen until it is cleared. */
const VITEST_CACHE = join(ROOT, 'node_modules/.vitest-cache');

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const id = args.find((a) => !a.startsWith('--'));
const dry = flags.has('--dry-run');
const remove = flags.has('--remove');

if (!id || !/^[a-z][a-z0-9]{2,23}$/.test(id)) {
  console.error('usage: npm run new-hero <id>   (lowercase ASCII letters and digits, 3 to 24 characters, e.g. "wozny")');
  process.exit(1);
}
const dir = join(HEROES, id);
const CONST = id.toUpperCase();
const read = (p) => readFileSync(p, 'utf8');
const touched = [];
const write = (p, text) => {
  if (!dry) writeFileSync(p, text);
  touched.push(p.slice(ROOT.length));
};
const clearCache = () => {
  if (!dry) rmSync(VITEST_CACHE, { recursive: true, force: true });
};
const snapshot = () => {
  clearCache();
  if (flags.has('--no-snapshot') || dry) return;
  const r = spawnSync('npx', ['vitest', 'run', 'src/heroes/contract.test.ts', '-u'], { cwd: ROOT, stdio: 'ignore' });
  touched.push(`src/heroes/contract.snapshot.json (${r.status === 0 ? 'regenerated' : 'regenerate it: npx vitest run src/heroes/contract.test.ts -u'})`);
};

// ---------- registry ----------

const registry = read(REGISTRY);
const registered = new RegExp(`'${id}'`).test(registry);

function registerHero() {
  let next = registry;
  next = next.replace(/(HERO_ID_LIST = \[[^\]]*?)(\] as const)/, `$1, '${id}'$2`);
  next = next.replace(/(\nimport type \{ HeroDef \} from '\.\/defs';)/, `\nimport { hero as ${id} } from './${id}';$1`);
  next = next.replace(/(const MODULES: readonly HeroModule\[\] = \[[^\]]*?)(\];)/, `$1, ${id}$2`);
  if (next === registry || !next.includes(`hero as ${id}`) || !next.includes(`, ${id}]`) || !next.includes(`'${id}'`)) {
    console.error('could not edit src/heroes/registry.ts; add the hero by hand (see src/heroes/README.md)');
    return false;
  }
  write(REGISTRY, next);
  return true;
}

function unregisterHero() {
  let next = registry;
  next = next.replace(`, '${id}'] as const`, `] as const`);
  next = next.replace(`import { hero as ${id} } from './${id}';\n`, '');
  next = next.replace(`, ${id}];`, `];`);
  write(REGISTRY, next);
}

/** The hero ids already registered (before the edit of this run), in order. */
const existing = [...(registry.match(/HERO_ID_LIST = \[([^\]]*)\]/)?.[1] ?? '').matchAll(/'([a-z0-9]+)'/g)].map((m) => m[1]).filter((x) => x !== id);

// ---------- i18n ----------

const listJson = (d) => readdirSync(d).filter((f) => f.endsWith('.json')).map((f) => join(d, f));
const jsonText = (d) => JSON.stringify(d, null, 2) + '\n';

/** Every object in `node` that has a key for each of `ids` (the maps keyed by hero): `fn(object)`. */
function eachHeroMap(node, ids, fn) {
  if (node === null || typeof node !== 'object') return;
  if (ids.length > 0 && ids.every((h) => h in node)) fn(node);
  for (const v of Object.values(node)) eachHeroMap(v, ids, fn);
}
const mark = (v) => (typeof v === 'string' ? `[${id}] ${v}` : v !== null && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mark(x)])) : v);

function fillMaps() {
  for (const file of listJson(I18N)) {
    const raw = read(file);
    const data = JSON.parse(raw);
    if (jsonText(data) !== raw) {
      // not in the canonical 2-space form: it cannot be rewritten without a diff of its own; say so only if it holds a hero map
      let holds = false;
      eachHeroMap(data, existing, () => (holds = true));
      if (holds) console.error(`${file.slice(ROOT.length)}: not in the canonical 2-space JSON form, its hero maps are not filled (add "${id}" by hand)`);
      continue;
    }
    let changed = false;
    eachHeroMap(data, existing, (m) => {
      if (id in m) return;
      m[id] = mark(m[existing[0]]);
      changed = true;
    });
    if (changed) write(file, jsonText(data));
  }
}

function emptyMaps() {
  for (const file of listJson(I18N)) {
    const raw = read(file);
    const data = JSON.parse(raw);
    if (jsonText(data) !== raw) continue;
    let changed = false;
    eachHeroMap(data, [...existing, id], (m) => {
      delete m[id];
      changed = true;
    });
    if (changed) write(file, jsonText(data));
  }
}

/** The text of what the templates name: the profile, five skills, their paragraphs, the ultimate and the three columns. Placeholders. */
function heroText() {
  const t = (s) => `[${id}] ${s}`;
  const para = {};
  for (let n = 1; n <= 5; n++) {
    para[`${id}${n}`] = Object.fromEntries([1, 2, 3].map((p) => [String(p), { name: t(`§ ${p} umiejętności ${n}`), desc: t(`Opis § ${p} umiejętności ${n}.`) }]));
  }
  const skills = {};
  for (let n = 1; n <= 5; n++) skills[`skill${n}`] = { name: t(`Umiejętność ${n}`), pad: t(`Pad ${n}`), desc: t(`Opis umiejętności ${n}.`) };
  const text = {
    name: t('Bohater'),
    desc1: t('Pierwszy wiersz profilu.'),
    desc2: t('Drugi wiersz profilu.'),
    desc3: t('Trzeci wiersz profilu.'),
    quirk: t('Opis cechy.'),
    ...skills,
    para,
    ult: {
      [`${id}Ult`]: {
        name: t('Argument ostateczny'),
        desc: t('Opis argumentu ostatecznego.'),
        stamp: `[${id.toUpperCase()}] ZNAK`,
        note: t('Notatka na marginesie.'),
        para: Object.fromEntries([1, 2, 3].map((p) => [String(p), { name: t(`§ ${p} argumentu`), desc: t(`Opis § ${p} argumentu.`) }])),
      },
    },
    spec: Object.fromEntries(['one', 'two', 'three'].map((c) => [c, { name: t(`Kolumna ${c}`), cap: { name: t(`Premia ${c}`), desc: t(`Opis premii ${c}.`) } }])),
  };
  return text;
}

// ---------- recipes ----------

const BEGIN = `  // SCAFFOLD ${id} begin`;
const END = `  // SCAFFOLD ${id} end`;

/** Placeholder recipes: a click and a body for every skill and the auto-attack, the ultimate with a sub, a tail and the late stamp thud. */
function recipeBlock() {
  const skills = [1, 2, 3, 4, 5].map(
    (n) => `  ${id}Skill${n}: combat([
    click(${1700 + n * 150}, 0.3),
    thump(${70 + n * 4}, 0.14, 0.7),
    noise(${900 + n * 120}, 0.12, 0.2, { q: 0.8, attack: 0.02, role: 'tail' }),
  ], 0.25, 7),`,
  );
  return [
    `${BEGIN} (placeholder recipes of a scaffolded hero, scripts/new-hero.mjs: give each its own sound, then delete these markers)`,
    `  ${id}Auto: combat([click(2300, 0.35), thump(92, 0.1, 0.6)], 0.1, 5),`,
    ...skills,
    `  ${id}Ult: combat([
    click(2000, 0.35),
    thump(86, 0.2, 0.7, { pitchDrop: 0.3 }),
    thump(46, 0.4, 0.5, { delay: 0.002, pitchDrop: 0.1, role: 'sub' }),
    noise(300, 0.5, 0.25, { q: 0.8, attack: 0.3, pitchDrop: 0.6, delay: 0.1, role: 'tail' }),
    click(2200, 0.4, { delay: 0.55 }),
    thump(68, 0.2, 0.7, { delay: 0.55, pitchDrop: 0.25 }),
  ], 1.2, 9),`,
    END,
    '',
  ].join('\n');
}

function addRecipes() {
  const text = read(RECIPES);
  const anchor = '  // ---------- flavours';
  if (!text.includes(anchor)) {
    console.error('src/audio/recipes.ts: the "flavours" anchor is gone; add the recipes by hand (sounds.ts names them)');
    return;
  }
  write(RECIPES, text.replace(anchor, `${recipeBlock()}\n${anchor}`));
}

function removeRecipes() {
  const text = read(RECIPES);
  const a = text.indexOf(BEGIN);
  const b = text.indexOf(END);
  if (a < 0 || b < 0) return;
  const lineEnd = text.indexOf('\n', b) + 1;
  // the block was followed by one blank line that the insertion added
  write(RECIPES, text.slice(0, a) + text.slice(lineEnd).replace(/^\n/, ''));
}

const NAMES = ['Auto', 'Skill1', 'Skill2', 'Skill3', 'Skill4', 'Skill5', 'Ult'].map((n) => `${id}${n}`);

/** The level trims of the placeholder recipes (a test wants one for every recipe), between markers like the recipes. */
function addTrims() {
  const text = read(LEVELS);
  const end = text.lastIndexOf('\n};');
  if (end < 0) {
    console.error('src/audio/levels.ts: the end of TRIMS is not where it was; add a trim of 1 for each placeholder recipe by hand');
    return;
  }
  // the placeholder sounds render near -16 dBFS at 1: 2.8 brings them to about -7, where the calibrated skills sit; the ultimate is already at -3
  const block = `\n${BEGIN}\n${NAMES.map((n) => `  ${n}: ${n.endsWith('Ult') ? 1 : 2.8},`).join('\n')}\n${END}`;
  write(LEVELS, text.slice(0, end) + block + text.slice(end));
}

function removeTrims() {
  const text = read(LEVELS);
  const a = text.indexOf(`\n${BEGIN}`);
  const b = text.indexOf(END);
  if (a < 0 || b < 0) return;
  write(LEVELS, text.slice(0, a) + text.slice(b + END.length));
}

// ---------- the Anomalia face ----------

const faceSource = () => `/**
 * Placeholder face of the ${id} (scripts/new-hero.mjs): it borrows the first face's figure and does nothing. TODO: STORY section 3 and
 * 8.4, its own figure in figures.ts, its mechanic, its text \`story.finale.face.${id}.*\` and \`story.finale.hero.${id}\`.
 */
import type { AnomaliaFace } from '../index';
import { FACE_END_FRACTION, hpFraction } from './common';
import { FIGURE_IDS } from './figures';
import { ${CONST} } from './heroes';

export const ${id}Face: AnomaliaFace = {
  heroId: ${CONST},
  sporAnswer: 'egzystencjalny',
  figure: FIGURE_IDS.kierownik,
  start() {},
  tick() {},
  damageMul: () => 1,
  done: (_s, e) => hpFraction(e) <= FACE_END_FRACTION,
  stop() {},
};
`;

function addFace(index) {
  write(join(FACES, `${id}.ts`), faceSource());
  const heroes = read(join(FACES, 'heroes.ts'));
  write(join(FACES, 'heroes.ts'), `${heroes.trimEnd()}\nexport const ${CONST}: HeroId = heroAt(${index});\n`);
  let idx = read(join(FACES, 'index.ts'));
  idx = idx.replace(/(\nimport \{ wezel \} from '\.\/wezel';)/, `$1\nimport { ${id}Face } from './${id}';`);
  idx = idx.replace(/(export const ALL_FACES: readonly AnomaliaFace\[\] = \[[^\]]*?)(\];)/, `$1, ${id}Face$2`);
  write(join(FACES, 'index.ts'), idx);
}

function removeFace() {
  if (!dry) rmSync(join(FACES, `${id}.ts`), { force: true });
  touched.push(`src/enemies/anomalia/faces/${id}.ts (removed)`);
  const heroes = read(join(FACES, 'heroes.ts'));
  write(join(FACES, 'heroes.ts'), heroes.replace(new RegExp(`export const ${CONST}: HeroId = heroAt\\(\\d+\\);\\n?`), ''));
  let idx = read(join(FACES, 'index.ts'));
  idx = idx.replace(`\nimport { ${id}Face } from './${id}';`, '').replace(`, ${id}Face]`, ']');
  write(join(FACES, 'index.ts'), idx);
}

// ---------- remove ----------

if (remove) {
  if (!existsSync(dir) && !registered) {
    console.error(`no hero '${id}' to remove`);
    process.exit(1);
  }
  if (existing.length === 0 || ['pralka', 'konsultant', 'petlowiec', 'kartograf', 'nalesnik'].includes(id)) {
    console.error(`'${id}' is a shipped hero: refusing to remove it`);
    process.exit(1);
  }
  if (registered) unregisterHero();
  removeRecipes();
  removeTrims();
  removeFace();
  emptyMaps();
  if (!dry) {
    rmSync(dir, { recursive: true, force: true });
    rmSync(join(I18N, 'heroes', `${id}.json`), { force: true });
  }
  touched.push(`src/heroes/${id}/ (removed)`, `src/i18n/pl/heroes/${id}.json (removed)`);
  snapshot();
  console.log(`${dry ? 'would remove' : 'removed'} '${id}':\n  ${touched.join('\n  ')}`);
  process.exit(0);
}

// ---------- make ----------

if (existsSync(dir)) {
  console.error(`src/heroes/${id}/ already exists`);
  process.exit(1);
}
if (registered) {
  console.error(`'${id}' is already in src/heroes/registry.ts`);
  process.exit(1);
}

const files = readdirSync(TEMPLATE).filter((f) => f.endsWith('.tpl'));
if (!dry) mkdirSync(dir);
for (const f of files) {
  const out = f.replace(/\.tpl$/, '');
  write(join(dir, out), read(join(TEMPLATE, f)).replaceAll('__ID__', id));
}

if (!flags.has('--no-register') && !dry) {
  if (registerHero()) {
    write(join(I18N, 'heroes', `${id}.json`), jsonText(heroText()));
    fillMaps();
    addRecipes();
    addTrims();
    addFace(existing.length);
    snapshot();
  }
}

console.log(`${dry ? 'would make' : 'made'}:\n  ${touched.join('\n  ')}\n`);
console.log(read(join(TEMPLATE, 'CHECKLIST.md.tpl')).replaceAll('__ID__', id));
console.log(`Every placeholder text starts with "[${id}] " (grep for it). To take the whole hero out again: npm run new-hero ${id} -- --remove`);
