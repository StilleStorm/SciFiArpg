// S28 ui-polish: screens in both orientations plus two audits that run on every frame: the smallest rendered text size and the real
// tap box (elementFromPoint 21 px out from the centre of every visible button). Usage:
//   SHOT_PORT=4193 SHOT_OUT=dist-ui-polish SHOT_DIR=shots-ui-polish vite build --outDir dist-ui-polish && node scripts/shot-ui-polish.mjs
// ONLY=name1,name2 limits the scenarios; LEG=p|l limits the orientation.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4193);
const OUT = process.env.SHOT_OUT ?? 'dist-ui-polish';
const SHOTS = process.env.SHOT_DIR ?? 'shots-ui-polish';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const LEG = process.env.LEG ?? '';
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
process.on('exit', () => server.kill('SIGTERM'));

const problems = [];
let failed = 0;

/** Runs in the page: text under 11 px and buttons whose real hit area is under 44 px. */
function audit() {
  const out = { small: [], tap: [] };
  const vis = (n) => {
    const r = n.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const cs = getComputedStyle(n);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05;
  };
  const label = (n) => `${n.tagName.toLowerCase()}${n.className && typeof n.className === 'string' ? '.' + n.className.trim().split(/\s+/).join('.') : ''}`;
  for (const n of document.querySelectorAll('#ui *')) {
    const own = [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim().length > 0);
    if (!own || !vis(n)) continue;
    const fs = parseFloat(getComputedStyle(n).fontSize) * (parseFloat(getComputedStyle(n).zoom) || 1);
    if (fs < 10.99) out.small.push(`${label(n)} ${fs}px "${n.textContent.trim().slice(0, 24)}"`);
  }
  for (const n of document.querySelectorAll('#ui button, #ui [role=button], #ui a')) {
    if (!vis(n)) continue;
    const r = n.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    // the part of the screen a scrolling ancestor shows: a point outside it is the scroll edge cutting the box, not another element
    let clip = { l: 0, t: 0, r: innerWidth, b: innerHeight };
    for (let a = n.parentElement; a && a !== document.body; a = a.parentElement) {
      const o = getComputedStyle(a).overflowY;
      if (o === 'auto' || o === 'scroll') {
        const q = a.getBoundingClientRect();
        clip = { l: Math.max(clip.l, q.left), t: Math.max(clip.t, q.top), r: Math.min(clip.r, q.right), b: Math.min(clip.b, q.bottom) };
      }
    }
    const hit = (x, y) => {
      if (x < clip.l || y < clip.t || x >= clip.r || y >= clip.b) return true;
      const e = document.elementFromPoint(x, y);
      return !!e && (e === n || n.contains(e));
    };
    if (!hit(cx, cy)) continue; // covered by a sheet or card: not tappable now, not a finding
    // the real hit box: walk out from the centre in each direction while the point still belongs to the button
    const reach = (dx, dy) => {
      let k = 0;
      while (k < 60 && hit(cx + dx * (k + 1), cy + dy * (k + 1))) k++;
      return k;
    };
    const wBox = reach(-1, 0) + reach(1, 0);
    const hBox = reach(0, -1) + reach(0, 1);
    if (wBox < 43 || hBox < 43) out.tap.push(`${label(n)} hit ${wBox}x${hBox} "${n.textContent.trim().slice(0, 18)}"`);
  }
  out.small = [...new Set(out.small)].slice(0, 12);
  out.tap = [...new Set(out.tap)].slice(0, 12);
  return out;
}

