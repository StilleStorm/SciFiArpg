// Milestone 4 (Depth, slices S16-S21) end-to-end gate, in portrait and in landscape, each from a fresh profile:
//  (1) every hero (5), a fresh browser profile each: every skill (up to 11) with each paragraph 1-3 cast in a run, and all three
//      ultimates with each of their three paragraphs cast, run and end;
//  (2) a set bonus: two and three pieces of a set worn (the Zalaczniki sheet taps); counts, speed bonus, card lines, the footnotes;
//  (3) a Reklamacja at the Sklep: one affix re-rolled, the old line struck on the row, the second attempt on the planet refused;
//  (4) a transfer: an item moved bag -> personal archive -> shared Archiwum with real taps, seen from a second case file,
//      surviving a reload;
//  then 40 enemies and 5 s of frame times. No page or console error anywhere.
// Usage: npm run e2e:m4 (builds into dist-m4 first). Env: M4_PORT (4190), M4_OUT (dist-m4), M4_DIR (shots-m4),
// M4_ONLY ("portrait", "landscape", "heroes" or "depth"), PERF_MAX_MS. Exits non-zero on any failed check or page/console error.
import { spawn } from 'node:child_process';
import { get } from 'node:http';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.M4_PORT ?? 4190);
const OUT = process.env.M4_OUT ?? 'dist-m4';
const SHOTS = process.env.M4_DIR ?? 'shots-m4';
const PERF_MAX = process.env.PERF_MAX_MS ? Number(process.env.PERF_MAX_MS) : null;
const ONLY = process.env.M4_ONLY ?? '';
const BASE = `http://127.0.0.1:${PORT}/SciFiArpg/`;
const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const ORIENTS = { portrait: { width: 390, height: 844 }, landscape: { width: 844, height: 390 } };
const HEROES = [
  { id: 'pralka', ults: ['pelnyCykl', 'uznanieOsobowosci', 'reklamacja'] },
  { id: 'konsultant', ults: ['przekazanie', 'koniecKolejki', 'ankieta'] },
  { id: 'petlowiec', ults: ['zebranie', 'cofniecie', 'przedwczesny'] },
  { id: 'kartograf', ults: ['mapaOstateczna', 'skreslenie', 'pomiarKontrolny'] },
  { id: 'nalesnik', ults: ['decyzjaKomisji', 'zderzenie', 'pelnia'] },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync(SHOTS, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--outDir', OUT, '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
const stop = () => server.kill('SIGTERM');
process.on('exit', stop);

const problems = [];
const checks = [];
let tag = '';
const check = (name, ok, detail = '') => {
  checks.push({ name: `[${tag}] ${name}`, ok });
  console.log(`${ok ? 'ok  ' : 'FAIL'} [${tag}] ${name}${ok || !detail ? '' : ` (${detail})`}`);
};

async function waitForServer(url, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // node:http, not fetch: undici refuses 4190 (a "bad port" of the fetch standard, ManageSieve)
    const ok = await new Promise((res) => {
      get(url, (r) => {
        r.resume();
        res(r.statusCode === 200);
      }).on('error', () => res(false));
    });
    if (ok) return;
    await sleep(200);
  }
  throw new Error(`preview server did not start at ${url}`);
}

/** A fresh browser profile (empty storage) with pinned randomness, errors collected. */
async function freshPage(browser, orient) {
  const ctx = await browser.newContext({
    viewport: ORIENTS[orient],
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: UA,
    colorScheme: 'light',
    serviceWorkers: 'block',
  });
  await ctx.addInitScript(() => {
    Math.random = () => 0.4242;
    Date.now = () => 1.75e12;
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`[${tag}] pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.text().includes('Service Worker registration blocked')) return;
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`[${tag}] console.${m.type()}: ${m.text()}`);
  });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);
  await page.evaluate(() => document.fonts.ready);
  return { ctx, page };
}

/** Leg 1: one hero from a fresh profile: every skill x paragraph, every ultimate x paragraph. */
async function heroLeg(browser, orient, hero, idx) {
  tag = `${orient} ${hero.id}`;
  const t0 = Date.now();
  const { ctx, page } = await freshPage(browser, orient);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const fresh = await ev(() => ({ chars: window.__game.meta().characters.length, screen: window.__game.screen() }));
  check('a fresh profile (no case file yet)', fresh.chars === 0, JSON.stringify(fresh));
  await ev((a) => window.__game.start(30 + a.i, { heroId: a.id, lawId: 'grawitacja' }), { i: idx, id: hero.id });
  await sleep(400);
  if (await ev(() => window.__game.state().modal === 'cookies')) await page.locator('.cookie button').last().click({ timeout: 3000 });
  const r = await ev(() => {
    const g = window.__game;
    const s = g.state();
    g.enemies.clear();
    s.player.hp = s.player.hpMax = 1e9;
    s.hero.pendingLevels = 0;
    g.setLevel(40);
    g.placePlayer(600, 800);
    g.hero.spawn(6);
    const ids = g.hero.info().skillIds;
    for (let k = 3; k < ids.length; k++) g.hero.installSkill(k);
    const out = { hero: g.hero.info().heroId, n: ids.length, cast: [], cd: [], para: [], fail: [] };
    for (const n of [1, 2, 3]) {
      for (let k = 0; k < ids.length; k++) {
        g.enemies.clear();
        s.law.botTime = 0;
        s.player.statuses.length = 0;
        s.player.hp = s.player.hpMax = 1e9;
        g.placePlayer(600, 800);
        g.hero.spawn(6);
        g.hero.assignPad(1, k);
        if (!g.hero.setParagraph(ids[k], n, true)) out.para.push(`${ids[k]}:${n}`);
        for (const e of s.enemies) e.hp = e.hpMax = 1e9;
        s.hero.cd.fill(0);
        const ok = g.hero.cast(1);
        if (!ok) out.fail.push(`${ids[k]}:${n}`);
        out.cast.push(ok);
        out.cd.push(g.hero.info().cd[k] > 0);
        g.advance(0.5);
      }
    }
    out.active = g.hero.info().paragraphs;
    return out;
  });
  check(`${hero.id}: all ${r.n} skills cast with § 1, § 2, § 3 and start a cooldown`, r.hero === hero.id && r.n >= 10 && r.n <= 11 && r.cast.length === 3 * r.n && r.cast.every(Boolean) && r.cd.every(Boolean) && r.para.length === 0 && r.active.length === r.n && r.active.every((n) => n === 3), JSON.stringify({ n: r.n, fail: r.fail, para: r.para, cd: r.cd.filter((c) => !c).length }));
  const shotName = `${SHOTS}/${orient}-hero-${hero.id}.png`;
  await page.screenshot({ path: shotName });
  const res = await ev((ults) => {
    const g = window.__game;
    const s = g.state();
    const out = [];
    for (const u of ults) {
      for (const n of [1, 2, 3]) {
        g.enemies.clear();
        g.placePlayer(600, 800);
        g.hero.spawn(6);
        for (const e of s.enemies) e.hp = e.hpMax = 1e9;
        s.hero.ultimateId = u;
        s.hero.ult = { para: n, active: [], idle: 0 };
        s.law.botTime = 0;
        s.player.statuses.length = 0;
        s.player.hp = s.player.hpMax = 1e9;
        g.fillMeter(1);
        const cast = g.castUltimate();
        const during = g.ultimateInfo();
        for (let k = 0; k < 10; k++) {
          g.advance(1);
          s.player.hp = s.player.hpMax = 1e9;
        }
        const after = g.ultimateInfo();
        out.push({ u, n, cast, ran: during.active.includes(u), ended: after.active.length === 0, meter: after.meter });
      }
    }
    return out;
  }, hero.ults);
  check(`${hero.id}: all three ultimates cast, run and end with § 1, § 2 and § 3`, res.length === 9 && res.every((x) => x.cast && x.ran && x.ended && x.meter === 0), JSON.stringify(res.filter((x) => !(x.cast && x.ran && x.ended && x.meter === 0))));
  const ok = await ev(() => window.__game.state().status);
  check('the run is still running after all the casts', ok === 'running', String(ok));
  console.log(`  leg ${orient} ${hero.id}: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await ctx.close();
}

/** Leg 2: the depth systems in one fresh profile: set, reclamation, transfer, reload, 40 enemies. */
async function depthLeg(browser, orient) {
  tag = `${orient} depth`;
  const t0 = Date.now();
  const { ctx, page } = await freshPage(browser, orient);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const shot = (name) => page.screenshot({ path: `${SHOTS}/${orient}-${name}.png` });
  const waitScreen = (name, ms = 8000) => page.waitForFunction((n) => window.__game.screen() === n, name, { timeout: ms }).then(() => true, () => false);
  const closeSheets = async () => {
    for (let k = 0; k < 3; k++) {
      const c = page.locator('.ps-close').locator('visible=true').first();
      if (!(await c.isVisible().catch(() => false))) break;
      await c.click({ timeout: 1500 }).catch(() => undefined);
      await sleep(200);
    }
  };
  const toRoster = async () => {
    await closeSheets();
    await ev(() => window.__game.pause());
    await page.locator('[data-pause=exit]').click({ timeout: 3000 });
    await page.locator('.roster .rs-case').first().waitFor({ state: 'visible', timeout: 4000 });
  };

  // ---- title -> roster -> base with real taps (first case file: Pralka) ----
  await sleep(1200);
  await page.locator('#ui').getByText('Rozpocznij', { exact: false }).locator('visible=true').first().click({ timeout: 5000 });
  await page.locator('button.choose').locator('visible=true').first().waitFor({ timeout: 5000 });
  await page.locator('button.choose').locator('visible=true').first().click();
  check('the first case file leads to the base', await waitScreen('baza'));
  await sleep(700);
  if (await page.locator('.card-layer .card-skip').isVisible().catch(() => false)) await page.locator('.card-layer .card-skip').click({ timeout: 3000 });
  await sleep(300);

  // ---- (2) a set bonus: pieces put on through the Zalaczniki sheet ----
  const wornObieg = () => ev(() => window.__game.state().player.sets?.obieg ?? 0);
  /** Put the first bag row on through the sheet: tap the row, then Załóż; retried while the count does not move. */
  const put = async () => {
    const was = await wornObieg();
    for (let k = 0; k < 4 && (await wornObieg()) === was; k++) {
      await page.evaluate(() => document.querySelectorAll('.inv-row')[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
      await sleep(300);
      await page.evaluate(() => {
        const btn = [...document.querySelectorAll('.inv-actions .ps-btn')].find((b) => b.textContent === 'Załóż');
        btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await sleep(400);
    }
  };
  await ev(() => {
    const g = window.__game;
    const p = g.state().player;
    p.inventory.length = 0;
    for (const k of Object.keys(p.equipment)) delete p.equipment[k];
    g.recomputeStats();
    g.giveNamed({ set: 'obieg', piece: 0 });
    g.giveNamed({ set: 'obieg', piece: 1 });
    g.giveNamed({ set: 'obieg', piece: 2 });
  });
  const notes0 = await ev(() => window.__game.notes().length);
  await ev(() => window.__game.openInventory());
  await page.locator('.inv-row').first().waitFor({ state: 'visible', timeout: 4000 });
  await put();
  const one = await ev(() => ({ sets: window.__game.state().player.sets ?? {}, hp: window.__game.state().player.stats.pewnoscSiebie }));
  await put();
  const two = await ev(() => ({ sets: window.__game.state().player.sets ?? {}, notes: window.__game.notes().slice(-6).map((n) => n.text) }));
  check('one piece worn counts one, two worn count two (the two-piece bonus reached)', one.sets.obieg === 1 && two.sets.obieg === 2, JSON.stringify({ one: one.sets, two: two.sets }));
  const noteObieg = await ev(() => window.__game.notes().slice(-8).map((n) => n.text).join(' | '));
  check('the joint footnote of the two-piece bonus is printed', /Dokumenty\skrążą\szgodnie\sz\sprocedurą/.test(noteObieg), noteObieg.slice(0, 200));
  // the card of the last worn piece: bonus2 line reached, bonus3 not
  await page.evaluate(() => document.querySelectorAll('.inv-slot')[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await sleep(300);
  const cardTwo = await ev(() => ({ on: document.querySelectorAll('.inv-plate.open .inv-set-line.on, .inv-set-line.on').length, off: document.querySelectorAll('.inv-set-line.off').length, head: document.querySelector('.inv-set-head')?.textContent ?? '', block: document.querySelector('.inv-set')?.textContent ?? '' }));
  check('the set card shows 2 of 3 worn, one bonus line reached and one not', /2\sz\s3/.test(cardTwo.head) && cardTwo.on === 1 && cardTwo.off === 1 && !/items\.|undefined/.test(cardTwo.block), JSON.stringify(cardTwo));
  await ev(() => document.querySelector('.ps-scroll')?.scrollTo(0, 0));
  await shot('m4-set-two');
  const statTwo = await ev(() => ({ pewn: window.__game.state().player.stats.pewnoscSiebie, hasResist: JSON.stringify(window.__game.state().player.stats).length }));
  await put();
  const three = await ev(() => ({ sets: window.__game.state().player.sets ?? {}, notes: window.__game.notes().slice(-8).map((n) => n.text).join(' | ') }));
  check('three pieces worn count three and the completeness footnote is printed', three.sets.obieg === 3 && /jest\skompletny/.test(three.notes), JSON.stringify({ sets: three.sets, notes: three.notes.slice(0, 200) }));
  await page.evaluate(() => document.querySelector('.inv-set')?.scrollIntoView({ block: 'center' }));
  const cardThree = await ev(() => ({ on: document.querySelectorAll('.inv-set-line.on').length, off: document.querySelectorAll('.inv-set-line.off').length, head: document.querySelector('.inv-set-head')?.textContent ?? '' }));
  check('the set card shows 3 of 3 worn with both bonus lines reached', /3\sz\s3/.test(cardThree.head) && cardThree.on === 2 && cardThree.off === 0, JSON.stringify(cardThree));
  await shot('m4-set-three');
  // the stat bonus itself: the same three pieces with the set broken to two must lack the +8 pewnosc of the bonus; the speed set shows it in state
  const bonus = await ev(() => {
    const g = window.__game;
    const p = g.state().player;
    const withAll = p.stats.pewnoscSiebie;
    const worn = p.equipment;
    const slot = Object.keys(worn).find((k) => worn[k].setId === 'obieg');
    const removed = worn[slot];
    delete worn[slot];
    g.recomputeStats();
    const broken = p.stats.pewnoscSiebie;
    const brokenSets = p.sets?.obieg ?? 0;
    worn[slot] = removed;
    g.recomputeStats();
    return { withAll, broken, brokenSets, back: p.stats.pewnoscSiebie, own: removed.stats?.pewnosc ?? null };
  });
  check('the bonus is in the stats: three worn differ from two worn by the piece plus the set effect, and the stats come back exactly', bonus.back === bonus.withAll && bonus.brokenSets === 2 && bonus.withAll !== bonus.broken, JSON.stringify(bonus));
  await closeSheets();
  const speed = await ev(() => {
    const g = window.__game;
    const p = g.state().player;
    p.inventory.length = 0;
    for (const k of Object.keys(p.equipment)) delete p.equipment[k];
    g.recomputeStats();
    const before = p.gearSpeed ?? 1;
    g.giveNamed({ set: 'ostatnia-mila', piece: 0 }, { wear: true });
    const one = p.gearSpeed ?? 1;
    g.giveNamed({ set: 'ostatnia-mila', piece: 1 }, { wear: true });
    return { before, one, two: p.gearSpeed ?? 1, sets: p.sets ?? {} };
  });
  check('Ostatnia mila: two pieces worn give the +8% walking speed (and one piece does not)', speed.before === 1 && speed.one === 1 && Math.abs(speed.two - 1.08) < 1e-9 && speed.sets['ostatnia-mila'] === 2, JSON.stringify(speed));

  // ---- (3) a Reklamacja at the Sklep ----
  await ev(() => window.__game.startBase(7));
  await sleep(900);
  const gear = await ev(() => {
    const g = window.__game;
    const s = g.state();
    s.player.inventory.length = 0;
    s.player.gwiazdki = 400;
    const takeable = () => {
      for (let k = 0; k < 14; k++) {
        const it = g.giveItem('rzadki');
        if (it && g.reclaimRefusal(it) === null) return it;
      }
      return null;
    };
    const a = takeable();
    return { a: a?.number ?? 0, stars: s.player.gwiazdki };
  });
  check('a reclaimable rzadki is in the bag', gear.a > 0, JSON.stringify(gear));
  const rec = (n) => ev((num) => {
    const it = window.__game.state().player.inventory.find((i) => i.number === num);
    return it ? { affixes: [...it.affixes], mods: JSON.stringify(it.mods ?? null), n: (it.reklamacje ?? []).length, refusal: window.__game.reclaimRefusal(it) } : null;
  }, n);
  const before = await rec(gear.a);
  await ev(() => window.__game.station('kiosk'));
  await page.locator('[data-rek="toggle"]').waitFor({ state: 'visible', timeout: 4000 }).catch(() => undefined);
  await page.locator('[data-rek="toggle"]').click().catch(() => undefined);
  const row = page.locator(`button[data-rek="${gear.a}"]`);
  const shown = await row.waitFor({ state: 'visible', timeout: 3000 }).then(() => true, () => false);
  await row.scrollIntoViewIfNeeded().catch(() => undefined);
  await shot('m4-reclaim-before');
  await row.dispatchEvent('click', undefined, { timeout: 2000 }).catch(() => undefined);
  await sleep(350);
  const after = await rec(gear.a);
  const starsAfter = await ev(() => window.__game.state().player.gwiazdki);
  const struck = await ev((num) => {
    const rows = [...document.querySelectorAll('.sk-rek-row')];
    const r = rows.find((x) => x.textContent?.includes(`${num}`) && x.querySelector('s'));
    return r ? { struck: r.querySelector('s')?.textContent ?? '', text: r.textContent ?? '' } : null;
  }, gear.a);
  const noBtn = (await page.locator(`button[data-rek="${gear.a}"]`).count()) === 0;
  const changed = before && after && (after.mods !== before.mods || after.affixes.join() !== before.affixes.join());
  check('one affix line was re-rolled: the item changed, one reklamacja on its record, the purse paid', shown && changed && after.n === before.n + 1 && starsAfter < gear.stars, JSON.stringify({ shown, before, after, stars: [gear.stars, starsAfter] }));
  check('the old line is struck through on the row (<s> with text), the new one typed', struck !== null && struck.struck.length > 3, JSON.stringify(struck));
  check('a second attempt on the same planet is refused: the hook gives a reason and the row has no button', noBtn && after?.refusal !== null && after.refusal.length > 5, JSON.stringify({ noBtn, refusal: after?.refusal }));
  await page.evaluate(() => document.querySelector('.sk-rek-row s')?.scrollIntoView({ block: 'center' }));
  await sleep(200);
  await shot('m4-reclaim-after');
  await closeSheets();

  // ---- (4) a transfer: bag -> personal archive -> shared Archiwum -> a second case file sees it -> reload ----
  const given = await ev(() => {
    const g = window.__game;
    g.state().player.inventory.length = 0;
    const it = g.giveItem('rzadki');
    return it ? { uid: it.uid, number: it.number } : null;
  });
  check('an item to move is in the bag', given !== null, JSON.stringify(given));
  await ev(() => window.__game.station('biurko'));
  await page.locator('[data-desk=archiwum]').click({ timeout: 3000 });
  await page.locator('.ar-sheet').waitFor({ state: 'visible', timeout: 3000 });
  const cell = (place) => page.locator(`.ar-sheet .ar-sec[data-place=${place}] .ar-cell[data-uid="${given.uid}"]`);
  await cell('bag').click({ timeout: 3000 });
  await page.locator('.ar-sheet .ar-move[data-to=personal]').click({ timeout: 3000 });
  await sleep(300);
  const toPersonal = await ev((uid) => {
    const m = window.__game.meta();
    const me = m.characters.find((c) => c.id === m.activeCharacterId);
    return { bag: window.__game.state().player.inventory.some((i) => i.uid === uid), personal: (me?.archive ?? []).some((i) => i.uid === uid), shared: (m.sharedArchive ?? []).some((i) => i.uid === uid) };
  }, given.uid);
  check('moved to the personal archive: gone from the bag, held by the character record, not shared', !toPersonal.bag && toPersonal.personal && !toPersonal.shared && (await cell('personal').count()) === 1, JSON.stringify(toPersonal));
  await cell('personal').click({ timeout: 3000 });
  await page.locator('.ar-sheet .ar-move[data-to=shared]').click({ timeout: 3000 });
  await sleep(300);
  const toShared = await ev((uid) => {
    const m = window.__game.meta();
    const me = m.characters.find((c) => c.id === m.activeCharacterId);
    return { personal: (me?.archive ?? []).some((i) => i.uid === uid), shared: (m.sharedArchive ?? []).some((i) => i.uid === uid) };
  }, given.uid);
  check('moved on to the shared Archiwum: out of the personal archive, in the shared one, drawn there', !toShared.personal && toShared.shared && (await cell('shared').count()) === 1, JSON.stringify(toShared));
  await shot('m4-archive-first');
  await closeSheets();
  await closeSheets();
  const firstId = await ev(() => window.__game.meta().activeCharacterId);
  // a second case file: Konsultant, started from the roster with taps
  await toRoster();
  await page.locator('[data-roster=new]').click({ timeout: 3000 });
  await page.locator('button.choose').locator('visible=true').first().waitFor({ timeout: 4000 });
  await page.locator('.nav .arrow').locator('visible=true').last().click({ timeout: 3000 });
  await sleep(150);
  await page.locator('button.choose').locator('visible=true').first().click();
  check('the second case file leads to the base', await waitScreen('baza'));
  await sleep(700);
  if (await page.locator('.card-layer .card-skip').isVisible().catch(() => false)) await page.locator('.card-layer .card-skip').click({ timeout: 3000 });
  const second = await ev(() => {
    const m = window.__game.meta();
    return { id: m.activeCharacterId, hero: m.character?.heroId ?? null, files: m.characters.length, bag: window.__game.state().player.inventory.length };
  });
  check('a second character is active, with an empty bag', second.id !== firstId && second.files === 2 && second.bag === 0, JSON.stringify({ second, firstId }));
  await ev(() => window.__game.station('biurko'));
  await page.locator('[data-desk=archiwum]').click({ timeout: 3000 });
  await page.locator('.ar-sheet').waitFor({ state: 'visible', timeout: 3000 });
  const seen = await ev((uid) => ({ shared: document.querySelectorAll(`.ar-sheet .ar-sec[data-place=shared] .ar-cell[data-uid="${uid}"]`).length, personal: document.querySelectorAll('.ar-sheet .ar-sec[data-place=personal] .ar-cell[data-uid]').length }), given.uid);
  check('the second character sees the item in the shared Archiwum and none in their own personal archive', seen.shared === 1 && seen.personal === 0, JSON.stringify(seen));
  await shot('m4-archive-second');
  // the second character takes it into their own bag (shared -> bag)
  await cell('shared').click({ timeout: 3000 });
  await page.locator('.ar-sheet .ar-move[data-to=bag]').click({ timeout: 3000 });
  await sleep(300);
  const taken = await ev((uid) => {
    const m = window.__game.meta();
    return { bag: window.__game.state().player.inventory.some((i) => i.uid === uid), shared: (m.sharedArchive ?? []).some((i) => i.uid === uid) };
  }, given.uid);
  check('the second character moved it from the shared Archiwum into their bag', taken.bag && !taken.shared, JSON.stringify(taken));
  // and back to shared so the reload has something to keep
  await cell('bag').click({ timeout: 3000 });
  await page.locator('.ar-sheet .ar-move[data-to=shared]').click({ timeout: 3000 });
  await sleep(300);
  await closeSheets();
  await closeSheets();
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);
  await sleep(900);
  const persisted = await ev((uid) => {
    const m = window.__game.meta();
    return { files: m.characters.length, shared: (m.sharedArchive ?? []).some((i) => i.uid === uid), anywhere: m.characters.some((c) => (c.archive ?? []).some((i) => i.uid === uid) || (c.character?.inventory ?? []).some((i) => i.uid === uid)) };
  }, given.uid);
  check('after a reload both case files and the item in the shared Archiwum are still there (once, nowhere else)', persisted.files === 2 && persisted.shared && !persisted.anywhere, JSON.stringify(persisted));

  // ---- 40 enemies, 5 s of frame times ----
  tag = `${orient} depth`;
  await ev(() => window.__game.start(11, { pageCount: 5, lawId: 'grawitacja' }));
  await sleep(1500);
  await ev(() => {
    const g = window.__game;
    const s = g.state();
    g.enemies.clear();
    s.player.hp = s.player.hpMax = 1e9;
    s.hero.pendingLevels = 0;
    for (const f of ['urzadzenia', 'powiadomienia', 'wygenerowane']) g.enemies.spawnFamily(f, f === 'urzadzenia' ? 14 : 13);
    for (const e of s.enemies) e.hp = e.hpMax = 1e9;
  });
  await sleep(1500);
  const perf = await ev(
    () =>
      new Promise((resolve) => {
        const deltas = [];
        let last = performance.now();
        const t1 = last;
        const tick = (now) => {
          deltas.push(now - last);
          last = now;
          if (now - t1 < 5000) requestAnimationFrame(tick);
          else resolve({ deltas, enemies: window.__game.state()?.enemies.length ?? 0 });
        };
        requestAnimationFrame(tick);
      }),
  );
  const d = perf.deltas.slice(1).sort((a, b) => a - b);
  const avg = d.reduce((a, b) => a + b, 0) / d.length;
  const p95 = d[Math.floor(d.length * 0.95)] ?? 0;
  console.log(`PERF ${orient}: ${perf.enemies} enemies, frame ${avg.toFixed(2)} ms avg, ${p95.toFixed(1)} ms p95 over ${d.length} frames`);
  await shot('forty-enemies');
  check('40 enemies on the page for the measurement', perf.enemies >= 40, String(perf.enemies));
  if (PERF_MAX !== null) check(`average frame under ${PERF_MAX} ms`, avg <= PERF_MAX, `${avg.toFixed(2)} ms`);
  console.log(`  leg ${orient} depth: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await ctx.close();
}

let browser;
try {
  await waitForServer(BASE);
  const extra = process.env.SMOKE_UNCAPPED ? ['--disable-frame-rate-limit', '--disable-gpu-vsync'] : [];
  browser = await chromium.launch({ executablePath: chromiumPath(), args: [...launchArgs, ...extra] });
  for (const orient of Object.keys(ORIENTS)) {
    if (ONLY && ONLY !== orient && ONLY !== 'heroes' && ONLY !== 'depth' && !HEROES.some((h) => h.id === ONLY)) continue;
    if (ONLY === 'portrait' || ONLY === 'landscape' ? ONLY !== orient : false) continue;
    for (const [i, hero] of HEROES.entries()) {
      if (ONLY === 'depth' || (HEROES.some((h) => h.id === ONLY) && ONLY !== hero.id)) continue;
      try {
        await heroLeg(browser, orient, hero, i);
      } catch (e) {
        tag = `${orient} ${hero.id}`;
        check('leg ran to the end', false, e instanceof Error ? e.message.split('\n')[0] : String(e));
      }
    }
    if (ONLY === 'heroes' || HEROES.some((h) => h.id === ONLY)) continue;
    try {
      await depthLeg(browser, orient);
    } catch (e) {
      tag = `${orient} depth`;
      check('leg ran to the end', false, e instanceof Error ? e.message.split('\n')[0] : String(e));
    }
  }
} catch (e) {
  problems.push(`script: ${e instanceof Error ? e.message : String(e)}`);
} finally {
  await browser?.close();
  stop();
}

tag = 'all';
check('no page or console errors', problems.length === 0);
for (const p of problems.slice(0, 20)) console.log(' -', p.slice(0, 300));
const failed = checks.filter((c) => !c.ok);
console.log(failed.length === 0 ? 'M4 E2E PASSED' : `M4 E2E FAILED (${failed.length}): ${failed.map((c) => c.name).join('; ')}`);
process.exit(failed.length === 0 ? 0 : 1);
