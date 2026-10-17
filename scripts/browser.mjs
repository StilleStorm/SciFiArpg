// Shared by shot.mjs and icons.mjs: find the bundled Chromium. Never downloads anything.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function chromiumPath() {
  const fromEnv = process.env.PLAYWRIGHT_CHROMIUM;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
  const candidates = [join(root, 'chromium')];
  if (existsSync(root)) {
    for (const dir of readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()) {
      candidates.push(join(root, dir, 'chrome-linux', 'chrome'));
    }
  }
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error(`No Chromium found under ${root}; set PLAYWRIGHT_CHROMIUM`);
  return found;
}

export const launchArgs = ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'];
