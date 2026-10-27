/**
 * The stop board (DESIGN 4.1 Przystanki, S21a): the sheet that opens from the base station `przystanek`. Every open planet is
 * a block with a heading and the stops registered on it, one button each (at least 44 css px); a tap prints the ticket again
 * from that page (`StopsHost.onTravel`, main.ts `travelToStop`). The sheet owns no state: it reads the host on each draw.
 */
import { t } from '../i18n';
import { planetDef, type CampaignState } from '../world/campaign';
import { stopRows, type StopRow, type Stops } from '../world/stops';
import { h } from './dom';
import { createSheet, type Sheet } from './sheet';
import './stops.css';

export interface StopsHost {
  campaign(): CampaignState;
  stops(): Stops | undefined;
  /** A stop was chosen: planet index and 0-based page index. The caller closes the sheet and moves the player. */
  onTravel(planet: number, index: number): void;
  onClose(): void;
}

export interface StopsSheet {
  sheet: Sheet;
  refresh(): void;
  close(): void;
}

/** What one block of the board prints (pure, tested): the planet's name and the page numbers (1-based) of its stops. */
export interface StopBlock {
  planet: number;
  title: string;
  pages: number[];
}

export function stopBlocks(rows: readonly StopRow[]): StopBlock[] {
  return rows.map((r) => ({ planet: r.planet, title: t(planetDef(r.planet).nameKey), pages: r.indices.map((i) => i + 1) }));
}

export function openStops(root: HTMLElement, host: StopsHost): StopsSheet {
  const sheet = createSheet(root, { title: t('screens.stops.title'), sub: t('screens.stops.sub'), onClose: host.onClose });
  sheet.el.classList.add('stops-sheet');
  sheet.note(t('screens.stops.note'));

  function refresh(): void {
    const top = sheet.scroll.scrollTop;
    sheet.scroll.replaceChildren();
    const blocks = stopBlocks(stopRows(host.campaign(), host.stops()));
    const body = h('div', 'stops');
    for (const b of blocks) {
      const block = h('section', 'stops-planet');
      block.dataset['planet'] = String(b.planet);
      block.append(h('h3', 'group', b.title));
      if (b.pages.length === 0) block.append(h('p', 'inv-empty', t('screens.stops.none')));
      for (const page of b.pages) {
        const btn = h('button', 'ps-btn stop-go', t('screens.stops.go', { page }));
        btn.type = 'button';
        btn.dataset['stop'] = `${b.planet}:${page - 1}`;
        btn.addEventListener('click', () => host.onTravel(b.planet, page - 1));
        block.append(btn);
      }
      body.append(block);
    }
    sheet.scroll.append(body);
    sheet.scroll.scrollTop = top;
  }

  refresh();
  return { sheet, refresh, close: () => sheet.remove() };
}
