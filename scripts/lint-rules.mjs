// Mechanical gate for the rules in CLAUDE.md that a type checker does not catch.
// Usage: node scripts/lint-rules.mjs   (exit 1 on any finding)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');
const findings = [];
const report = (file, line, rule, text) => findings.push(`${relative(ROOT, file)}:${line}  [${rule}]  ${text.trim().slice(0, 110)}`);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(SRC);
const isTest = (f) => /\.test\.ts$/.test(f);
const isI18n = (f) => f.includes('/i18n/');
const PL = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
// setTimeout is allowed only where a file declares why, with this exact marker on the line.
const TIMER_OK = /lint-allow-timer/;

for (const f of files) {
  const text = readFileSync(f, 'utf8');
  const lines = text.split('\n');
  const ts = f.endsWith('.ts');
  const css = f.endsWith('.css');
  lines.forEach((raw, i) => {
    const n = i + 1;
    const trimmed = raw.trim();
    if (/^(\*|\/\*)/.test(trimmed)) return; // block-comment line
    const line = raw.replace(/\/\/.*$/, ''); // strip line comments for most rules
    if (EMOJI.test(raw)) report(f, n, 'no-emoji', raw);
    if (ts && !isTest(f) && !isI18n(f)) {
      // Polish diacritics inside a string literal in code = a user-facing literal that bypassed i18n.
      const strings = line.match(/(['"`])(?:\\.|(?!\1).)*\1/g) ?? [];
      for (const s of strings) if (PL.test(s)) report(f, n, 'i18n-literal', raw);
      if (/\bany\b/.test(line) && /:\s*any\b|<any>|as any\b|any\[\]/.test(line)) report(f, n, 'no-any', raw);
      if (/[\w\)\]]!\s*[\.\[\(;,)]/.test(line) && !/!==?/.test(line.replace(/[\w\)\]]!\s*[\.\[\(;,)]/, ''))) report(f, n, 'no-non-null', raw);
      if (/\bset(Timeout|Interval)\s*\(/.test(line) && !TIMER_OK.test(raw)) report(f, n, 'no-settimeout', raw);
    }
    if (css) {
      if (/gradient\(/.test(line)) report(f, n, 'look-no-gradient', raw);
      if (/box-shadow|text-shadow|drop-shadow|backdrop-filter|blur\(/.test(line) && !/none/.test(line)) report(f, n, 'look-no-shadow-blur', raw);
      if (/font-family[^;]*(sans-serif|Inter|Roboto|Arial|Helvetica|system-ui)/.test(line)) report(f, n, 'look-no-sans', raw);
      const r = line.match(/border-radius\s*:\s*(\d+)px/);
      if (r && Number(r[1]) > 6) report(f, n, 'look-no-rounded-cards', raw);
    }
  });
  if (ts && !isTest(f) && !isI18n(f)) {
    // SVG attributes that break the ink rule.
    if (/(linearGradient|radialGradient|feGaussianBlur|feDropShadow)/.test(text) && !/lint-allow-filter/.test(text)) report(f, 0, 'look-no-gradient-blur-svg', 'uses a gradient/blur/shadow SVG primitive');
  }
}

if (findings.length) {
  console.log(`lint-rules: ${findings.length} finding(s)\n` + findings.join('\n'));
  process.exit(1);
}
console.log('lint-rules: clean');
