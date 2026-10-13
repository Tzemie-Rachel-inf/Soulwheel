# Soulwheel

Roll a soul. Send it into the world.

A wheel-spinning hero generator and life sim. Every part of a hero is rolled on a weighted wheel. The hero then lives one life, start to finish, in a persistent world with houses, a Demon Lord, a graveyard and a Hall of Fame. What the game is for and the rules it keeps are in [PRODUCT.md](PRODUCT.md).

## Running it

```bash
npm install
npm run dev
```

- `npm run build`: typecheck and build.
- `npx vitest run src`: the test suite.
- `npm run lint`: oxlint.

## Where things live

- `src/config/`: all game content: wheels, races, archetypes, powers, quests, stakes, fame. `gameConfig.ts` puts it together, and `src/engine/validate.ts` checks it at boot.
- `src/engine/`: the rules. Pure functions, with no React.
- `src/state/`: React hooks over the engine.
- `src/ui/`: components. The wheel is painted on a canvas in `ui/wheel/paintWheel.ts`.
- `src/devtools/`: the dev-only Wheels tab, plus the life simulator.

## Balance

After any content change, re-run the life simulator and compare it against the last report:

```bash
LIFE_SIM_OUT=report.json npx vitest run scripts/life-sim.test.ts
```

Reference docs are in `docs/`: the creation and adventure wheel trees, the stat ladders, a quest playtest, and design reviews.
