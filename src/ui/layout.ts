import type { Settings } from '../save/save';
import './landscape.css';

/**
 * Orientation and steering (DESIGN 2). The layout follows the viewport as it really is: `data-orient` on <html>
 * is "landscape" when the window is wider than tall. The setting "Orientacja" asks the Screen Orientation API for
 * a lock where the platform has one (an installed app on Android); everywhere else, iOS included, the phone
 * decides and the setting is only remembered.
 */
export type Orient = 'landscape' | 'portrait';
export type Steering = 'joystick' | 'tap';

/** Wider than tall is landscape; a square window counts as portrait (the layout the game was built in). */
export function orientationOf(width: number, height: number): Orient {
  return width > height ? 'landscape' : 'portrait';
}

/** Joystick under the thumb in landscape, a tap on the page in portrait. */
export function defaultSteering(orient: Orient): Steering {
  return orient === 'landscape' ? 'joystick' : 'tap';
}

type SteeringSettings = Pick<Settings, 'steering' | 'steeringTouched'>;

/** The player's choice once he has made one; before that the orientation decides. */
export function effectiveSteering(settings: SteeringSettings, orient: Orient): Steering {
  return settings.steeringTouched === true && settings.steering ? settings.steering : defaultSteering(orient);
}

/** The orientation the player asked for; landscape unless he changed it. */
export function orientationSetting(settings: Pick<Settings, 'orientation'>): Orient {
  return settings.orientation ?? 'landscape';
}

let current: Orient = 'portrait';

export function currentOrient(): Orient {
  return current;
}

function viewportOrient(): Orient {
  return orientationOf(window.innerWidth, window.innerHeight);
}

/** Write the viewport's orientation on <html> and return it. */
export function applyOrient(): Orient {
  current = viewportOrient();
  document.documentElement.setAttribute('data-orient', current);
  return current;
}

/** `data-steer` on <html>: the style sheet moves the Załączniki pad out of the steering half. */
export function applySteering(steering: Steering): void {
  document.documentElement.setAttribute('data-steer', steering);
}

/**
 * Set `data-orient` now and keep it right on resize and orientationchange. `onChange` runs only when the
 * orientation really flips (the camera and the HUD are measured again by the caller on every resize anyway).
 */
export function initLayout(onChange: (orient: Orient) => void): () => void {
  const update = (): void => {
    const before = current;
    const now = applyOrient();
    if (now !== before) onChange(now);
  };
  current = viewportOrient();
  document.documentElement.setAttribute('data-orient', current);
  const later = (): void => {
    // some browsers report the old size for a moment after a rotation: look again on the next two frames
    requestAnimationFrame(() => requestAnimationFrame(update));
  };
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', later);
  screen.orientation?.addEventListener?.('change', later);
  return () => {
    window.removeEventListener('resize', update);
    window.removeEventListener('orientationchange', later);
    screen.orientation?.removeEventListener?.('change', later);
  };
}

export type LockResult = 'locked' | 'unsupported' | 'refused';

interface LockableOrientation {
  lock?: (kind: string) => Promise<void>;
}

/** True when the browser exposes `screen.orientation.lock` at all (it may still refuse outside an installed app). */
export function lockSupported(): boolean {
  const o = (typeof screen === 'undefined' ? undefined : screen.orientation) as LockableOrientation | undefined;
  return typeof o?.lock === 'function';
}

/** Ask for the lock. Never throws: unsupported platforms and refusals come back as a word. */
export async function lockOrientation(orient: Orient): Promise<LockResult> {
  if (!lockSupported()) return 'unsupported';
  try {
    const o = screen.orientation as unknown as LockableOrientation;
    await o.lock?.(orient);
    return 'locked';
  } catch {
    return 'refused';
  }
}
