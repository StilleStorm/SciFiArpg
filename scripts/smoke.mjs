// Scripted play-through of the built game in the bundled Chromium: real button clicks to get into a run,
// the test hook for fighting, then a boss, the end of the ticket, a death, and a frame-time measurement
// with 40 enemies. Usage: npm run smoke (builds first). Exits non-zero on page errors or a failed check.
// Pictures go to shots-smoke/. Env: SMOKE_PORT, SMOKE_OUT (build dir), SMOKE_DIR, PERF_MAX_MS (fail above this),
// SMOKE_UNCAPPED (measure without the 60 Hz limit).
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SMOKE_PORT ?? 4191);
const OUT = process.env.SMOKE_OUT ?? 'dist';
const SHOTS = process.env.SMOKE_DIR ?? 'shots-smoke';
const PERF_MAX = process.env.PERF_MAX_MS ? Number(process.env.PERF_MAX_MS) : null;
const BASE = `http://127.0.0.1:${PORT}/SciFiArpg/`;
const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync(SHOTS, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--outDir', OUT, '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
  stdio: 'ignore',
});
const stop = () => server.kill('SIGTERM');
process.on('exit', stop);

const problems = [];
const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
};
const log = (...a) => console.log(' ', ...a);

async function waitForServer(url, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(200);
  }
  throw new Error(`preview server did not start at ${url}`);
}

