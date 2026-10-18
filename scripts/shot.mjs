// Renders key screens into shots/ with the bundled Chromium. Usage: npm run build && npm run shot
// (the npm script builds first). Test hook used: window.__game, see docs/ARCHITECTURE.md.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4173);
// Several agents may run this at once: give each its own port, build dir and shots dir.
const OUT = process.env.SHOT_OUT ?? 'dist';
const SHOTS = process.env.SHOT_DIR ?? 'shots';
const BASE = `http://127.0.0.1:${PORT}/SciFiArpg/`;
const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

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

mkdirSync(SHOTS, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--outDir', OUT, '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
  stdio: 'ignore',
});
const stop = () => server.kill('SIGTERM');
process.on('exit', stop);

const problems = [];
let browser;
try {
  await waitForServer(BASE);
  browser = await chromium.launch({ executablePath: chromiumPath(), args: launchArgs });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: UA,
    colorScheme: 'light',
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.text().includes('Service Worker registration blocked')) return;
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`console.${m.type()}: ${m.text()}`);
  });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);
  await page.evaluate(() => document.fonts.ready);

  const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png` });
  const wait = (ms) => page.waitForTimeout(ms);

  await wait(2200);
  await shot('title');

  // ticket screen: the run start, then the declined note
  await page.evaluate(() => window.__game.go('ticket'));
  await wait(700);
  await shot('ticket');
  await page.click('.ticket .link-btn');
  await wait(500);
  await shot('ticket-declined');

  await page.evaluate(() => window.__game.start(7, { lawId: 'parzystosc', pageCount: 5 }));
  await wait(1500);
  await shot('run');

  // a hit, a critical-looking second hit, then the kill; capture while the strike is on the page
  await page.evaluate(() => window.__game.hitEnemy());
  await wait(120);
  await page.evaluate(() => window.__game.hitEnemy());
  await wait(200);
  await page.evaluate(() => window.__game.killEnemy());
  await wait(420);
  await shot('strike');

  // tap-to-move: a real pointer tap, then capture the x mark and the walking figure
  await wait(900);
  await page.touchscreen.tap(300, 330);
  await wait(250);
  await shot('tap');

  // the paper ends: walk into the left edge for the margin note and the hatched border
  await page.evaluate(() => window.__game.placePlayer(70, 900));
  await wait(1800);
  await page.touchscreen.tap(4, 420);
  await wait(900);
  await shot('edge');

  // the top of the page: the regulamin printed as the header, and the folded-corner exit
  await page.evaluate(() => {
    const s = window.__game.state();
    const e = s.page.exit;
    window.__game.placePlayer(e.x + (e.corner[1] === 'l' ? 150 : -150), e.y + (e.corner[0] === 't' ? 170 : -170));
  });
  await wait(1200);
  await shot('header-exit');

  // mid page-turn: stand in the exit, capture the sweep
  await page.evaluate(() => {
    const s = window.__game.state();
    const e = s.page.exit;
    window.__game.placePlayer(e.x + (e.corner[1] === 'l' ? 55 : -55), e.y + (e.corner[0] === 't' ? 55 : -55));
  });
  await wait(260);
  await shot('pageturn');
  await wait(1100);
  const turned = await page.evaluate(() => window.__game.state().pageIndex);
  if (turned !== 1) problems.push(`expected page index 1 after the exit, got ${turned}`);
  await shot('page2');

  // kiosk page and the QR code, sticky note, clip
  await page.evaluate(() => {
    const s = window.__game.state();
    const k = s.pages.find((p) => p.hasKiosk);
    window.__game.turnTo(k.index);
  });
  await wait(1300);
  await page.evaluate(() => {
    const s = window.__game.state();
    const k = s.page.obstacles.find((o) => o.kind === 'kiosk');
    window.__game.placePlayer(k.x, k.y + 150);
  });
  await wait(1500);
  await shot('kiosk');

  // the hand-drawn obstacles: a QR code, a sticky note, a paperclip, a stapled note
  for (const kind of ['qr', 'sticky', 'clip']) {
    const found = await page.evaluate((kind) => {
      const s = window.__game.state();
      const p = s.pages.find((pg) => pg.obstacles.some((o) => o.kind === kind));
      if (!p) return false;
      if (p.index !== s.pageIndex) window.__game.turnTo(p.index);
      return true;
    }, kind);
    if (!found) continue;
    await wait(1300);
    await page.evaluate((kind) => {
      const s = window.__game.state();
      const o = s.page.obstacles.find((o) => o.kind === kind);
      window.__game.placePlayer(o.x, o.y + 190);
    }, kind);
    await wait(1400);
    await shot(`obstacle-${kind}`);
  }

  await page.evaluate(() => window.__game.setTheme('night'));
  await wait(400);
  await shot('run-night');
  await page.evaluate(() => window.__game.setTheme('day'));

  // godziny konsultanta: advance into the bot hours, act, and read the scripted answer
  await page.evaluate(() => window.__game.start(11, { lawId: 'godziny-konsultanta', pageCount: 4 }));
  await wait(1200);
  await page.evaluate(() => window.__game.advance(31));
  await page.evaluate(() => document.querySelector('.pad.s1').click());
  await wait(500);
  await shot('bot-hours');

  // ciasteczka: the banner on page entry
  await page.evaluate(() => window.__game.start(12, { lawId: 'ciasteczka', pageCount: 4 }));
  await wait(1500);
  await shot('cookies');

  // the footnote history sheet
  await page.evaluate(() => document.querySelector('.pop-buttons .form-btn').click());
  await page.evaluate(() => window.__game.advance(1));
  await page.evaluate(() => window.__game.footnote('Przypis kontrolny.'));
  await wait(300);
  await page.touchscreen.tap(190, 800);
  await wait(400);
  await shot('footnote-history');

  // base screen with a history; the lost run is rewritten on the first visit
  await page.evaluate(() => {
    const m = window.__game.meta();
    window.__game.setMeta({
      ...m,
      heroId: 'pralka',
      gwiazdki: 37,
      runsCompleted: 3,
      history: [
        { number: 48213, planet: 'Planeta Dwudziesta Trzecia (Nieprzyjemna)', clause: 'parzystosc', outcome: 'ukonczono', kills: 61, pages: 5, total: 5 },
        { number: 48214, planet: 'Planeta Siódma (Domniemana)', clause: 'godziny-konsultanta', outcome: 'zgloszenie', kills: 14, pages: 2, total: 4 },
        { number: 48215, planet: 'Planeta Trzynasta (Sporna)', clause: 'oplata-serwisowa', outcome: 'zgloszenie', kills: 9, pages: 3, total: 6, rewritten: true },
      ],
    });
    window.__game.go('baza');
  });
  await wait(900);
  await shot('base-page');
  // the desk sheet is the old base form: the history, rewritten on the first visit
  await page.evaluate(() => window.__game.station('biurko'));
  await wait(900);
  await shot('baza');
  await wait(3200);
  await shot('baza-rewritten');

  await page.evaluate(() => {
    document.querySelector('.ps-close').click();
  });
  await wait(300);
  await page.evaluate(() => window.__game.station('tablica'));
  await wait(500);
  await shot('settings');
  await page.getByText('Leworęczny').click();
  await wait(200);
  await page.evaluate(() => window.__game.start(5));
  await wait(1300);
  await shot('run-lefty');

  // death: the ticket form counts down, then the base screen shows the new entry
  await page.evaluate(() => window.__game.hero.die('zgloszenie'));
  await wait(2500);
  await shot('death');
  await wait(6000);
  const snap = await page.evaluate(() => window.__game.screen());
  if (snap !== 'baza') problems.push(`expected the base screen after death, got ${snap}`);
  await wait(500);
  await shot('baza-after-death');

  // ---------- portrait with the joystick: the Załączniki pad moves under the HUD, top right ----------
  await page.evaluate(() => {
    window.__game.setLeftHanded(false);
    window.__game.setSteering('joystick');
    window.__game.start(5);
  });
  await wait(1300);
  await shot('run-joystick');
  await page.evaluate(() => window.__game.setSteering('tap'));

  // ---------- landscape (DESIGN 2): 844 x 390, joystick by default ----------
  const lctx = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: UA,
    colorScheme: 'light',
    serviceWorkers: 'block',
  });
  const lp = await lctx.newPage();
  lp.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  lp.on('console', (m) => {
    if (m.text().includes('Service Worker registration blocked')) return;
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`console.${m.type()}: ${m.text()}`);
  });
  await lp.goto(BASE, { waitUntil: 'load' });
  await lp.waitForFunction(() => window.__game !== undefined);
  await lp.evaluate(() => document.fonts.ready);
  const lshot = (name) => lp.screenshot({ path: `${SHOTS}/land-${name}.png` });
  const lwait = (ms) => lp.waitForTimeout(ms);
  const lcdp = await lctx.newCDPSession(lp);
  const touch = (type, id, x, y) => lcdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id }] });

  await lwait(2200);
  await lshot('title');
  const orient = await lp.evaluate(() => document.documentElement.dataset.orient);
  if (orient !== 'landscape') problems.push(`expected data-orient landscape at 844x390, got ${orient}`);
  const ctl = await lp.evaluate(() => window.__game.controls());
  if (ctl.steering !== 'joystick') problems.push(`expected the joystick by default in landscape, got ${ctl.steering}`);

  await lp.evaluate(() => window.__game.go('ticket'));
  await lwait(700);
  await lshot('ticket');

  await lp.evaluate(() => window.__game.start(7, { lawId: 'parzystosc', pageCount: 5 }));
  await lwait(1500);
  await lp.evaluate(() => {
    window.__game.footnote('Urządzenie nr 4471-B zostało skreślone zgodnie z procedurą.');
    window.__game.footnote('Procedury nie odnaleziono. Przepraszamy za utrudnienia w tym zakresie, które nie wynikają z naszej winy.');
  });
  await lwait(400);
  await lshot('run');

  // joystick mid-drag: thumb down on the left half, dragged right and up; the figure walks, the stick is drawn
  const before = await lp.evaluate(() => ({ x: window.__game.state().player.x, y: window.__game.state().player.y }));
  await touch('touchStart', 1, 150, 260);
  await lwait(120);
  for (let i = 1; i <= 8; i++) {
    await touch('touchMove', 1, 150 + i * 7, 260 - i * 5);
    await lwait(60);
  }
  await lwait(600);
  await lshot('joystick');
  await touch('touchEnd', 1, 0, 0);
  await lwait(200);
  const after = await lp.evaluate(() => ({ x: window.__game.state().player.x, y: window.__game.state().player.y }));
  if (Math.hypot(after.x - before.x, after.y - before.y) < 20) problems.push('the joystick did not move the player');

  // the page header at the top of the page is not covered by the HUD
  await lp.evaluate(() => {
    window.__game.state().enemies.length = 0;
    window.__game.placePlayer(600, 160);
  });
  await lwait(1500);
  await lshot('header');

  // the queued update: the typed line top right, then the form
  await lp.evaluate(() => window.__game.hero.levelUp());
  await lwait(500);
  await lshot('update-line');
  await lp.locator('.hud .upd').click();
  await lwait(800);
  await lshot('update-form');
  await lp.evaluate(() => window.__game.hero.pickUpdate(0));
  await lwait(1500);

  // the inventory as a two-column sheet
  await lp.evaluate(() => {
    window.__game.demoInventory();
    window.__game.openInventory();
  });
  await lwait(700);
  await lshot('inventory');
  await lp.locator('.ps-close').click();
  await lwait(300);

  // the Sklep sheet
  await lp.evaluate(() => window.__game.openSklep());
  await lwait(700);
  await lshot('sklep');
  await lp.locator('.ps-close').click();
  await lwait(300);

  // a pop-up form (cookie banner) and the footnote history
  await lp.evaluate(() => window.__game.start(12, { lawId: 'ciasteczka', pageCount: 4 }));
  await lwait(1500);
  await lshot('cookies');
  await lp.evaluate(() => document.querySelector('.pop-buttons .form-btn').click());
  await lp.evaluate(() => window.__game.footnote('Przypis kontrolny.'));
  await lwait(300);
  await lp.locator('.foot').click();
  await lwait(400);
  await lshot('footnote-history');
  await lp.locator('.pop-wrap').click();

  // paint sample (DESIGN 3.4): the hero, six enemies of mixed families with an elite, a boss, gwiazdki and item cards,
  // in day and in night. The simulation is frozen once everything is drawn in, so the layout stays as placed.
  await lp.evaluate(() => {
    window.__game.setLeftHanded(false);
    window.__game.start(7, { pageCount: 5 });
  });
  await lwait(1200);
  await lp.evaluate(() => {
    const g = window.__game;
    const s = g.state();
    g.enemies.clear();
    s.pickups.length = 0;
    g.placePlayer(600, 800);
    const at = (id, dx, dy) => {
      const e = s.enemies.find((x) => x.id === id);
      e.x = 600 + dx;
      e.y = 800 + dy;
      e.home = { x: e.x, y: e.y };
    };
    const put = (ids, spots) => ids.forEach((id, i) => at(id, spots[i][0], spots[i][1]));
    put(g.enemies.spawnFamily('urzadzenia', 2), [[-430, -150], [-200, 150]]);
    put(g.enemies.spawnFamily('powiadomienia', 1), [[-250, -120]]);
    put(g.enemies.spawnFamily('powiadomienia', 1, { elite: 'sponsorowany' }), [[130, 140]]);
    put(g.enemies.spawnFamily('wygenerowane', 2), [[-60, -150], [-450, 130]]);
    const bossId = g.enemies.spawnBoss('urzadzenia');
    at(bossId, 330, -90);
    const card = (tier, dx, dy, number) => {
      const item = g.giveItem(tier);
      s.player.inventory = s.player.inventory.filter((x) => x !== item);
      s.pickups.push({ kind: 'pickup', id: s.nextId++, x: 600 + dx, y: 800 + dy, r: 26, number, item });
    };
    card('zwykly', -330, 40, 3);
    card('rzadki', 250, 150, 4);
    card('unikatowy', 40, -170, 5);
    [[-130, 70], [-30, 160], [80, 60], [190, 200]].forEach(([dx, dy], i) => {
      s.pickups.push({ kind: 'pickup', id: s.nextId++, x: 600 + dx, y: 800 + dy, r: 14, number: 0, gwiazdki: 1 + i });
    });
  });
  await lwait(1100);
  await lp.evaluate(() => (window.__game.state().status = 'paused'));
  await lwait(300);
  await lshot('wash-sample');
  await lp.evaluate(() => window.__game.setTheme('night'));
  await lwait(400);
  await lshot('wash-sample-night');
  await lp.evaluate(() => {
    window.__game.setTheme('day');
    window.__game.state().status = 'running';
  });

  // left-handed: halves and pads swap, the stick answers on the right half
  await lp.evaluate(() => {
    window.__game.setLeftHanded(true);
    window.__game.start(5);
  });
  await lwait(1300);
  await touch('touchStart', 1, 700, 250);
  await lwait(100);
  for (let i = 1; i <= 6; i++) {
    await touch('touchMove', 1, 700 - i * 8, 250 - i * 4);
    await lwait(60);
  }
  await lwait(300);
  await lshot('run-lefty');
  await touch('touchEnd', 1, 0, 0);
  await lp.evaluate(() => window.__game.setLeftHanded(false));

  // base, settings, profile
  await lp.evaluate(() => {
    const m = window.__game.meta();
    window.__game.setMeta({ ...m, heroId: 'konsultant', gwiazdki: 37, runsCompleted: 3 });
    window.__game.go('baza');
  });
  await lwait(900);
  await lshot('base-page');
  await lp.evaluate(() => window.__game.station('biurko'));
  await lwait(700);
  await lshot('baza');
  await lp.evaluate(() => {
    document.querySelector('.ps-close').click();
  });
  await lwait(300);
  await lp.evaluate(() => window.__game.station('tablica'));
  await lwait(500);
  await lshot('settings');
  await lp.getByText('Wróć', { exact: true }).click();
  await lwait(300);
  await lp.evaluate(() => window.__game.go('profile'));
  await lwait(900);
  await lshot('profile');
  await lp.locator('.profile .choose').click();
  await lwait(500);

  // night edition, and a death form
  await lp.evaluate(() => {
    window.__game.start(5);
    window.__game.setTheme('night');
  });
  await lwait(1300);
  await lshot('run-night');
  await lp.evaluate(() => window.__game.setTheme('day'));
  await lp.evaluate(() => window.__game.hero.die('zgloszenie'));
  await lwait(2500);
  await lshot('death');
  await lwait(7500);
  await lp.evaluate(() => window.__game.start(9, { pageCount: 4 }));
  await lwait(1200);
  await lp.evaluate(() => window.__game.hero.die('petla'));
  await lwait(2200);
  await lshot('death-slip');
} finally {
  await browser?.close();
  stop();
}

if (problems.length) {
  console.error(problems.join('\n'));
} else {
  console.log('shots written to shots/');
}
process.exit(problems.length ? 1 : 0);
