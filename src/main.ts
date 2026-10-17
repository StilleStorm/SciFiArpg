import './style.css';
import { createBus, type Screen } from './core/events';
import { createLoop } from './core/loop';
import { createGame } from './game';
import { createInput } from './input';
import { bindPlaceholderNotes } from './narration/placeholder';
import { bindFx } from './render/bindings';
import { createCamera } from './render/camera';
import { initInk } from './render/ink';
import { installPaper } from './render/paper';
import { createWobble, getStage } from './render/stage';
import { tickTweens } from './render/tween';
import { loadMeta, saveMeta } from './save/save';
import { installTestHook } from './testHook';
import { createDeath } from './ui/death';
import { createFootnotes } from './ui/footnotes';
import { createHud } from './ui/hud';
import { createPads } from './ui/pads';
import { createTitle } from './ui/title';
import { PAGE_H, PAGE_W } from './world/pages';

const stage = getStage();
installPaper();
initInk(stage.fx);

const bus = createBus();
const camera = createCamera(stage.svg, stage.wobble, { w: PAGE_W, h: PAGE_H });
camera.resize();
const wobble = createWobble(stage);
let meta = loadMeta();
let screen: Screen = 'title';

// Router: title -> run -> death -> run
const input = createInput(stage.svg, (x, y) => game.onTap(x, y));
const game = createGame(stage, bus, camera, input);
const hud = createHud(stage.ui);
const footnotes = createFootnotes(stage.ui);
const pads = createPads(stage.ui, bus);
const title = createTitle(stage.ui, () => go('run'));
const death = createDeath(stage.ui, () => go('run'));

const freshSeed = (): number => (Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0;

function go(next: Screen, seed: number = freshSeed()): void {
  screen = next;
  const running = next === 'run';
  hud.el.classList.toggle('hidden', !running);
  footnotes.el.classList.toggle('hidden', !running);
  pads.classList.toggle('hidden', !running);
  if (next === 'title') {
    death.hide();
    input.setEnabled(false);
    title.show();
  } else if (next === 'run') {
    title.hide();
    death.hide();
    footnotes.reset();
    game.start(seed);
    hud.invalidate();
  } else {
    title.hide();
    death.show(game.state?.kills ?? 0);
  }
  bus.emit('screen:changed', { screen: next });
}

bindFx(bus, game.views);
bindPlaceholderNotes(bus);
bus.on('footnote', (e) => footnotes.add(e.text));
bus.on('player:died', () => {
  meta = { ...meta, runsCompleted: meta.runsCompleted + 1 };
  saveMeta(meta);
  loop.after(1, () => {
    if (screen === 'run') go('death');
  });
});

const loop = createLoop({
  update: (dt) => game.update(dt),
  render: (dt) => {
    tickTweens(dt * 1000);
    wobble.tick(dt * 1000);
    game.render(dt);
    if (screen === 'run' && game.state) hud.update(game.state);
  },
});

window.addEventListener('resize', () => {
  camera.resize();
  hud.invalidate();
});

installTestHook({ game, bus, getScreen: () => screen, go });
go('title');
loop.start();
