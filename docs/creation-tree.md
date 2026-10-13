# Soulwheel: character creation tree



Every wheel a new soul can spin, in the order they are met, starting at **Wheel of Ancestry**. 47 wheels. The stat wheels (one per race and stat) are listed compactly in [stat-ladders.md](stat-ladders.md).



## How to read this

- **Weight** is the option's base weight; **Base chance** is its share of the wheel before anything about the character or world changes it (locked options still count here). Options marked *special* only appear for some characters.
- What bends the odds, per character: **Luck** (×(1 + k × luck)), **Stats** (×(1 + k × (stat − 10))), **Fame** (×(1 + k × fame tier)), the character's **race** and **archetype**, and on fights the **chance to win** (your CP ÷ (your CP + foe power)). **Threat** (the world dial) changes odds but not slice sizes.
- **Locked** options show on the wheel but cannot be rolled. A **route** sends the character to one of several wheels depending on who they are.
- Stats floor at 0 at creation; on an adventure, a stat reaching 0 kills the hero.



## Wheels



- [Wheel of Ancestry](#ancestry)
- [Where Were You Raised?](#human_homeland)
- [Which Elven Line?](#elf_lineage)
- [Which Clan?](#dwarf_clan)
- [Standing in the Warband](#orc_standing)
- [Which Hearth?](#halfling_hearth)
- [What Do You Tinker With?](#gnome_workshop)
- [What Kind of Monster?](#monster_type)
- [Which Dragon’s Blood?](#dragon_bloodline)
- [What Kind of Construct?](#construct_type)
- [Born of Light, or Raised to It?](#angel_origin)
- [Born a Demon, or Made One?](#fiend_origin)
- [Which Domain Is Yours?](#god_domain)
- [Wheel of Archetypes](#archetype)
- [How Big Is the Band?](#goblin_band)
- [What Does the Warren Need?](#kobold_calling)
- [Which Caste?](#lizard_caste)
- [What Stirs in the Bones?](#undeath)
- [What Does the Clan Make of You?](#ogre_role)
- [What Did the Labyrinth Make You?](#labyrinth)
- [How Did the Wolf Find You?](#the_turning)
- [Whose Blood Runs in You?](#bloodline)
- [Resurrected From Which Race?](#resurrected_from)
- [Where Did You Fall From?](#celestial_origin)
- [Ascended From Which Race?](#ascended_from)
- [Which Sin Rules You?](#demon_sin)
- [Corrupted From Which Race?](#corrupted_from)
- [Which Minor Domain?](#minor_domain)
- [Wheel of Fate](#fate)
- [Your Place in the Band (goblin_place_gang)](#goblin_place_gang)
- [Your Place in the Band (goblin_place_band)](#goblin_place_band)
- [Your Place in the Band (goblin_place_horde)](#goblin_place_horde)
- [Which Virtue Is Yours?](#angel_virtue)
- [Succubus or Incubus?](#lust_form)
- [Which Sin Took You?](#fallen_sin)
- [Whose God Are You?](#god_of_race)
- [What Kind of War?](#war_style)
- [The Abyss Calls](#abyss_calls)
- [Wheel of Personality](#personality)
- [Wheel of Talents](#talents)
- [Abyssal Wheel](#abyssal)
- [The Armory](#armory)
- [What Do You Wear?](#outfitter)
- [Blessed Powers](#blessed_powers)
- [Corrupted Powers](#corrupted_powers)
- [Arcane Powers](#arcane_powers)
- [Mastery of the Power](#power_mastery)



<a id="ancestry"></a>
## Wheel of Ancestry

`ancestry`

*Every soul begins here.*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Human**<br><sub>Adaptable to a fault.</sub> | common | 34 | 28% | Race: Human | [Where Were You Raised?](#human_homeland) |  |
| **Elf**<br><sub>Born listening to things no one else can hear. But which elves?</sub> | uncommon | 16 | 13% | Race: Elf | [Which Elven Line?](#elf_lineage) |  |
| **Dwarf**<br><sub>Carved more than born.</sub> | uncommon | 16 | 13% | Race: Dwarf | [Which Clan?](#dwarf_clan) |  |
| **Orc**<br><sub>The war-drums started before you could walk.</sub> | uncommon | 14 | 12% | Race: Orc | [Standing in the Warband](#orc_standing) |  |
| **Halfling**<br><sub>Easy to overlook, and luckier than they have any right to be.</sub> | uncommon | 12 | 10.0% | Luck +0.5; Race: Halfling | [Which Hearth?](#halfling_hearth) |  |
| **Gnome**<br><sub>Small hands, big ideas, frequent explosions.</sub> | uncommon | 10 | 8.3% | Race: Gnome | [What Do You Tinker With?](#gnome_workshop) |  |
| **Monster**<br><sub>Something people lock their doors against. But which something?</sub> | uncommon | 8 | 6.7% | Marked monster | [What Kind of Monster?](#monster_type) |  |
| **Dragonborn**<br><sub>Hatched, not born, and proud of it.</sub> | rare | 5 | 4.2% | Gains Draconic Blood; Race: Dragonborn | [Which Dragon’s Blood?](#dragon_bloodline) |  |
| **Construct**<br><sub>Built, not born. But by whom, and how?</sub> | epic | 2.5 | 2.1% | Marked construct | [What Kind of Construct?](#construct_type) |  |
| **Angel**<br><sub>Born of light, or raised to it. Almost never corrupted.</sub> | legendary | 1.2 | <1% | +1 spin on Blessed Powers; Marked angel | [Born of Light, or Raised to It?](#angel_origin) | Threat -0.1/lvl |
| **Demon**<br><sub>The Abyss has a child up here. Very few stay on the right side.</sub> | legendary | 1.2 | <1% | +1 spin on Corrupted Powers; Marked fiend | [Born a Demon, or Made One?](#fiend_origin) | Threat +0.2/lvl |
| **God**<br><sub>A god, born into the world. Three blessed powers, and a domain no other god may hold.</sub> | mythical | 0.4 | <1% | Race: God; +3 spins on Blessed Powers; Marked divine | [Which Domain Is Yours?](#god_domain) |  |

<a id="human_homeland"></a>
## Where Were You Raised?

`human_homeland`

*Every human comes from somewhere small.*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Farmstead**<br><sub>Early mornings and strong backs.</sub> | common | 34 | 34% | Vitality roll +1 position | [Wheel of Archetypes](#archetype) | Title "of the Fields" (priority 5) |
| **City Streets**<br><sub>Quick feet, quicker wits.</sub> | common | 30 | 30% | Agility roll +1 position; Intellect roll +1 position | [Wheel of Archetypes](#archetype) | Title "of the Alleys" (priority 5) |
| **The Frontier**<br><sub>Where the maps run out.</sub> | uncommon | 18 | 18% | Might roll +1 position; Vitality roll +1 position | [Wheel of Archetypes](#archetype) | Title "of the Marches" (priority 6) |
| **Temple Ward**<br><sub>Raised on prayers and old books.</sub> | uncommon | 12 | 12% | Arcana roll +1 position; Intellect roll +1 position | [Wheel of Archetypes](#archetype) | Title "of the Temple" (priority 6) |
| **Noble House**<br><sub>A name that opens doors, and enemies who know it.</sub> | rare | 6 | 6.0% | Luck +0.5 | [Wheel of Archetypes](#archetype) | Title "of Noble Blood" (priority 30) |

<a id="elf_lineage"></a>
## Which Elven Line?

`elf_lineage`

*The forests remember every family.*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Wood Elf**<br><sub>Bow, leaf and silence.</sub> | common | 40 | 40% | Race: Wood Elf | [Wheel of Archetypes](#archetype) | Title "of the Greenwood" (priority 8) |
| **High Elf**<br><sub>Towers of silver and very long memories.</sub> | uncommon | 24 | 24% | Race: High Elf | [Wheel of Archetypes](#archetype) | Title "of the Silver Spires" (priority 10) |
| **Dark Elf**<br><sub>Raised under the world, where trust is a weakness.</sub> | uncommon | 20 | 20% | Race: Dark Elf | [Wheel of Archetypes](#archetype) | Title "of the Underdark" (priority 10) |
| **Moon Elf**<br><sub>Blessed by a pale sky.</sub> | rare | 12 | 12% | Luck +0.5; Race: Moon Elf | [Wheel of Archetypes](#archetype) | Title "Moonblessed" (priority 25) |
| **Star Elf**<br><sub>Fell with the stars, and never quite landed.</sub> | epic | 4 | 4.0% | Gains Starlight; Race: Star Elf | [Wheel of Archetypes](#archetype) | Title "the Starborn" (priority 45) |

<a id="dwarf_clan"></a>
## Which Clan?

`dwarf_clan`

*A dwarf without a clan is a rock without a mountain.*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Clan Ironfist**<br><sub>They solve problems by hitting them.</sub> | common | 30 | 30% | Might roll +1 position | [Wheel of Archetypes](#archetype) |  |
| **Clan Stonehelm**<br><sub>Patient as the mountain, twice as stubborn.</sub> | common | 28 | 28% | Vitality roll +1 position | [Wheel of Archetypes](#archetype) |  |
| **Clan Deepdelver**<br><sub>They dug too deep, and found something worth it.</sub> | uncommon | 18 | 18% | Intellect roll +1 position; Luck +0.25 | [Wheel of Archetypes](#archetype) |  |
| **Clan Goldbeard**<br><sub>Rich, and determined to stay that way.</sub> | uncommon | 16 | 16% | Luck +0.5 | [Wheel of Archetypes](#archetype) |  |
| **Clan Runeforged**<br><sub>Their names are carved into the oldest doors.</sub> | rare | 8 | 8.0% | Arcana roll +2 positions | [Wheel of Archetypes](#archetype) | Title "Rune-Born" (priority 25) |

<a id="orc_standing"></a>
## Standing in the Warband

`orc_standing`

*Every orc earns a place, or takes one.*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Grunt**<br><sub>At the front, where the shouting is.</sub> | common | 36 | 36% | Vitality roll +1 position | [Wheel of Archetypes](#archetype) | Title "of the Warband" (priority 6) |
| **Raider**<br><sub>First over the wall, first to the loot.</sub> | common | 26 | 26% | Agility roll +1 position | [Wheel of Archetypes](#archetype) | Title "the Raider" (priority 12) |
| **Berserker**<br><sub>Stops fighting when everything else does.</sub> | uncommon | 18 | 18% | Might roll +2 positions; Intellect roll −1 position | [Wheel of Archetypes](#archetype) | Title "the Berserker" (priority 25) |
| **Shaman**<br><sub>Talks to the spirits. Sometimes they answer.</sub> | uncommon | 14 | 14% | Arcana roll +2 positions | [Wheel of Archetypes](#archetype) | Title "the Shaman" (priority 25) |
| **Warchief’s Blood**<br><sub>Born to the warchief. Expected to be worth it.</sub> | rare | 6 | 6.0% | Might roll +1 position; Luck +0.5 | [Wheel of Archetypes](#archetype) | Title "Blood of the Warchief" (priority 50) |

<a id="halfling_hearth"></a>
## Which Hearth?

`halfling_hearth`

*There is always a kettle on somewhere.*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Hillfolk**<br><sub>Round doors and second breakfasts.</sub> | common | 36 | 36% | Vitality roll +1 position | [Wheel of Archetypes](#archetype) |  |
| **Riverfolk**<br><sub>Boats, fish, and gossip.</sub> | common | 30 | 30% | Agility roll +1 position | [Wheel of Archetypes](#archetype) |  |
| **Burglar’s Kin**<br><sub>Light fingers run in the family.</sub> | uncommon | 22 | 22% | Agility roll +2 positions | [Wheel of Archetypes](#archetype) | Title "the Light-Fingered" (priority 28) |
| **Born Under a Lucky Star**<br><sub>Things just work out. Infuriatingly.</sub> | rare | 12 | 12% | Luck +0.5 | [Wheel of Archetypes](#archetype) | Title "the Lucky" (priority 35) |

<a id="gnome_workshop"></a>
## What Do You Tinker With?

`gnome_workshop`

*Every gnome has a workbench. Most have scorch marks.*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Clockwork**<br><sub>Springs, cogs, and a ticking you can’t find.</sub> | common | 34 | 34% | Intellect roll +1 position | [Wheel of Archetypes](#archetype) | Title "the Tinker" (priority 12) |
| **Illusions**<br><sub>Nothing is quite where it looks.</sub> | common | 28 | 28% | Arcana roll +1 position | [Wheel of Archetypes](#archetype) | Title "the Illusionist" (priority 15) |
| **Gemcutting**<br><sub>A good eye, and a lucky one.</sub> | uncommon | 18 | 18% | Luck +0.5 | [Wheel of Archetypes](#archetype) | Title "the Gemcutter" (priority 12) |
| **Pranks**<br><sub>Engineering, technically.</sub> | uncommon | 14 | 14% | Agility roll +1 position | [Wheel of Archetypes](#archetype) | Title "the Prankster" (priority 14) |
| **A Grand Invention**<br><sub>It walks, it talks, it follows you around.</sub> | rare | 6 | 6.0% | Gains Clockwork Companion | [Wheel of Archetypes](#archetype) | Title "the Inventor" (priority 40) |

<a id="monster_type"></a>
## What Kind of Monster?

`monster_type`

*Every village has a story about one of these.*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Goblin**<br><sub>Quick hands, quicker excuses.</sub> | common | 30 | 26% | Race: Goblin | [How Big Is the Band?](#goblin_band) |  |
| **Kobold**<br><sub>Small, clever, and always one trap ahead.</sub> | common | 22 | 19% | Luck +0.25; Race: Kobold | [What Does the Warren Need?](#kobold_calling) |  |
| **Lizardfolk**<br><sub>Hatched in the marsh, and in no hurry.</sub> | common | 20 | 17% | Race: Lizardfolk | [Which Caste?](#lizard_caste) |  |
| **Skeleton**<br><sub>Bones that forgot how to lie still.</sub> | common | 16 | 14% | Race: Skeleton | [What Stirs in the Bones?](#undeath) |  |
| **Ogre**<br><sub>Big enough to be a weather event.</sub> | uncommon | 12 | 10% | Race: Ogre | [What Does the Clan Make of You?](#ogre_role) |  |
| **Minotaur**<br><sub>Horns first, questions never.</sub> | uncommon | 9 | 7.8% | Race: Minotaur | [What Did the Labyrinth Make You?](#labyrinth) |  |
| **Werewolf**<br><sub>Bitten once. Changed forever.</sub> | rare | 5 | 4.3% | Gains Moonstruck; Race: Werewolf | [How Did the Wolf Find You?](#the_turning) |  |
| **Vampire**<br><sub>Dead for a century, and only getting started.</sub> | epic | 2 | 1.7% | Gains Vampiric; Race: Vampire | [Whose Blood Runs in You?](#bloodline) | Threat +0.2/lvl |

<a id="dragon_bloodline"></a>
## Which Dragon’s Blood?

`dragon_bloodline`

*The colour of your scales is a promise.*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Red Bloodline**<br><sub>Fire, pride, and a short temper.</sub> | common | 26 | 26% | Might roll +2 positions | [Wheel of Archetypes](#archetype) | Title "of the Red Flight" (priority 10) |
| **Blue Bloodline**<br><sub>Lightning, and the patience to wait for it.</sub> | common | 24 | 24% | Agility roll +2 positions | [Wheel of Archetypes](#archetype) | Title "of the Blue Flight" (priority 10) |
| **Green Bloodline**<br><sub>Cunning, poison, and a pleasant smile.</sub> | uncommon | 18 | 18% | Intellect roll +2 positions | [Wheel of Archetypes](#archetype) | Title "of the Green Flight" (priority 10) |
| **Black Bloodline**<br><sub>Acid, swamps, and a very thick hide.</sub> | uncommon | 16 | 16% | Vitality roll +2 positions | [Wheel of Archetypes](#archetype) | Title "of the Black Flight" (priority 10) |
| **Gold Bloodline**<br><sub>The rarest flight, and the kindest.</sub> | rare | 10 | 10% | Arcana roll +1 position; Luck +0.5 | [Wheel of Archetypes](#archetype) | Title "of the Gold Flight" (priority 30) |
| **Shadow Bloodline**<br><sub>A flight no one admits to having seen.</sub> | epic | 6 | 6.0% | Arcana roll +2 positions; Agility roll +1 position | [Wheel of Archetypes](#archetype) | Title "of the Shadow Flight" (priority 35) |

<a id="construct_type"></a>
## What Kind of Construct?

`construct_type`

*Gears, runes, stone, or something stitched together.*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Undead Construct**<br><sub>Stitched from the dead and wound up again. But dead what?</sub> | common | 30 | 47% | Marked undead | [Resurrected From Which Race?](#resurrected_from) |  |
| **Crazy Experiment**<br><sub>Lightning, a laboratory, and a very bad idea that worked.</sub> | uncommon | 14 | 22% | Luck −0.25; Gains Unstable Experiment; Race: Construct | [Wheel of Archetypes](#archetype) | Title "the Experiment" (priority 30) |
| **Magical Golem**<br><sub>Stone, a rune, and a purpose.</sub> | uncommon | 14 | 22% | Gains Golem Core; Race: Construct | [Wheel of Archetypes](#archetype) | Title "the Golem" (priority 30) |
| **Dwarven Masterpiece**<br><sub>A lifetime of a master’s work, in brass and steel.</sub> | epic | 4 | 6.3% | Gains Masterwork Frame; Race: Construct | [Wheel of Archetypes](#archetype) | Title "the Dwarven Masterpiece" (priority 55) |
| **Ancient Construct**<br><sub>Built before history. Woke up yesterday.</sub> | legendary | 1.5 | 2.4% | Gains Ancient Core; Race: Construct | [Wheel of Archetypes](#archetype) | Title "the Ancient Engine" (priority 80) |

<a id="angel_origin"></a>
## Born of Light, or Raised to It?

`angel_origin`

*Some angels were made in heaven. Some earned their way there.*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **A True Angel**<br><sub>Born of light: stronger than any mortal raised to it.</sub> | common | 50 | 50% | Gains Born of Light; Gains Celestial Grace; Race: Angel | [Where Did You Fall From?](#celestial_origin) |  |
| **An Ascended Mortal**<br><sub>Once mortal. Which race did the light lift up?</sub> | common | 50 | 50% | Marked ascended | [Ascended From Which Race?](#ascended_from) |  |

<a id="fiend_origin"></a>
## Born a Demon, or Made One?

`fiend_origin`

*Half the Abyss was born there. The other half fell in.*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Born of the Abyss**<br><sub>A true demon: stronger than any mortal it corrupts.</sub> | common | 50 | 50% | Gains True Demon | [Which Sin Rules You?](#demon_sin) |  |
| **A Corrupted Mortal**<br><sub>Once something else. Which race did the Abyss take?</sub> | common | 50 | 50% | Marked corrupted | [Corrupted From Which Race?](#corrupted_from) |  |

<a id="god_domain"></a>
## Which Domain Is Yours?

`god_domain` · can repeat

*Every domain has exactly one god. Which one is free?*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **A Minor Domain**<br><sub>Not the sky or the sea. Something smaller, and dearer to someone.</sub> | common | 44 | 47% | — | [Which Minor Domain?](#minor_domain) |  |
| **Life**<br><sub>Birth, healing, and one more Blessed power.</sub> | uncommon | 8 | 8.5% | Gains Domain of Life; +1 spin on Blessed Powers; Claims the one-of-a-kind role Domain Life | Route, picked by the character: [Which Domain Is Yours?](#god_domain), [Wheel of Archetypes](#archetype) (or End) | One of a kind (Domain Life): locked while someone holds it. Another god already rules Life<br>Title "God of Life" (priority 86) |
| **Death**<br><sub>The last door, and a Corrupted power to guard it.</sub> | uncommon | 8 | 8.5% | Gains Domain of Death; +1 spin on Corrupted Powers; Claims the one-of-a-kind role Domain Death | Route, picked by the character: [Which Domain Is Yours?](#god_domain), [Wheel of Archetypes](#archetype) (or End) | One of a kind (Domain Death): locked while someone holds it. Another god already rules Death<br>Title "God of Death" (priority 86) |
| **Time**<br><sub>Past and future, and one more Arcane power.</sub> | uncommon | 8 | 8.5% | Gains Domain of Time; +1 spin on Arcane Powers; Claims the one-of-a-kind role Domain Time | Route, picked by the character: [Which Domain Is Yours?](#god_domain), [Wheel of Archetypes](#archetype) (or End) | One of a kind (Domain Time): locked while someone holds it. Another god already rules Time<br>Title "God of Time" (priority 86) |
| **Justice**<br><sub>Law and judgement. They can never be corrupted.</sub> | uncommon | 8 | 8.5% | Gains Uncorruptable; Claims the one-of-a-kind role Domain Justice | Route, picked by the character: [Which Domain Is Yours?](#god_domain), [Wheel of Archetypes](#archetype) (or End) | One of a kind (Domain Justice): locked while someone holds it. Another god already rules Justice<br>Title "God of Justice" (priority 86) |
| **Magic**<br><sub>Every spell, and two more Arcane powers.</sub> | uncommon | 8 | 8.5% | Gains Domain of Magic; +2 spins on Arcane Powers; Claims the one-of-a-kind role Domain Magic | Route, picked by the character: [Which Domain Is Yours?](#god_domain), [Wheel of Archetypes](#archetype) (or End) | One of a kind (Domain Magic): locked while someone holds it. Another god already rules Magic<br>Title "God of Magic" (priority 86) |
| **Space**<br><sub>The void between the stars. Ten times the Combat Power.</sub> | uncommon | 8 | 8.5% | Gains Cosmic Scale; Claims the one-of-a-kind role Domain Space | Route, picked by the character: [Which Domain Is Yours?](#god_domain), [Wheel of Archetypes](#archetype) (or End) | One of a kind (Domain Space): locked while someone holds it. Another god already rules Space<br>Title "God of Space" (priority 86) |
| **Many Domains**<br><sub>One domain was never going to be enough. Spin for two more.</sub> | legendary | 2 | 2.1% | +2 spins on Which Domain Is Yours? | Route, picked by the character: [Which Domain Is Yours?](#god_domain), [Wheel of Archetypes](#archetype) (or End) | Locked: Already gathering domains<br>Title "of Many Domains" (priority 84) |

<a id="archetype"></a>
## Wheel of Archetypes

`archetype`

*What were you made for?*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Warrior**<br><sub>Steel, shield and stubbornness.</sub> | common | 18 | 17% | Might roll +2 positions; Vitality roll +1 position; Archetype: Warrior | [Wheel of Fate](#fate) | Title "the Warrior" (priority 16) |
| **Rogue**<br><sub>Quick hands, quiet feet, and a knife for every problem.</sub> | common | 15 | 14% | Agility roll +2 positions; Intellect roll +1 position; Archetype: Rogue | [Wheel of Fate](#fate) | Title "the Rogue" (priority 16) |
| **Ranger**<br><sub>At home where the roads run out.</sub> | common | 13 | 13% | Agility roll +1 position; Vitality roll +1 position; Intellect roll +1 position; Archetype: Ranger | [Wheel of Fate](#fate) | Title "the Ranger" (priority 16) |
| **Mage**<br><sub>Years of study, one very loud spell.</sub> | uncommon | 10 | 9.7% | Arcana roll +2 positions; Intellect roll +1 position; Archetype: Mage; +1 spin on Arcane Powers | [Wheel of Fate](#fate) | Title "the Mage" (priority 18) |
| **Cleric**<br><sub>Prayers that get answered, sometimes loudly.</sub> | uncommon | 9 | 8.7% | Arcana roll +1 position; Vitality roll +1 position; Intellect roll +1 position; Archetype: Cleric; +1 spin on Blessed Powers | [Wheel of Fate](#fate) | Title "the Cleric" (priority 18) |
| **Paladin**<br><sub>An oath, a sword, and no patience for evil.</sub> | uncommon | 8 | 7.7% | Might roll +1 position; Vitality roll +1 position; Arcana roll +1 position; Archetype: Paladin | [Wheel of Fate](#fate) | Title "the Paladin" (priority 20) |
| **Barbarian**<br><sub>Rage first. Rage second. Thinking eventually.</sub> | uncommon | 8 | 7.7% | Might roll +3 positions; Vitality roll +1 position; Intellect roll −1 position; Archetype: Barbarian | [Wheel of Fate](#fate) | Title "the Barbarian" (priority 18) |
| **Bard**<br><sub>Every legend needs someone to sing it. Ideally themselves.</sub> | uncommon | 7 | 6.8% | Intellect roll +1 position; Agility roll +1 position; Luck +0.25; Archetype: Bard | [Wheel of Fate](#fate) | Title "the Bard" (priority 16) |
| **Druid**<br><sub>Speaks for the forest, and the forest has opinions.</sub> | rare | 4 | 3.9% | Arcana roll +1 position; Vitality roll +1 position; Archetype: Druid; +1 spin on Arcane Powers | [Wheel of Fate](#fate) | Title "the Druid" (priority 22) |
| **Monk**<br><sub>Empty hands, full discipline.</sub> | rare | 4 | 3.9% | Agility roll +2 positions; Vitality roll +1 position; Archetype: Monk | [Wheel of Fate](#fate) | Title "the Monk" (priority 22) |
| **Warlock**<br><sub>Power on loan from something that will collect.</sub> | rare | 3 | 2.9% | Arcana roll +2 positions; Archetype: Warlock; +1 spin on Corrupted Powers; Marked pact | [Wheel of Fate](#fate) | Title "the Warlock" (priority 24) |
| **Artificer**<br><sub>If it doesn’t exist yet, they’ll build it by Tuesday.</sub> | rare | 3 | 2.9% | Intellect roll +2 positions; Weapon tier +1; Archetype: Artificer | [Wheel of Fate](#fate) | Title "the Artificer" (priority 22) |
| **Necromancer**<br><sub>Death is a resource. A renewable one.</sub> | epic | 1.5 | 1.4% | Arcana roll +2 positions; Intellect roll +1 position; Archetype: Necromancer; +1 spin on Corrupted Powers | [Wheel of Fate](#fate) | Title "the Necromancer" (priority 30) |

<a id="goblin_band"></a>
## How Big Is the Band?

`goblin_band`

*Goblins are never alone. Almost never.*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Small Gang**<br><sub>Five goblins, one plan, no agreement.</sub> | common | 38 | 38% | — | [Your Place in the Band (goblin_place_gang)](#goblin_place_gang) |  |
| **Raiding Band**<br><sub>Thirty goblins and a stolen cart.</sub> | common | 32 | 32% | — | [Your Place in the Band (goblin_place_band)](#goblin_place_band) |  |
| **Great Horde**<br><sub>A tide of goblins. The ground shakes.</sub> | uncommon | 18 | 18% | — | [Your Place in the Band (goblin_place_horde)](#goblin_place_horde) |  |
| **Lone Goblin**<br><sub>The band is a band of one, and it votes for you.</sub> | uncommon | 12 | 12% | Agility roll +1 position; Luck +0.25 | [Wheel of Archetypes](#archetype) | Title "the Lone" (priority 20) |

<a id="kobold_calling"></a>
## What Does the Warren Need?

`kobold_calling`

*Every kobold has a job. Usually a dangerous one.*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Trapmaker**<br><sub>Wires, springs, and a nasty sense of humour.</sub> | common | 32 | 33% | Intellect roll +1 position | [Wheel of Archetypes](#archetype) | Title "the Trapmaker" (priority 15) |
| **Tunneler**<br><sub>Dig first. Ask where later.</sub> | common | 30 | 31% | Vitality roll +1 position | [Wheel of Archetypes](#archetype) | Title "the Tunneler" (priority 10) |
| **Scout**<br><sub>Sees you long before you see them.</sub> | uncommon | 22 | 23% | Agility roll +1 position | [Wheel of Archetypes](#archetype) | Title "the Scout" (priority 12) |
| **Dragon-Priest**<br><sub>Speaks for a dragon who may or may not be listening.</sub> | rare | 12 | 13% | Arcana roll +2 positions | [Wheel of Archetypes](#archetype) | Title "Voice of the Dragon" (priority 45) |

<a id="lizard_caste"></a>
## Which Caste?

`lizard_caste`

*The swamp sorts its children early.*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Hunter**<br><sub>Still as a log. Then not.</sub> | common | 36 | 36% | Agility roll +1 position | [Wheel of Archetypes](#archetype) | Title "the Hunter" (priority 12) |
| **Scale-Warden**<br><sub>Guards the eggs. Guards them very well.</sub> | common | 28 | 28% | Vitality roll +1 position | [Wheel of Archetypes](#archetype) | Title "the Scale-Warden" (priority 15) |
| **Swamp Shaman**<br><sub>Reads the bubbles in the mud.</sub> | uncommon | 22 | 22% | Arcana roll +2 positions | [Wheel of Archetypes](#archetype) | Title "the Swamp Shaman" (priority 22) |
| **Hatchling of the Old Brood**<br><sub>From eggs older than the swamp itself.</sub> | rare | 14 | 14% | Might roll +1 position; Luck +0.25 | [Wheel of Archetypes](#archetype) | Title "of the Old Brood" (priority 35) |

<a id="undeath"></a>
## What Stirs in the Bones?

`undeath`

*Something woke you. What came back with it?*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Mindless Bones**<br><sub>Clatter, shuffle, clatter.</sub> | common | 34 | 34% | Vitality roll +1 position; Intellect roll −1 position | [Wheel of Archetypes](#archetype) | Title "the Mindless" (priority 10) |
| **Restless Warrior**<br><sub>Died fighting. Still fighting.</sub> | common | 30 | 30% | Might roll +2 positions | [Wheel of Archetypes](#archetype) | Title "the Restless" (priority 15) |
| **Bone Knight**<br><sub>Rusted armour, perfect posture.</sub> | uncommon | 22 | 22% | Might roll +1 position; Vitality roll +1 position | [Wheel of Archetypes](#archetype) | Title "the Bone Knight" (priority 35) |
| **Spark of Sorcery**<br><sub>The spark grows. You will not stay a skeleton for long: you are a Lich.</sub> | rare | 14 | 14% | Gains Phylactery; Race: Lich | [Wheel of Archetypes](#archetype) | Title "the Lich" (priority 70) |

<a id="ogre_role"></a>
## What Does the Clan Make of You?

`ogre_role`

*Ogres respect two things: size, and dinner.*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Brute**<br><sub>Big. Loud. Effective.</sub> | common | 40 | 40% | Might roll +1 position | [Wheel of Archetypes](#archetype) | Title "the Brute" (priority 12) |
| **Clan Cook**<br><sub>The most important ogre in any clan.</sub> | common | 26 | 26% | Vitality roll +2 positions | [Wheel of Archetypes](#archetype) | Title "the Cook" (priority 15) |
| **Clan Chief**<br><sub>Won the job by sitting on the last chief.</sub> | uncommon | 24 | 24% | Might roll +1 position; Luck +0.25 | [Wheel of Archetypes](#archetype) | Title "Chief of the Clan" (priority 40) |
| **Ogre Mage**<br><sub>Nobody expected it. Least of all them.</sub> | rare | 10 | 10% | Arcana roll +3 positions; Intellect roll +1 position | [Wheel of Archetypes](#archetype) | Title "the Ogre Mage" (priority 45) |

<a id="labyrinth"></a>
## What Did the Labyrinth Make You?

`labyrinth`

*Every minotaur is born in a maze. Few leave it.*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Maze-Born**<br><sub>Knows every turn, and every way out.</sub> | common | 38 | 38% | Intellect roll +1 position | [Wheel of Archetypes](#archetype) | Title "of the Labyrinth" (priority 8) |
| **Escaped the Pits**<br><sub>The chains are still around somewhere.</sub> | common | 28 | 28% | Agility roll +1 position | [Wheel of Archetypes](#archetype) | Title "the Unchained" (priority 20) |
| **Arena Champion**<br><sub>The crowd still chants the name.</sub> | uncommon | 24 | 24% | Might roll +2 positions | [Wheel of Archetypes](#archetype) | Title "Champion of the Arena" (priority 40) |
| **Lord of the Labyrinth**<br><sub>The maze rearranges itself for them.</sub> | rare | 10 | 10% | Luck +0.25; Gains Lord of the Labyrinth | [Wheel of Archetypes](#archetype) | Title "Lord of the Labyrinth" (priority 60) |

<a id="the_turning"></a>
## How Did the Wolf Find You?

`the_turning`

*Some are bitten. Some are born. Some bite back.*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Bitten**<br><sub>One bad night in the woods.</sub> | common | 40 | 40% | Vitality roll +1 position | [Wheel of Archetypes](#archetype) | Title "the Bitten" (priority 10) |
| **Born a Wolf**<br><sub>The moon was full at your birth. Of course it was.</sub> | common | 30 | 30% | Agility roll +1 position; Might roll +1 position | [Wheel of Archetypes](#archetype) | Title "Wolfblood" (priority 18) |
| **Moon-Mad**<br><sub>The wolf is in charge more often than not.</sub> | uncommon | 20 | 20% | Might roll +2 positions; Intellect roll −1 position | [Wheel of Archetypes](#archetype) | Title "the Moon-Mad" (priority 30) |
| **Alpha of the Pack**<br><sub>Where they run, wolves follow.</sub> | rare | 10 | 10% | Luck +0.25; Gains Pack Alpha | [Wheel of Archetypes](#archetype) | Title "Alpha of the Pack" (priority 55) |

<a id="bloodline"></a>
## Whose Blood Runs in You?

`bloodline`

*Every vampire was made by someone.*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Fledgling**<br><sub>New to the night, and very hungry.</sub> | common | 42 | 42% | Agility roll +1 position | [Wheel of Archetypes](#archetype) | Title "the Fledgling" (priority 10) |
| **Nosferatu**<br><sub>Not pretty. Very hard to kill.</sub> | uncommon | 26 | 26% | Might roll +2 positions | [Wheel of Archetypes](#archetype) | Title "the Nosferatu" (priority 25) |
| **The Crimson Court**<br><sub>Velvet, intrigue, and long knives.</sub> | uncommon | 22 | 22% | Intellect roll +1 position; Arcana roll +1 position; Luck +0.25 | [Wheel of Archetypes](#archetype) | Title "of the Crimson Court" (priority 35) |
| **Ancient Blood**<br><sub>Made by something older than any name.</sub> | rare | 10 | 10% | Arcana roll +2 positions; Gains Ancient Blood | [Wheel of Archetypes](#archetype) | Title "the Ancient" (priority 60) |

<a id="resurrected_from"></a>
## Resurrected From Which Race?

`resurrected_from`

*The body was someone, once.*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Human**<br><sub>Short lives, long ambitions. Good at everything, best at nothing.</sub> | common | 10 | 7.7% | Gains Reanimated; Race: Human | [Wheel of Archetypes](#archetype) | Title "the Reanimated" (priority 25) |
| **Elf**<br><sub>Quick, keen, and older than they look.</sub> | common | 10 | 7.7% | Gains Reanimated; Race: Elf | [Wheel of Archetypes](#archetype) | Title "the Reanimated" (priority 25) |
| **Dwarf**<br><sub>Stone-stubborn and forge-proud.</sub> | common | 10 | 7.7% | Gains Reanimated; Race: Dwarf | [Wheel of Archetypes](#archetype) | Title "the Reanimated" (priority 25) |
| **Orc**<br><sub>Strength first. Questions later, possibly never.</sub> | common | 10 | 7.7% | Gains Reanimated; Race: Orc | [Wheel of Archetypes](#archetype) | Title "the Reanimated" (priority 25) |
| **Halfling**<br><sub>Small, quiet, and somehow always where the luck is.</sub> | common | 10 | 7.7% | Gains Reanimated; Race: Halfling | [Wheel of Archetypes](#archetype) | Title "the Reanimated" (priority 25) |
| **Dragonborn**<br><sub>Scales, smoke, and a grudge older than kingdoms.</sub> | common | 10 | 7.7% | Gains Reanimated; Race: Dragonborn | [Wheel of Archetypes](#archetype) | Title "the Reanimated" (priority 25) |
| **Gnome**<br><sub>Small hands, big ideas, frequent explosions.</sub> | common | 10 | 7.7% | Gains Reanimated; Race: Gnome | [Wheel of Archetypes](#archetype) | Title "the Reanimated" (priority 25) |
| **Goblin**<br><sub>Small, sharp, and never as alone as they look.</sub> | common | 10 | 7.7% | Gains Reanimated; Race: Goblin | [Wheel of Archetypes](#archetype) | Title "the Reanimated" (priority 25) |
| **Kobold**<br><sub>Trap-maker, tunnel-digger, dragon-worshipper.</sub> | common | 10 | 7.7% | Gains Reanimated; Race: Kobold | [Wheel of Archetypes](#archetype) | Title "the Reanimated" (priority 25) |
| **Lizardfolk**<br><sub>Cold blood, patient eyes, no small talk.</sub> | common | 10 | 7.7% | Gains Reanimated; Race: Lizardfolk | [Wheel of Archetypes](#archetype) | Title "the Reanimated" (priority 25) |
| **Ogre**<br><sub>Very large, very hungry, surprisingly sentimental.</sub> | common | 10 | 7.7% | Gains Reanimated; Race: Ogre | [Wheel of Archetypes](#archetype) | Title "the Reanimated" (priority 25) |
| **Minotaur**<br><sub>Never lost in any maze, never far from a fight.</sub> | common | 10 | 7.7% | Gains Reanimated; Race: Minotaur | [Wheel of Archetypes](#archetype) | Title "the Reanimated" (priority 25) |
| **Werewolf**<br><sub>Two shapes, one appetite.</sub> | common | 10 | 7.7% | Gains Reanimated; Race: Werewolf | [Wheel of Archetypes](#archetype) | Title "the Reanimated" (priority 25) |

<a id="celestial_origin"></a>
## Where Did You Fall From?

`celestial_origin`

*Heaven has many doors.*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Fallen Star**<br><sub>A spark that strayed too far.</sub> | common | 40 | 40% | Arcana roll +1 position | [Which Virtue Is Yours?](#angel_virtue) | Title "Starfallen" (priority 12) |
| **Angelic Echo**<br><sub>An old choir, still faintly singing.</sub> | common | 30 | 30% | Vitality roll +1 position; Intellect roll +1 position | [Which Virtue Is Yours?](#angel_virtue) | Title "the Radiant" (priority 20) |
| **Exiled Seraph**<br><sub>Thrown out of heaven. Not sorry.</sub> | uncommon | 20 | 20% | Might roll +2 positions | [Which Virtue Is Yours?](#angel_virtue) | Title "the Exiled" (priority 25) |
| **Herald of Dawn**<br><sub>Sent ahead of the morning, on purpose.</sub> | rare | 10 | 10% | Luck +0.5; Gains Herald of Dawn | [Which Virtue Is Yours?](#angel_virtue) | Title "Herald of Dawn" (priority 55) |

<a id="ascended_from"></a>
## Ascended From Which Race?

`ascended_from`

*Before the light lifted them, they were something else.*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Human**<br><sub>Short lives, long ambitions. Good at everything, best at nothing.</sub> | common | 10 | 6.6% | Gains Ascended Soul; Race: Human | [Which Virtue Is Yours?](#angel_virtue) |  |
| **Elf**<br><sub>Quick, keen, and older than they look.</sub> | common | 10 | 6.6% | Gains Ascended Soul; Race: Elf | [Which Virtue Is Yours?](#angel_virtue) |  |
| **Dwarf**<br><sub>Stone-stubborn and forge-proud.</sub> | common | 10 | 6.6% | Gains Ascended Soul; Race: Dwarf | [Which Virtue Is Yours?](#angel_virtue) |  |
| **Orc**<br><sub>Strength first. Questions later, possibly never.</sub> | common | 10 | 6.6% | Gains Ascended Soul; Race: Orc | [Which Virtue Is Yours?](#angel_virtue) |  |
| **Halfling**<br><sub>Small, quiet, and somehow always where the luck is.</sub> | common | 10 | 6.6% | Gains Ascended Soul; Race: Halfling | [Which Virtue Is Yours?](#angel_virtue) |  |
| **Dragonborn**<br><sub>Scales, smoke, and a grudge older than kingdoms.</sub> | common | 10 | 6.6% | Gains Ascended Soul; Race: Dragonborn | [Which Virtue Is Yours?](#angel_virtue) |  |
| **Gnome**<br><sub>Small hands, big ideas, frequent explosions.</sub> | common | 10 | 6.6% | Gains Ascended Soul; Race: Gnome | [Which Virtue Is Yours?](#angel_virtue) |  |
| **Goblin**<br><sub>Small, sharp, and never as alone as they look.</sub> | common | 10 | 6.6% | Gains Ascended Soul; Race: Goblin | [Which Virtue Is Yours?](#angel_virtue) |  |
| **Kobold**<br><sub>Trap-maker, tunnel-digger, dragon-worshipper.</sub> | common | 10 | 6.6% | Gains Ascended Soul; Race: Kobold | [Which Virtue Is Yours?](#angel_virtue) |  |
| **Lizardfolk**<br><sub>Cold blood, patient eyes, no small talk.</sub> | common | 10 | 6.6% | Gains Ascended Soul; Race: Lizardfolk | [Which Virtue Is Yours?](#angel_virtue) |  |
| **Skeleton**<br><sub>Bones that forgot how to lie still.</sub> | common | 10 | 6.6% | Gains Ascended Soul; Race: Skeleton | [Which Virtue Is Yours?](#angel_virtue) |  |
| **Ogre**<br><sub>Very large, very hungry, surprisingly sentimental.</sub> | common | 10 | 6.6% | Gains Ascended Soul; Race: Ogre | [Which Virtue Is Yours?](#angel_virtue) |  |
| **Minotaur**<br><sub>Never lost in any maze, never far from a fight.</sub> | common | 10 | 6.6% | Gains Ascended Soul; Race: Minotaur | [Which Virtue Is Yours?](#angel_virtue) |  |
| **Werewolf**<br><sub>Two shapes, one appetite.</sub> | common | 10 | 6.6% | Gains Ascended Soul; Race: Werewolf | [Which Virtue Is Yours?](#angel_virtue) |  |
| **Vampire**<br><sub>Old, elegant, and always thirsty.</sub> | common | 10 | 6.6% | Gains Ascended Soul; Race: Vampire | [Which Virtue Is Yours?](#angel_virtue) |  |
| **A Demon**<br><sub>The rarest redemption of all.</sub> | epic | 2 | 1.3% | Gains Ascended Soul; Race: Demon | [Which Virtue Is Yours?](#angel_virtue) | Title "the Redeemed" (priority 75) |

<a id="demon_sin"></a>
## Which Sin Rules You?

`demon_sin`

*A demon is a sin with a body. Which sin?*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Pride**<br><sub>A Archfiend: Pride given horns and a throne-shaped ambition.</sub> | common | 14 | 14% | Intellect roll +1 position; Arcana roll +1 position; Luck +0.25; Race: Archfiend; Marked sin_pride | [Wheel of Archetypes](#archetype) | Title "Demon of Pride" (priority 60) |
| **Greed**<br><sub>A Hoardfiend: Greed with claws. Counts souls like coins.</sub> | common | 14 | 14% | Luck +0.5; Race: Hoardfiend; Marked sin_greed | [Wheel of Archetypes](#archetype) | Title "Demon of Greed" (priority 60) |
| **Lust**<br><sub>A Succubus or an Incubus. The wheel decides which.</sub> | common | 14 | 14% | Agility roll +1 position; Arcana roll +1 position; Marked sin_lust | [Succubus or Incubus?](#lust_form) | Title "Demon of Lust" (priority 60) |
| **Envy**<br><sub>A Doppelganger: Envy that wears your face better than you do.</sub> | common | 14 | 14% | Intellect roll +2 positions; Race: Doppelganger; Marked sin_envy | [Wheel of Archetypes](#archetype) | Title "Demon of Envy" (priority 60) |
| **Gluttony**<br><sub>A Maw Demon: Gluttony: all teeth, no bottom.</sub> | common | 14 | 14% | Vitality roll +3 positions; Agility roll −1 position; Race: Maw Demon; Marked sin_gluttony | [Wheel of Archetypes](#archetype) | Title "Demon of Gluttony" (priority 60) |
| **Wrath**<br><sub>A Balor: Wrath made of fire and a whip of flame.</sub> | common | 14 | 14% | Might roll +3 positions; Race: Balor; Marked sin_wrath | [Wheel of Archetypes](#archetype) | Title "Demon of Wrath" (priority 60) |
| **Sloth**<br><sub>A Dreamfiend: Sloth that steals your sleep, then your will.</sub> | common | 14 | 14% | Vitality roll +2 positions; Agility roll −1 position; Arcana roll +1 position; Race: Dreamfiend; Marked sin_sloth | [Wheel of Archetypes](#archetype) | Title "Demon of Sloth" (priority 60) |

<a id="corrupted_from"></a>
## Corrupted From Which Race?

`corrupted_from`

*Before the Abyss took them, they were something else.*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Human**<br><sub>Short lives, long ambitions. Good at everything, best at nothing.</sub> | common | 10 | 6.6% | Gains Demonic Corruption; Race: Human | [Which Sin Took You?](#fallen_sin) |  |
| **Elf**<br><sub>Quick, keen, and older than they look.</sub> | common | 10 | 6.6% | Gains Demonic Corruption; Race: Elf | [Which Sin Took You?](#fallen_sin) |  |
| **Dwarf**<br><sub>Stone-stubborn and forge-proud.</sub> | common | 10 | 6.6% | Gains Demonic Corruption; Race: Dwarf | [Which Sin Took You?](#fallen_sin) |  |
| **Orc**<br><sub>Strength first. Questions later, possibly never.</sub> | common | 10 | 6.6% | Gains Demonic Corruption; Race: Orc | [Which Sin Took You?](#fallen_sin) |  |
| **Halfling**<br><sub>Small, quiet, and somehow always where the luck is.</sub> | common | 10 | 6.6% | Gains Demonic Corruption; Race: Halfling | [Which Sin Took You?](#fallen_sin) |  |
| **Dragonborn**<br><sub>Scales, smoke, and a grudge older than kingdoms.</sub> | common | 10 | 6.6% | Gains Demonic Corruption; Race: Dragonborn | [Which Sin Took You?](#fallen_sin) |  |
| **Gnome**<br><sub>Small hands, big ideas, frequent explosions.</sub> | common | 10 | 6.6% | Gains Demonic Corruption; Race: Gnome | [Which Sin Took You?](#fallen_sin) |  |
| **Goblin**<br><sub>Small, sharp, and never as alone as they look.</sub> | common | 10 | 6.6% | Gains Demonic Corruption; Race: Goblin | [Which Sin Took You?](#fallen_sin) |  |
| **Kobold**<br><sub>Trap-maker, tunnel-digger, dragon-worshipper.</sub> | common | 10 | 6.6% | Gains Demonic Corruption; Race: Kobold | [Which Sin Took You?](#fallen_sin) |  |
| **Lizardfolk**<br><sub>Cold blood, patient eyes, no small talk.</sub> | common | 10 | 6.6% | Gains Demonic Corruption; Race: Lizardfolk | [Which Sin Took You?](#fallen_sin) |  |
| **Skeleton**<br><sub>Bones that forgot how to lie still.</sub> | common | 10 | 6.6% | Gains Demonic Corruption; Race: Skeleton | [Which Sin Took You?](#fallen_sin) |  |
| **Ogre**<br><sub>Very large, very hungry, surprisingly sentimental.</sub> | common | 10 | 6.6% | Gains Demonic Corruption; Race: Ogre | [Which Sin Took You?](#fallen_sin) |  |
| **Minotaur**<br><sub>Never lost in any maze, never far from a fight.</sub> | common | 10 | 6.6% | Gains Demonic Corruption; Race: Minotaur | [Which Sin Took You?](#fallen_sin) |  |
| **Werewolf**<br><sub>Two shapes, one appetite.</sub> | common | 10 | 6.6% | Gains Demonic Corruption; Race: Werewolf | [Which Sin Took You?](#fallen_sin) |  |
| **Vampire**<br><sub>Old, elegant, and always thirsty.</sub> | common | 10 | 6.6% | Gains Demonic Corruption; Race: Vampire | [Which Sin Took You?](#fallen_sin) |  |
| **An Angel**<br><sub>They fell all the way down.</sub> | epic | 2 | 1.3% | Gains Demonic Corruption; Race: Angel | [Which Sin Took You?](#fallen_sin) | Title "the Fallen Angel" (priority 75) |
| **A God**<br><sub>Even gods can be dragged down.</sub> | legendary | 0.6 | <1% | Gains Demonic Corruption; Race: God | [Which Sin Took You?](#fallen_sin) | Title "the Fallen God" (priority 92) |

<a id="minor_domain"></a>
## Which Minor Domain?

`minor_domain`

*Small domains, devoted followers.*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Fertility** | common | 12 | 10% | Vitality roll +1 position; Gains Minor Divinity; Claims the one-of-a-kind role Domain Fertility | Route, picked by the character: [Which Domain Is Yours?](#god_domain), [Wheel of Archetypes](#archetype) (or End) | One of a kind (Domain Fertility): locked while someone holds it. Another god already rules Fertility<br>Title "God of Fertility" (priority 80) |
| **One of the Races**<br><sub>A people, and their prayers. Which people?</sub> | common | 12 | 10% | — | [Whose God Are You?](#god_of_race) |  |
| **Harvest** | common | 12 | 10% | Vitality roll +1 position; Gains Minor Divinity; Claims the one-of-a-kind role Domain Harvest | Route, picked by the character: [Which Domain Is Yours?](#god_domain), [Wheel of Archetypes](#archetype) (or End) | One of a kind (Domain Harvest): locked while someone holds it. Another god already rules the Harvest<br>Title "God of the Harvest" (priority 80) |
| **Family** | common | 12 | 10% | Luck +0.25; Gains Minor Divinity; Claims the one-of-a-kind role Domain Family | Route, picked by the character: [Which Domain Is Yours?](#god_domain), [Wheel of Archetypes](#archetype) (or End) | One of a kind (Domain Family): locked while someone holds it. Another god already rules Family<br>Title "God of Hearth and Family" (priority 80) |
| **Nature** | common | 12 | 10% | Arcana roll +1 position; Gains Minor Divinity; Claims the one-of-a-kind role Domain Nature | Route, picked by the character: [Which Domain Is Yours?](#god_domain), [Wheel of Archetypes](#archetype) (or End) | One of a kind (Domain Nature): locked while someone holds it. Another god already rules Nature<br>Title "God of Nature" (priority 80) |
| **Animals** | common | 12 | 10% | Agility roll +1 position; Gains Minor Divinity; Claims the one-of-a-kind role Domain Animals | Route, picked by the character: [Which Domain Is Yours?](#god_domain), [Wheel of Archetypes](#archetype) (or End) | One of a kind (Domain Animals): locked while someone holds it. Another god already rules the Beasts<br>Title "God of Beasts" (priority 80) |
| **Mischief**<br><sub>A trickster domain. Even its odds are a joke: anywhere from common to epic.</sub> | common | 12 | 10% | Luck +0.5; Gains Minor Divinity; Claims the one-of-a-kind role Domain Mischief | Route, picked by the character: [Which Domain Is Yours?](#god_domain), [Wheel of Archetypes](#archetype) (or End) | One of a kind (Domain Mischief): locked while someone holds it. Another god already rules Mischief<br>Weight or rarity varies per character<br>Title "God of Mischief" (priority 80) |
| **Lost Things**<br><sub>Keys, socks, and causes. Nobody else wanted it.</sub> | common | 12 | 10% | Gains Minor Divinity | Route, picked by the character: [Which Domain Is Yours?](#god_domain), [Wheel of Archetypes](#archetype) (or End) | Title "God of Lost Things" (priority 78) |
| **Water** | uncommon | 6 | 5.1% | Vitality roll +1 position; Agility roll +1 position; Gains Minor Divinity; Claims the one-of-a-kind role Domain Water | Route, picked by the character: [Which Domain Is Yours?](#god_domain), [Wheel of Archetypes](#archetype) (or End) | One of a kind (Domain Water): locked while someone holds it. Another god already rules the Seas<br>Title "God of the Seas" (priority 80) |
| **Air** | uncommon | 6 | 5.1% | Agility roll +2 positions; Gains Minor Divinity; Claims the one-of-a-kind role Domain Air | Route, picked by the character: [Which Domain Is Yours?](#god_domain), [Wheel of Archetypes](#archetype) (or End) | One of a kind (Domain Air): locked while someone holds it. Another god already rules the Winds<br>Title "God of the Winds" (priority 80) |
| **Love** | uncommon | 6 | 5.1% | Luck +0.5; Gains Minor Divinity; Claims the one-of-a-kind role Domain Love | Route, picked by the character: [Which Domain Is Yours?](#god_domain), [Wheel of Archetypes](#archetype) (or End) | One of a kind (Domain Love): locked while someone holds it. Another god already rules Love<br>Title "God of Love" (priority 80) |
| **Underworld**<br><sub>The dead have a king.</sub> | epic | 2 | 1.7% | Gains Lord of the Underworld; Claims the one-of-a-kind role Domain Underworld | Route, picked by the character: [Which Domain Is Yours?](#god_domain), [Wheel of Archetypes](#archetype) (or End) | One of a kind (Domain Underworld): locked while someone holds it. Another god already rules the Underworld<br>Title "God of the Underworld" (priority 84) |
| **War**<br><sub>Every battlefield is a temple. But what kind of war?</sub> | epic | 2 | 1.7% | Might roll +2 positions; Gains Minor Divinity; Claims the one-of-a-kind role Domain War | [What Kind of War?](#war_style) | One of a kind (Domain War): locked while someone holds it. Another god already rules War<br>Title "God of War" (priority 82) |

<a id="fate"></a>
## Wheel of Fate

`fate`

*Then the stars have their say.*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Normal Fate**<br><sub>An ordinary birth: no luck either way. Your story is yours to write.</sub> | common | 50 | 60% | — | Route, picked by the character: [The Abyss Calls](#abyss_calls), [Wheel of Personality](#personality) (or End) |  |
| **Blessed by the Gods**<br><sub>Born under a favourable sky. Every wheel leans your way.</sub> | uncommon | 14 | 17% | Luck +1; Gains Divine Favor; Marked blessed | Route, picked by the character: [The Abyss Calls](#abyss_calls), [Wheel of Personality](#personality) (or End) | Threat -0.1/lvl<br>Title "the Blessed" (priority 22) |
| **Cursed Birth**<br><sub>Strength, bought with something you never agreed to sell. Luck went with it.</sub> | uncommon | 14 | 17% | Might roll +4 positions; Arcana roll +2 positions; Vitality roll −3 positions; Luck −0.5; Gains Cursed Blood; Marked cursed | Route, picked by the character: [The Abyss Calls](#abyss_calls), [Wheel of Personality](#personality) (or End) | Threat +0.25/lvl<br>Title "the Cursed" (priority 22) |
| **Demon Lord**<br><sub>You are the darkness the heroes are born to fight.</sub> | legendary | 6 | 7.1% | Might roll +5 positions; Arcana roll +5 positions; Vitality roll +8 positions; Luck +1.5; Gains Mantle of the Demon Lord; Becomes Demon Lord; Claims the one-of-a-kind role Demon Lord; Marked demonic | Route, picked by the character: [The Abyss Calls](#abyss_calls), [Wheel of Personality](#personality) (or End) | One of a kind (Demon Lord): locked while someone holds it. A Demon Lord already reigns over this world<br>Threat +0.2/lvl<br>Title "the Demon Lord" (priority 100) |

<a id="goblin_place_gang"></a>
## Your Place in the Band (goblin_place_gang)

`goblin_place_gang`

*Somebody has to lead the Gang. Is it you?*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Runt**<br><sub>Last to eat, first to be blamed.</sub> | common | 25 | 25% | Agility roll +1 position | [Wheel of Archetypes](#archetype) | Title "the Runt" (priority 12) |
| **Grunt**<br><sub>One of the crowd. A loud part of it.</sub> | common | 40 | 40% | Vitality roll +1 position | [Wheel of Archetypes](#archetype) | Title "of the Gang" (priority 6) |
| **Lieutenant**<br><sub>Close enough to the boss to want the job.</sub> | uncommon | 15 | 15% | Might roll +1 position | [Wheel of Archetypes](#archetype) | Title "Lieutenant of the Gang" (priority 30) |
| **The Boss**<br><sub>They follow you. You are the leader.</sub> | uncommon | 20 | 20% | Luck +0.25; Gains Gang Boss | [Wheel of Archetypes](#archetype) | Title "Boss of the Gang" (priority 45) |

<a id="goblin_place_band"></a>
## Your Place in the Band (goblin_place_band)

`goblin_place_band`

*Somebody has to lead the Raiding Band. Is it you?*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Runt**<br><sub>Last to eat, first to be blamed.</sub> | common | 28 | 28% | Agility roll +1 position | [Wheel of Archetypes](#archetype) | Title "the Runt" (priority 12) |
| **Grunt**<br><sub>One of the crowd. A loud part of it.</sub> | common | 45 | 45% | Vitality roll +1 position | [Wheel of Archetypes](#archetype) | Title "of the Raiding Band" (priority 6) |
| **Lieutenant**<br><sub>Close enough to the boss to want the job.</sub> | uncommon | 18 | 18% | Might roll +1 position | [Wheel of Archetypes](#archetype) | Title "Lieutenant of the Raiding Band" (priority 30) |
| **The Boss**<br><sub>They follow you. You are the leader.</sub> | rare | 9 | 9.0% | Luck +0.25; Gains Band Chief | [Wheel of Archetypes](#archetype) | Title "Chief of the Raiding Band" (priority 55) |

<a id="goblin_place_horde"></a>
## Your Place in the Band (goblin_place_horde)

`goblin_place_horde`

*Somebody has to lead the Great Horde. Is it you?*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Runt**<br><sub>Last to eat, first to be blamed.</sub> | common | 30 | 30% | Agility roll +1 position | [Wheel of Archetypes](#archetype) | Title "the Runt" (priority 12) |
| **Grunt**<br><sub>One of the crowd. A loud part of it.</sub> | common | 50 | 50% | Vitality roll +1 position | [Wheel of Archetypes](#archetype) | Title "of the Great Horde" (priority 6) |
| **Lieutenant**<br><sub>Close enough to the boss to want the job.</sub> | uncommon | 16 | 16% | Might roll +1 position | [Wheel of Archetypes](#archetype) | Title "Lieutenant of the Great Horde" (priority 30) |
| **The Boss**<br><sub>They follow you. You are the leader.</sub> | epic | 4 | 4.0% | Luck +0.25; Gains Horde Warboss | [Wheel of Archetypes](#archetype) | Title "Warboss of the Great Horde" (priority 75) |

<a id="angel_virtue"></a>
## Which Virtue Is Yours?

`angel_virtue`

*Every angel carries one above all others.*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Purity**<br><sub>An angel of purity.</sub> | common | 14 | 14% | Arcana roll +2 positions | [Wheel of Archetypes](#archetype) | Title "Angel of Purity" (priority 58) |
| **Temperance**<br><sub>An angel of temperance.</sub> | common | 14 | 14% | Vitality roll +1 position; Intellect roll +1 position | [Wheel of Archetypes](#archetype) | Title "Angel of Temperance" (priority 58) |
| **Charity**<br><sub>An angel of charity.</sub> | common | 14 | 14% | Luck +0.5 | [Wheel of Archetypes](#archetype) | Title "Angel of Charity" (priority 58) |
| **Diligence**<br><sub>An angel of diligence.</sub> | common | 14 | 14% | Might roll +1 position; Vitality roll +1 position | [Wheel of Archetypes](#archetype) | Title "Angel of Diligence" (priority 58) |
| **Patience**<br><sub>An angel of patience.</sub> | common | 14 | 14% | Intellect roll +2 positions | [Wheel of Archetypes](#archetype) | Title "Angel of Patience" (priority 58) |
| **Kindness**<br><sub>An angel of kindness.</sub> | common | 14 | 14% | Vitality roll +2 positions | [Wheel of Archetypes](#archetype) | Title "Angel of Kindness" (priority 58) |
| **Humility**<br><sub>An angel of humility.</sub> | common | 14 | 14% | Arcana roll +1 position; Luck +0.25 | [Wheel of Archetypes](#archetype) | Title "Angel of Humility" (priority 58) |

<a id="lust_form"></a>
## Succubus or Incubus?

`lust_form`

*Lust wears many faces. Which one is yours?*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Succubus**<br><sub>Lust in a lovely shape. The shape is a lie.</sub> | common | 50 | 50% | Race: Succubus | [Wheel of Archetypes](#archetype) |  |
| **Incubus**<br><sub>Lust with a winning smile and a bargain ready.</sub> | common | 50 | 50% | Race: Incubus | [Wheel of Archetypes](#archetype) |  |

<a id="fallen_sin"></a>
## Which Sin Took You?

`fallen_sin`

*Every fall starts with one.*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Pride**<br><sub>The Abyss found them through pride.</sub> | common | 14 | 14% | Intellect roll +1 position; Arcana roll +1 position; Luck +0.25; Marked sin_pride | [Wheel of Archetypes](#archetype) | Title "the Proud" (priority 24) |
| **Greed**<br><sub>The Abyss found them through greed.</sub> | common | 14 | 14% | Luck +0.5; Marked sin_greed | [Wheel of Archetypes](#archetype) | Title "the Insatiable" (priority 24) |
| **Lust**<br><sub>The Abyss found them through lust.</sub> | common | 14 | 14% | Agility roll +1 position; Arcana roll +1 position; Marked sin_lust | [Wheel of Archetypes](#archetype) | Title "the Lustful" (priority 24) |
| **Envy**<br><sub>The Abyss found them through envy.</sub> | common | 14 | 14% | Intellect roll +2 positions; Marked sin_envy | [Wheel of Archetypes](#archetype) | Title "the Envious" (priority 24) |
| **Gluttony**<br><sub>The Abyss found them through gluttony.</sub> | common | 14 | 14% | Vitality roll +3 positions; Agility roll −1 position; Marked sin_gluttony | [Wheel of Archetypes](#archetype) | Title "the Gluttonous" (priority 24) |
| **Wrath**<br><sub>The Abyss found them through wrath.</sub> | common | 14 | 14% | Might roll +3 positions; Marked sin_wrath | [Wheel of Archetypes](#archetype) | Title "the Wrathful" (priority 24) |
| **Sloth**<br><sub>The Abyss found them through sloth.</sub> | common | 14 | 14% | Vitality roll +2 positions; Agility roll −1 position; Arcana roll +1 position; Marked sin_sloth | [Wheel of Archetypes](#archetype) | Title "the Slothful" (priority 24) |

<a id="god_of_race"></a>
## Whose God Are You?

`god_of_race`

*Every people prays to someone. Equal odds, except the gods themselves.*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Humans**<br><sub>The god Humans pray to.</sub> | common | 10 | 8.3% | Gains Minor Divinity; Claims the one-of-a-kind role Domain People Human | Route, picked by the character: [Which Domain Is Yours?](#god_domain), [Wheel of Archetypes](#archetype) (or End) | One of a kind (Domain People Human): locked while someone holds it. Another god already rules Humans<br>Title "God of Humans" (priority 81) |
| **Elves**<br><sub>The god Elves pray to.</sub> | common | 10 | 8.3% | Gains Minor Divinity; Claims the one-of-a-kind role Domain People Elf | Route, picked by the character: [Which Domain Is Yours?](#god_domain), [Wheel of Archetypes](#archetype) (or End) | One of a kind (Domain People Elf): locked while someone holds it. Another god already rules Elves<br>Title "God of Elves" (priority 81) |
| **Dwarves**<br><sub>The god Dwarves pray to.</sub> | common | 10 | 8.3% | Gains Minor Divinity; Claims the one-of-a-kind role Domain People Dwarf | Route, picked by the character: [Which Domain Is Yours?](#god_domain), [Wheel of Archetypes](#archetype) (or End) | One of a kind (Domain People Dwarf): locked while someone holds it. Another god already rules Dwarves<br>Title "God of Dwarves" (priority 81) |
| **Orcs**<br><sub>The god Orcs pray to.</sub> | common | 10 | 8.3% | Gains Minor Divinity; Claims the one-of-a-kind role Domain People Orc | Route, picked by the character: [Which Domain Is Yours?](#god_domain), [Wheel of Archetypes](#archetype) (or End) | One of a kind (Domain People Orc): locked while someone holds it. Another god already rules Orcs<br>Title "God of Orcs" (priority 81) |
| **Halflings**<br><sub>The god Halflings pray to.</sub> | common | 10 | 8.3% | Gains Minor Divinity; Claims the one-of-a-kind role Domain People Halfling | Route, picked by the character: [Which Domain Is Yours?](#god_domain), [Wheel of Archetypes](#archetype) (or End) | One of a kind (Domain People Halfling): locked while someone holds it. Another god already rules Halflings<br>Title "God of Halflings" (priority 81) |
| **Gnomes**<br><sub>The god Gnomes pray to.</sub> | common | 10 | 8.3% | Gains Minor Divinity; Claims the one-of-a-kind role Domain People Gnome | Route, picked by the character: [Which Domain Is Yours?](#god_domain), [Wheel of Archetypes](#archetype) (or End) | One of a kind (Domain People Gnome): locked while someone holds it. Another god already rules Gnomes<br>Title "God of Gnomes" (priority 81) |
| **Monsters**<br><sub>The god Monsters pray to.</sub> | common | 10 | 8.3% | Gains Minor Divinity; Claims the one-of-a-kind role Domain People Monster | Route, picked by the character: [Which Domain Is Yours?](#god_domain), [Wheel of Archetypes](#archetype) (or End) | One of a kind (Domain People Monster): locked while someone holds it. Another god already rules Monsters<br>Title "God of Monsters" (priority 81) |
| **Dragonborn**<br><sub>The god the Dragonborn pray to.</sub> | common | 10 | 8.3% | Gains Minor Divinity; Claims the one-of-a-kind role Domain People Dragonborn | Route, picked by the character: [Which Domain Is Yours?](#god_domain), [Wheel of Archetypes](#archetype) (or End) | One of a kind (Domain People Dragonborn): locked while someone holds it. Another god already rules the Dragonborn<br>Title "God of the Dragonborn" (priority 81) |
| **Constructs**<br><sub>The god Constructs pray to.</sub> | common | 10 | 8.3% | Gains Minor Divinity; Claims the one-of-a-kind role Domain People Construct | Route, picked by the character: [Which Domain Is Yours?](#god_domain), [Wheel of Archetypes](#archetype) (or End) | One of a kind (Domain People Construct): locked while someone holds it. Another god already rules Constructs<br>Title "God of Constructs" (priority 81) |
| **Angels**<br><sub>The god Angels pray to.</sub> | common | 10 | 8.3% | Gains Minor Divinity; Claims the one-of-a-kind role Domain People Angel | Route, picked by the character: [Which Domain Is Yours?](#god_domain), [Wheel of Archetypes](#archetype) (or End) | One of a kind (Domain People Angel): locked while someone holds it. Another god already rules Angels<br>Title "God of Angels" (priority 81) |
| **Demons**<br><sub>The god Demons pray to.</sub> | common | 10 | 8.3% | Gains Minor Divinity; Claims the one-of-a-kind role Domain People Demon | Route, picked by the character: [Which Domain Is Yours?](#god_domain), [Wheel of Archetypes](#archetype) (or End) | One of a kind (Domain People Demon): locked while someone holds it. Another god already rules Demons<br>Title "God of Demons" (priority 81) |
| **A Forgotten People**<br><sub>Their last worshipper died long ago. The god stayed anyway.</sub> | common | 10 | 8.3% | Gains Minor Divinity | Route, picked by the character: [Which Domain Is Yours?](#god_domain), [Wheel of Archetypes](#archetype) (or End) | Title "God of the Forgotten" (priority 81) |
| **The Gods**<br><sub>The god that gods pray to.</sub> | legendary | 1 | <1% | Luck +0.5; Gains Minor Divinity; Claims the one-of-a-kind role Domain People Gods | Route, picked by the character: [Which Domain Is Yours?](#god_domain), [Wheel of Archetypes](#archetype) (or End) | One of a kind (Domain People Gods): locked while someone holds it. Another god already rules the Gods<br>Title "God of Gods" (priority 96) |

<a id="war_style"></a>
## What Kind of War?

`war_style`

*Some gods love a plan. Some love the screaming.*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Strategic War**<br><sub>Every battle won before it starts.</sub> | common | 50 | 50% | Intellect roll +3 positions | Route, picked by the character: [Which Domain Is Yours?](#god_domain), [Wheel of Archetypes](#archetype) (or End) | Title "God of Strategy" (priority 83) |
| **Brutal War**<br><sub>No plan. Just the charge.</sub> | common | 50 | 50% | Might roll +3 positions | Route, picked by the character: [Which Domain Is Yours?](#god_domain), [Wheel of Archetypes](#archetype) (or End) | Title "God of Slaughter" (priority 83) |

<a id="abyss_calls"></a>
## The Abyss Calls

`abyss_calls`

*Something below knows your name. Some never become heroes at all.*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Resist the Call**<br><sub>You hear it. You refuse it. It will ask again.</sub> | common | 58 | 58% | Vitality roll +1 position | [Wheel of Personality](#personality) | Weight or rarity varies per character |
| **Haunted by It**<br><sub>You said no, but the voice moved in.</sub> | common | 26 | 26% | Arcana roll +1 position; Luck −0.25 | [Wheel of Personality](#personality) | Weight or rarity varies per character |
| **Answer the Call**<br><sub>Never a hero, not for a day. Straight into the Demon Lord’s army.</sub> | uncommon | 16 | 16% | Gains Abyssal Pact; Becomes Dark Champion | [Wheel of Personality](#personality) | Weight or rarity varies per character<br>Title "Sworn to the Abyss" (priority 65) |

<a id="personality"></a>
## Wheel of Personality

`personality`

*Who are they, when no one is watching?*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Brave**<br><sub>Runs toward the screaming.</sub> | common | 20 | 19% | Might roll +1 position; Personality: Brave | Route, picked by the character: [Human Might](stat-ladders.md#stat_might_human), [Elf Might](stat-ladders.md#stat_might_elf), [Wood Elf Might](stat-ladders.md#stat_might_wood_elf), [High Elf Might](stat-ladders.md#stat_might_high_elf) … (25 wheels) (or End) | Title "the Brave" (priority 14) |
| **Cautious**<br><sub>Checks every door twice.</sub> | common | 18 | 17% | Intellect roll +1 position; Personality: Cautious | Route, picked by the character: [Human Might](stat-ladders.md#stat_might_human), [Elf Might](stat-ladders.md#stat_might_elf), [Wood Elf Might](stat-ladders.md#stat_might_wood_elf), [High Elf Might](stat-ladders.md#stat_might_high_elf) … (25 wheels) (or End) | Title "the Cautious" (priority 14) |
| **Kind**<br><sub>Gives away the last loaf.</sub> | common | 16 | 16% | Vitality roll +1 position; Personality: Kind | Route, picked by the character: [Human Might](stat-ladders.md#stat_might_human), [Elf Might](stat-ladders.md#stat_might_elf), [Wood Elf Might](stat-ladders.md#stat_might_wood_elf), [High Elf Might](stat-ladders.md#stat_might_high_elf) … (25 wheels) (or End) | Title "the Kind" (priority 14) |
| **Curious**<br><sub>Opens the box. Always opens the box.</sub> | uncommon | 14 | 14% | Arcana roll +1 position; Personality: Curious | Route, picked by the character: [Human Might](stat-ladders.md#stat_might_human), [Elf Might](stat-ladders.md#stat_might_elf), [Wood Elf Might](stat-ladders.md#stat_might_wood_elf), [High Elf Might](stat-ladders.md#stat_might_high_elf) … (25 wheels) (or End) | Title "the Curious" (priority 14) |
| **Greedy**<br><sub>Counts everything twice and shares nothing.</sub> | uncommon | 10 | 9.7% | Luck +0.25; Personality: Greedy | Route, picked by the character: [Human Might](stat-ladders.md#stat_might_human), [Elf Might](stat-ladders.md#stat_might_elf), [Wood Elf Might](stat-ladders.md#stat_might_wood_elf), [High Elf Might](stat-ladders.md#stat_might_high_elf) … (25 wheels) (or End) | Title "the Greedy" (priority 14) |
| **Reckless**<br><sub>Jumps first. Looks never.</sub> | uncommon | 9 | 8.7% | Agility roll +1 position; Personality: Reckless | Route, picked by the character: [Human Might](stat-ladders.md#stat_might_human), [Elf Might](stat-ladders.md#stat_might_elf), [Wood Elf Might](stat-ladders.md#stat_might_wood_elf), [High Elf Might](stat-ladders.md#stat_might_high_elf) … (25 wheels) (or End) | Title "the Reckless" (priority 14) |
| **Honorable**<br><sub>Keeps every oath, even the stupid ones.</sub> | rare | 7 | 6.8% | Personality: Honorable | Route, picked by the character: [Human Might](stat-ladders.md#stat_might_human), [Elf Might](stat-ladders.md#stat_might_elf), [Wood Elf Might](stat-ladders.md#stat_might_wood_elf), [High Elf Might](stat-ladders.md#stat_might_high_elf) … (25 wheels) (or End) | Title "the Honorable" (priority 14) |
| **Cruel**<br><sub>Enjoys it a little too much.</sub> | rare | 5 | 4.9% | Might roll +1 position; Personality: Cruel | Route, picked by the character: [Human Might](stat-ladders.md#stat_might_human), [Elf Might](stat-ladders.md#stat_might_elf), [Wood Elf Might](stat-ladders.md#stat_might_wood_elf), [High Elf Might](stat-ladders.md#stat_might_high_elf) … (25 wheels) (or End) | Title "the Cruel" (priority 14) |
| **Ambitious**<br><sub>Wants a throne. Any throne.</sub> | rare | 4 | 3.9% | Intellect roll +1 position; Personality: Ambitious | Route, picked by the character: [Human Might](stat-ladders.md#stat_might_human), [Elf Might](stat-ladders.md#stat_might_elf), [Wood Elf Might](stat-ladders.md#stat_might_wood_elf), [High Elf Might](stat-ladders.md#stat_might_high_elf) … (25 wheels) (or End) | Title "the Ambitious" (priority 14) |

<a id="talents"></a>
## Wheel of Talents

`talents`

*What gift did fate leave you? Most get none.*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Ordinary Soul**<br><sub>No gift worth a name. Plenty of legends started here.</sub> | common | 130 | 52% | — | [The Armory](#armory) | Luck -0.5/pt |
| **Blademaster**<br><sub>Steel answers to you.</sub> | common | 25 | 10.0% | +3 Might; +2 Agility; Weapon tier +1; Gains Blademaster | [The Armory](#armory) | Title "Blademaster" (priority 35) |
| **Arcane Savant**<br><sub>The weave of magic is plain to you.</sub> | uncommon | 18 | 7.2% | +3 Intellect; +5 Arcana; Gains Arcane Savant | [The Armory](#armory) | Locked: Requires 12 Arcana<br>Title "the Arcane" (priority 35) |
| **Unbreakable**<br><sub>Pain is information, nothing more.</sub> | common | 25 | 10.0% | +5 Vitality; +1 Might; Gains Iron Will | [The Armory](#armory) | Title "the Unbroken" (priority 28) |
| **Shadowstep**<br><sub>Gone before the guard turns around.</sub> | common | 20 | 8.0% | +5 Agility; Gains Shadowstep | [The Armory](#armory) | Title "Shadowstep" (priority 30) |
| **Echoes of the Fallen**<br><sub>The dead lend you what they learned.</sub> | rare | 12 | 4.8% | +2 Intellect; +2 Vitality; Gains Echoes of the Fallen | [The Armory](#armory) | Locked: Requires 3 souls in the graveyard<br>Title "Voice of the Fallen" (priority 40) |
| **Runesmith**<br><sub>The forge-songs come back to you like a mother tongue.</sub> | rare | 10 | 4.0% | +2 Intellect; +1 Might; Weapon tier +1; Gains Runesmith | [The Armory](#armory) | Locked: Only dwarves are taught the runes<br>Title "the Runesmith" (priority 40) |
| **Archmage of the Spire**<br><sub>The tower has waited for you.</sub> | epic | 6 | 2.4% | +4 Intellect; +8 Arcana; Gains Archmage of the Spire; Claims the one-of-a-kind role Archmage | [The Armory](#armory) | One of a kind (Archmage): locked while someone holds it. Requires 13 Arcana<br>Title "Archmage of the Spire" (priority 90) |
| **Chosen of the Holy Sword**<br><sub>The blade picked you. It does not explain itself.</sub> | legendary | 5 | 2.0% | Weapon tier +5; Gains Holy Sword Bearer; Claims the one-of-a-kind role Holy Sword Bearer | [What Do You Wear?](#outfitter) | One of a kind (Holy Sword Bearer): locked while someone holds it. The Holy Sword sleeps until a Demon Lord rises<br>Threat +0.5/lvl<br>Title "Bearer of the Holy Sword" (priority 95) |

<a id="abyssal"></a>
## Abyssal Wheel

`abyssal`

*What manner of darkness do you rule?*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Infernal Tyrant**<br><sub>The world will burn on your schedule.</sub> | common | 35 | 35% | +10 Might; +5 Vitality; Weapon tier +3; Armour tier +4; Gains Infernal Tyrant | Route, picked by the character: [Blessed Powers](#blessed_powers), [Corrupted Powers](#corrupted_powers), [Arcane Powers](#arcane_powers) (or End) | Title "the Infernal Tyrant" (priority 101) |
| **Plague Sovereign**<br><sub>Your court coughs in unison.</sub> | common | 30 | 30% | +8 Arcana; +4 Vitality; Weapon tier +2; Armour tier +2; Gains Plague Sovereign | Route, picked by the character: [Blessed Powers](#blessed_powers), [Corrupted Powers](#corrupted_powers), [Arcane Powers](#arcane_powers) (or End) | Title "the Plague Sovereign" (priority 101) |
| **Void Herald**<br><sub>Something vast speaks through you.</sub> | uncommon | 25 | 25% | +6 Agility; +6 Arcana; Weapon tier +2; Armour tier +2; Gains Void Herald | Route, picked by the character: [Blessed Powers](#blessed_powers), [Corrupted Powers](#corrupted_powers), [Arcane Powers](#arcane_powers) (or End) | Title "Herald of the Void" (priority 101) |
| **Lich King**<br><sub>Death was a door, and you kept the key.</sub> | epic | 10 | 10% | +12 Arcana; +6 Intellect; Weapon tier +2; Armour tier +3; Gains Phylactery | Route, picked by the character: [Blessed Powers](#blessed_powers), [Corrupted Powers](#corrupted_powers), [Arcane Powers](#arcane_powers) (or End) | Locked: Requires 5 souls in the graveyard<br>Threat +0.3/lvl<br>Title "the Lich King" (priority 102) |

<a id="armory"></a>
## The Armory

`armory`

*Most souls set out with nothing. The lucky ones set out armed.*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Empty Hands**<br><sub>Nothing but fists and nerve. The road has weapons, for those who survive it.</sub> | common | 28 | 28% | +2 Agility | [What Do You Wear?](#outfitter) | Luck -0.6/pt |
| **Rusted Shortsword**<br><sub>It has seen better centuries.</sub> | common | 9 | 9.1% | Weapon tier +1 | [What Do You Wear?](#outfitter) |  |
| **Hunting Spear**<br><sub>Reach, balance, and a sharp point.</sub> | common | 7.5 | 7.6% | +1 Might; Weapon tier +1 | [What Do You Wear?](#outfitter) |  |
| **Iron Mace**<br><sub>Crude, heavy, honest.</sub> | common | 7 | 7.1% | +1 Vitality; Weapon tier +1 | [What Do You Wear?](#outfitter) |  |
| **Hunter’s Longbow**<br><sub>Patience, strung and waxed.</sub> | uncommon | 6 | 6.1% | +2 Agility; Weapon tier +2 | [What Do You Wear?](#outfitter) | Luck +0.3/pt |
| **Runed Staff**<br><sub>Warm to the touch, and humming.</sub> | uncommon | 5 | 5.1% | +3 Arcana; Weapon tier +2 | [What Do You Wear?](#outfitter) | Luck +0.4/pt |
| **Dwarven War Axe**<br><sub>Heavy enough to settle arguments.</sub> | uncommon | 5 | 5.1% | +3 Might; Weapon tier +3 | [What Do You Wear?](#outfitter) | Luck +0.5/pt |
| **Twin Daggers**<br><sub>One for the front, one for the back.</sub> | uncommon | 4.5 | 4.5% | +2 Agility; Weapon tier +2 | [What Do You Wear?](#outfitter) | Luck +0.3/pt |
| **Crossbow**<br><sub>Point, pull, problem solved.</sub> | uncommon | 4.5 | 4.5% | +1 Agility; Weapon tier +2 | [What Do You Wear?](#outfitter) | Luck +0.3/pt |
| **Apprentice’s Wand**<br><sub>A little stick that does big things, for the right hand.</sub> | uncommon | 4 | 4.0% | +4 Arcana; Weapon tier +1 | [What Do You Wear?](#outfitter) | Luck +0.4/pt |
| **Warhammer**<br><sub>Armour is just a suggestion.</sub> | rare | 3 | 3.0% | +2 Might; +1 Vitality; Weapon tier +3 | [What Do You Wear?](#outfitter) | Luck +0.6/pt |
| **Duelist’s Rapier**<br><sub>Thin, quick, and very rude.</sub> | rare | 3 | 3.0% | +3 Agility; Weapon tier +3 | [What Do You Wear?](#outfitter) | Luck +0.6/pt |
| **Greatsword**<br><sub>Taller than some of its owners.</sub> | rare | 2.5 | 2.5% | +2 Might; Weapon tier +4 | [What Do You Wear?](#outfitter) | Luck +0.6/pt |
| **Heirloom of the Fallen**<br><sub>Taken up from a hero who will not need it again.</sub> | rare | 3.5 | 3.5% | Weapon tier +4 | [What Do You Wear?](#outfitter) | Locked: No hero has fallen yet<br>Luck +0.6/pt<br>Title "Heir of the Fallen" (priority 32) |
| **Elven Moonbow**<br><sub>Strung with moonlight. It misses only on purpose.</sub> | epic | 2.5 | 2.5% | +3 Agility; Weapon tier +4 | [What Do You Wear?](#outfitter) | Locked: Only an elf can draw a moonbow<br>Luck +0.8/pt<br>Title "Moonbow" (priority 42) |
| **Obsidian Glaive**<br><sub>Volcanic glass on a long black haft. It never dulls.</sub> | epic | 1.5 | 1.5% | +2 Might; +2 Agility; Weapon tier +4 | [What Do You Wear?](#outfitter) | Luck +0.8/pt<br>Title "of the Black Glaive" (priority 42) |
| **Stormbow**<br><sub>Every arrow lands with a clap of thunder.</sub> | epic | 1.25 | 1.3% | +3 Agility; +2 Arcana; Weapon tier +4 | [What Do You Wear?](#outfitter) | Luck +0.9/pt<br>Title "Stormcaller" (priority 44) |
| **Dragonbone Blade**<br><sub>Carved from the last of the old wyrms.</sub> | legendary | 1.25 | 1.3% | Weapon tier +5; Gains Dragonbone | [What Do You Wear?](#outfitter) | Luck +1.5/pt<br>Threat +0.3/lvl<br>Title "Dragonbone" (priority 48) |

<a id="outfitter"></a>
## What Do You Wear?

`outfitter`

*Most souls set out in their travelling clothes. The lucky ones set out in steel.*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Travelling Clothes**<br><sub>A good cloak and sturdy boots. The road has armour, for those who survive it.</sub> | common | 30 | 29% | — | Route, picked by the character: [Blessed Powers](#blessed_powers), [Corrupted Powers](#corrupted_powers), [Arcane Powers](#arcane_powers) (or End) | Luck -0.6/pt |
| **Padded Gambeson**<br><sub>Quilted cloth, thick enough to stop a knife. Usually.</sub> | common | 12 | 12% | Armour tier +1 | Route, picked by the character: [Blessed Powers](#blessed_powers), [Corrupted Powers](#corrupted_powers), [Arcane Powers](#arcane_powers) (or End) |  |
| **Leather Jerkin**<br><sub>Light, quiet, and it smells of the tannery.</sub> | common | 11 | 11% | +1 Agility; Armour tier +1 | Route, picked by the character: [Blessed Powers](#blessed_powers), [Corrupted Powers](#corrupted_powers), [Arcane Powers](#arcane_powers) (or End) |  |
| **Hide Armour**<br><sub>The bear wore it first.</sub> | common | 9 | 8.8% | +1 Vitality; Armour tier +1 | Route, picked by the character: [Blessed Powers](#blessed_powers), [Corrupted Powers](#corrupted_powers), [Arcane Powers](#arcane_powers) (or End) |  |
| **Chain Shirt**<br><sub>Ten thousand little rings, and every one of them heavy.</sub> | uncommon | 7 | 6.8% | Armour tier +2 | Route, picked by the character: [Blessed Powers](#blessed_powers), [Corrupted Powers](#corrupted_powers), [Arcane Powers](#arcane_powers) (or End) | Luck +0.3/pt |
| **Brigandine**<br><sub>Steel plates riveted inside a soldier’s coat.</sub> | uncommon | 6 | 5.8% | +1 Might; Armour tier +2 | Route, picked by the character: [Blessed Powers](#blessed_powers), [Corrupted Powers](#corrupted_powers), [Arcane Powers](#arcane_powers) (or End) | Luck +0.3/pt |
| **Shield and Helm**<br><sub>Round shield, iron cap, and the sense to hide behind both.</sub> | uncommon | 6 | 5.8% | Armour tier +2 | Route, picked by the character: [Blessed Powers](#blessed_powers), [Corrupted Powers](#corrupted_powers), [Arcane Powers](#arcane_powers) (or End) | Luck +0.3/pt |
| **Robes of Warding**<br><sub>Embroidered with runes that turn a blade aside, and amplify a spell.</sub> | uncommon | 5 | 4.9% | +3 Arcana; Armour tier +1 | Route, picked by the character: [Blessed Powers](#blessed_powers), [Corrupted Powers](#corrupted_powers), [Arcane Powers](#arcane_powers) (or End) | Luck +0.4/pt |
| **Scale Mail**<br><sub>Overlapping steel, like a fish that went to war.</sub> | rare | 3.5 | 3.4% | Armour tier +3 | Route, picked by the character: [Blessed Powers](#blessed_powers), [Corrupted Powers](#corrupted_powers), [Arcane Powers](#arcane_powers) (or End) | Luck +0.6/pt |
| **Full Plate**<br><sub>A walking fortress. Stairs are a problem.</sub> | rare | 3 | 2.9% | −1 Agility; Armour tier +4 | Route, picked by the character: [Blessed Powers](#blessed_powers), [Corrupted Powers](#corrupted_powers), [Arcane Powers](#arcane_powers) (or End) | Luck +0.6/pt<br>Title "Iron-Clad" (priority 26) |
| **Armour of the Fallen**<br><sub>Dented where its last owner was not quick enough.</sub> | rare | 3 | 2.9% | Armour tier +3 | Route, picked by the character: [Blessed Powers](#blessed_powers), [Corrupted Powers](#corrupted_powers), [Arcane Powers](#arcane_powers) (or End) | Locked: No hero has fallen yet<br>Luck +0.6/pt |
| **Elven Mithril**<br><sub>Light as silk, hard as a promise.</sub> | epic | 2.5 | 2.4% | +2 Agility; Armour tier +4 | Route, picked by the character: [Blessed Powers](#blessed_powers), [Corrupted Powers](#corrupted_powers), [Arcane Powers](#arcane_powers) (or End) | Locked: Only an elf is given mithril<br>Luck +0.8/pt<br>Title "Mithril-Clad" (priority 40) |
| **Dwarven Plate**<br><sub>Forged under the mountain, for someone exactly this tall.</sub> | epic | 2.5 | 2.4% | +1 Vitality; Armour tier +4 | Route, picked by the character: [Blessed Powers](#blessed_powers), [Corrupted Powers](#corrupted_powers), [Arcane Powers](#arcane_powers) (or End) | Locked: Only dwarves are fitted for it<br>Luck +0.8/pt<br>Title "the Anvil-Clad" (priority 40) |
| **Dragonscale Armour**<br><sub>Scales that turned a dragon’s own fire.</sub> | legendary | 1.2 | 1.2% | Armour tier +5; Gains Dragonscale Armour | Route, picked by the character: [Blessed Powers](#blessed_powers), [Corrupted Powers](#corrupted_powers), [Arcane Powers](#arcane_powers) (or End) | Luck +1.5/pt<br>Threat +0.3/lvl<br>Title "Dragonscale" (priority 48) |
| **Celestial Aegis**<br><sub>A shield of light, forged above the clouds, for a blessed hand.</sub> | legendary | 1 | <1% | Armour tier +5; Gains Celestial Aegis | Route, picked by the character: [Blessed Powers](#blessed_powers), [Corrupted Powers](#corrupted_powers), [Arcane Powers](#arcane_powers) (or End) | Locked: Only the blessed may bear it<br>Luck +1.5/pt<br>Title "of the Aegis" (priority 48) |

<a id="blessed_powers"></a>
## Blessed Powers

`blessed_powers` · can repeat

*The light offers a gift. Which one?*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Healing Light**<br><sub>Wounds close at a touch.</sub> | common | 18 | 18% | Gains Healing Light; Marked power | [Mastery of the Power](#power_mastery) | Locked: Already known |
| **Divine Shield**<br><sub>A wall of light no blade can pass.</sub> | common | 16 | 16% | Gains Divine Shield; Marked power | [Mastery of the Power](#power_mastery) | Locked: Already known |
| **Smite**<br><sub>Holy wrath, delivered by hand.</sub> | common | 14 | 14% | Gains Smite; Marked power | [Mastery of the Power](#power_mastery) | Locked: Already known |
| **Holy Flame**<br><sub>Fire that burns only the wicked.</sub> | uncommon | 10 | 10% | Gains Holy Flame; Marked power | [Mastery of the Power](#power_mastery) | Locked: Already known |
| **Radiant Aura**<br><sub>The dark backs away from them.</sub> | uncommon | 9 | 9.2% | Gains Radiant Aura; Marked power | [Mastery of the Power](#power_mastery) | Locked: Already known |
| **Sanctuary**<br><sub>Where they stand, no harm can enter.</sub> | uncommon | 8 | 8.2% | Gains Sanctuary; Marked power | [Mastery of the Power](#power_mastery) | Locked: Already known |
| **Fortune’s Blessing**<br><sub>Luck, delivered by an angel.</sub> | uncommon | 8 | 8.2% | Luck +0.5; Gains Fortune’s Blessing; Marked power | [Mastery of the Power](#power_mastery) | Locked: Already known |
| **Angelic Wings**<br><sub>White wings, for when walking is beneath you.</sub> | epic | 3 | 3.1% | Gains Angelic Wings; Marked power | [Mastery of the Power](#power_mastery) | Locked: Already known<br>Stats: arcana +0.03/pt<br>Title "the Winged" (priority 50) |
| **Resurrection**<br><sub>Death is a door they can open from the other side.</sub> | legendary | 1.5 | 1.5% | Gains Resurrection; Marked power | [Mastery of the Power](#power_mastery) | Locked: Already known<br>Stats: arcana +0.04/pt<br>Title "the Twice-Born" (priority 70) |
| **Miracle**<br><sub>The impossible, once a day.</sub> | mythical | 0.4 | <1% | Gains Miracle; Marked power | [Mastery of the Power](#power_mastery) | Locked: Already known<br>Stats: arcana +0.04/pt<br>Title "the Miracle-Worker" (priority 88) |
| **Fleeting Grace**<br><sub>The light touches them, and moves on.</sub> | common | 10 | 10% | +1 Vitality; Luck +0.25 | Route, picked by the character: [Blessed Powers](#blessed_powers), [Corrupted Powers](#corrupted_powers), [Arcane Powers](#arcane_powers) (or End) |  |

<a id="corrupted_powers"></a>
## Corrupted Powers

`corrupted_powers` · can repeat

*The Abyss offers a gift. It always wants something back.*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Shadow Bolt**<br><sub>A spear of darkness, thrown.</sub> | common | 18 | 18% | Gains Shadow Bolt; Marked power | [Mastery of the Power](#power_mastery) | Locked: Already known |
| **Life Drain**<br><sub>Every wound they deal heals them.</sub> | common | 16 | 16% | Gains Life Drain; Marked power | [Mastery of the Power](#power_mastery) | Locked: Already known |
| **Aura of Dread**<br><sub>Brave men run. Cowards faint.</sub> | common | 14 | 14% | Gains Aura of Dread; Marked power | [Mastery of the Power](#power_mastery) | Locked: Already known |
| **Hellfire**<br><sub>Fire from below. It does not go out.</sub> | uncommon | 10 | 10% | Gains Hellfire; Marked power | [Mastery of the Power](#power_mastery) | Locked: Already known |
| **Raise the Dead**<br><sub>The fallen get up and follow them.</sub> | uncommon | 9 | 9.2% | Gains Raise the Dead; Marked power | [Mastery of the Power](#power_mastery) | Locked: Already known |
| **Plague Touch**<br><sub>Sickness spreads where they walk.</sub> | uncommon | 8 | 8.2% | Gains Plague Touch; Marked power | [Mastery of the Power](#power_mastery) | Locked: Already known |
| **Curse of Ruin**<br><sub>Their enemies’ luck sours and dies.</sub> | uncommon | 8 | 8.2% | Gains Curse of Ruin; Marked power | [Mastery of the Power](#power_mastery) | Locked: Already known |
| **Demonic Wings**<br><sub>Leathern wings, and a shadow that falls first.</sub> | epic | 3 | 3.1% | Gains Demonic Wings; Marked power | [Mastery of the Power](#power_mastery) | Locked: Already known<br>Stats: arcana +0.03/pt<br>Title "the Dark-Winged" (priority 50) |
| **Soul Rend**<br><sub>They tear the soul out first. The body follows.</sub> | legendary | 1.5 | 1.5% | Gains Soul Rend; Marked power | [Mastery of the Power](#power_mastery) | Locked: Already known<br>Stats: arcana +0.04/pt<br>Title "the Soul-Render" (priority 70) |
| **The Unmaking**<br><sub>What they touch was never there.</sub> | mythical | 0.4 | <1% | Gains The Unmaking; Marked power | [Mastery of the Power](#power_mastery) | Locked: Already known<br>Stats: arcana +0.04/pt<br>Title "the Unmaker" (priority 88) |
| **Dark Hunger**<br><sub>The Abyss feeds them a little. Just a taste.</sub> | common | 10 | 10% | +2 Might | Route, picked by the character: [Blessed Powers](#blessed_powers), [Corrupted Powers](#corrupted_powers), [Arcane Powers](#arcane_powers) (or End) |  |

<a id="arcane_powers"></a>
## Arcane Powers

`arcane_powers` · can repeat

*Which spell answers when they call?*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Fireball**<br><sub>The classic. Still works.</sub> | common | 18 | 18% | Gains Fireball; Marked power | [Mastery of the Power](#power_mastery) | Locked: Already known |
| **Frost Lance**<br><sub>Ice, thrown very hard.</sub> | common | 16 | 16% | Gains Frost Lance; Marked power | [Mastery of the Power](#power_mastery) | Locked: Already known |
| **Chain Lightning**<br><sub>One bolt, everyone it can reach.</sub> | common | 14 | 14% | Gains Chain Lightning; Marked power | [Mastery of the Power](#power_mastery) | Locked: Already known |
| **Arcane Shield**<br><sub>A shimmer that turns aside steel.</sub> | uncommon | 10 | 10% | Gains Arcane Shield; Marked power | [Mastery of the Power](#power_mastery) | Locked: Already known |
| **Blink**<br><sub>Here. Now there. Now behind you.</sub> | uncommon | 9 | 9.2% | Gains Blink; Marked power | [Mastery of the Power](#power_mastery) | Locked: Already known |
| **Mind Reading**<br><sub>Every secret, in a glance.</sub> | uncommon | 8 | 8.2% | Gains Mind Reading; Marked power | [Mastery of the Power](#power_mastery) | Locked: Already known |
| **Summon Elemental**<br><sub>Earth, wind or fire: it comes when called.</sub> | uncommon | 8 | 8.2% | Gains Summon Elemental; Marked power | [Mastery of the Power](#power_mastery) | Locked: Already known |
| **Meteor Swarm**<br><sub>The sky falls, on request.</sub> | epic | 3 | 3.1% | Gains Meteor Swarm; Marked power | [Mastery of the Power](#power_mastery) | Locked: Already known<br>Stats: arcana +0.03/pt<br>Title "the Starcaller" (priority 50) |
| **Time Stop**<br><sub>Everything waits while they think.</sub> | legendary | 1.5 | 1.5% | Gains Time Stop; Marked power | [Mastery of the Power](#power_mastery) | Locked: Already known<br>Stats: arcana +0.04/pt<br>Title "the Timeless" (priority 70) |
| **Wish**<br><sub>Reality, rewritten in a sentence.</sub> | mythical | 0.4 | <1% | Gains Wish; Marked power | [Mastery of the Power](#power_mastery) | Locked: Already known<br>Stats: arcana +0.04/pt<br>Title "Who Spoke the Wish" (priority 88) |
| **Arcane Spark**<br><sub>Not a spell yet. A start.</sub> | common | 10 | 10% | +2 Arcana | Route, picked by the character: [Blessed Powers](#blessed_powers), [Corrupted Powers](#corrupted_powers), [Arcane Powers](#arcane_powers) (or End) |  |

<a id="power_mastery"></a>
## Mastery of the Power

`power_mastery` · can repeat

*Knowing a spell is one thing. How well do they wield it?*

| Option | Rarity | Weight | Base chance | Effects | Leads to | Notes |
|---|---|---|---|---|---|---|
| **Practised**<br><sub>Reliable, if unremarkable.</sub> | common | 34 | 34% | Their newest power: Practised | Route, picked by the character: [Blessed Powers](#blessed_powers), [Corrupted Powers](#corrupted_powers), [Arcane Powers](#arcane_powers) (or End) |  |
| **Novice**<br><sub>It works about half the time. The other half is exciting.</sub> | common | 28 | 28% | Their newest power: Novice, ×0.75 power | Route, picked by the character: [Blessed Powers](#blessed_powers), [Corrupted Powers](#corrupted_powers), [Arcane Powers](#arcane_powers) (or End) | Stats: arcana -0.02/pt |
| **Expert**<br><sub>Smooth, quick, and on purpose.</sub> | uncommon | 22 | 22% | Their newest power: Expert, ×1.35 power | Route, picked by the character: [Blessed Powers](#blessed_powers), [Corrupted Powers](#corrupted_powers), [Arcane Powers](#arcane_powers) (or End) | Stats: arcana +0.02/pt |
| **Virtuoso**<br><sub>They improvise with it. It still works.</sub> | rare | 10 | 10% | Their newest power: Virtuoso, ×1.75 power | Route, picked by the character: [Blessed Powers](#blessed_powers), [Corrupted Powers](#corrupted_powers), [Arcane Powers](#arcane_powers) (or End) | Stats: arcana +0.03/pt |
| **Paragon**<br><sub>Scholars write books about how they cast it.</sub> | epic | 4.5 | 4.5% | Their newest power: Paragon, ×2.5 power | Route, picked by the character: [Blessed Powers](#blessed_powers), [Corrupted Powers](#corrupted_powers), [Arcane Powers](#arcane_powers) (or End) | Stats: arcana +0.04/pt |
| **Transcendent**<br><sub>The power is less something they use than something they are.</sub> | legendary | 1.2 | 1.2% | Their newest power: Transcendent, ×4 power | Route, picked by the character: [Blessed Powers](#blessed_powers), [Corrupted Powers](#corrupted_powers), [Arcane Powers](#arcane_powers) (or End) | Stats: arcana +0.04/pt<br>Title "the Transcendent" (priority 66) |