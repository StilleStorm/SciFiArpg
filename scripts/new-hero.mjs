// Scaffold a new hero: node scripts/new-hero.mjs <id> [--no-register] [--dry-run]   (npm run new-hero <id>)
// Makes src/heroes/<id>/ from src/heroes/_template/*.tpl (placeholders compile and play), puts the id in the registry
// (src/heroes/registry.ts) and prints the checklist. The folder also gets CHECKLIST.md with the same list.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const HEROES = join(ROOT, 'src/heroes');
const TEMPLATE = join(HEROES, '_template');

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const id = args.find((a) => !a.startsWith('--'));
const dry = flags.has('--dry-run');

if (!id || !/^[a-z][a-z0-9]{2,23}$/.test(id)) {
  console.error('usage: npm run new-hero <id>   (lowercase ASCII letters and digits, 3 to 24 characters, e.g. "wozny")');
  process.exit(1);
}
const dir = join(HEROES, id);
if (existsSync(dir)) {
  console.error(`src/heroes/${id}/ already exists`);
  process.exit(1);
}
const registryPath = join(HEROES, 'registry.ts');
const registry = readFileSync(registryPath, 'utf8');
if (new RegExp(`'${id}'`).test(registry)) {
  console.error(`'${id}' is already in src/heroes/registry.ts`);
  process.exit(1);
}

const files = readdirSync(TEMPLATE).filter((f) => f.endsWith('.tpl'));
const made = [];
if (!dry) mkdirSync(dir);
for (const f of files) {
  const out = f.replace(/\.tpl$/, '');
  const text = readFileSync(join(TEMPLATE, f), 'utf8').replaceAll('__ID__', id);
  if (!dry) writeFileSync(join(dir, out), text);
  made.push(`src/heroes/${id}/${out}`);
}

// the registry: the id list, the import, the module list
let next = registry;
next = next.replace(/(HERO_ID_LIST = \[[^\]]*?)(\] as const)/, `$1, '${id}'$2`);
next = next.replace(/(\nimport type \{ HeroDef \} from '\.\/defs';)/, `\nimport { hero as ${id} } from './${id}';$1`);
next = next.replace(/(const MODULES: readonly HeroModule\[\] = \[[^\]]*?)(\];)/, `$1, ${id}$2`);
if (next === registry || !next.includes(`hero as ${id}`) || !next.includes(`, ${id}]`) || !next.includes(`'${id}'`)) {
  console.error('could not edit src/heroes/registry.ts; add the hero by hand (see src/heroes/README.md)');
} else if (!flags.has('--no-register') && !dry) {
  writeFileSync(registryPath, next);
  made.push('src/heroes/registry.ts (registered)');
}

console.log(`${dry ? 'would make' : 'made'}:\n  ${made.join('\n  ')}\n`);
console.log(readFileSync(join(TEMPLATE, 'CHECKLIST.md.tpl'), 'utf8').replaceAll('__ID__', id));
console.log('Until the keys exist, the registry test fails on the missing i18n entries (profile text, passives): that is the to-do list.');
