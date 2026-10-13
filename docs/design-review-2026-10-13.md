# Soulwheel design review (2026-10-13)

How I did it: I played the dev build at 1440×1000 and at phone width (375). I rolled one hero all the way through creation (Mogra the Indomitable, orc ranger, 13 spins), took them on two adventures, and opened the Chronicle and the dev Wheels tab. I also read PRODUCT.md, App.tsx and the docs/ trees. These notes are judgement, not test results. Anything marked **verify** is something I saw once and haven't traced in the code.

## Verdict

The foundation is unusually strong: clear principles, a data-driven engine, honest odds and a distinctive look. The weak point is the **payoff per spin once the hero is on the road**. The wheels look important, but many results are small stat nudges that don't change the story. Three things undercut the "Every spin matters" principle: the flow around the wheel (scrolling, a buried log), dense wheels you can't read, and a slow fame curve.

---

## What works (keep it)

- **Principles that are written down and followed.** PRODUCT.md is short, specific and testable ("odds are always shown", "one life at a time"). Most of the UI visibly obeys it.
- **Honest odds are a real feature.** Locked options give the reason and where the hero stands, e.g. *"Only for the Famous (32 fame). They are Unknown, with 0."* This is the best UI copy in the game. It turns a lock into a goal.
- **The hammer-up mechanic** (banked stat bonuses push a result up the ladder, and "past the top, into Ascension") is legible and satisfying. The "hammered up from Slow-Witted" note in the path is a nice touch.
- **Visual identity.** The gilt rod with hanging swallowtail banners, the crest, the ebony panels in gilt frames and the gold wheel rim make a coherent royal-court look that doesn't read as a template. The active banner is clear. On phone, the tabs still fit on one row.
- **Tooling discipline.** The config validator runs at boot, there's a life simulator with baseline numbers, generated docs (creation and adventure trees, stat ladders), and a dev wheel inspector with Normal, Fast and Instant speeds. This is how you tune a random game well.
- **The world has texture.** Seasons, world events ("Festival season, 2 seasons left"), threat, houses and the graveyard give the single hero a backdrop.

---

## Game design

### 1. Adventures are often too short to feel like adventures — high
- Adventure 1 was **Study → History and Letters**: 2 spins, +2 Intellect, +2 fame, home.
- Adventure 2 was **Learn a New Power → The Abyss → Dark Hunger**: 3 spins, +2 Might, **no power learned**, 0 fame.
- A 2–3 spin outing whose outcome is "+2 to a stat" reads as an errand. Ideas:
  - Make the minimum adventure 3–4 beats: activity → complication or hype slice → outcome.
  - Or chain a short "on the way home" wheel.
  - The open item "press on for mid-length adventures" in your memory notes is this same problem.

### 2. Promises the result doesn't keep — high
- "Learn a New Power" landing on a result that teaches no power feels like a bait-and-switch. Every slice on a power wheel should give *a* power, even a weak one.
- *"The Abyss offers a gift. It always wants something back."* No price was shown. The hero got a `tainted` mark, but the character card still says "Traits: None yet". If taint matters later, show it on the card now: "Tainted: the Abyss will collect". A hidden debt is lost drama.

### 3. The crossroads wheel ignores who the hero is — medium
- "What Will You Do?" has ~30 slices, most of them 1–4%. A *Muddled* orc *ranger* rolled **Study** (3%).
- The docs say stats and archetype bend the odds, but at 0 fame the wheel looks almost the same for everyone.
- Weight the crossroads noticeably by archetype and personality: a Ranger gets more Explore, Hunt and Tame; a Kind hero gets more Make an Ally. Say so in the odds list ("Likelier for a Ranger"). The "Likelier with high Arcana" hint already exists on other wheels, so this is consistent.
- The subtitle says *"A free season, a full pack, and a choice"*, but it's a spin. Change "a choice" to something like "and the road decides".

### 4. Fame is slow to arrive — medium
- After 2 adventures the hero had 2 fame. The tiers are Known at 6, Renowned at 15 and Famous at 32, and Destiny Calls and A Legendary Challenge are locked behind them.
- The locks are well explained, but at this rate a typical hero may never see them. The sim data can confirm this: check the fame each hero has reached when they die.
- Options: give a small fame floor per adventure (e.g. 1), or lower the Renowned bar.

### 5. Creation still has blank spins — low/medium (you chose this, so revisit it only if it bothers you)
- Of 13 creation spins, three gave nothing: **Normal Fate** (1 in 2), **Ordinary Soul** (1 in 2) and **Empty Hands** (1 in 4). The hero entered the world with 0 weapon CP and no traits.
- This is a deliberate decision ("creation keeps blanks"), but at 1-in-2 odds the blanks are the *most likely* result on two wheels.
- Consider lowering them to around 1 in 3. Or give a blank a small consolation that sets up a future spin, e.g. Empty Hands: "first Find a Weapon on the road is weighted up".

