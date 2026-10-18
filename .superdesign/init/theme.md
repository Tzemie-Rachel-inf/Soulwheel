# Theme

## Part 1 — Token summary

World: a king's great hall at night. Oxblood velvet page with faint damask, ebony panels framed in leaf gold with corner fleurons, heraldic banners (azure, gules active) on a gilt rod. Square corners (radius 1-2px).

Fonts: display `IM Fell English SC` (titles, small caps); wordmark only `UnifrakturMaguntia`; body `Alegreya`; labels `Alegreya SC`. (Google Fonts.)

Colors:
- nave #380e17 (page, oxblood velvet) · slab #1b1210 (ebony panels) · slab-raised #2a1d17 · slab-hover #3a2a1e
- lead #5c4320 (bronze borders) · candle #f4dc9a (headings) · vellum #ecdfc6 (body) · ash #b8a68a (secondary) · ink #241505 (text on gold)
- gilt #d2a542 · gilt-bright #f0cd6c · gilt-deep #8a6420
- gules #8f1c2c · gules-bright #b52a3c · azure #1c2f63 · azure-bright #2b4689
- ember #f2795f (losses) · moss #7fd0a6 (gains)
- Rarity tints on wheel slices/reveal (src/ui/rarity.ts) with twinkle stars, pulse glow, shimmer text.

Shadows: dark offset drop shadows (0 3px 8px -2px rgba(0,0,0,.7)); gold glow text-shadow on titles (0 0 22px rgba(240,205,108,.16)).
Motion: framer-motion; ease cubic-bezier(0.16,1,0.3,1); reveal enters 300ms; landing burst + hammer upgrade on wheel; banner sway; prefers-reduced-motion honoured.
Breakpoints: Tailwind defaults (sm 640, lg 1024 two-column).

## Part 2 — Raw source

### `src/index.css`

