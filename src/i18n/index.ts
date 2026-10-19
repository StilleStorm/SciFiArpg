import { bindOrphans } from './typography';

/**
 * t('domain.key', params). Files in pl/*.json are merged under their file name:
 * pl/ui.json -> keys "ui.<path>". A leaf is a string or a plural object {one, few, many}.
 */
export interface PluralForms {
  one: string;
  few: string;
  many: string;
}
export type Entry = string | PluralForms;
export type Params = Record<string, string | number>;
export type Gender = 'm' | 'f' | 'n' | 'pl';
export type GenderForms = Record<Gender, string>;

interface Tree {
  [key: string]: Entry | Tree;
}

const files = import.meta.glob<Tree>('./pl/*.json', { eager: true, import: 'default' });
/** pl/heroes/<id>.json: the paragraphs of one hero, merged under `heroes.<id>` (S2). */
const heroFiles = import.meta.glob<Tree>('./pl/heroes/*.json', { eager: true, import: 'default' });

function isPlural(v: Entry | Tree): v is PluralForms {
  return typeof v === 'object' && 'one' in v && 'few' in v && 'many' in v && typeof v['one'] === 'string';
}

/** Flatten a nested tree to dotted keys; plural objects stay leaves. */
export function flatten(tree: Tree, prefix: string, out: Map<string, Entry> = new Map()): Map<string, Entry> {
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string' || isPlural(v)) out.set(key, v);
    else flatten(v as Tree, key, out);
  }
  return out;
}

let table = new Map<string, Entry>();
for (const [path, tree] of Object.entries(files)) {
  const name = path.replace(/^.*\//, '').replace(/\.json$/, '');
  flatten(tree, name, table);
}
for (const [path, tree] of Object.entries(heroFiles)) {
  flatten(tree, `heroes.${path.replace(/^.*\//, '').replace(/\.json$/, '')}`, table);
}

/** Replace the string table (tests). */
export function setTable(next: Map<string, Entry>): void {
  table = next;
  warned.clear();
}

/** Polish plural category: 1 -> one; 2-4 except 12-14 -> few; everything else -> many. */
export function pluralCategory(n: number): keyof PluralForms {
  const a = Math.abs(Math.trunc(n));
  if (a === 1) return 'one';
  const last = a % 10;
  const last2 = a % 100;
  if (last >= 2 && last <= 4 && !(last2 >= 12 && last2 <= 14)) return 'few';
  return 'many';
}

const warned = new Set<string>();

function warnOnce(key: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[i18n] missing key: ${key}`);
}

export function t(key: string, params?: Params): string {
  const entry = table.get(key);
  if (entry === undefined) {
    warnOnce(key);
    return key;
  }
  let text: string;
  if (typeof entry === 'string') text = entry;
  else {
    const count = params?.['count'];
    text = entry[pluralCategory(typeof count === 'number' ? count : Number(count ?? 0))];
  }
  if (!params) return bindOrphans(text);
  return bindOrphans(
    text.replace(/\{(\w+)\}/g, (m, name: string) => {
      const v = params[name];
      return v === undefined ? m : String(v);
    }),
  );
}

/** Pick the form of a generated word that agrees with the noun's grammatical gender. */
export function genderForm(forms: GenderForms, gender: Gender): string {
  return forms[gender];
}
