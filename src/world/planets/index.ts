/**
 * The registry of planet modules: importing this file once (testHook.ts, which main.ts loads, and the tests that need a planet's
 * content) registers each planet's clerk, side tickets and boss variant. A planet's record stays in world/campaign.ts and its
 * location data in `locations.ts`. S14 adds `./p3` here.
 */
import './p1';
import './p2';