const SCENARIOS = {
  async run(p) {
    await p.run(11, { pageCount: 5, lawId: 'grawitacja' });
    await p.g(() => { const g = window.__game; g.hero.levelUp(); });
    await sleep(900);
  },
  async runLongRacja(p) {
    await p.run(11, { pageCount: 5, lawId: 'grawitacja' });
    await p.g(() => { const s = window.__game.state(); s.player.hpMax = 123456; s.player.hp = 123456; });
    await sleep(700);
  },
  async pause(p) {
    await p.run(11, { pageCount: 5, lawId: 'grawitacja' });
    await p.click('.pause-btn');
    await sleep(700);
  },
  async settings(p) {
    await p.run(11, { pageCount: 5, lawId: 'grawitacja' });
    await p.click('.pause-btn');
    await sleep(500);
    await p.g(() => { const b = [...document.querySelectorAll('[data-pause]')].find((x) => /settings|ustaw/i.test(x.dataset.pause)); if (b) b.click(); });
    await sleep(600);
  },
  async inventory(p) {
    await p.run(11, { pageCount: 5, lawId: 'grawitacja' });
    await p.g(() => { const g = window.__game; g.demoInventory(); g.openInventory(); });
    await sleep(700);
  },
  async invCard(p) {
    await p.run(11, { pageCount: 5, lawId: 'grawitacja' });
    await p.g(() => { const g = window.__game; g.demoInventory(); g.openInventory(); });
    await sleep(600);
    await p.g(() => { const c = document.querySelector('.inv-cell:not(.empty), .inv-item, [data-slot]:not(.empty)'); if (c) c.click(); });
    await sleep(600);
  },
  async uniqueCard(p) {
    await p.run(11, { pageCount: 5, lawId: 'grawitacja' });
    await p.g(() => { const g = window.__game; g.giveNamed({ unique: 'odmowa' }, { wear: false }); g.giveNamed({ unique: 'kaskmili' }, { wear: true }); g.openInventory(); });
    await sleep(600);
    await p.g(() => { const c = document.querySelector('.inv-plate'); if (c) c.click(); });
    await sleep(500);
  },
  async chapter(p) {
    await p.run(11, { pageCount: 5, lawId: 'grawitacja' });
    await p.g(() => window.__game.showCard('chapter'));
    await sleep(900);
  },
  async cardOpening(p) {
    await p.run(11, { pageCount: 5, lawId: 'grawitacja' });
    await p.g(() => window.__game.showCard('opening'));
    await sleep(900);
  },
  async cardFinale(p) {
    await p.run(11, { pageCount: 5, lawId: 'grawitacja' });
    await p.g(() => window.__game.showCard('finale'));
    await sleep(900);
  },
  async cardReopened(p) {
    await p.run(11, { pageCount: 5, lawId: 'grawitacja' });
    await p.g(() => window.__game.showCard('reopened'));
    await sleep(900);
  },
  async cardRewritten(p) {
    await p.run(11, { pageCount: 5, lawId: 'grawitacja' });
    await p.g(() => window.__game.showCard('rewritten'));
    await sleep(900);
  },
  async updateSheet(p) {
    await p.run(11, { pageCount: 5, lawId: 'grawitacja', heroId: 'konsultant' });
    await p.g(() => { const g = window.__game; g.hero.levelUp(); g.hero.openUpdate(); });
    await sleep(900);
  },
  async sklep(p) {
    await p.base();
    await p.g(() => window.__game.openSklep());
    await sleep(800);
  },
  async skills(p) {
    await p.run(11, { pageCount: 5, lawId: 'grawitacja', heroId: 'konsultant' });
    await p.click('.pause-btn');
    await sleep(400);
    await p.click('[data-pause=skills]');
    await sleep(800);
  },
  async karta(p) {
    await p.base();
    await p.g(() => window.__game.station('biurko'));
    await sleep(500);
    await p.g(() => document.querySelector('[data-desk=karta]')?.click());
    await sleep(800);
  },
  async baseDesk(p) {
    await p.base();
    await p.g(() => window.__game.station('biurko'));
    await sleep(800);
  },
  async baseBoard(p) {
    await p.base();
    await p.g(() => {
      const m = window.__game.meta();
      window.__game.setMeta({ ...m, runsCompleted: 3, history: [
        { number: 48213, planet: 'Planeta Dwudziesta Trzecia (Nieprzyjemna)', clause: 'parzystosc', outcome: 'ukonczono', kills: 61, pages: 5, total: 5 },
        { number: 48214, planet: 'Planeta Siódma (Domniemana)', clause: 'godziny-konsultanta', outcome: 'zgloszenie', kills: 14, pages: 2, total: 4 },
      ] });
      window.__game.station('tablica');
    });
    await sleep(900);
  },
  async baseDeskScroll(p) {
    await SCENARIOS.baseDesk(p);
    // the wheel over the sheet must move the body: scrollTop changes and the "c.d. poniżej" cue goes
    const before = await p.g(() => { const s = document.querySelector('.desk-sheet .ps-scroll'); return { top: s.scrollTop, sh: s.scrollHeight, ch: s.clientHeight, oy: getComputedStyle(s).overflowY }; });
    await p.page.mouse.move(p.page.viewportSize().width / 2, p.page.viewportSize().height / 2);
    await p.page.mouse.wheel(0, 400);
    await sleep(400);
    const after = await p.g(() => document.querySelector('.desk-sheet .ps-scroll').scrollTop);
    console.log(`desk scroll: ${JSON.stringify(before)} -> ${after}`);
  },
  async baseBoardCerts(p) {
    await p.base();
    await p.g(() => {
      const m = window.__game.meta();
      const c = { current: 3, closed: [0, 1, 2], finalTicket: false, caseClosed: true, extras: 5, cards: { opening: true, chapters: [0, 1, 2, -1, -2, -3], finale: true } };
      window.__game.setMeta({ ...m, character: { ...m.character, campaign: c }, history: [] });
      window.__game.station('tablica');
    });
    await sleep(900);
  },
  async baseBoardCertsEnd(p) {
    await SCENARIOS.baseBoardCerts(p);
    await p.g(() => { const s = document.querySelector('.ps-scroll'); s.scrollTop = s.scrollHeight; });
    await sleep(500);
  },
  async settingsMid(p) {
    await SCENARIOS.settings(p);
    await p.g(() => { const s = document.querySelector('.set-scroll'); s.scrollTop = s.scrollHeight * 0.5; });
    await sleep(500);
  },
  async settingsBig(p) {
    await SCENARIOS.settings(p);
    await p.g(() => window.__game.setSettings({ textSize: 2 }));
    await sleep(500);
    await p.g(() => { const sc = document.querySelector('.set-scroll'); sc.scrollTop = 120; });
    await sleep(400);
  },
  async settingsEnd(p) {
    await SCENARIOS.settings(p);
    await p.g(() => { const s = document.querySelector('.set-scroll'); s.scrollTop = s.scrollHeight; });
    await sleep(500);
  },
  async baseKiosk(p) {
    await p.base();
    await p.g(() => window.__game.station('kiosk'));
    await sleep(800);
  },
  async basePaczkomat(p) {
    await p.base();
    await p.g(() => window.__game.station('paczkomat'));
    await sleep(800);
  },
  async basePaczkomatFull(p) {
    await p.base();
    await p.g(() => {
      const g = window.__game;
      g.setMeta({ ...g.meta(), gwiazdki: 90 });
      g.state().player.gwiazdki = 90;
      for (const t of ['rzadki', 'nietypowy', 'unikatowy', 'rzadki']) g.giveAwizo({ tier: t }, 0);
      g.station('paczkomat');
    });
    await sleep(900);
  },
  async padTags(p) {
    await p.run(11, { pageCount: 5, lawId: 'grawitacja', heroId: 'konsultant' });
    await p.g(() => {
      const g = window.__game;
      g.setLevel(16);
      const ids = g.hero.info().skillIds;
      for (const id of ids.slice(0, 3)) g.hero.setParagraph(id, 3, true);
    });
    await sleep(900);
  },
  async ultReady(p) {
    await p.run(11, { pageCount: 5, lawId: 'grawitacja', heroId: 'pralka' });
    await p.g(() => { const g = window.__game; g.setLevel(16); g.fillMeter(1); });
    await sleep(900);
  },
  async argFull(p) {
    await p.run(11, { pageCount: 5, lawId: 'grawitacja', heroId: 'pralka' });
    await p.g(() => { const g = window.__game; g.setLevel(8); g.fillMeter(1); });
    await sleep(900);
  },
  async konfKons(p) {
    await p.run(11, { pageCount: 5, lawId: 'grawitacja', heroId: 'konsultant' });
    await p.click('.pause-btn');
    await sleep(500);
    await p.click('[data-pause=paragraphs]');
    await sleep(800);
  },
  async longNote(p) {
    await p.run(11, { pageCount: 5, lawId: 'grawitacja' });
    await p.g(() => { const g = window.__game; g.enemies.clear(); g.footnote('Zgłoszenie rozpatrzono. Anomalia istniała w stopniu, w jakim zgłoszenie uznawało się za otwarte, a ponieważ zgłoszenia zamknięto, nie istniała nigdy, co potwierdzono w trzech instancjach, z których żadna nie była właściwa. Sprostowanie: nie jest to zjawisko lokalne, lecz poprzednia wersja Asystenta. Zgłoszenia dodatkowego nie otwarto.'); });
    await sleep(900);
  },
  async baseUrzednik(p) {
    await p.base();
    await p.g(() => window.__game.station('urzednik'));
    await sleep(800);
  },
  async spor(p) {
    await p.boss('urzadzenia');
  },
  async sporAnomalia(p) {
    await p.boss('powiadomienia');
  },
  async sporAnkieta(p) {
    await p.g(() => window.__game.start(43, { pageCount: 6, plan: { kind: 'campaign', planet: 5, priority: 'normalny', lawId: 'weryfikacja-dwuetapowa' } }));
    await sleep(1200);
    await p.g(() => { const h = window.__game; h.state().enemies.length = 0; h.turnTo(5); });
    await sleep(1500);
    await p.g(() => { const h = window.__game; h.state().player.suspended = false; h.state().player.hp = h.state().player.hpMax; });
    for (let i = 0; i < 40; i++) {
      await sleep(200);
      if (await p.g(() => window.__game.spor.info()?.open === true)) break;
    }
    await sleep(800);
  },
  async finaleSpor(p) {
    await p.g(() => { window.__game.finale.start('pralka', { seed: 5, lawId: 'parzystosc' }); const s = window.__game.state(); s.player.hp = s.player.hpMax = 1e7; });
    await sleep(900);
    await p.g(() => window.__game.finale.skipTo('face'));
    for (let i = 0; i < 30; i++) {
      await sleep(200);
      if (await p.g(() => window.__game.spor.info()?.open === true)) break;
    }
    await sleep(600);
  },
  async sporWrong(p) {
    await p.boss('urzadzenia');
    await p.g(() => { const i = window.__game.spor.info(); const w = [0, 1, 2].find((k) => k !== i.correct); const b = document.querySelector(`.spor-reply[data-reply="${w}"]`); if (b) b.click(); });
    await sleep(120);
  },
  async death(p) {
    await p.run(11, { pageCount: 5, lawId: 'grawitacja' });
    await p.g(() => { const g = window.__game; g.state().hero.pendingLevels = 0; g.hurtPlayer(1e9); });
    await sleep(3500);
  },
  async deathLong(p) {
    await p.run(11, { pageCount: 5, lawId: 'grawitacja' });
    await p.g(() => { const g = window.__game; g.state().hero.pendingLevels = 0; g.hurtPlayer(1e9); });
    await sleep(9000);
  },
  async deathZgl(p) {
    await p.run(11, { pageCount: 5, lawId: 'grawitacja' });
    await p.g(() => window.__game.hero.die('zgloszenie'));
    await sleep(4500);
  },
  async deathPetla(p) {
    await p.run(11, { pageCount: 5, lawId: 'grawitacja' });
    await p.g(() => window.__game.hero.die('petla'));
    await sleep(2500);
  },
  async deathZaw(p) {
    await p.run(11, { pageCount: 5, lawId: 'grawitacja' });
    await p.g(() => window.__game.hero.die('zawieszenie'));
    await sleep(3500);
  },
  async finaleFace(p) {
    await p.g(() => { window.__game.finale.start('pralka', { seed: 5, lawId: 'parzystosc' }); const s = window.__game.state(); s.player.hp = s.player.hpMax = 1e7; });
    await sleep(900);
    await p.g(() => window.__game.finale.skipTo('face'));
    await sleep(1500);
  },
  async finaleLast(p) {
    await p.g(() => { window.__game.finale.start('pralka', { seed: 5, lawId: 'parzystosc' }); const s = window.__game.state(); s.player.hp = s.player.hpMax = 1e7; });
    await sleep(900);
    await p.g(() => window.__game.finale.skipTo('last'));
    await sleep(3000);
  },
  async roster(p) {
    await p.g(() => window.__game.go('roster'));
    await sleep(800);
  },
  async title(p) {
    await sleep(2200);
  },
  async ticket(p) {
    await p.g(() => window.__game.go('ticket'));
    await sleep(800);
  },
};

