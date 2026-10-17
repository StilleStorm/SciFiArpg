/** Paper grain: one tiny SVG tile, used as a CSS variable (bands, screens) and as the in-world pattern. */
function tileSvg(): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">` +
    `<filter id="n" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" seed="11"/>` +
    `<feColorMatrix type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.33  0 0 0 0 0.2  0 0 0 1.6 -0.97"/>` +
    `</filter><rect width="256" height="256" filter="url(#n)"/></svg>`
  );
}

export function paperTileUri(): string {
  return `data:image/svg+xml,${encodeURIComponent(tileSvg())}`;
}

export function installPaper(): void {
  const uri = paperTileUri();
  document.documentElement.style.setProperty('--paper-noise', `url("${uri}")`);
  document.getElementById('paper-tile')?.setAttribute('href', uri);
}