let browser;
try {
  await waitForServer(BASE);
  // SMOKE_UNCAPPED=1 lifts the 60 Hz limit so the frame time shows what a frame really costs.
  const extra = process.env.SMOKE_UNCAPPED ? ['--disable-frame-rate-limit', '--disable-gpu-vsync'] : [];
  browser = await chromium.launch({ executablePath: chromiumPath(), args: [...launchArgs, ...extra] });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: UA,
    colorScheme: 'light',
    serviceWorkers: 'block',
  });
  // The only randomness outside the seeded run is the fresh seed of each ticket: pin it.
  await ctx.addInitScript(() => {
    Math.random = () => 0.4242;
    Date.now = () => 1.75e12;
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.text().includes('Service Worker registration blocked')) return;
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`console.${m.type()}: ${m.text()}`);
  });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);
  await page.evaluate(() => document.fonts.ready);

  const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png` });
  const screen = () => page.evaluate(() => window.__game.screen());
  const runState = () =>
    page.evaluate(() => {
      const s = window.__game.state();
      return s && { status: s.status, modal: s.modal, hp: s.player.hp, level: s.player.level, pending: s.hero.pendingLevels, kills: s.kills, page: s.pageIndex, pages: s.pageCount, victoryAt: s.victoryAt, boss: s.enemies.some((e) => e.boss) };
    });
  const clickText = async (txt) => {
    const el = page.locator('#ui').getByText(txt, { exact: false }).locator('visible=true').first();
    await el.click({ timeout: 5000 });
  };

  /** Take whatever holds the run: a law sheet, the update form (opened from the HUD line). Returns how many things it closed. */
  async function settle() {
    let closed = 0;
    for (let k = 0; k < 8; k++) {
      const st = await runState();
      if (!st) return closed;
      const form = page.locator('.sheet:not(.hidden) .entry').first();
      if (await form.isVisible().catch(() => false)) {
        const open = page.locator('.sheet:not(.hidden) .entry:not(.locked)').first();
        await open.click({ timeout: 2000 });
        await page.locator('.sheet:not(.hidden) .install').click({ timeout: 2000 });
        await sleep(1300); // the stamp lands, then the form closes
        closed++;
        continue;
      }
      if (st.modal) {
        const btn = page.locator('.pop-wrap .form-btn, .pop-wrap button').locator('visible=true').first();
        await btn.click({ timeout: 2000 }).catch(() => undefined);
        await sleep(400);
        closed++;
        continue;
      }
      const upd = page.locator('.hud .upd');
      if (st.status === 'running' && st.pending > 0 && !st.boss && st.victoryAt === null && (await upd.isVisible().catch(() => false))) {
        await upd.click({ timeout: 2000 }).catch(() => undefined); // the typed "aktualizacja dostepna" line under Reputacja
        await sleep(600);
        continue;
      }
      return closed;
    }
    return closed;
  }

  // ---------- 1. into a run through the real buttons ----------
  await sleep(1500);
  await clickText('Rozpocznij');
  await sleep(600);
  if ((await screen()) === 'profile') {
    await shot('01-profile');
    await page.locator('button.choose').locator('visible=true').first().click();
    await sleep(600);
  }
  await shot('02-baza');
  await clickText('Nowe zgłoszenie');
  await sleep(600);
  await shot('03-ticket');
  await clickText('Akceptuję regulamin');
  await sleep(1800);
  check('reached the run through the real buttons', (await screen()) === 'run');
  await shot('04-run-start');
  // sound: the real button clicks unlocked the context, the music started with the run (menus had none)
  const ctxState = await page.evaluate(() => window.__game.audio.contextState());
  check('the audio context was unlocked by the real clicks', ctxState === 'running', ctxState);
  await sleep(2500);
  const music = await page.evaluate(() => window.__game.audio.music());
  check('music is playing during the run', music !== null && music.bars >= 1, music ? `${music.id} ${music.bpm} bpm ${music.scale}, bars ${music.bars}` : 'none');
  await settle();

  // ---------- 2. walk, fight, kill ----------
  const k0 = (await runState())?.kills ?? 0;
  for (let i = 0; i < 12; i++) {
    await page.touchscreen.tap(120 + (i % 3) * 80, 300 + (i % 4) * 90);
    await sleep(500);
    await page.evaluate(() => window.__game.hitEnemy());
    if (i % 2) await page.evaluate(() => window.__game.killEnemy());
    if (i % 4 === 0) await page.locator('.pad.s1').click({ timeout: 800 }).catch(() => undefined);
    await settle();
  }
  const afterFight = await runState();
  check('at least one kill', (afterFight?.kills ?? 0) > k0, `kills ${afterFight?.kills}`);
  const music2 = await page.evaluate(() => window.__game.audio.music());
  check('the music kept going through the fight', music2 !== null && music2.bars > (music?.bars ?? 0), music2 ? `bars ${music2.bars}` : 'none');
  await shot('05-fight');

  // ---------- 3. the deferred update: HUD line, tap, form, install ----------
  await settle();
  await page.evaluate(() => {
    const s = window.__game.state();
    if (s) s.enemies.length = 0;
  });
  const before = await runState();
  await page.evaluate(() => window.__game.hero.levelUp());
  const queued = await runState();
  check('a level up queues the update and does not open the form', queued?.status === 'running' && queued.pending > (before?.pending ?? 0), `pending ${queued?.pending}`);
  await sleep(250);
  check('the HUD shows the "aktualizacja dostepna" line', await page.locator('.hud .upd').isVisible());
  await shot('06-update-available');
  await page.locator('.hud .upd').click();
  await page.locator('.sheet:not(.hidden) .entry').first().waitFor({ state: 'visible', timeout: 3000 });
  await sleep(500);
  await shot('07-update-form');
  const closedForms = await settle();
  const afterUpdate = await runState();
  check('the update form closes after installing', closedForms > 0 && afterUpdate?.status === 'running' && afterUpdate.pending === 0, `status ${afterUpdate?.status}, pending ${afterUpdate?.pending}`);

  // ---------- 4. inventory sheet ----------
  await page.evaluate(() => window.__game.demoInventory());
  await page.locator('.pad.inv').click({ timeout: 2000 }).catch(() => undefined);
  await sleep(600);
  await shot('08-inventory');
  await page.locator('.ps-close').click({ timeout: 2000 }).catch(() => undefined);
  await sleep(300);

  // ---------- 5. the boss ----------
  await settle();
  const pages = (await runState())?.pages ?? 1;
  await page.evaluate((n) => window.__game.turnTo(n - 1), pages);
  await sleep(1500);
  await settle();
  await shot('09-boss-page');
  const boss = await page.evaluate(() => {
    const b = window.__game.state()?.enemies.find((e) => e.boss);
    return b ? { id: b.id, family: b.family } : null;
  });
  check('the boss spawns on the last page', boss !== null, boss ? boss.family : 'none');
  let bossDead = false;
  for (let i = 0; i < 60 && boss; i++) {
    const alive = await page.evaluate((id) => {
      const s = window.__game.state();
      const b = s?.enemies.find((e) => e.id === id);
      if (!s || !b) return false;
      window.__game.placePlayer(b.x + 30, b.y);
      for (const t of ['regulaminowy', 'mechaniczny', 'egzystencjalny']) window.__game.enemies.hit(id, t, 60);
      return true;
    }, boss.id);
    if (!alive) {
      bossDead = true;
      break;
    }
    await sleep(150);
    await settle();
  }
  check('the boss dies', bossDead);
  await sleep(300);
  await shot('10-boss-dead');
  for (let i = 0; i < 30 && (await screen()) !== 'baza'; i++) {
    await sleep(300);
    await settle();
  }
  check("'baza' is reached after the boss", (await screen()) === 'baza', await screen());
  await shot('11-baza-after-boss');

  // ---------- 6. a death form ----------
  await clickText('Nowe zgłoszenie');
  await sleep(500);
  await clickText('Akceptuję regulamin');
  await sleep(1500);
  await settle();
  await page.evaluate(() => {
    const s = window.__game.state();
    if (s) s.enemies.length = 0;
    window.__game.hurtPlayer(99999);
  });
  await sleep(1400);
  const deathForm = await page.locator('.sheet:not(.hidden)').first().isVisible().catch(() => false);
  check('a death form appears', deathForm);
  await shot('12-death');
  await sleep(7500);
  await shot('13-after-death');
  log('after the death form:', await screen(), JSON.stringify(await runState()));

  // ---------- 7. frame time with 40 enemies ----------
  // a fresh run: the death slip of the step above may still hold the old one
  await page.evaluate(() => window.__game.start(11, { pageCount: 5, lawId: 'grawitacja' }));
  await sleep(1500);
  await settle();
  await page.evaluate(() => {
    const g = window.__game;
    const s = g.state();
    if (!s) return;
    g.enemies.clear();
    s.player.hp = s.player.hpMax = 1e9; // stay alive for the whole measurement
    s.hero.pendingLevels = 0;
    for (const f of ['urzadzenia', 'powiadomienia', 'wygenerowane']) g.enemies.spawnFamily(f, f === 'urzadzenia' ? 14 : 13);
    for (const e of s.enemies) e.hp = e.hpMax = 1e9; // nobody dies during the measurement
  });
  await sleep(1500); // let them be drawn in
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  const m0 = await metrics();
  const perf = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const deltas = [];
        let last = performance.now();
        const t0 = last;
        const tick = (now) => {
          deltas.push(now - last);
          last = now;
          if (now - t0 < 5000) requestAnimationFrame(tick);
          else resolve({ deltas, enemies: window.__game.state()?.enemies.length ?? 0 });
        };
        requestAnimationFrame(tick);
      }),
  );
  const m1 = await metrics();
  const d = perf.deltas.slice(1).sort((a, b) => a - b);
  const avg = d.reduce((a, b) => a + b, 0) / d.length;
  const p95 = d[Math.floor(d.length * 0.95)] ?? 0;
  const frames = d.length;
  const per = (k) => (((m1[k] ?? 0) - (m0[k] ?? 0)) * 1000) / frames;
  console.log(
    `PERF ${perf.enemies} enemies: frame ${avg.toFixed(2)} ms avg, ${p95.toFixed(1)} ms p95 over ${frames} frames; main thread per frame: task ${per('TaskDuration').toFixed(2)} ms (script ${per('ScriptDuration').toFixed(2)}, layout ${per('LayoutDuration').toFixed(2)}, style ${per('RecalcStyleDuration').toFixed(2)})`,
  );
  await shot('14-forty-enemies');
  check('40 enemies on the page for the measurement', perf.enemies >= 40, String(perf.enemies));
  if (PERF_MAX !== null) check(`average frame under ${PERF_MAX} ms`, avg <= PERF_MAX, `${avg.toFixed(2)} ms`);
} catch (e) {
  problems.push(`script: ${e instanceof Error ? e.message : String(e)}`);
} finally {
  await browser?.close();
  stop();
}

check('no page or console errors', problems.length === 0);
for (const p of problems.slice(0, 15)) console.log(' -', p.slice(0, 300));
const failed = checks.filter((c) => !c.ok);
console.log(failed.length === 0 ? 'SMOKE PASSED' : `SMOKE FAILED: ${failed.map((c) => c.name).join('; ')}`);
process.exit(failed.length === 0 ? 0 : 1);
