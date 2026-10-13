/**
 * Developer tools: the "Wheels" tab, for browsing, inspecting and spinning any wheel
 * without rolling a soul. Nothing it does touches the saved world.
 *
 * DEV_TOOLS_ENABLED is the one switch:
 *
 *   import.meta.env.DEV  on under `npm run dev`; `npm run build` leaves the tools out of
 *                        the bundle entirely (the lazy import below becomes dead code)
 *   false                hidden while developing too
 *   true                 shipped in builds as well
 *
 * To remove the tools for good, delete this folder and the lines in App.tsx that import it.
 */
import { lazy } from 'react';

export const DEV_TOOLS_ENABLED: boolean = import.meta.env.DEV;

export const WheelInspector = DEV_TOOLS_ENABLED ? lazy(() => import('./WheelInspector')) : null;
