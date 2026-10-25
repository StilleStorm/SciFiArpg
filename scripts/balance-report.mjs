// Balance report (S16): a scripted player plays seeded tickets through window.__game and the numbers are printed as a table.
// The bot walks to enemies and fights them (the game attacks by itself), picks up everything, opens teczki, wears better items,
// casts skills and the ultimate whenever ready, takes the first free update, answers the Spor correctly, takes side tickets of
// the planet and reports them when ready. It is a competent but plain player, so the numbers are a yardstick, not a forecast.
// Usage: npm run balance (builds into dist-balance). Env: BAL_RUNS (runs per hero, default 6; 20 is the full pass), BAL_HEROES (comma list), BAL_PLANET
// (0-based planet, default 0), BAL_AIM (auto = every pad on the auto aim, the S16 bot; nearest = aimed at the nearest enemy; claim = aimed at the enemy whose claim the skill rebuts), BAL_LOADOUT (skill ids for pads 1, 2, 3, put there once installed; default: the pads as the game starts them), BAL_PRIORITY (default normalny), BAL_PORT (4197), BAL_OUT (dist-balance), BAL_JSON (write raw rows).
// Heroes play side by side; one run is about 5 s of wall time, so 6 runs per hero take about a minute (BAL_RUNS=20: three to four).
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const RUNS = Number(process.env.BAL_RUNS ?? 6);
const PLANET = Number(process.env.BAL_PLANET ?? 0);
const PRIORITY = process.env.BAL_PRIORITY ?? 'normalny';
const PORT = Number(process.env.BAL_PORT ?? 4197);
const AIM = process.env.BAL_AIM ?? 'nearest';
const LOADOUT = (process.env.BAL_LOADOUT ?? '').split(',').filter(Boolean);
const OUT = process.env.BAL_OUT ?? 'dist-balance';
const HEROES = (process.env.BAL_HEROES ?? 'pralka,konsultant,petlowiec,kartograf,nalesnik').split(',');
const URL = `http://127.0.0.1:${PORT}/SciFiArpg/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--outDir', OUT, '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
process.on('exit', () => server.kill('SIGTERM'));
for (let i = 0; i < 100; i++) {
  try {
    if ((await fetch(URL)).ok) break;
  } catch {
    /* not up yet */
  }
  await sleep(200);
}

/** One whole ticket, played in the page. Returns the row. */
async function playTicket({ heroId, seed, planet, priority, wallMs, trace, mode, finaleLevel, aim, loadout }) {
  const g = window.__game;
  const LAWS = { 0: 'wymagana-aktualizacja' };
  const lawId = LAWS[planet] ?? undefined;
  const plan = { kind: 'campaign', planet, priority, lawId: lawId ?? 'ciasteczka' };
  if (mode === 'finale') {
    // the return ticket after planet CAMPAIGN_LAST: a character of the level and gear the three planets of Akt I would have made
    g.setMeta({ ...g.meta(), character: undefined });
    g.finale.start(heroId, { seed, priority });
    for (let i = 1; i < finaleLevel; i++) g.hero.levelUp();
    ['bron', 'nakrycie', 'odziez', 'przyrzad', 'dokument'].forEach((slot, i) => g.giveItem(i < 3 ? 'nietypowy' : 'rzadki', slot));
  } else {
    g.start(seed, { heroId, plan, character: undefined }); // a fresh file every time: nothing carries over from the run before
    if (finaleLevel > 1) {
      // a character of that level in the gear its planets would have given it (BAL_LEVEL)
      for (let i = 1; i < finaleLevel; i++) g.hero.levelUp();
      ['bron', 'nakrycie', 'odziez', 'przyrzad', 'dokument'].forEach((slot, i) => g.giveItem(i < 3 ? 'nietypowy' : 'rzadki', slot));
    }
  }
  const row = {
    heroId, seed, planet, won: false, ended: false, tEnd: 0, tBossPage: null, tBoss: null, deaths: 0, level: 1, kills: 0,
    potwDropped: 0, potwHeldMax: 0, potwUsed: 0, ults: 0, casts: 0, updates: 0,
    drops: { zwykly: 0, nietypowy: 0, rzadki: 0, unikatowy: 0, zestaw: 0 }, drawn: 0, taken: 0, equipped: 0,
    stars: 0, teczki: 0, sideDone: 0, sideTaken: 0, minHpFrac: 1, pages: 0, stall: false,
  };
  const seenElite = new Set();
  const chase = new Map();
  const seenPick = new Set();
  const seenPotw = new Set();
  const opened = new Set();
  let held = 0;
  let lastX = 0;
  let lastY = 0;
  let prevDeaths = 0;
  let probeAt = 0;
  let escape = null;
  let side = 1;
  let pageSince = 0;
  let pageIdx = 0;
  let equipAt = -99;
  const tierRank = { zwykly: 0, nietypowy: 1, rzadki: 2, unikatowy: 4, zestaw: 3 };
  const score = (it) => (it.level ?? 1) + (tierRank[it.tier] ?? 0) * 4;
  const nap = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => {
    const el = document.querySelector(sel);
    if (el) el.click();
    return !!el;
  };

  // side tickets of the planet: take what the board offers
  try {
    for (const o of g.quests.offers().slice(0, 3)) if (g.quests.accept(o.id)) row.sideTaken++;
  } catch {
    /* no board in a hook run */
  }

  const equipBest = (s) => {
    const p = s.player;
    const better = [];
    p.inventory.forEach((it, i) => {
      if (it.blockedBy && !it.adapter) return;
      const worn = p.equipment[it.slot];
      if (!worn || score(it) > score(worn)) better.push(i);
    });
    if (better.length === 0) return;
    g.openInventory();
    for (let guard = 0; guard < 4; guard++) {
      const rows = document.querySelectorAll('.ps .inv-row');
      const bag = s.player.inventory;
      let pick = -1;
      let best = -1;
      bag.forEach((it, i) => {
        if (it.blockedBy && !it.adapter) return;
        const worn = s.player.equipment[it.slot];
        if ((!worn || score(it) > score(worn)) && score(it) > best) {
          best = score(it);
          pick = i;
        }
      });
      const rowEl = rows[pick];
      if (pick < 0 || !rowEl) break;
      rowEl.click();
      const btn = document.querySelector('.ps .inv-actions .ps-btn');
      if (!btn) break;
      btn.click();
      row.equipped++;
    }
    click('.ps-close');
  };

  const DT = 0.1;
  const wall0 = Date.now();
  for (let step = 0; step < 30000; step++) {
    const s = g.state();
    if (Date.now() - wall0 > wallMs) {
      row.stall = true;
      row.wall = true;
      break;
    }
    if (!s || g.screen() !== 'run') {
      row.ended = true;
      row.endScreen = g.screen();
      if (mode === 'finale') row.won = !!g.meta().character?.campaign?.caseClosed;
      row.endStatus = s?.status;
      break;
    }
    // sheets and forms that hold the run: a clause's pop-up (cookies, a demanded update, a code), then the hero's update form
    const popBtn = [...document.querySelectorAll('.pop-wrap button')].at(-1);
    if (document.querySelector('.sheet.slip:not(.hidden)')) {
      click('.sheet.slip:not(.hidden) .install'); // Petla / Zawieszenie: the slip
      await nap(400);
    } else if (s.modal && popBtn) {
      popBtn.click();
      await nap(350); // sheets close on real frames (tweens run on the render loop, not on the simulation)
    } else if (document.querySelector('.sheet.assigning:not(.hidden)')) {
      click('.sheet.assigning:not(.hidden) .report.later'); // a fourth or fifth skill: the pads stay as they are
      await nap(400);
    } else if (document.querySelector('.sheet:not(.hidden) .entry')) {
      let done = false;
      for (let i = 0; i < 3 && !done; i++) done = g.hero.pickUpdate(i);
      if (done) {
        row.updates++;
        await nap(1400);
      } else {
        click('.sheet.assigning:not(.hidden) .report.later');
        await nap(400);
      }
    } else if (s.hero.pendingLevels > 0 && !s.modal) {
      g.hero.requestUpdate();
    }
    if (s.status === 'paused' && document.querySelector('.sheet:not(.hidden)') && !document.querySelector('.sheet:not(.hidden) .entry')) await nap(300); // the death ticket runs its countdown
    if (s.status === 'paused' && !s.modal && !document.querySelector('.ps, .sheet')) g.resume();
    if (document.querySelector('.card-layer')) click('.card-layer .card-skip');
    g.advance(DT);
    const p = s.player;
    row.tEnd = Math.round(s.time);
    if (mode === 'finale') {
      const fi = g.finale.info();
      if (fi) {
        const st = fi.stage === 'done' ? 'last' : fi.stage;
        row.phaseSec ??= { form: 0, face: 0, last: 0 };
        row.phaseSec[st] = (row.phaseSec[st] ?? 0) + DT;
      }
    }
    row.level = p.level;
    row.kills = s.kills;
    if (s.hero.deaths > prevDeaths) {
      prevDeaths = s.hero.deaths;
      const near = {};
      for (const e of s.enemies) {
        if (Math.hypot(e.x - p.x, e.y - p.y) > 260) continue;
        const k = `${e.boss ? 'BOSS-' : ''}${e.elite ? 'elita-' : ''}${e.family}${e.tier}`;
        near[k] = (near[k] ?? 0) + 1;
      }
      (row.deathLog ??= []).push({ t: Math.round(s.time), page: s.pageIndex + 1, of: s.pageCount, lvl: p.level, near });
    }
    row.deaths = Math.max(row.deaths, s.hero.deaths);
    row.pages = Math.max(row.pages, s.pageIndex + 1);
    row.minHpFrac = Math.min(row.minHpFrac, p.hp / Math.max(1, p.hpMax));
    if (s.pageIndex !== pageIdx) {
      pageIdx = s.pageIndex;
      pageSince = s.time;
    }
    if (s.pageIndex === s.pageCount - 1 && row.tBossPage === null) row.tBossPage = Math.round(s.time);
    if (row.tBoss === null && s.enemies.some((e) => e.boss)) {
      row.tBoss = Math.round(s.time);
      row.lvlAtBoss = p.level;
      row.hpAtBoss = +(p.hp / p.hpMax).toFixed(2);
    }
    if (s.victoryAt !== null && s.victoryAt >= 0) row.won = true;

    // bookkeeping
    for (const e of s.enemies) if (e.elite && !seenElite.has(e.id)) seenElite.add(e.id);
    row.elites = seenElite.size;
    for (const k of s.pickups) {
      if (k.potwierdzenie && !seenPotw.has(k.id)) {
        seenPotw.add(k.id);
        row.potwDropped++;
      }
      if (k.item && !seenPick.has(k.id)) {
        seenPick.add(k.id);
        row.drops[k.item.tier] = (row.drops[k.item.tier] ?? 0) + 1;
        row.drawn++;
      }
    }
    const h = p.potwierdzenia ?? 0;
    if (h < held) row.potwUsed += held - h;
    held = h;
    row.potwHeldMax = Math.max(row.potwHeldMax, h);
    row.taken = p.inventory.length + Object.keys(p.equipment).length;
    for (const c of g.content.list()) if (c.state === 'opened') opened.add(`${s.pageIndex}:${c.id}`);
    row.teczki = opened.size;
    row.stars = Math.max(row.stars, p.gwiazdki);
    if (s.turning) await nap(120); // the page-turn sweep runs on real frames
    if (s.phase !== 'run' || s.turning || s.modal || s.status !== 'running') continue;

    // decisions
    if (h > 0 && p.hp < p.hpMax * 0.45) g.usePotwierdzenie();
    if (s.spor && g.spor.info()?.open) {
      const c = g.spor.info().correct;
      if (c !== null) g.spor.answer(c);
    }
    if (loadout.length > 0) {
      // BAL_LOADOUT (S19): the skills the bot wants on pads 1, 2, 3, by id; each goes on its pad as soon as it is installed
      const info = g.hero.info();
      loadout.forEach((id, slot) => {
        const k = info.skillIds.indexOf(id);
        if (k >= 0 && (k <= 2 || (info.ranks[k] ?? 0) > 0) && info.pads[slot] !== k) g.hero.assignPad(slot + 1, k);
      });
    }
    const near = s.enemies.filter((e) => Math.hypot(e.x - p.x, e.y - p.y) < 420);
    if (near.length > 0) {
      // BAL_AIM=auto casts every pad on the auto aim (the S16 bot). nearest (S19): a kierunek skill gets the direction to the nearest
      // enemy, a wskazanie skill that enemy's position. claim: the same, but the enemy whose standing claim the skill rebuts comes first
      // (a thumb that reads the bubbles). An auto skill is always the auto cast.
      const info = aim !== 'auto' ? g.hero.info() : null;
      const byDist = near.slice().sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
      for (const slot of [1, 2, 3]) {
        let aimed = { kind: 'auto' };
        if (info && byDist[0]) {
          const k = info.pads[slot - 1];
          const mode = info.aims[k];
          const type = info.types[k];
          const target = (aim === 'claim' ? byDist.find((e) => e.claim && !e.claim.struck && e.claim.type === type) : undefined) ?? byDist[0];
          const d = Math.hypot(target.x - p.x, target.y - p.y) || 1;
          if (mode === 'kierunek') aimed = { kind: 'kierunek', dx: (target.x - p.x) / d, dy: (target.y - p.y) / d };
          else if (mode === 'wskazanie') aimed = { kind: 'wskazanie', x: target.x, y: target.y };
        }
        if (g.hero.cast(slot, aimed)) row.casts++;
      }
    }
    if (g.castUltimate()) row.ults++;
    if (step % 150 === 0 && s.time - equipAt > 10 && p.inventory.length > 0) {
      equipAt = s.time;
      equipBest(s);
    }
    for (const q of g.quests.active()) if (q.ready && g.quests.report(q.id)) row.sideDone = g.quests.done();

    // walking
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    let goal = null;
    const pageTimeNow = s.time - pageSince;
    const takeable = (k) => {
      if ((chase.get(k.id) ?? 0) > 8) return false; // tried long enough: it cannot be taken
      if (k.item) return p.inventory.length < 20;
      if (k.potwierdzenie) return p.hp < p.hpMax || (p.potwierdzenia ?? 0) < 5;
      return true;
    };
    const pick = s.pickups.filter(takeable).sort((a, b) => dist(a, p) - dist(b, p))[0];
    const enemy = s.enemies.filter((e) => !e.boss || true).sort((a, b) => dist(a, p) - dist(b, p))[0];
    const folder = g.content.list().find((c) => c.kind === 'teczka' && c.state !== 'opened');
    if (pick && dist(pick, p) < 320) {
      goal = { x: pick.x, y: pick.y };
      chase.set(pick.id, (chase.get(pick.id) ?? 0) + DT);
    }
    else if (enemy && pageTimeNow < 70) {
      const stand = Math.max(30, (p.attackRange ?? 120) * 0.7);
      const d = dist(enemy, p);
      goal = d > stand ? { x: enemy.x, y: enemy.y } : null;
      if (!goal) p.target = null;
    } else if (folder && dist(folder, p) < 900) {
      g.content.tap(folder.id);
      goal = { x: folder.x, y: folder.y };
    }
    const pageTime = s.time - pageSince;
    if (!goal && !enemy) {
      const ex = s.page.exit;
      if (ex) goal = { x: ex.x + (ex.corner[1] === 'l' ? 40 : -40), y: ex.y + (ex.corner[0] === 't' ? 40 : -40) };
    } else if (!goal && pageTime > 70 && s.page.exit) {
      const ex = s.page.exit; // hunted long enough: go on
      goal = { x: ex.x + (ex.corner[1] === 'l' ? 40 : -40), y: ex.y + (ex.corner[0] === 't' ? 40 : -40) };
    }
    if (goal) {
      // no way round an obstacle is planned: when two seconds bring the player nowhere, walk across the grain for three
      if (s.time - probeAt >= 2) {
        const moved = Math.hypot(p.x - lastX, p.y - lastY);
        if (moved < 30 && !escape) {
          side = -side;
          const a = Math.atan2(goal.y - p.y, goal.x - p.x) + (side * Math.PI) / 2;
          escape = { until: s.time + 3, goal: { x: p.x + Math.cos(a) * 380, y: p.y + Math.sin(a) * 380 } };
        }
        probeAt = s.time;
        lastX = p.x;
        lastY = p.y;
      }
      if (escape && s.time > escape.until) escape = null;
      if (escape) goal = escape.goal;
      p.target = goal;
    }
    if (trace && step % 100 === 0) (row.trace ??= []).push([Math.round(s.time), Math.round(p.x), Math.round(p.y), goal ? [Math.round(goal.x), Math.round(goal.y)] : null, s.enemies.length, Math.round(p.hp), escape ? 1 : 0, p.target ? 1 : 0]);
    if (s.time > 1500) {
      row.stall = true;
      break;
    }
  }
  const s = g.state();
  if (s) {
    row.dbg = { pos: [Math.round(s.player.x), Math.round(s.player.y)], exit: s.page.exit, gate: g.gate.info(), enemies: s.enemies.length, pageIdx: s.pageIndex, pageCount: s.pageCount, near: s.enemies.slice(0, 2).map((e) => [Math.round(e.x), Math.round(e.y), e.boss, e.hp]), status: s.status, modal: s.modal, turning: s.turning, pend: s.hero.pendingLevels, sheet: document.querySelector('.sheet:not(.hidden), .ps, .pop-wrap')?.className ?? null, html: (document.querySelector('.sheet:not(.hidden), .pop-wrap')?.textContent ?? '').slice(0, 200) };
    row.deaths = Math.max(row.deaths, s.hero.deaths);
    row.stars = Math.max(row.stars, s.player.gwiazdki);
  }
  row.sideDone = g.quests.done();
  return row;
}

const browser = await chromium.launch({ executablePath: chromiumPath(), args: launchArgs });
const rows = [];
const problems = [];
const t0 = Date.now();
/** One hero's runs in a context of its own; heroes play side by side. */
async function playHero(heroId) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`${heroId}: ${e.message}`));
  page.on('console', (m) => {
    if (m.text().includes('Service Worker registration blocked')) return;
    if (m.type() === 'error') problems.push(`${heroId}: console.error ${m.text()}`);
  });
  await page.goto(URL);
  await page.waitForFunction(() => !!window.__game, null, { timeout: 15000 });
  for (let i = 0; i < RUNS; i++) {
    const seed = process.env.BAL_SEED ? Number(process.env.BAL_SEED) + i : 9100 + i * 131 + ['pralka', 'konsultant', 'petlowiec', 'kartograf', 'nalesnik'].indexOf(heroId) * 7;
    const row = await page.evaluate(playTicket, { aim: AIM, loadout: LOADOUT, heroId, seed, planet: PLANET, priority: PRIORITY, wallMs: Number(process.env.BAL_RUN_MS ?? 100000), trace: !!process.env.BAL_TRACE, mode: process.env.BAL_MODE ?? 'ticket', finaleLevel: Number(process.env.BAL_LEVEL ?? (process.env.BAL_MODE === 'finale' ? 12 : 1)) });
    if (process.env.BAL_VERBOSE) console.log(`${heroId} #${i} won=${row.won} t=${row.tEnd}s wall=${((Date.now() - t0) / 1000).toFixed(0)}s lvl=${row.level} deaths=${row.deaths} pages=${row.pages} dbg=${JSON.stringify(row.dbg ?? null).slice(0, 700)}`);
    rows.push(row);
    await page.evaluate(() => window.__game.go('baza')).catch(() => undefined);
  }
  await ctx.close();
}
await Promise.all(HEROES.map(playHero));
await browser.close();

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const f = (n, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : '-');
const cols = ['hero', 'n', 'win%', 'dead%', 'stall%', 'tBossPg', 'tBoss', 'fight', 'tEnd', 'deaths', 'lvl', 'minHp', 'potwDrop', 'held', 'used', 'ults', ...(process.env.BAL_MODE === 'finale' ? ['p1s', 'p2s', 'p3s'] : []), 'drops', 'z/n/r/u', 'stars', 'elites', 'teczki', 'side', 'updates'];
console.log(`Balance report: planet ${PLANET + 1}, ${PRIORITY}, ${RUNS} runs per hero, ${((Date.now() - t0) / 1000).toFixed(0)} s wall`);
console.log(cols.join('\t'));
for (const heroId of [...HEROES, 'ALL']) {
  const r = heroId === 'ALL' ? rows : rows.filter((x) => x.heroId === heroId);
  if (r.length === 0) continue;
  const d = (k) => avg(r.map((x) => x.drops[k] ?? 0));
  console.log(
    [
      heroId, r.length, f((100 * r.filter((x) => x.won).length) / r.length, 0), f((100 * r.filter((x) => !x.won && x.ended).length) / r.length, 0), f((100 * r.filter((x) => !x.won && !x.ended).length) / r.length, 0),
      f(avg(r.filter((x) => x.tBossPage !== null).map((x) => x.tBossPage)), 0), f(avg(r.filter((x) => x.tBoss !== null).map((x) => x.tBoss)), 0), f(avg(r.filter((x) => x.won && x.tBoss !== null).map((x) => x.tEnd - x.tBoss)), 0), f(avg(r.map((x) => x.tEnd)), 0),
      f(avg(r.map((x) => x.deaths))), f(avg(r.map((x) => x.level))), f(avg(r.map((x) => x.minHpFrac)), 2),
      f(avg(r.map((x) => x.potwDropped))), f(avg(r.map((x) => x.potwHeldMax))), f(avg(r.map((x) => x.potwUsed))), f(avg(r.map((x) => x.ults))),
      ...(process.env.BAL_MODE === 'finale' ? ['form', 'face', 'last'].map((k) => f(avg(r.map((x) => x.phaseSec?.[k] ?? 0)), 0)) : []),
      f(avg(r.map((x) => x.drawn))), `${f(d('zwykly'))}/${f(d('nietypowy'))}/${f(d('rzadki'))}/${f(d('unikatowy'))}`,
      f(avg(r.map((x) => x.stars)), 0), f(avg(r.map((x) => x.elites ?? 0))), f(avg(r.map((x) => x.teczki))), `${f(avg(r.map((x) => x.sideDone)))}/${f(avg(r.map((x) => x.sideTaken)))}`, f(avg(r.map((x) => x.updates))),
    ].join('\t'),
  );
}
const stalled = rows.filter((x) => !x.won && !x.ended).length;
console.log(`unfinished (the bot stalled, not a death): ${stalled}/${rows.length}; page errors: ${problems.length}`);
for (const p of problems.slice(0, 5)) console.log(`  ${p}`);
if (process.env.BAL_JSON) writeFileSync(process.env.BAL_JSON, JSON.stringify(rows, null, 1));
process.exit(problems.length ? 1 : 0);
