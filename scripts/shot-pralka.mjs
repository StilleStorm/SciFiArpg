// S19, Pralka filled: the five later skills and the two later ultimates at work, the pad glyphs, the loadout sheet with ten rows, the
// Konfiguracja form with its ultimate chooser, the Karta uprawnien, the update form leading with a new skill, the profile screen.
// Usage: SHOT_PORT=4198 SHOT_OUT=dist-pralka SHOT_DIR=shots-pralka vite build --outDir dist-pralka && node scripts/shot-pralka.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4198);
const OUT = process.env.SHOT_OUT ?? 'dist-pralka';
const SHOTS = process.env.SHOT_DIR ?? 'shots-pralka';
const BASE = `http://127.0.0.1:${PORT}/SciFiArpg/`;
const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

mkdirSync(SHOTS, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--outDir', OUT, '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
const stop = () => server.kill('SIGTERM');
process.on('exit', stop);

const problems = [];
const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
};

// skill: SkillIndex; aim: what the pad hands over; at: enemies relative to the hero; waits: ms after the cast for a picture
const SCENES = [
  { name: 'plukanie', skill: 5, aim: null, at: [[80, -10], [110, 30], [-90, 40]], waits: [200, 700] },
  { name: 'program90', skill: 6, aim: null, at: [[60, -20], [-50, 40], [30, 70], [110, 10]], waits: [400, 1800] },
  { name: 'tryb-oszczedny', skill: 7, aim: null, at: [[110, -10], [-100, 30]], waits: [500] },
  { name: 'odpompowanie', skill: 9, aim: { kind: 'wskazanie', x: 700, y: 800 }, at: [[90, -10], [120, 40], [60, 50]], waits: [300, 2400] },
  { name: 'zmiana', skill: 8, aim: null, at: [[80, -10], [110, 30]], waits: [250], first: 0 },
  { name: 'uznanie', ult: 'uznanieOsobowosci', at: [[80, -10], [-90, 40], [30, 110], [140, 60]], waits: [500, 2500] },
  { name: 'reklamacja', ult: 'reklamacja', at: [[80, -10], [-90, 40], [30, 110], [140, 60], [-60, -90]], waits: [350, 1200] },
];

