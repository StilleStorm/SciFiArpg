/**
 * Audio facade for main.ts: unlock on the first gesture, bind the bus, follow the settings.
 * Everything here is safe when Web Audio is missing or blocked: no call throws, nothing is heard.
 */
import type { Bus } from '../core/events';
import { bindAudio, type AudioBindings, type AudioDeps } from './bindings';
import { installUnlock, setVolumes as setBusVolumes, unlockAudio } from './context';
import { play } from './sfx';

export { unlockAudio, setVolumes } from './context';

export interface Audio extends AudioBindings {
  /** Music and SFX volume, 0..100. */
  setVolumes(music: number, sfx: number): void;
  /** A short key click so the SFX slider can be judged by ear. */
  preview(): void;
}

export function createAudio(bus: Bus, deps: AudioDeps): Audio {
  installUnlock();
  const bound = bindAudio(bus, deps);
  return {
    frame: bound.frame,
    setVolumes: setBusVolumes,
    preview() {
      unlockAudio();
      play('hit');
    },
  };
}