let browser;
try {
  await waitForServer(BASE);
  browser = await chromium.launch({ executablePath: chromiumPath(), args: launchArgs });
  const legs = [
    ['p', { width: 390, height: 844 }],
    ['l', { width: 844, height: 390 }],
  ].filter(([k]) => !LEG || LEG === k);
  for (const [prefix, viewport] of legs) {
    for (const [name, fn] of Object.entries(SCENARIOS)) {
      if (ONLY && !ONLY.includes(name)) continue;
      const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA, colorScheme: 'light', serviceWorkers: 'block' });
      await ctx.addInitScript(() => { Math.random = () => 0.4242; });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => problems.push(`pageerror (${prefix}-${name}): ${e.message}`));
      page.on('console', (m) => {
        if (m.text().includes('Service Worker registration blocked')) return;
        if (m.type() === 'error' || m.type() === 'warning') problems.push(`console.${m.type()} (${prefix}-${name}): ${m.text()}`);
      });
      await page.goto(BASE, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__game !== undefined);
      await page.evaluate(() => document.fonts.ready);
      const p = {
        page,
        g: (f, a) => page.evaluate(f, a),
        click: (sel) => page.locator(sel).first().click({ timeout: 3000 }).catch((e) => problems.push(`click ${sel}: ${e.message.split('\n')[0]}`)),
        async run(seed, opts) {
          await page.evaluate(([s, o]) => window.__game.start(s, o), [seed, opts]);
          await sleep(1500);
        },
        async base() {
          await page.evaluate(() => window.__game.startBase());
          await sleep(1200);
        },
        async boss(family) {
          await page.evaluate(() => window.__game.start(11, { pageCount: 5, lawId: 'grawitacja', heroId: 'pralka' }));
          await sleep(1400);
          await page.evaluate((f) => {
            const g = window.__game;
            const s = g.state();
            s.hero.pendingLevels = 0;
            s.hero.updateRequested = false;
            g.enemies.clear();
            g.enemies.spawnBoss(f);
          }, family);
          for (let i = 0; i < 40; i++) {
            await sleep(150);
            if (await page.evaluate(() => window.__game.spor.info()?.open === true)) break;
          }
          await page.evaluate(() => {
            const b = window.__game.state().enemies.find((e) => e.boss);
            if (b) { window.__game.placePlayer(b.x + 36, b.y + 44); b.speed = 0; b.attackTimer = 99; }
            const s = window.__game.state(); s.player.hp = s.player.hpMax;
          });
          await sleep(900);
        },
      };
      try {
        await fn(p);
        await page.screenshot({ path: `${SHOTS}/${prefix}-${name}.png` });
        const a = await page.evaluate(audit);
        const line = [a.small.length ? `small: ${a.small.join(' | ')}` : '', a.tap.length ? `tap: ${a.tap.join(' | ')}` : ''].filter(Boolean).join('  ');
        console.log(`${prefix}-${name}: ${line || 'clean'}`);
        if (line) failed++;
      } catch (e) {
        problems.push(`${prefix}-${name}: ${e.message.split('\n')[0]}`);
      }
      await ctx.close();
    }
  }
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
if (problems.length) console.error(problems.join('\n'));
console.log(`shots in ${SHOTS}; ${failed} frames with audit findings`);
process.exit(problems.length ? 1 : 0);