### 6. Content breadth vs. depth — note
- There are 509 wheels (47 for creation, 147 for adventures, plus ladders). A single hero sees only a sliver.
- Before adding more wheels, prefer deepening the ~10 most-rolled paths. The sim can rank wheels by how often they're reached; spend writing effort where heroes actually go.

---

## UX and flow

### 7. The wheel and its result don't fit on one screen — high
- At 1440×1000, landing a spin scrolls the page down to the result card, so the wheel's title is off-screen.
- After **Continue**, the page *stays* scrolled. The next wheel's title and the top half of the wheel are hidden until you scroll back up.
- Every spin turns into scroll → read → scroll. Fixes:
  - Put the result card beside the wheel on wide screens. The right column is already the character card, so lay the reveal over the lower part of the wheel area instead.
  - Or scroll back to the wheel title on Continue.

### 8. Dense wheels are unreadable — medium
- On the crossroads wheel, the ~1–4% slices are slivers. Their labels are rotated, tiny and partly overlapping.
- Options:
  - Hide labels below a size threshold and keep only the icon.
  - Group the thin slices into one "rare band" arc with a combined label.
  - Rely on the odds list, and highlight a row when the matching slice is hovered.

### 9. The side card shows the wrong history on the road — medium
- During adventures the card still lists the full 13-step creation **"Path through the wheels"** first. The **Adventures** log sits below it at the very bottom.
- On the Adventures tab, show the current adventure's beats near the top and collapse the creation path into a "Born:" summary line.

### 10. The adventure record doesn't match — verify
- After two adventures, the World panel said "2 adventures", but the card's Adventures list and the Chronicle showed only **"1. Study → History and Letters"**.
- Adventure 2 ended on "Mogra comes home", and I switched tabs without pressing "Another adventure". Either the record is only written on that press, or a zero-fame adventure is skipped. Either way the hero's record shouldn't silently miss a season.

### 11. A reload lands on the wrong tab — low
- Reloading while a hero lives opens **Create**, which shows "One life at a time / Back to Mogra".
- Default to **Adventures** whenever `playerHero(world)` exists.

### 12. Odds lists are hard to scan — low
- Rows follow config order, not chance. In "Which Power Answers?", *All Three Answer (2%)* sits between the 49% and 25% rows. In the crossroads list, Go on an Adventure (13%) is followed by Train (6%), then Explore (8%).
- Sort by chance, with locked options last, or group rows by rarity.

---

## Visual

- **Small caps everywhere at small sizes.** Labels like "Combat power", "Weapon tier", "Odds on this wheel" and "Path through the wheels" are around 11–12px in Fell SC or Alegreya SC. They are legible but tiring, and the side card is a long column of them. Bump the size or drop small caps for secondary labels.
- **Ash italic on oxblood** (taglines, "Not rolled yet", lock reasons) looks close to the 4.5:1 commitment. Measure the ratios for `text-ash` on the panel and page backgrounds.
- **Rarity colours** (green uncommon, blue rare, purple epic, gold legendary) follow the MMO loot convention. That's useful and familiar, but it's the one modern-game note in a heraldic room. You could keep the hues and render the rarity word as a small heraldic tincture or charge instead of coloured caps. Optional.
- **Phone layout** works: the tabs fit, the crest scales and the stat block is clean. One flaw is that "Armour tier" wraps onto two lines beside its value; give the label `whitespace-nowrap` or stack the value under it.
- **74 hard-coded hex colours** in `src/ui` and `App.tsx` bypass the 33 CSS tokens in `index.css`. Fine for the canvas wheel painter, but in components they will drift from the palette at the next re-theme. Move the repeats into tokens.

---

## Housekeeping (not design, but noticed)

- `README.md` is still the Vite template boilerplate. Replace it with a short pointer to PRODUCT.md and the docs/ trees.
- `src/App.css` (184 lines of `.counter` and `.hero` template CSS), `src/assets/react.svg`, `vite.svg` and `hero.png` are not imported anywhere and can be deleted.
- `roguelite-phase2.zip` sits in the project root.
- **No git.** Backups are folder copies (`backups/pre-…`). A `git init` with one commit per change would make "what did the redesign change?" a one-line answer and make reverts safe.

---

## Suggested order

1. Keep the wheel and its result in one view (#7). This is pure UI, and you'll feel it on every spin.
2. Make sure every power, gift or bargain result pays what its wheel promises, and show taint on the card (#2).
3. Set a minimum adventure length or add a complication beat (#1), then re-run the life sim against the baseline of 254/500.
4. Weight the crossroads by archetype and personality, and say so in the odds list (#3).
5. Sort the odds lists, and handle thin slices on dense wheels (#8, #12).
6. Check the adventure-record mismatch (#10) and the default tab on reload (#11).
