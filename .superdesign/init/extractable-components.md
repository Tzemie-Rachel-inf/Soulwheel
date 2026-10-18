# Extractable Components

## Layout Components

## AppHeader
- Source: `src/App.tsx` (header block + GiltRod, Crest, TabBar)
- Category: layout
- Description: Gilt rod with finials; crest SVG + blackletter "Soulwheel" wordmark and italic tagline at left; four hanging swallowtail banner tabs (azure, active one gules and longer) at right; sound toggle plaque.
- Extractable props: activeTab (string, default: "create")
- Hardcoded: crest SVG, wordmark text, tagline, tab labels, banner CSS

## HeroBar
- Source: `src/ui/HeroBar.tsx`
- Category: layout
- Description: Phone-only bottom bar (hero name, ancestry/archetype, CP) that opens the hero card as a sheet.
- Extractable props: none needed for desktop drafts
- Hardcoded: all CSS

## Basic Components

## GiltButton
- Source: `src/ui/RollReveal.tsx` (primaryButton -> .btn-gilt in src/index.css)
- Category: basic
- Description: Flat gold plaque button, Alegreya SC bold, ink text, square corners.

## PlaqueButton
- Source: `src/ui/RollReveal.tsx` (secondaryButton -> .btn-plaque)
- Category: basic
- Description: Ebony plaque button with bronze border and gold hairline.

## CourtPanel
- Source: `src/index.css` (.court-panel)
- Category: basic
- Description: Ebony board in a leaf-gold frame with corner fleurons; container for reveal and cards.

## SpinWheel
- Source: `src/ui/wheel/SpinWheel.tsx` + `src/ui/wheel/paintWheel.ts`
- Category: basic
- Description: Canvas wheel: rarity-tinted slices with labels and %, gold rim with gem band, gules velvet hub, pointer at top, Spin button below.
- Extractable props: spinning (boolean), winnerIndex (number|null)
