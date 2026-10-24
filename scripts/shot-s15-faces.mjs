// Screenshots of the five Anomalia face figures (S15). The in-game hook (finale jump) belongs to anomalia-core, so this
// renders the part-library figures themselves, drawn from the same Assembly/layout the game uses, on cream paper in ink.
// Usage: SHOT_PORT=4195 SHOT_OUT=dist-s15 SHOT_DIR=shots-s15 node scripts/shot-s15-faces.mjs   (uses a vite dev server)
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4195);
const SHOTS = process.env.SHOT_DIR ?? 'shots-s15';
const BASE = `http://127.0.0.1:${PORT}/SciFiArpg/`;

async function waitForServer(url, ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`dev server did not start at ${url}`);
}

mkdirSync(SHOTS, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
process.on('exit', () => server.kill('SIGTERM'));

const problems = [];
let browser;
try {
  await waitForServer(BASE);
  browser = await chromium.launch({ executablePath: chromiumPath(), args: launchArgs });
  const page = await browser.newPage({ viewport: { width: 1000, height: 420 }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  await page.goto(BASE, { waitUntil: 'load' });
  const heroes = ['konsultant', 'pralka', 'petlowiec', 'kartograf', 'nalesnik'];
  await page.evaluate(async (heroes) => {
    await import('/SciFiArpg/src/enemies/anomalia/index.ts');
    const { faceAssembly } = await import('/SciFiArpg/src/enemies/anomalia/faces/assembly.ts');
    const { layoutAssembly } = await import('/SciFiArpg/src/enemies/assemble.ts');
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;background:#f3ecd8';
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 1000 420');
    svg.setAttribute('width', '1000');
    svg.setAttribute('height', '420');
    svg.innerHTML =
      '<defs><pattern id="hatch" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="3" stroke="#1a1815" stroke-width="0.8"/></pattern></defs>';
    const mk = (tag, attrs) => {
      const el = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      return el;
    };
    heroes.forEach((h, i) => {
      const asm = faceAssembly(h, 3);
      const lay = layoutAssembly(asm);
      const g = mk('g', { transform: `translate(${100 + i * 200} 330) scale(${asm.scale * 1.55})`, fill: 'none', stroke: '#1a1815', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
      for (const layer of lay.layers) {
        const lg = mk('g', { transform: layer.tf });
        if (layer.art.hatch) lg.appendChild(mk('path', { d: layer.art.hatch, fill: 'url(#hatch)', stroke: 'none' }));
        if (layer.art.thin) lg.appendChild(mk('path', { d: layer.art.thin, 'stroke-width': '0.7' }));
        if (layer.art.line) lg.appendChild(mk('path', { d: layer.art.line, 'stroke-width': '1.2', 'stroke-dasharray': asm.dotted ? '0' : '0' }));
        if (layer.art.ink) lg.appendChild(mk('path', { d: layer.art.ink, fill: '#1a1815', stroke: 'none' }));
        g.appendChild(lg);
      }
      const lg = mk('g', { transform: lay.legTf });
      for (const d of lay.legs(0)) lg.appendChild(mk('path', { d, 'stroke-width': '1.2' }));
      g.appendChild(lg);
      svg.appendChild(g);
      svg.appendChild(mk('line', { x1: 40 + i * 200, y1: 332, x2: 160 + i * 200, y2: 332, stroke: '#1a1815', 'stroke-width': '0.6' }));
      const label = mk('text', { x: 100 + i * 200, y: 372, 'text-anchor': 'middle', 'font-family': 'monospace', 'font-size': '12', fill: '#1a1815' });
      label.textContent = h;
      svg.appendChild(label);
    });
    document.body.appendChild(svg);
  }, heroes);
  await page.screenshot({ path: `${SHOTS}/faces.png` });
  for (let i = 0; i < heroes.length; i++) await page.screenshot({ path: `${SHOTS}/face-${heroes[i]}.png`, clip: { x: i * 200, y: 0, width: 200, height: 420 } });
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`figures written to ${SHOTS}/`);