```css
@import 'tailwindcss';

/*
 * Design tokens. A king's great hall at night: oxblood velvet on the walls, ebony boards
 * framed in leaf gold, and heraldic banners (azure, gules, or) hanging from gilt rods.
 * The token names are the old ones so every component picks up the new hall.
 */
@theme {
  --font-display: 'IM Fell English SC', 'Iowan Old Style', Georgia, serif;
  --font-blackletter: 'UnifrakturMaguntia', 'IM Fell English SC', Georgia, serif;
  --font-sans: 'Alegreya', 'Iowan Old Style', Georgia, serif;
  --font-caps: 'Alegreya SC', 'Alegreya', Georgia, serif;

  /* Heraldry is cut square. */
  --radius-sm: 1px;
  --radius: 2px;
  --radius-md: 2px;

  --color-nave: #380e17; /* page: oxblood velvet */
  --color-slab: #1b1210; /* panels: ebony boards */
  --color-slab-raised: #2a1d17;
  --color-slab-hover: #3a2a1e;
  --color-lead: #5c4320; /* bronze: borders and rules */
  --color-candle: #f4dc9a; /* headings and emphasis: candlelit gold */
  --color-vellum: #ecdfc6; /* body text: ivory */
  --color-ash: #b8a68a; /* secondary text */
  --color-ink: #241505; /* text on gilt */
  --color-gilt: #d2a542;
  --color-gilt-bright: #f0cd6c;
  --color-gilt-deep: #8a6420;
  --color-gules: #8f1c2c; /* heraldic red */
  --color-gules-bright: #b52a3c;
  --color-azure: #1c2f63; /* heraldic blue */
  --color-azure-bright: #2b4689;
  --color-ember: #f2795f; /* losses, warnings, the Demon Lord */
  --color-moss: #7fd0a6; /* gains */

  /* Combat Power breakdown. Validated as a categorical set on the slab surface. */
  --color-cp-stats: #c99a35;
  --color-cp-stats-track: #3d2e18;
  --color-cp-weapon: #3aa58b;
  --color-cp-weapon-track: #1f3a33;
  --color-cp-armor: #739ddb;
  --color-cp-armor-track: #26304a;
  --color-cp-traits: #9682ee;
}

/*
 * The page ground and body type sit outside @layer on purpose: a host that wraps the page
 * (the published artifact does) brings its own unlayered body styles, and those beat any layer.
 */
:root {
  color-scheme: dark;
}

@layer base {
  html {
    scrollbar-color: var(--color-gilt-deep) var(--color-nave);
    /* Players name their heroes: a 40-letter name with no spaces must wrap, never push a panel wide. */
    overflow-wrap: break-word;
  }
}

body {
  margin: 0;
  /* Diapered velvet: a faint lozenge lattice, a quatrefoil in each lozenge, gold points at the crossings. */
  background-color: var(--color-nave);
  background-image:
    radial-gradient(ellipse 130% 100% at 50% 0%, rgba(0, 0, 0, 0) 50%, rgba(14, 3, 6, 0.45) 100%),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56' viewBox='0 0 56 56'%3E%3Cpath d='M28 0 56 28 28 56 0 28Z' fill='none' stroke='%23d2a542' stroke-opacity='.07' stroke-width='1'/%3E%3Cpath d='M28 22c2 3 4 5 6 6-2 1-4 3-6 6-2-3-4-5-6-6 2-1 4-3 6-6Z' fill='%23d2a542' fill-opacity='.08'/%3E%3Ccircle cx='0' cy='28' r='1.6' fill='%23d2a542' fill-opacity='.14'/%3E%3Ccircle cx='56' cy='28' r='1.6' fill='%23d2a542' fill-opacity='.14'/%3E%3Ccircle cx='28' cy='0' r='1.6' fill='%23d2a542' fill-opacity='.14'/%3E%3Ccircle cx='28' cy='56' r='1.6' fill='%23d2a542' fill-opacity='.14'/%3E%3C/svg%3E");
  background-attachment: fixed;
  color: var(--color-vellum);
  font-family: var(--font-sans);
  font-size: 1.0625rem;
  line-height: 1.5;
  font-variant-numeric: lining-nums;
  /* Alegreya defaults to old-style figures; numbers here are data, so they stand on the line. */
  font-feature-settings: 'lnum' 1;
  -webkit-font-smoothing: antialiased;
}

@layer base {
  ::selection {
    background: var(--color-gules-bright);
    color: var(--color-candle);
  }

  :focus-visible {
    outline: 2px solid var(--color-gilt-bright);
    outline-offset: 3px;
  }

  input,
  textarea {
    caret-color: var(--color-gilt-bright);
  }

  button:not(:disabled) {
    cursor: pointer;
  }

  ::-webkit-scrollbar {
    width: 12px;
    height: 12px;
  }
  ::-webkit-scrollbar-track {
    background: var(--color-nave);
  }
  ::-webkit-scrollbar-thumb {
    background: linear-gradient(90deg, var(--color-gilt-deep), var(--color-gilt), var(--color-gilt-deep));
    border: 3px solid var(--color-nave);
  }
}

@layer components {
  /*
   * A gilt-framed board: ebony inside a thin gold moulding, a second hairline set in,
   * and a gold corner piece at each corner. The frame's corners are drawn, not rounded.
   */
  .court-panel {
    position: relative;
    border: 1px solid var(--color-gilt-deep) !important;
    border-radius: 0 !important;
    background-color: var(--color-slab);
    background-image: linear-gradient(180deg, rgba(240, 205, 108, 0.05), rgba(0, 0, 0, 0) 45%);
    box-shadow:
      var(--panel-glow, 0 0 0 transparent),
      inset 0 0 0 3px var(--color-slab),
      inset 0 0 0 4px rgba(210, 165, 66, 0.32),
      0 12px 26px -10px rgba(0, 0, 0, 0.8),
      0 2px 4px rgba(0, 0, 0, 0.5);
  }
  .court-panel::before {
    content: '';
    position: absolute;
    inset: -3px;
    pointer-events: none;
    z-index: 1;
    background:
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'%3E%3Cpath d='M1 1h12' stroke='%23f0cd6c' stroke-width='1.6'/%3E%3Cpath d='M1 1v12' stroke='%23f0cd6c' stroke-width='1.6'/%3E%3Cpath d='M8.2 8.2C6.6 5.2 7.4 3 9.6 2.6 9.8 4.6 9.4 6.6 8.2 8.2Z' fill='%23f0cd6c' stroke='%235c4320' stroke-width='.5'/%3E%3Cpath d='M8.2 8.2C5.2 6.6 3 7.4 2.6 9.6 4.6 9.8 6.6 9.4 8.2 8.2Z' fill='%23f0cd6c' stroke='%235c4320' stroke-width='.5'/%3E%3Cpath d='M8.2 8.2C9.6 11.6 12.4 12.6 14.6 11.2 13.4 9.2 10.8 7.8 8.2 8.2Z' fill='%23f0cd6c' stroke='%235c4320' stroke-width='.5'/%3E%3Ccircle cx='8.2' cy='8.2' r='1.3' fill='%23fff0bd' stroke='%235c4320' stroke-width='.4'/%3E%3C/svg%3E") top left / 20px 20px no-repeat,
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'%3E%3Cg transform='rotate(90 10 10)'%3E%3Cpath d='M1 1h12' stroke='%23f0cd6c' stroke-width='1.6'/%3E%3Cpath d='M1 1v12' stroke='%23f0cd6c' stroke-width='1.6'/%3E%3Cpath d='M8.2 8.2C6.6 5.2 7.4 3 9.6 2.6 9.8 4.6 9.4 6.6 8.2 8.2Z' fill='%23f0cd6c' stroke='%235c4320' stroke-width='.5'/%3E%3Cpath d='M8.2 8.2C5.2 6.6 3 7.4 2.6 9.6 4.6 9.8 6.6 9.4 8.2 8.2Z' fill='%23f0cd6c' stroke='%235c4320' stroke-width='.5'/%3E%3Cpath d='M8.2 8.2C9.6 11.6 12.4 12.6 14.6 11.2 13.4 9.2 10.8 7.8 8.2 8.2Z' fill='%23f0cd6c' stroke='%235c4320' stroke-width='.5'/%3E%3Ccircle cx='8.2' cy='8.2' r='1.3' fill='%23fff0bd' stroke='%235c4320' stroke-width='.4'/%3E%3C/g%3E%3C/svg%3E") top right / 20px 20px no-repeat,
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'%3E%3Cg transform='rotate(180 10 10)'%3E%3Cpath d='M1 1h12' stroke='%23f0cd6c' stroke-width='1.6'/%3E%3Cpath d='M1 1v12' stroke='%23f0cd6c' stroke-width='1.6'/%3E%3Cpath d='M8.2 8.2C6.6 5.2 7.4 3 9.6 2.6 9.8 4.6 9.4 6.6 8.2 8.2Z' fill='%23f0cd6c' stroke='%235c4320' stroke-width='.5'/%3E%3Cpath d='M8.2 8.2C5.2 6.6 3 7.4 2.6 9.6 4.6 9.8 6.6 9.4 8.2 8.2Z' fill='%23f0cd6c' stroke='%235c4320' stroke-width='.5'/%3E%3Cpath d='M8.2 8.2C9.6 11.6 12.4 12.6 14.6 11.2 13.4 9.2 10.8 7.8 8.2 8.2Z' fill='%23f0cd6c' stroke='%235c4320' stroke-width='.5'/%3E%3Ccircle cx='8.2' cy='8.2' r='1.3' fill='%23fff0bd' stroke='%235c4320' stroke-width='.4'/%3E%3C/g%3E%3C/svg%3E") bottom right / 20px 20px no-repeat,
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'%3E%3Cg transform='rotate(270 10 10)'%3E%3Cpath d='M1 1h12' stroke='%23f0cd6c' stroke-width='1.6'/%3E%3Cpath d='M1 1v12' stroke='%23f0cd6c' stroke-width='1.6'/%3E%3Cpath d='M8.2 8.2C6.6 5.2 7.4 3 9.6 2.6 9.8 4.6 9.4 6.6 8.2 8.2Z' fill='%23f0cd6c' stroke='%235c4320' stroke-width='.5'/%3E%3Cpath d='M8.2 8.2C5.2 6.6 3 7.4 2.6 9.6 4.6 9.8 6.6 9.4 8.2 8.2Z' fill='%23f0cd6c' stroke='%235c4320' stroke-width='.5'/%3E%3Cpath d='M8.2 8.2C9.6 11.6 12.4 12.6 14.6 11.2 13.4 9.2 10.8 7.8 8.2 8.2Z' fill='%23f0cd6c' stroke='%235c4320' stroke-width='.5'/%3E%3Ccircle cx='8.2' cy='8.2' r='1.3' fill='%23fff0bd' stroke='%235c4320' stroke-width='.4'/%3E%3C/g%3E%3C/svg%3E") bottom left / 20px 20px no-repeat;
  }

  /* Primary: a plaque of or (heraldic gold), keylined in deep gilt. Flat, as a tincture is. */
  /* Phones: the hero's bar along the bottom edge (HeroBar.tsx), an ebony board under a gilt rule. */
  .hero-bar {
    background: linear-gradient(180deg, var(--color-slab-raised), var(--color-slab) 70%);
    border-top: 1px solid var(--color-gilt-deep);
    box-shadow:
      inset 0 1px 0 rgba(240, 205, 108, 0.22),
      inset 0 3px 0 var(--color-slab-raised),
      inset 0 4px 0 rgba(210, 165, 66, 0.18),
      0 -12px 26px -10px rgba(0, 0, 0, 0.85);
    transition: background-color 0.15s;
    -webkit-tap-highlight-color: transparent;
  }
  .hero-bar:active {
    background: var(--color-slab-hover);
  }

  /* …and the sheet it opens: the full card, rising from the bottom edge. */
  .hero-sheet {
    margin: auto 0 0;
    padding: 0;
    width: 100%;
    max-width: none;
    max-height: 88svh;
    border: 0;
    background: transparent;
    color: inherit;
    overflow: visible;
  }
  .hero-sheet::backdrop {
    background: rgba(14, 3, 6, 0.72);
  }
  .hero-sheet-panel {
    max-height: 88svh;
    overflow-y: auto;
    overscroll-behavior: contain;
    background: var(--color-slab);
    border-top: 1px solid var(--color-gilt-deep);
    box-shadow:
      inset 0 1px 0 rgba(240, 205, 108, 0.22),
      0 -16px 40px -12px rgba(0, 0, 0, 0.9);
  }
  .hero-sheet[open] .hero-sheet-panel {
    animation: sheet-rise 320ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .btn-gilt {
    border: 1px solid var(--color-gilt-deep);
    border-radius: 0;
    background: var(--color-gilt);
    color: var(--color-ink);
    font-family: var(--font-caps);
    font-weight: 700;
    letter-spacing: 0.03em;
    box-shadow:
      inset 0 0 0 2px var(--color-gilt),
      inset 0 0 0 3px rgba(36, 21, 5, 0.35),
      0 3px 8px -2px rgba(0, 0, 0, 0.7);
    transition:
      background-color 0.15s,
      transform 0.15s;
  }
  .btn-gilt:not(:disabled):hover {
    background: var(--color-gilt-bright);
    box-shadow:
      inset 0 0 0 2px var(--color-gilt-bright),
      inset 0 0 0 3px rgba(36, 21, 5, 0.35),
      0 3px 8px -2px rgba(0, 0, 0, 0.7);
  }
  .btn-gilt:not(:disabled):active {
    transform: translateY(1px);
  }
  .btn-gilt:disabled {
    filter: grayscale(0.7) brightness(0.7);
  }

  /* Secondary: an ebony plaque with gold hairline trim. */
  .btn-plaque {
    border: 1px solid var(--color-lead);
    border-radius: 0;
    background: linear-gradient(180deg, var(--color-slab-raised), var(--color-slab));
    color: var(--color-vellum);
    box-shadow:
      inset 0 0 0 1px rgba(210, 165, 66, 0.12),
      0 2px 6px -2px rgba(0, 0, 0, 0.6);
    transition:
      border-color 0.15s,
      color 0.15s;
  }
  /* A chosen plaque: gules field, gilt edge. */
  .btn-plaque-on,
  .btn-plaque-on:not(:disabled):hover {
    border-color: var(--color-gilt);
    background: var(--color-gules);
    color: var(--color-candle);
  }
  .btn-plaque:not(:disabled):hover {
    border-color: var(--color-gilt);
    color: var(--color-candle);
    background: linear-gradient(180deg, var(--color-slab-hover), var(--color-slab-raised));
  }

  /* A gilt rule fading out at both ends, with whatever sits inside it (a lozenge, a word) at the centre. */
  .gilt-rule {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: var(--color-gilt);
  }
  .gilt-rule::before,
  .gilt-rule::after {
    content: '';
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, rgba(210, 165, 66, 0), var(--color-gilt) 35%, var(--color-gilt) 65%, rgba(210, 165, 66, 0));
  }

  /*
   * The tabs: heraldic banners hanging from the gilt rod. The button is the gold edging,
   * cut swallowtail; the cloth inside is azure, or gules for the banner you stand under,
   * which also hangs longer. Drop shadows sit on the rail because a clip would cut them.
   */
  .banner-rail {
    align-items: flex-start;
    filter: drop-shadow(0 6px 6px rgba(0, 0, 0, 0.6));
    margin-top: -0.3rem;
  }
  .banner {
    --tail: 0.85rem;
    display: block;
    padding: 0 2px 2px;
    border: 0;
    background: linear-gradient(180deg, #fff0bd, var(--color-gilt) 30%, var(--color-gilt-deep));
    clip-path: polygon(0 0, 100% 0, 100% 100%, 50% calc(100% - var(--tail)), 0 100%);
    transform-origin: 50% 0;
  }
  .banner:focus-visible {
    outline: none;
  }
  .banner-cloth {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 5.5rem;
    padding: 1rem 0.9rem calc(var(--tail) + 0.7rem);
    color: var(--color-vellum);
    /* Layers, top to bottom: the fringe's heading band and its gold threads along the tail, a gilt hem under the rod, the cloth. */
    background:
      linear-gradient(var(--color-gilt-deep), var(--color-gilt-deep)) 0 calc(100% - var(--tail) - 0.4rem) / 100% 2px no-repeat,
      repeating-linear-gradient(90deg, var(--color-gilt-bright) 0 1.5px, var(--color-gilt-deep) 1.5px 2.5px, transparent 2.5px 4px) 0 100% / 100% calc(var(--tail) + 0.4rem) no-repeat,
      linear-gradient(var(--color-gilt), var(--color-gilt)) 0 0.45rem / 100% 1px no-repeat,
      linear-gradient(180deg, var(--color-azure-bright), var(--color-azure) 70%, #13214a);
    clip-path: polygon(0 0, 100% 0, 100% 100%, 50% calc(100% - var(--tail) + 1px), 0 100%);
    transition:
      padding 0.25s cubic-bezier(0.16, 1, 0.3, 1),
      color 0.15s;
  }
  .banner:hover .banner-cloth {
    color: var(--color-candle);
    padding-bottom: calc(var(--tail) + 1rem);
  }
  .banner:focus-visible .banner-cloth {
    outline: 2px solid var(--color-gilt-bright);
    outline-offset: -6px;
  }
  .banner-active .banner-cloth,
  .banner-active:hover .banner-cloth {
    color: var(--color-candle);
    padding-bottom: calc(var(--tail) + 1.6rem);
    background:
      linear-gradient(var(--color-gilt-deep), var(--color-gilt-deep)) 0 calc(100% - var(--tail) - 0.4rem) / 100% 2px no-repeat,
      repeating-linear-gradient(90deg, var(--color-gilt-bright) 0 1.5px, var(--color-gilt-deep) 1.5px 2.5px, transparent 2.5px 4px) 0 100% / 100% calc(var(--tail) + 0.4rem) no-repeat,
      linear-gradient(var(--color-gilt), var(--color-gilt)) 0 0.45rem / 100% 1px no-repeat,
      linear-gradient(180deg, var(--color-gules-bright), var(--color-gules) 65%, #5e0f1b);
  }
  /* A gold lozenge charged on each banner, larger on the one you stand under. */
  .banner-charge {
    display: block;
    width: 0.4rem;
    height: 0.4rem;
    margin-top: 0.45rem;
    background: var(--color-gilt);
    transform: rotate(45deg);
    opacity: 0.6;
  }
  .banner-active .banner-charge {
    width: 0.6rem;
    height: 0.6rem;
    opacity: 1;
    box-shadow: 0 0 8px rgba(240, 205, 108, 0.7);
  }
  .banner-sway {
    /* Freshly stood under: it drops longer and swings on its rings, then joins the draught. */
    animation:
      banner-settle 900ms cubic-bezier(0.16, 1, 0.3, 1),
      banner-sway 7s ease-in-out 900ms infinite;
  }
  @media (max-width: 40rem) {
    .banner-cloth {
      min-width: 0;
      padding-inline: 0.25rem;
    }
  }

  /* A small swallowtail pennon in a slice's colour, edged in gold, hanging off a board's top edge. */
  .pennon {
    position: absolute;
    top: -1px;
    right: 1.5rem;
    z-index: 2;
    width: 1.6rem;
    height: 3rem;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(0, 0, 0, 0) 40%, rgba(0, 0, 0, 0.3)),
      var(--tincture, var(--color-gules));
    border: 2px solid var(--color-gilt);
    border-top-width: 4px;
    clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 72%, 0 100%);
    filter: drop-shadow(0 3px 3px rgba(0, 0, 0, 0.6));
  }

  /* Titles in Fell small caps, lifted off the velvet. */
  .court-title {
    font-family: var(--font-display);
    color: var(--color-candle);
    text-shadow:
      0 2px 0 rgba(0, 0, 0, 0.55),
      0 0 22px rgba(240, 205, 108, 0.16);
  }
}

/*
 * Rarity effects. On the wheel: stars twinkling in the rim's gem band, and light pulsing
 * behind epic and legendary glass. In the reveal: a shimmer across the winner's name.
 */
@keyframes rarity-twinkle {
  0%,
  100% {
    opacity: 0.1;
    transform: scale(0.45) rotate(0deg);
  }
  50% {
    opacity: 1;
    transform: scale(1) rotate(45deg);
  }
}

@keyframes rarity-pulse {
  0%,
  100% {
    opacity: 0;
  }
  50% {
    opacity: var(--glow, 0.3);
  }
}

@keyframes rarity-shimmer {
  from {
    background-position: 160% 0;
  }
  to {
    background-position: -60% 0;
  }
}

/* A banner just hung: a swing that dies away. --swing is 1 or -1, the way the player moved. */
@keyframes banner-settle {
  0% {
    transform: rotate(calc(var(--swing, 1) * 3deg));
  }
  35% {
    transform: rotate(calc(var(--swing, 1) * -1.6deg));
  }
  65% {
    transform: rotate(calc(var(--swing, 1) * 0.8deg));
  }
  100% {
    transform: rotate(-0.6deg);
  }
}

/* A panel arriving under a new banner: up out of the velvet, quickly. */
@keyframes panel-enter {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}
.panel-enter {
  animation: panel-enter 240ms cubic-bezier(0.16, 1, 0.3, 1);
}

/*
 * A new wheel's title, lettered in from the left behind a soft edge of light, then its
 * subtitle. The mask lives only in the keyframes, so nothing is left on the title after.
 */
@keyframes inscribe {
  from {
    -webkit-mask-image: linear-gradient(90deg, #000 40%, transparent 60%);
    mask-image: linear-gradient(90deg, #000 40%, transparent 60%);
    -webkit-mask-size: 250% 100%;
    mask-size: 250% 100%;
    -webkit-mask-position: 100% 0;
    mask-position: 100% 0;
  }
  to {
    -webkit-mask-image: linear-gradient(90deg, #000 40%, transparent 60%);
    mask-image: linear-gradient(90deg, #000 40%, transparent 60%);
    -webkit-mask-size: 250% 100%;
    mask-size: 250% 100%;
    -webkit-mask-position: 0 0;
    mask-position: 0 0;
  }
}
@keyframes inscribe-after {
  from {
    opacity: 0;
  }
}
.inscribe {
  animation: inscribe 560ms cubic-bezier(0.16, 1, 0.3, 1);
}
.inscribe-after {
  animation: inscribe-after 300ms ease-out 180ms backwards;
}

/* A banner stirring in the draught of the hall. Pivots from the rod. */
@keyframes banner-sway {
  0%,
  100% {
    transform: rotate(-0.6deg);
  }
  50% {
    transform: rotate(0.6deg);
  }
}

.rarity-twinkle {
  transform-box: fill-box;
  transform-origin: center;
  animation: rarity-twinkle 2s ease-in-out infinite;
}

.rarity-pulse {
  animation: rarity-pulse 3s ease-in-out infinite;
}

/* Candle-coloured text with a band of rarity light sweeping across it every few seconds. */
.rarity-shimmer {
  background-image: linear-gradient(
    100deg,
    var(--color-candle) 40%,
    var(--shine, #fff) 50%,
    var(--color-candle) 60%
  );
  background-size: 250% 100%;
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  animation: rarity-shimmer 3.2s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }

  /* Infinite loops at 0.01ms would strobe. Hold the effects still instead. */
  .rarity-twinkle,
  .rarity-pulse,
  .rarity-shimmer,
  .banner-sway {
    animation: none !important;
  }
  .rarity-twinkle {
    opacity: 0.85;
  }
  .rarity-pulse {
    opacity: calc(var(--glow, 0.3) * 0.6);
  }
  .rarity-shimmer {
    color: var(--color-candle);
    background: none;
  }

  /* No swing and no travel: a new title or panel simply fades in. */
  .inscribe,
  .panel-enter {
    animation: inscribe-after 200ms ease-out !important;
  }
}

@keyframes sheet-rise {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

/* Scrolls, but shows no bar (the result popup). */
.no-scrollbar {
  scrollbar-width: none;
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

```

### `vite.config.ts`

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        // Three chunks, all loaded at once, split by how often they change: libraries rarely, the
        // game (engine and wheel content) whenever a wheel is tuned, the app whenever the screen is.
        // A returning player re-downloads only what changed. The game never imports the app, so the
        // chunks never import each other in a circle.
        codeSplitting: {
          groups: [
            { name: 'vendor', test: /node_modules/, priority: 20 },
            { name: 'game', test: /[\\/]src[\\/](engine|config)[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
});

```
