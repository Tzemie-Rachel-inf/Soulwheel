# Quest playtest

An autoplayer (it picks each choice by the weights in the config, so it behaves like a player choosing at random) ran complete quests with freshly generated heroes of every race and personality: one batch at world threat 0, one at world threat 6, each in a world with six other characters in it.

What changed after the first run, because of what it showed:

- Rivals rarely concluded (71–79% ended "still out there"; only 30% ever struck back). Now they strike sooner and almost surely before the end, the duel finale weighs more, and in every other finale a rival still in play leads the enemy (their name and half their power join it) and is concluded by how it goes. A rival who kills the hero has had their revenge.
- Deaths left the tale unexplained (it just stopped). Every death now writes a line.
- Too many quests ended mid-way at high threat (17%). Encounter fights are a little less deadly, and scale a little less with threat.
- Turns (talks failing, being cornered, a parley collapsing into a duel) went unrecorded. They are written into the tale now.
- A witch’s gift taken late could go unpaid. She now bargains only with road left, and always collects before the end; hired swords always ask for more.

Reading the numbers: "finale by history" is the state just before the finale (an active rival or not, the quest's threat, allies or alone) against the finale the wheel picked.

## World threat 0: 268 quests
- length avg 6.0; threat at finale avg 1.5
- rival made 94 (35%), struck 69, gambit 23
- rival fates: Fell to H in the final duel 15 (16%), Stood against H at the end of The Beast of Wyrmwood 14 (15%), Stood against H at the end of The Lost Heir 14 (15%), the final duel 9 (10%), Stood against H at the end of The Stolen Sunstone 8 (9%), Stood against H at the end of The Siege of Harrowgate 6 (6%), Fell to H in a duel the bards still sing 5 (5%), Killed H in the final duel 4 (4%), Laid down their grudge 4 (4%), Killed H on the road 3 (3%), Backed down before H 2 (2%), Stood against X at the end of The Siege of Harrowgate 2 (2%), Stood against X at the end of The Lost Heir 1 (1%), Broken by H in battle 1 (1%), Fell to X in the final duel 1 (1%), still out there 1 (1%), Stood against X at the end of The Stolen Sunstone 1 (1%), Had H killed by their lieutenants 1 (1%), Made peace with H 1 (1%), Made a truce with H 1 (1%)
- deaths 53 (20%), of which at the finale 35
- rare events 74, legendary 13, world threat moved in 34; quests with a repeated log line: 0; unpaid bargains among survivors: 1
- finales: fin_siege 68 (25%), fin_escape 61 (23%), fin_lair 49 (18%), fin_duel 35 (13%), fin_alliance 30 (11%), (died before the finale) 18 (7%), fin_parley 7 (3%)
- endings: objective done 150 (56%), failed 64 (24%), died 49 (18%), sacrificed 4 (1%), left unfinished 1 (0%)
- road picks: enc_champion 175 (11%), enc_relic 162 (10%), enc_wounded 159 (10%), enc_flood 151 (10%), enc_banners 147 (9%), enc_ambush 140 (9%), quiet 117 (7%), q_events_common 109 (7%), enc_witch 94 (6%), enc_refugees 90 (6%), q_events_rare 74 (5%), enc_rival_strikes 69 (4%), enc_witch_price 32 (2%), enc_hired_demand 29 (2%), enc_rival_gambit 23 (1%), q_events_legendary 13 (1%)
- finale by history: no rival / threat low / allies → fin_alliance: 19
  no rival / threat low / allies → fin_escape: 14
  no rival / threat low / allies → fin_lair: 21
  no rival / threat low / allies → fin_siege: 29
  no rival / threat low / alone → fin_alliance: 1
  no rival / threat low / alone → fin_escape: 23
  no rival / threat low / alone → fin_lair: 17
  no rival / threat low / alone → fin_siege: 15
  no rival / threat mid / allies → fin_alliance: 3
  no rival / threat mid / allies → fin_escape: 4
  no rival / threat mid / allies → fin_lair: 3
  no rival / threat mid / allies → fin_siege: 6
  no rival / threat mid / alone → fin_alliance: 2
  no rival / threat mid / alone → fin_escape: 1
  no rival / threat mid / alone → fin_lair: 1
  no rival / threat mid / alone → fin_siege: 3
  rival / threat high / allies → fin_duel: 1
  rival / threat high / allies → fin_siege: 1
  rival / threat low / allies → fin_alliance: 3
  rival / threat low / allies → fin_duel: 11
  rival / threat low / allies → fin_escape: 3
  rival / threat low / allies → fin_lair: 1
  rival / threat low / allies → fin_parley: 1
  rival / threat low / allies → fin_siege: 3
  rival / threat low / alone → fin_duel: 13
  rival / threat low / alone → fin_escape: 10
  rival / threat low / alone → fin_lair: 4
  rival / threat low / alone → fin_parley: 1
  rival / threat low / alone → fin_siege: 4
  rival / threat mid / allies → fin_alliance: 2
  rival / threat mid / allies → fin_duel: 7
  rival / threat mid / allies → fin_escape: 4
  rival / threat mid / allies → fin_lair: 1
  rival / threat mid / allies → fin_parley: 4
  rival / threat mid / allies → fin_siege: 5
  rival / threat mid / alone → fin_duel: 3
  rival / threat mid / alone → fin_escape: 2
  rival / threat mid / alone → fin_lair: 1
  rival / threat mid / alone → fin_parley: 1
  rival / threat mid / alone → fin_siege: 2
- choices: enc_ambush:false_trail=30 enc_ambush:run=39 enc_ambush:stand_and_fight=49 enc_ambush:throw_purse=22 enc_banners:sabotage=26 enc_banners:stand_with_villagers=41 enc_banners:stay_out=44 enc_banners:take_the_coin=36 enc_champion:duel_honourably=59 enc_champion:pay_toll=28 enc_champion:shame_them=30 enc_champion:talk_past=58 enc_flood:detour=59 enc_flood:ford=57 enc_flood:leave_gear=35 enc_hired_demand:let_them_go=13 enc_hired_demand:pay_up=16 enc_refugees:escort=36 enc_refugees:give_supplies=33 enc_refugees:turn_away=21 enc_relic:ask_for_it=65 enc_relic:leave_it=43 enc_relic:steal_it=54 enc_rival_gambit:give_it_back=2 enc_rival_gambit:go_after_them=14 enc_rival_gambit:let_it_go=7 enc_rival_strikes:face_them=25 enc_rival_strikes:parley=26 enc_rival_strikes:set_trap=4 enc_rival_strikes:slip_away=14 enc_witch_price:give_it_back=7 enc_witch_price:pay_in_blood=12 enc_witch_price:pay_with_ally=4 enc_witch_price:refuse_to_pay=9 enc_witch:cheat_her=26 enc_witch:refuse=34 enc_witch:take_the_gift=34 enc_wounded:hire_them=35 enc_wounded:rob_them=25 enc_wounded:tend_wounds=55 enc_wounded:walk_on=44 fin_alliance:face_the_horror=1 fin_alliance:lead_the_charge=10 fin_alliance:unite_them=19 fin_duel:call_allies=5 fin_duel:head_on=22 fin_duel:offer_mercy=6 fin_duel:use_relic=2 fin_escape:hide=18 fin_escape:hold_the_pass=9 fin_escape:run_for_border=16 fin_escape:turn_and_fight=18 fin_lair:relic_light=4 fin_lair:sneak_in=21 fin_lair:storm_in=24 fin_parley:offer_terms=4 fin_parley:threaten=2 fin_parley:walk_away=1 fin_siege:burn_engines=25 fin_siege:lead_defence=26 fin_siege:negotiate_surrender=11 fin_siege:rally_countryside=6

## World threat 6: 276 quests
- length avg 6.0; threat at finale avg 3.6
- rival made 106 (38%), struck 76, gambit 26
- rival fates: Fell to H in the final duel 23 (22%), Stood against H at the end of The Siege of Harrowgate 16 (15%), Stood against H at the end of The Stolen Sunstone 12 (11%), Stood against H at the end of The Lost Heir 11 (10%), the final duel 10 (9%), Killed H in the final duel 8 (8%), Killed H on the road 6 (6%), Stood against H at the end of The Beast of Wyrmwood 5 (5%), Broken by H in battle 4 (4%), Made peace with H 2 (2%), Made a truce with H 2 (2%), Laid down their grudge 2 (2%), still out there 2 (2%), Fell to H in a duel the bards still sing 2 (2%), Backed down before H 1 (1%)
- deaths 79 (29%), of which at the finale 47
- rare events 89, legendary 17, world threat moved in 43; quests with a repeated log line: 0; unpaid bargains among survivors: 1
- finales: fin_siege 77 (28%), fin_escape 58 (21%), fin_lair 43 (16%), fin_duel 42 (15%), (died before the finale) 32 (12%), fin_alliance 18 (7%), fin_parley 6 (2%)
- endings: objective done 135 (49%), died 77 (28%), failed 62 (22%), sacrificed 2 (1%)
- road picks: enc_ambush 195 (13%), enc_champion 178 (11%), enc_relic 154 (10%), enc_wounded 151 (10%), enc_flood 126 (8%), enc_banners 118 (8%), q_events_common 116 (7%), quiet 114 (7%), q_events_rare 89 (6%), enc_refugees 86 (6%), enc_rival_strikes 76 (5%), enc_witch 69 (4%), enc_rival_gambit 26 (2%), enc_hired_demand 25 (2%), enc_witch_price 18 (1%), q_events_legendary 17 (1%)
- finale by history: no rival / threat high / allies → fin_escape: 1
  no rival / threat high / allies → fin_lair: 4
  no rival / threat high / allies → fin_siege: 3
  no rival / threat high / alone → fin_alliance: 1
  no rival / threat high / alone → fin_escape: 1
  no rival / threat high / alone → fin_siege: 1
  no rival / threat low / allies → fin_alliance: 5
  no rival / threat low / allies → fin_escape: 6
  no rival / threat low / allies → fin_lair: 6
  no rival / threat low / allies → fin_siege: 4
  no rival / threat low / alone → fin_escape: 15
  no rival / threat low / alone → fin_lair: 8
  no rival / threat low / alone → fin_siege: 14
  no rival / threat mid / allies → fin_alliance: 9
  no rival / threat mid / allies → fin_escape: 15
  no rival / threat mid / allies → fin_lair: 13
  no rival / threat mid / allies → fin_siege: 23
  no rival / threat mid / alone → fin_escape: 9
  no rival / threat mid / alone → fin_lair: 3
  no rival / threat mid / alone → fin_siege: 11
  rival / threat high / allies → fin_alliance: 1
  rival / threat high / allies → fin_duel: 8
  rival / threat high / allies → fin_escape: 3
  rival / threat high / allies → fin_lair: 1
  rival / threat high / allies → fin_parley: 2
  rival / threat high / allies → fin_siege: 1
  rival / threat high / alone → fin_duel: 5
  rival / threat high / alone → fin_escape: 2
  rival / threat high / alone → fin_lair: 1
  rival / threat high / alone → fin_parley: 1
  rival / threat high / alone → fin_siege: 4
  rival / threat low / allies → fin_alliance: 1
  rival / threat low / allies → fin_duel: 1
  rival / threat low / allies → fin_siege: 1
  rival / threat low / alone → fin_duel: 3
  rival / threat low / alone → fin_lair: 1
  rival / threat low / alone → fin_siege: 1
  rival / threat mid / allies → fin_alliance: 1
  rival / threat mid / allies → fin_duel: 10
  rival / threat mid / allies → fin_escape: 4
  rival / threat mid / allies → fin_lair: 1
  rival / threat mid / allies → fin_parley: 2
  rival / threat mid / allies → fin_siege: 7
  rival / threat mid / alone → fin_duel: 15
  rival / threat mid / alone → fin_escape: 2
  rival / threat mid / alone → fin_lair: 5
  rival / threat mid / alone → fin_parley: 1
  rival / threat mid / alone → fin_siege: 7
- choices: enc_ambush:false_trail=48 enc_ambush:run=49 enc_ambush:stand_and_fight=57 enc_ambush:throw_purse=41 enc_banners:sabotage=33 enc_banners:stand_with_villagers=30 enc_banners:stay_out=30 enc_banners:take_the_coin=25 enc_champion:duel_honourably=55 enc_champion:pay_toll=33 enc_champion:shame_them=45 enc_champion:talk_past=45 enc_flood:detour=53 enc_flood:ford=53 enc_flood:leave_gear=20 enc_hired_demand:let_them_go=13 enc_hired_demand:pay_up=12 enc_refugees:escort=30 enc_refugees:give_supplies=29 enc_refugees:turn_away=27 enc_relic:ask_for_it=60 enc_relic:leave_it=44 enc_relic:steal_it=50 enc_rival_gambit:give_it_back=2 enc_rival_gambit:go_after_them=13 enc_rival_gambit:let_it_go=11 enc_rival_strikes:face_them=28 enc_rival_strikes:parley=19 enc_rival_strikes:set_trap=1 enc_rival_strikes:slip_away=28 enc_witch_price:give_it_back=5 enc_witch_price:pay_in_blood=8 enc_witch_price:refuse_to_pay=5 enc_witch:cheat_her=15 enc_witch:refuse=35 enc_witch:take_the_gift=19 enc_wounded:hire_them=31 enc_wounded:rob_them=32 enc_wounded:tend_wounds=50 enc_wounded:walk_on=38 fin_alliance:face_the_horror=2 fin_alliance:lead_the_charge=9 fin_alliance:unite_them=7 fin_duel:call_allies=7 fin_duel:head_on=26 fin_duel:offer_mercy=2 fin_duel:use_relic=7 fin_escape:hide=14 fin_escape:hold_the_pass=10 fin_escape:run_for_border=15 fin_escape:turn_and_fight=19 fin_lair:relic_light=2 fin_lair:sneak_in=19 fin_lair:storm_in=22 fin_parley:offer_terms=4 fin_parley:threaten=2 fin_siege:burn_engines=23 fin_siege:lead_defence=26 fin_siege:negotiate_surrender=20 fin_siege:rally_countryside=8

## Sample tales

### Seren (human, curious, 289 CP), world threat 0: The Beast of Wyrmwood
- Took up the quest: Hunt the beast that is emptying the villages.
- Traded with a caravan for better mail.
- Asked the Order of the Veil for their relic, and was refused.
- Cut Down at the Crossing. The champion’s record stands.
- No rival.
- Finale: none. Status: fallen. Quest threat at the end: 0. World threat moved 0.

### Bramble Underhill (halfling, brave, 147 CP), world threat 0: The Siege of Harrowgate
- Took up the quest: Reach Harrowgate and break the siege.
- Took the Iron Company’s coin. The mill burned.
- Asked the Order of the Veil for their relic, and was refused.
- A storm hid their trail.
- Left their heavy gear on the bank and swam the flood.
- Saw a strange omen.
- Paid a champion’s toll to pass.
- Escorted refugees to safety, at the cost of days.
- Burned the enemy’s siege engines in the night. The Siege of Harrowgate: done.
- No rival.
- Finale: fin_siege. Status: alive. Quest threat at the end: 2. World threat moved 0.

### Halvard (human, curious, 174 CP), world threat 0: The Beast of Wyrmwood
- Took up the quest: Hunt the beast that is emptying the villages.
- Talked past a champion without drawing steel.
- Forded the flood.
- Prayed at a roadside shrine.
- Took the Iron Company’s coin. The mill burned.
- Saved a wounded captain, who swore to repay it.
- Doran, another hero of the world, rode with them.
- United everyone they had met into one army, and won. The Beast of Wyrmwood: done.
- No rival.
- Finale: fin_alliance. Status: alive. Quest threat at the end: 1. World threat moved 0.

### Finnick Quickfoot (halfling, kind, 142 CP), world threat 0: The Siege of Harrowgate
- Took up the quest: Reach Harrowgate and break the siege.
- Was caught robbing the shrine, and beaten for it.
- A hunter told them what lies ahead.
- Stayed out of the fight at the mill.
- Saved a wounded captain, who swore to repay it.
- Cheated the Crossroads Witch out of her gift. Garrick will not forget it.
- Beat Garrick in a skirmish. They fell back, weaker.
- Garrick fell in a duel for the ages. The Siege of Harrowgate: done.
- Rival: Garrick, the Crossroads Witch (136 CP). Memory: You cheated her out of a bargain, and nobody cheats her. / Lost to Finnick Quickfoot on the road.. Fate: Fell to Finnick Quickfoot in a duel the bards still sing
- Finale: fin_duel. Status: alive. Quest threat at the end: 2. World threat moved 0.

### Mirela (human, brave, 249 CP), world threat 6: The Siege of Harrowgate
- Took up the quest: Reach Harrowgate and break the siege.
- Saw a strange omen.
- Paid a champion’s toll to pass.
- The hunters saw through the false trail.
- Fought off an ambush.
- Gave their supplies to refugees.
- A hunter told them what lies ahead.
- Was caught outside the walls.
- The walls fell. The Siege of Harrowgate: failed.
- No rival.
- Finale: fin_siege. Status: alive. Quest threat at the end: 3. World threat moved 0.5.

### Caius (human, reckless, 243 CP), world threat 6: The Beast of Wyrmwood
- Took up the quest: Hunt the beast that is emptying the villages.
- Saw a strange omen.
- A hunter told them what lies ahead.
- Talked past a champion without drawing steel.
- Threw down their purse to buy off an ambush.
- Asked the Order of the Veil for their relic, and was refused.
- They won a fight for the songs in the lair. The Beast of Wyrmwood: done.
- No rival.
- Finale: fin_lair. Status: alive. Quest threat at the end: 2. World threat moved 0.

### Kestra (human, greedy, 189 CP), world threat 6: The Beast of Wyrmwood
- Took up the quest: Hunt the beast that is emptying the villages.
- Hired a wounded captain’s sword.
- Let the hired swords walk.
- Prayed at a roadside shrine.
- Saw a strange omen.
- Gave their supplies to refugees.
- Was discovered creeping into the lair.
- They finished what waited in the lair. The Beast of Wyrmwood: done.
- No rival.
- Finale: fin_lair. Status: alive. Quest threat at the end: 2. World threat moved 0.

### Lirael (wood_elf, brave, 295 CP), world threat 6: The Beast of Wyrmwood
- Took up the quest: Hunt the beast that is emptying the villages.
- Lost a duel to a champion, and limped on.
- Found a hidden path around the flood, and learned the land.
- Saved a wounded captain, who swore to repay it.
- Took a gift from the Crossroads Witch. The price will come due.
- Refused to pay the witch. The road ahead was cursed.
- A storm hid their trail.
- Fell on the Walls. Among the last defenders.
- No rival.
- Finale: fin_siege. Status: fallen. Quest threat at the end: 5. World threat moved 0.
