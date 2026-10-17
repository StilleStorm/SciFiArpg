// Screenshots for the enemies: each family with its claim bubbles, statuses, an elite, the three bosses.
// Usage: SHOT_PORT=4181 SHOT_OUT=dist-b1 SHOT_DIR=shots-b1 npx vite build --outDir dist-b1 && node scripts/shot-enemies.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4181);
const OUT = process.env.SHOT_OUT ?? 'dist-b1';
const SHOTS = process.env.SHOT_DIR ?? 'shots-b1';
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
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--outDir', OUT, '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
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
  const g = (fn, arg) => page.evaluate(fn, arg);

  // a quiet page: the player is shadowbanned so nobody walks about while the picture is taken
  async function stage(seed, x = 600, y = 1000) {
    await g((s) => window.__game.start(s, { lawId: 'parzystosc', pageCount: 5 }), seed);
    await wait(900);
    await g(([x, y]) => {
      window.__game.placePlayer(x, y);
      window.__game.enemies.clear();
      window.__game.state().player.suspended = true;
    }, [x, y]);
    await wait(700);
  }

  // ---- each family, six of them, with their claims ----
  const families = ['urzadzenia', 'powiadomienia', 'wygenerowane'];
  for (const f of families) {
    await stage(3);
    await g((f) => window.__game.enemies.spawnFamily(f, 6), f);
    await wait(1100);
    await shot(`family-${f}`);
  }
  // the four tiers of the notifications, side by side
  await stage(3);
  for (let tier = 1; tier <= 4; tier++) await g((t) => window.__game.enemies.spawnFamily('powiadomienia', 1, { tier: t }), tier);
  await g(() => {
    const s = window.__game.state();
    s.enemies.forEach((e, i) => {
      e.x = s.player.x - 135 + i * 90;
      e.y = s.player.y - 100;
      e.home = { x: e.x, y: e.y };
    });
  });
  await wait(1100);
  await shot('tiers');

  // ---- statuses, each on its own device ----
  await stage(5);
  await g(() => window.__game.enemies.spawnFamily('urzadzenia', 5));
  await g(() => {
    const s = window.__game.state();
    const kinds = ['zablokowany', 'wyciszony', 'zgloszony', 'przeczytane', 'do_weryfikacji'];
    s.enemies.forEach((e, i) => e.statuses.push({ kind: kinds[i], remaining: 60, source: s.player.id }));
  });
  await wait(1100);
  await shot('statuses');

  // ---- a rebuttal and a miss of topic ----
  await stage(5);
  await g(() => window.__game.enemies.spawnFamily('urzadzenia', 3));
  await wait(900);
  await g(() => {
    const s = window.__game.state();
    const [a, b] = s.enemies;
    // one hit of exactly the claim's type (struck through), one of another type (nie na temat)
    window.__game.enemies.hit(a.id, a.claim.type);
    const other = ['mechaniczny', 'regulaminowy', 'egzystencjalny'].find((t) => t !== b.claim.type);
    window.__game.enemies.hit(b.id, other);
  });
  await wait(450);
  await shot('claims');

  // ---- an elite of each affix ----
  await stage(5);
  const affixes = ['zweryfikowany', 'sponsorowany', 'nieuchronny', 'domniemany'];
  for (const a of affixes) await g((a) => window.__game.enemies.spawnFamily('urzadzenia', 1, { elite: a }), a);
  await g(() => {
    const s = window.__game.state();
    s.enemies.forEach((e, i) => {
      e.x = s.player.x - 135 + i * 90;
      e.y = s.player.y - 110;
      e.home = { x: e.x, y: e.y };
    });
  });
  await wait(1100);
  await shot('elites');

  // ---- the bosses ----
  for (const f of families) {
    await stage(9);
    await g((f) => window.__game.enemies.spawnBoss(f), f);
    await wait(1300);
    await shot(`boss-${f}`);
  }

  // ---- night edition, all three families ----
  await stage(3);
  await g(() => {
    window.__game.enemies.spawnFamily('urzadzenia', 2);
    window.__game.setTheme('night');
  });
  await wait(1100);
  await shot('night');
  await g(() => window.__game.setTheme('day'));
} finally {
  await browser?.close();
  stop();
}

if (problems.length) {
  console.error(problems.join('\n'));
} else {
  console.log(`shots written to ${SHOTS}/`);
}
process.exit(problems.length ? 1 : 0);