let browser;
try {
  await waitForServer(BASE);
  browser = await chromium.launch({ executablePath: chromiumPath(), args: launchArgs });
  const open = async (viewport, scale = 2) => {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale, isMobile: true, hasTouch: true, userAgent: UA, colorScheme: 'light', serviceWorkers: 'block' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.text().includes('Service Worker registration blocked')) return;
      if (m.type() === 'error' || m.type() === 'warning') problems.push(`console.${m.type()}: ${m.text()}`);
    });
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__game !== undefined);
    await page.evaluate(() => document.fonts.ready);
    return { ctx, page };
  };
  const startRun = async (page) => {
    await page.evaluate(() => window.__game.start(11, { pageCount: 5, lawId: 'grawitacja', heroId: 'pralka' }));
    await sleep(1300);
    await page.evaluate(() => {
      const g = window.__game;
      const s = g.state();
      s.hero.pendingLevels = 0;
      s.hero.updateRequested = false;
      g.enemies.clear();
      g.setLevel(40);
      for (const i of [3, 4]) g.hero.installSkill(i);
      for (const i of [5, 6, 7, 8, 9]) {
        s.hero.ranks[i] = 1;
        s.hero.upgrades[`skill${i + 1}`] = 1;
      }
      s.hero.pendingLevels = 0;
      s.hero.updateRequested = false;
    });
  };

  // ---- the skills at work ----
  {
    const { ctx, page } = await open({ width: 390, height: 844 });
    const clip = (h = 400) =>
      page.evaluate((h) => {
        const r = document.querySelector('#world > g[data-kind="player"]').getBoundingClientRect();
        const cy = r.top + r.height / 2;
        return { x: 0, y: Math.max(0, Math.round(cy - h / 2)), width: 390, height: h };
      }, h);
    for (const sc of SCENES) {
      await startRun(page);
      await page.evaluate((sc) => {
        const g = window.__game;
        const s = g.state();
        g.placePlayer(600, 800);
        s.player.hp = s.player.hpMax = 1e9;
        g.hero.spawn(sc.at.length);
        s.enemies.forEach((e, i) => {
          e.x = s.player.x + sc.at[i][0];
          e.y = s.player.y + sc.at[i][1];
          e.home = { x: e.x, y: e.y };
          e.mode = 'wander';
          e.wanderTimer = 99;
          e.speed = 0;
          e.attackTimer = 99;
          e.hp = e.hpMax = 1e6;
        });
        if (sc.skill !== undefined) g.hero.assignPad(1, sc.skill);
        if (sc.ult) {
          s.hero.ultimateId = sc.ult;
          g.fillMeter(1);
        }
      }, sc);
      await sleep(900);
      if (sc.first !== undefined) {
        await page.evaluate((i) => {
          window.__game.hero.assignPad(2, i);
          window.__game.hero.cast(2); // something to change
          window.__game.hero.assignPad(1, 8);
        }, sc.first);
        await sleep(300);
      }
      const fired = await page.evaluate((sc) => {
        const g = window.__game;
        if (sc.ult) return g.castUltimate();
        g.state().hero.cd[sc.skill] = 0;
        return g.hero.cast(1, sc.aim ?? undefined);
      }, sc);
      check(`${sc.name}: it fires`, fired === true);
      let last = 0;
      for (const w of sc.waits) {
        await sleep(w - last);
        last = w;
        await page.screenshot({ path: `${SHOTS}/${sc.name}-${w}.png`, clip: await clip() });
        if (sc.ult && last === sc.waits[0]) await page.screenshot({ path: `${SHOTS}/${sc.name}-full.png` });
      }
    }
    await ctx.close();
  }

  // ---- the sheets, portrait and landscape ----
  for (const [prefix, viewport] of [['port', { width: 390, height: 844 }], ['land', { width: 844, height: 390 }]]) {
    const { ctx, page } = await open(viewport);
    const shot = (name) => page.screenshot({ path: `${SHOTS}/${prefix}-${name}.png` });
    await startRun(page);
    await page.evaluate(() => {
      const g = window.__game;
      g.hero.assignPad(1, 5);
      g.hero.assignPad(2, 6);
      g.hero.assignPad(3, 9);
    });
    await sleep(300);
    const words = await page.evaluate(() => ['s1', 's2', 's3'].map((c) => document.querySelector(`.pad.${c} .word`)?.textContent ?? ''));
    check(`${prefix}: the pads carry the later skills' words`, words.join('|') === 'Płukanie|Program|Odpompowanie', words.join('|'));
    await shot('pads');
    const padBox = await page.evaluate(() => {
      const r = [...document.querySelectorAll('.pad.s1, .pad.s2, .pad.s3')].map((n) => n.getBoundingClientRect());
      const x0 = Math.min(...r.map((b) => b.left));
      const y0 = Math.min(...r.map((b) => b.top));
      return { x: Math.max(0, x0 - 12), y: Math.max(0, y0 - 12), width: Math.max(...r.map((b) => b.right)) - x0 + 24, height: Math.max(...r.map((b) => b.bottom)) - y0 + 24 };
    });
    await page.screenshot({ path: `${SHOTS}/${prefix}-glyphs-a.png`, clip: padBox });
    await page.evaluate(() => {
      const g = window.__game;
      g.hero.assignPad(1, 7);
      g.hero.assignPad(2, 8);
    });
    await sleep(250);
    await page.screenshot({ path: `${SHOTS}/${prefix}-glyphs-b.png`, clip: padBox });

    // the loadout sheet
    await page.locator('.pause-btn').click();
    await sleep(400);
    await page.locator('[data-pause=skills]').click();
    await page.locator('.loadout-sheet .lo-row').first().waitFor({ state: 'visible', timeout: 3000 });
    await sleep(300);
    await shot('loadout');
    const lo = await page.evaluate(() => ({ rows: document.querySelectorAll('.loadout-sheet .lo-row').length, off: document.querySelectorAll('.loadout-sheet .lo-row.off').length }));
    check(`${prefix}: the loadout lists ten rows, none greyed once all are installed`, lo.rows === 10 && lo.off === 0, JSON.stringify(lo));
    await page.locator('.lo-back').click();
    await sleep(300);

    // Konfiguracja with the ultimate chooser
    await page.locator('[data-pause=paragraphs]').click();
    await page.locator('.kf-row').first().waitFor({ state: 'visible', timeout: 3000 });
    await sleep(300);
    await shot('konfiguracja-top');
    await page.evaluate(() => {
      const sc = document.querySelector('.kf-sheet .ps-scroll');
      if (sc) sc.scrollTop = sc.scrollHeight;
    });
    await sleep(250);
    await shot('konfiguracja-end');
    const kf = await page.evaluate(() => ({
      rows: document.querySelectorAll('.kf-row').length,
      ults: [...document.querySelectorAll('.kf-ultrow')].map((r) => r.dataset.skill),
      picks: [...document.querySelectorAll('.kf-ultpick')].map((b) => ({ id: b.dataset.ultimate, h: Math.round(b.getBoundingClientRect().height), w: Math.round(b.getBoundingClientRect().width) })),
    }));
    check(`${prefix}: Konfiguracja lists ten skills and three ultimates, the other two with a pick button of 44 px`, kf.rows === 10 && kf.ults.length === 3 && kf.picks.length === 2 && kf.picks.every((p) => p.h >= 44 && p.w >= 44), JSON.stringify(kf));
    await page.locator('.kf-ultpick').first().click();
    await sleep(300);
    const chosen = await page.evaluate(() => window.__game.state().hero.ultimateId);
    check(`${prefix}: picking an ultimate puts it in the slot`, chosen === 'uznanieOsobowosci', String(chosen));
    await page.evaluate(() => {
      const sc = document.querySelector('.kf-sheet .ps-scroll');
      if (sc) sc.scrollTop = sc.scrollHeight;
    });
    await sleep(250);
    await shot('konfiguracja-picked');
    await page.locator('[data-konfiguracja=back]').click();
    await sleep(300);
    await ctx.close();
  }

  // ---- the Karta uprawnien from the base desk ----
  {
    const { ctx, page } = await open({ width: 390, height: 844 });
    await page.evaluate(() => window.__game.startBase());
    await sleep(1200);
    await page.evaluate(() => {
      const g = window.__game;
      g.setLevel(40);
      const s = g.state();
      s.hero.pendingLevels = 0;
      for (const i of [3, 4]) g.hero.installSkill(i);
      for (const i of [5, 6, 7]) {
        s.hero.ranks[i] = 1;
        s.hero.upgrades[`skill${i + 1}`] = 1;
      }
    });
    await page.evaluate(() => window.__game.station('biurko'));
    await page.locator('[data-desk=karta]').waitFor({ state: 'visible', timeout: 4000 });
    await page.locator('[data-desk=karta]').click();
    await page.locator('.kt-body').waitFor({ state: 'visible', timeout: 3000 });
    await sleep(500);
    await page.screenshot({ path: `${SHOTS}/karta-top.png` });
    const kt = await page.evaluate(() => ({
      ults: document.querySelectorAll('.kt-ult').length,
      nodes: [...document.querySelectorAll('.kt-col')].map((c) => c.querySelectorAll('.kt-node').length),
      passives: document.querySelectorAll('.kt-band .kt-node').length,
      rule: document.querySelector('.kt-band .kt-node[data-node="passive:7"]')?.dataset.state,
    }));
    check('karta: three ultimates, ten passives, the rule always stamped', kt.ults === 3 && kt.passives === 10 && kt.rule === 'granted', JSON.stringify(kt));
    await page.evaluate(() => {
      const sc = document.querySelector('.kt-sheet .ps-scroll');
      if (sc) sc.scrollTop = 700;
    });
    await sleep(300);
    await page.screenshot({ path: `${SHOTS}/karta-mid.png` });
    await page.evaluate(() => {
      const sc = document.querySelector('.kt-sheet .ps-scroll');
      if (sc) sc.scrollTop = sc.scrollHeight;
    });
    await sleep(300);
    await page.screenshot({ path: `${SHOTS}/karta-end.png` });
    await ctx.close();
  }

  // ---- the update form leading with a new skill, and the profile ----
  {
    const { ctx, page } = await open({ width: 390, height: 844 });
    await page.evaluate(() => window.__game.start(11, { pageCount: 5, lawId: 'grawitacja', heroId: 'pralka' }));
    await sleep(1300);
    await page.evaluate(() => {
      const g = window.__game;
      g.enemies.clear();
      g.setLevel(3);
      g.hero.requestUpdate();
    });
    await sleep(700);
    const opened = await page.evaluate(() => window.__game.hero.openUpdate());
    await sleep(500);
    await page.screenshot({ path: `${SHOTS}/update-new-skill.png` });
    const lead = await page.evaluate(() => document.querySelector('.sheet .entry')?.textContent ?? '');
    check('update: the form leads with a skill of S19 at level 3 (Płukanie or Tryb oszczędny)', opened && /Płukanie|Tryb oszczędny/.test(lead), lead.slice(0, 80));
    await ctx.close();
  }
  {
    const { ctx, page } = await open({ width: 390, height: 844 });
    await page.evaluate(() => window.__game.hero.profile());
    await sleep(900);
    await page.screenshot({ path: `${SHOTS}/profile-top.png` });
    await page.evaluate(() => {
      const b = document.querySelector('.profile .ps-scroll, .profile-body, .pf-body');
      if (b) b.scrollTop = b.scrollHeight;
    });
    await sleep(300);
    await page.screenshot({ path: `${SHOTS}/profile-end.png` });
    await ctx.close();
  }
} catch (e) {
  problems.push(`script: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
} finally {
  await browser?.close();
  stop();
}

check('no page or console errors', problems.length === 0);
for (const p of problems.slice(0, 15)) console.log(' -', p.slice(0, 400));
const failed = checks.filter((c) => !c.ok);
console.log(failed.length === 0 ? 'PRALKA SHOTS PASSED' : `PRALKA SHOTS FAILED: ${failed.map((c) => c.name).join('; ')}`);
process.exit(failed.length === 0 ? 0 : 1);
