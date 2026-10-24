/**
 * Fills the face lookup (`state.ts`) from the registry. Imported once by the game (`game.ts`) after the heroes, and by tests that
 * want the real faces. Kept apart so that the combat code, the renderer and the core never import the registry themselves
 * (the face modules reach the hero registry at load time; see the note in `state.ts`).
 */
import { faceAssemblyOf } from './faces/assembly';
import { faceFor, faceKeys } from './index';
import { setFaceLookup } from './state';

setFaceLookup({ faceFor, faceKeys, assemblyOf: (figure, seed) => faceAssemblyOf(figure, seed) });
