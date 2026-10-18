// Offline audio renders for inspection (DESIGN 14.5). Usage: npm run render-audio (builds first).
// Drives the bundled Chromium through window.__game.audio (OfflineAudioContext inside the page, through the real
// mix with its limiter), writes WAVs to audio-renders/ and prints, per file: peak dBFS, RMS dBFS, whether a
// 60-140 Hz body is present (combat sounds), and clipping. Exit code 1 if a sound clips, peaks above -1 dBFS,
// or a combat sound has no body band.
// Env: AUDIO_PORT, AUDIO_OUT (build dir), AUDIO_DIR (output dir), AUDIO_SECONDS (music length, default 20).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.AUDIO_PORT ?? 4192);
const OUT = process.env.AUDIO_OUT ?? 'dist';
const DIR = process.env.AUDIO_DIR ?? 'audio-renders';
const SECONDS = Number(process.env.AUDIO_SECONDS ?? 20);
const BASE = `http://127.0.0.1:${PORT}/SciFiArpg/`;
// One seed per profile, so the table also shows three different planets (tempo, scale, loop, band).
const SEEDS = { B: 1, C: 3, BC: 5 };

const PEAK_MAX_DB = -1;
const BODY_FRACTION_MIN = 0.1;
const BODY_LEVEL_MIN_DB = -48;
const MUSIC_RMS_RANGE_DB = [-52, -34];

const db = (x) => 20 * Math.log10(Math.max(x, 1e-9));

async function waitForServer(url, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`preview server did not start at ${url}`);
}

/** In-place radix-2 FFT. */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

/** Decode the 16-bit mono WAV the page returned. */
function decode(buf) {
  const n = (buf.length - 44) / 2;
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = buf.readInt16LE(44 + i * 2) / 32768;
  return x;
}

function analyse(x, sr) {
  let peak = 0;
  let sum = 0;
  let clipped = 0;
  for (const v of x) {
    peak = Math.max(peak, Math.abs(v));
    sum += v * v;
    if (Math.abs(v) >= 0.9995) clipped++;
  }
  const rms = Math.sqrt(sum / x.length);
  // band energy 60-140 Hz as a share of the whole spectrum
  let n = 1;
  while (n < x.length) n <<= 1;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  re.set(x);
  fft(re, im);
  let total = 0;
  let band = 0;
  for (let k = 1; k < n / 2; k++) {
    const e = re[k] * re[k] + im[k] * im[k];
    const f = (k * sr) / n;
    total += e;
    if (f >= 60 && f <= 140) band += e;
  }
  const fraction = total > 0 ? band / total : 0;
  const bandRms = rms * Math.sqrt(fraction);
  return { peakDb: db(peak), rmsDb: db(rms), clipped, fraction, bandDb: db(bandRms) };
}

mkdirSync(DIR, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--outDir', OUT, '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
process.on('exit', () => server.kill('SIGTERM'));

const rows = [];
const problems = [];
let browser;
try {
  await waitForServer(BASE);
  browser = await chromium.launch({ executablePath: chromiumPath(), args: launchArgs });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.text().includes('Service Worker registration blocked')) return;
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`console.${m.type()}: ${m.text()}`);
  });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);

  const save = (r, prefix) => {
    const buf = Buffer.from(r.wav, 'base64');
    const file = `${DIR}/${prefix}-${r.name.replace(/[^a-zA-Z0-9+_.-]/g, '_')}.wav`;
    writeFileSync(file, buf);
    return { file, x: decode(buf) };
  };

  // ---- music: every profile x state ----
  const profiles = await page.evaluate(() => window.__game.audio.profiles());
  const states = await page.evaluate(() => window.__game.audio.states());
  for (const profile of profiles) {
    for (const state of states) {
      const r = await page.evaluate(([p, s, sec, seed]) => window.__game.audio.renderProfile(p, s, { seconds: sec, seed }), [profile, state, SECONDS, SEEDS[profile] ?? 1957]);
      const { file, x } = save(r, 'music');
      const a = analyse(x, r.sampleRate);
      rows.push({ kind: 'music', name: r.name, file, info: r.info, ...a });
    }
    // a crossfade (calm -> boss at 8 s) and a death (calm, then the mechanism stops at 8 s)
    for (const [label, flags] of [
      ['calm-to-boss', { boss: true, enemiesNear: 5 }],
      ['death', { dead: true }],
    ]) {
      const r = await page.evaluate(([p, f, sec, seed]) => window.__game.audio.renderProfile(p, 'calm', { seconds: sec, seed, timeline: [{ t: 8, flags: f }] }), [profile, flags, 16, SEEDS[profile] ?? 1957]);
      const { file, x } = save({ ...r, name: `${profile}-${label}` }, 'music');
      const a = analyse(x, r.sampleRate);
      // levels in 2 s windows, to see the crossfade and the stop
      const win = [];
      for (let s = 0; s + 2 <= x.length / r.sampleRate; s += 2) {
        let e = 0;
        for (let i = s * r.sampleRate; i < (s + 2) * r.sampleRate; i++) e += x[i] * x[i];
        win.push(Math.round(db(Math.sqrt(e / (2 * r.sampleRate)))));
      }
      rows.push({ kind: 'music', name: `${profile}-${label}`, file, info: r.info, windows: win, ...a });
    }
  }

  // ---- sfx: every recipe, plus the composites that the bindings play together ----
  const names = await page.evaluate(() => window.__game.audio.sfxNames());
  const COMBAT_NAMES = new Set(['hit', 'crit', 'kill', 'playerHurt', 'playerHurtLow', 'bossPhase', 'escalate']);
  const specs = names.map((n) => ({ names: [n] }));
  specs.push({ names: ['bossHum'] });
  for (const base of ['hit', 'crit', 'kill']) {
    specs.push({ names: [base, 'flavDevice'] }, { names: [base, 'flavNotice'] }, { names: [base, 'flavBeast'] });
  }
  specs.push({ names: ['hit', 'flavBeast'], opts: { scale: { body: 0.05, sub: 0.05, transient: 0.7 } }, label: 'hit+flavBeast@e0.3' });
  // a swarm: the worst case the limiter sees (three kills, a crit and a hurt together)
  specs.push({ names: ['kill', 'kill', 'crit', 'playerHurt', 'bossPhase', 'pralkaSpin'], label: 'pile-up' });
  for (const sp of specs) {
    const r = await page.evaluate((s) => window.__game.audio.renderSfx({ names: s.names, opts: s.opts }, 1), sp);
    const name = sp.label ?? r.name;
    const { file, x } = save({ ...r, name }, 'sfx');
    const a = analyse(x, r.sampleRate);
    const combat = sp.names.some((n) => COMBAT_NAMES.has(n) || /^(pralka|kons|petl|karto|nales)/.test(n) || n === 'bossHum');
    rows.push({ kind: 'sfx', name, file, combat, ...a });
  }
} catch (e) {
  problems.push(String(e));
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}

