# Soulwheel design system

## Product
Soulwheel: a wheel-spinning fantasy hero generator and life sim ("Roll a soul. Send it into the world."). Every attribute of a hero (ancestry, stats, weapon, armour, traits) is rolled on a weighted wheel; that one hero then lives one life in a persistent world. Single player, desktop and phone. Principles: every spin matters (the wheel and its result are always the centre of attention); odds are always shown honestly; the fantasy dresses the game and never hides a control or a number.

Key screen: Create tab. Left column: wheel title (Fell small caps, e.g. "Wheel of Ancestry") + subtitle, then a large canvas wheel (rarity-tinted slices with labels and lucide icons in roundels, gold rim with gilt studs, gules-red velvet SPIN hub in the centre, gold teardrop pointer at the top). When it lands: the other slices dim, and a result popup (gilt-framed ebony board) rises over the lower wheel: slice icon roundel, result name in Fell caps, "Wheel of X, a 1 in N chance", rarity word, italic flavour line, effect chips ("Race: Orc"), gold CONTINUE button and "Next: <next wheel>". Below: seed panel, then "Odds on this wheel" two-column list. Right column: the hero's gilt-framed card.

## World: a king's great hall at night (heraldic royal court)
Oxblood velvet ground with a faint damask; ebony panels framed in leaf gold with corner fleurons; heraldic banners (azure, gules) on a gilt rod. Corners are cut square (radius 1-2px), except round things (wheel, hub, studs, roundels).

## Colour (use only these)
- nave #380e17 page velvet · slab #1b1210 panels · slab-raised #2a1d17 · slab-hover #3a2a1e
- lead #5c4320 bronze borders · gilt #d2a542 · gilt-bright #f0cd6c · gilt-deep #8a6420
- candle #f4dc9a headings · vellum #ecdfc6 body · ash #b8a68a secondary · ink #241505 text on gold
- gules #8f1c2c / gules-bright #b52a3c (heraldic red) · azure #1c2f63 / azure-bright #2b4689
- ember #f2795f losses · moss #7fd0a6 gains
- Rarity colours: common (slice's own tint, no label), uncommon green #5fcf8f, rare blue #5aa9ff, epic violet #bd85ff, legendary amber #ffb84d, mythical pink #ff7ad1.

## Type
- Display / titles: IM Fell English SC (Google Fonts)
- Wordmark only: UnifrakturMaguntia
- Body: Alegreya; labels and buttons: Alegreya SC
No other fonts.

## Components
- Gilt button: flat gold plaque (#d2a542), 1px gilt-deep border, inset keylines, Alegreya SC bold, ink text, square.
- Plaque button: ebony gradient, bronze border, gold hairline.
- Court panel: ebony board, leaf-gold frame, corner fleurons.
- Pennon: small swallowtail flag in the result's tint, edged in gold, hanging off a board's top edge.

## Motion
Ease cubic-bezier(0.16,1,0.3,1). Spin is 5-7 turns easing to a stop; the pointer kicks on each slice boundary with a tick sound; dramatic slow-down near big prizes; occasional near miss ("So close! Angel was right there."); landing bursts for rare+ results; hammer bumps for banked stat bonuses. Reduced motion honoured.

## Direction for this round: casino mechanics, court look
Borrow the engagement mechanics of casino wheels and slot machines, rendered entirely in this court palette and type (no neon, no new fonts, no felt-green unless from the palette):
- marquee bulbs set into the gold rim that chase while spinning and flash on the landed slice
- a heavier, clacking pointer; pegs between slices
- build-up as the wheel slows (bulbs slowing, light narrowing to the pointer)
- jackpot-style reveal for rare+ results: a bigger plaque, coin/gilt-spark shower, odds shown as the "payout" ("1 in 50!")
- the odds stay visible and honest at all times.