// ---- report ----
const f1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : '-inf').padStart(7);
const bad = [];
console.log('\nMUSIC (20 s per file unless noted; music slider 80, through the master limiter)');
console.log('name'.padEnd(26), 'peak dB', ' rms dB', ' clip', ' bpm', 'scale'.padEnd(8), 'loop', ' notes', ' 2-s windows (dB)');
for (const r of rows.filter((x) => x.kind === 'music')) {
  const flag = [];
  if (r.clipped > 0) flag.push('CLIP');
  if (r.peakDb > PEAK_MAX_DB) flag.push('PEAK');
  const calm = !/death|boss|elite/.test(r.name);
  if (calm && (r.rmsDb < MUSIC_RMS_RANGE_DB[0] || r.rmsDb > MUSIC_RMS_RANGE_DB[1]) && !r.name.endsWith('botTime')) flag.push('LEVEL');
  console.log(
    r.name.padEnd(26),
    f1(r.peakDb),
    f1(r.rmsDb),
    String(r.clipped).padStart(5),
    String(r.info.bpm).padStart(4),
    String(r.info.scale).padEnd(8),
    String(r.info.loopBars).padStart(4),
    String(r.info.notes).padStart(6),
    r.windows ? ` ${r.windows.join(' ')}` : '',
    flag.length ? ` <-- ${flag.join(',')}` : '',
  );
  if (flag.includes('CLIP') || flag.includes('PEAK')) bad.push(`${r.name}: ${flag.join(',')}`);
}
console.log('\nSFX (1 s per file, through the master limiter)');
console.log('name'.padEnd(26), 'peak dB', ' rms dB', ' clip', 'body 60-140 Hz: share  level dB', ' body');
for (const r of rows.filter((x) => x.kind === 'sfx')) {
  const body = r.fraction >= BODY_FRACTION_MIN && r.bandDb >= BODY_LEVEL_MIN_DB;
  const flag = [];
  if (r.clipped > 0) flag.push('CLIP');
  if (r.peakDb > PEAK_MAX_DB) flag.push('PEAK');
  const isBeastWeak = r.name.includes('@e0.3');
  if (r.combat && !body && !isBeastWeak) flag.push('NO-BODY');
  console.log(
    r.name.padEnd(26),
    f1(r.peakDb),
    f1(r.rmsDb),
    String(r.clipped).padStart(5),
    ' '.repeat(15),
    `${(r.fraction * 100).toFixed(0).padStart(3)}%`,
    f1(r.bandDb),
    r.combat || isBeastWeak ? (body ? '  yes' : '  no ') : '  n/a',
    flag.length ? ` <-- ${flag.join(',')}` : '',
  );
  if (flag.length) bad.push(`${r.name}: ${flag.join(',')}`);
}
if (problems.length) console.log('\nPAGE PROBLEMS:\n ', problems.join('\n  '));
console.log(`\n${rows.length} files in ${DIR}/`);
if (bad.length || problems.length) {
  console.log(`FAILED: ${bad.length} audio violations, ${problems.length} page problems`);
  process.exit(1);
}
console.log('OK: no clipping, all peaks below -1 dBFS, every combat sound has its body band');
