This is a description of a new concept which is going to make the raid part of the game much more involved and nuanced.

Raids:
  They are based on a lib item, but may change later.
  They consist of:
    'reach' required to access the raid
    encounters[]

They no longer have a set time. Instead, they have distance, represented by WalkEncounters.

'reach' is a number. To unlock a raid, your reach should be >= the raid's reach requirement.

Encounters are specified like this:
  count: number
  encounterType (i.e. 'WalkEncounter')
  encounter params []: any (i.e. monster type)

The specific fields of params are expected based on encounterType (discriminating union yada-yada).

Encounters are events that are going to happen during the raid.
They are arranged in a particular order in the beginning and processed sequentially until all done or until the player's hp drops to 0.
They may be of multiple types:
  FightEncounter(monster type):
    you're fighting a monster.
    Monster has hp
    You have hp, chance to hit, chance to block, damage
    Each turn you're going to roll for a hit.
    finalHit = clamp(hit chance - dodge, 0, 100)
      if success - they lose hp = your 'damage'. Also they don't get to hit you in this case. If hp < 0 they die, the encounter ends. If they die and you have the Aspirator Probe perk, a new encounter is inserted into the queue next: LootMonsterEncounter(monster type)
      if failure - you roll for a block chance
        if success - you take no damage
        if failure you lose the monster's 'damage' hp
      in either case you spend 1 minute. If you have the Careful Maneuvering perk, you spend +1 minute
    if the fight takes more than 100 rounds - you die.
  LootEncounter(raid item list)
    You spend a minute and roll for a chance to find an item.
    If you have the Thorough Search perk, you spend +1 minute.
    If success, you roll for a specific item and if you have space in the bags - you get it
    Final loot chance = clamp(raid Loot Chance + gear Loot Bonus, 0, 100)
  LootMonsterEncounter(monster type)
    same as LootEncounter but the item you get is determined by the monster type, not by the raid item list.
  WalkEncounter (all such encounters are identical)
    You walk 1 km spending time depending on your speed
    If you have regen per kilometer - it applies
  QuestEncounter(time)
    You spend time doing the quest - however much the quest specifies
    If the quest has a requirement (i.e. requires metal detector) but it is not fulfilled - you skip this and receive no quest reward.

The type of Encounter == class name for the purposes of the factory

QuestEncounter and LootMonsterEncounter are added dynamically, never specified.

Encounters write to the raid log and that log is shown to the player at the end of the raid.
In case of death, the raid gives nothing - no items, no quest rewards.
In case of success, those are awarded.
Extraction happens when all encounters are resolved.

Monster stats:
  dodge:%
  accuracy:%
  hp
  item that can be looted from their corpse with an aspirator

Player stats:
  chance to hit +% (monster dodge is subtracted from it to get the final roll chance)
  chance to block (monster accuracy is subtracted from it to get the final roll chance)
  hp
  damage
  additional loot chance (this is added to raid's loot chance for the final roll chance)
  bags volume
  regen per km
  perk list[]
  baseSpeed
  speedBonus
  weight
  maxWeight

weight depends on gear and affects move speed.
volume depends on gear and affects the maximum volume of all items that you can carry from the raid. So looted items don't contribute to weight, only equipped gear does.


maxHp is the starting hp value
Walking speed is base player speed * hp/maxHp * (maxWeight - weight)/maxWeight
if the player has perk Overcoming the Pain, hp/maxHp is replaced with (hp + maxHp) * 0.5 / maxHp
regen is applied at the end of each WalkEncounter.
Each WalkEncounter is always 1 km
regen can increase hp more than maxHp


These stats are based on the player's gear that they take into the raid.
The player can choose up to N items in each category:
Weapons, Accessories, Armor, Bags, Devices, Companions, Grenades, Medicine, Tactics (perks go here)

Before the raid, the player selects these from available options.
They cost credits.
New items in these lists are unlocked via research for chronotraces.
The number of items in each category that can be taken is unlocked via skill points.

The new set of possible essences in items:
Red - credits
Green - time flux
Blue - chronotraces
Yellow - skill points
Black - failure chance 5%
White - success chance 5%
Lime - yield +5%
Magenta - refining speed +5%


Quests:
  Each quest can have a prerequisite unlock. Unlock is a string. Typically to form a chains of quests, one quest is going to unlock the prerequisite for another.
  Quests can be limited to particular raids.
  Quests need to be accepted manually to be active in raid (except for a few specially marked quests that are always active i.e. "receive no damage")
  They have effect and reward. Effect is applied to the raid, while the reward is only given in case of successful completion and extraction from the raid.
  Effects: change player params, add/remove encounters from raid.
  Their completion is either resolved via QuestEncounter which they add or can be computed at raids end (i.e. for quest "receive no damage")
  Possible rewards:
    +reach (allowing to access new raids)
    permanently adds/removes/replaces encounters in the raid
The completed quests are tracked and no longer available.
Quests can't be failed, they stay until completed.

Upon successful extraction, the raid evolves - some encounters may be added/replaced/removed. In general it becomes less rewarding and more difficult.


Encounter ordering:
  N WalkEncounters split the timeline into N+1 buckets
  LootEncounters are spread as evenly as possible among these buckets
  QuestEncounters are placed in the middle bucket.
  FightEncounters are spread as evenly as possible too, with the total number of encounters in the bucket being the tiebreaker.

Within the bucket encounters are shuffled randomly.

GearItem
  needs to be unlocked to be available
  can give perk, add player stat, costs credits

Perk
  A simple string which a player may have or not have. Encounter logic may check for its existence for some of the logic.

Gear choice for each raid should be stored for future attempts.

Implementation details:
  Everything uses seeded RNG from GameState

Most encounter details are implemented inside the encounter classes.

We additionally need:
  GearLib
    each item has:
      name
      category: string (GearCategoryLib item id)
      chanceToHit?
      chanceToBlock?
      weight
      maxWeight?
      regenPerKm?
      hp?
      speedPercent?
      speedFlat?
      volume?
      lootChance?
      perk?
      damage?
      ...
  MonsterLib
    each item has:
      name
      hp
      dodge
      accuracy
      damage
      lootItemName
  QuestLib
    prerequisites:[]?
    raidRestriction:[]?
    encounters:[] : Mutations
    givesPerks[]?
    rewards:{
      modifyRaidEncounters:[] : Mutations
      credits?
      chronotraces?
      skillPoints?
      timeFlux?
      reach?
      unlocks[]?
    }
    endRaidChecks[] // i.e. "receiveNoDamage"
    autoaccept: bool
  GearCategoryLib
    name
    unlockCost:[number]

Perks:
export class Perks {
  static public THOROUGH_SEARCH = "Thorough Search"
  ...
}

new RaidSourceLib:
  name
  encounters[]
  reachRequired
  baseLootChance // for LootEncounters

It is going to be duplicated into RaidLib which becomes the mutable copy used by the game.

State Additions to player:
unlocks[]
completedQuests[]
gearLevels {} // max number of items in each category
skillPoints: number
loadouts {} // selected gear ids for each raid
speed = 6 (km/h)


Remove the old state and lib:
...


Raid mutation on success:
(here 'original' refers to the initial values loaded from data, as opposed to the mutated runtime raid)
LootDifficultyMutation
  decreases loot chance by 5% flat
  weight = current loot chance / original loot chance
LootMutation
  removes loot encounter
  weight = number of loot encounters in the raid / original number of loot encounters (but 0 if there is only 1 such encounter now)
WalkMutation
  adds WalkEncounter
  weight = original number of walk encounters / number of walk encounters in the raid
AddMonsterMutation
  adds the copy of the weakest MonsterEncounter. The strengthIdx is calculated in the lib item as the index in the sorted array based on each monster's hp * dodge * accuracy * damage
  weight = original number of monster encounters / number of monster encounters in the raid
UpgradeMonsterMutation
  replaces a random monster who is not the strongest (or the first one if they are all equal) with the one which has strengthIdx + 1
  weight = 
    Calculate strengthSum = sum of strengthIdx of each monster encounter
    if strengthSum < the original strengthSum, weight = 1
    else
      weight = original strengthSum / strengthSum
When a raid is successfully completed, it's modified based on the mutation chosen randomly according to their weights.
The weight of a mutation can't be greater than 1. If it's 0, the mutation is excluded from the list of possibilities.
QuestMutation - never added automatically, but can be added by quests. Adds  QuestEncounter(time)


RaidEventLog

Each encounter produces a log object. They have custom state based on the specific encounter. Discriminating union yada-yada.
WalkEncounter:
  hpBefore
  hpAfter
  timeSpent
  speed
QuestEncounter:
  questId
  success:bool
  timeSpent
FightEncounter
  dieFromOvertime:bool
  fightLog[]:FightEvent
  FightEvent:
    myHitRoll:number
    theirDodgeValue:number
    damageDealt:number
    theirHp:number
    theirHitValue:number
    myBlockRoll:number
    damageReceived:number
    myHp:number
    timeSpent:number
    encounterCreated:bool

  LootEncounter/LootMonsterEncounter:
    myRoll:number
    checkValue:number
    item:string
    volumeBefore:number
    volumeAfter:number
    timeSpent:number


General guidelines:
No fallback logic
Log only problems, don't log starts and successes.


Implementation Plan: WalkEncounter‑First Raids

- Principle: small, testable stages. Early stages may temporarily break gameplay and TypeScript compiling.
- Scope now: only WalkEncounter; just enough plumbing to run raids to completion and emit a log. Other encounter types are backlog.
- After completion of each state, this fact must be marked in this file along with details and info about divergence from the plan during the implementation.
- Only one system runs at a time. A raid completes immediately upon start and then adds the computed total time to `gs.time`.
- UI and Maze subsystems are handled separately and do not block this plan.

Stage 1 — Remove Legacy Raid Code (Game may be unplayable)
- Goal: clear out old raid mechanics that conflict with the new model.
- Changes (logic/data only — keep Maze/UI intact)
  - Repurpose `src/logic/Raid.ts` by removing the old slider/equipment calculus (`computeRaidStats` etc.). This file will host the new runner.
  - Remove reliance on `difficulty`, `durationMin`, `itemDropRate`, `itemDropDifficulty` from raid processing paths (e.g., parts of `src/logic/evt/EvtProcessor.ts`). It’s OK if callers break in this stage.
  - Remove `Model.computeNextEvt` and any call sites that depend on it. Future flows will set `nextEvt` explicitly at the start of an operation, or run raids immediately.
- Temporary stubs (if needed to keep build green)
  - In `EvtProcessor.ts`, make any raid completion handling a no‑op that only clears active raid state until the runner is wired.

Stage 2 — Define New Data Shapes and Lib Field (types only)
- Goal: introduce minimal types to model the new system, without logic.
- Changes
  - Define `RaidSourceDefinition` and `Encounter` union with only `type: 'WalkEncounter'` (+ params if needed later).
  - Add a new field to `Lib` in `src/logic/Lib.ts`: `raidSources: Map<string, RaidSourceDefinition>` (source data). Keep a mutable runtime copy `raids` using the new shape.
  - Extend `GameState` types with placeholders for: `unlocks: string[]`, `completedQuests: string[]`, `gearLevels: Record<string, number>`, `skillPoints: number`, `loadouts: Record<string, string[]>` (kept empty for now).

Stage 3 — Populate ActiveRaid From Gear (types + plumbing)
- Goal: `ActiveRaid` holds final, gear‑resolved values used by the runner.
- Changes
  - On raid start, compute and set: `hp` (start HP), `maxHp` (= hp at start), `baseSpeed`, `speedBonus` (from gear; 0 if none), `regenPerKm` (from gear; 0 if none), `weight`, `maxWeight`, `bagsVolume`, and any perk flags needed later.
  - These values are immutable for the duration of the raid and are the only inputs the runner needs from the player.

Stage 4 — Raid Runner in Raid.ts (WalkEncounter only)
- Goal: resolve encounters sequentially and produce a `RaidEventLog`; only WalkEncounter is implemented.
- Changes
  - Implement a pure runner in `src/logic/Raid.ts`: `runRaid(gs, raidId)` returns `{ success, log, timeSpentSec }`.
  - WalkEncounter: compute time for 1 km using the speed formula; apply regen at the end of each km; log `{ hpBefore, hpAfter, timeSpent }` per encounter. Allow hp > maxHp as specified.

Stage 5 — Start Command Integration and Event Flow
- Goal: run raids immediately and accrue time at completion; manage `nextEvt` manually for other systems.
- Changes
  - Update raid start path to: build `ActiveRaid` (Stage 3), call `runRaid`, then set `gs.time += timeSpentSec`, set `lastRaidOutcome` with the log, and clear `gs.raid`.
  - Do not schedule a future raid event; the raid completes immediately upon start. Do not use `durationMin`.
  - For refining (and any future timed ops), set `gs.nextEvt` directly at start (manual), since `Model.computeNextEvt` is removed.
- Acceptance
  - Starting a raid completes immediately and increases game time by the computed total.

Stage 6 — Seed Minimal Raid Sources
- Goal: migrate data to the new shape sufficient for WalkEncounters.
- Changes
  - Add `raidSources` in data: 1–2 raids with only WalkEncounters (e.g., 5–10 km) and a `reachRequired` for gating.
  - Duplicate into mutable runtime `raids` on Lib initialization.
- Acceptance
  - The game can list and run these raids via the new runner (even if UI is stubbed/broken).

Stage 7 — Gear‑Derived Speed/Healing Only
- Goal: enforce that speedBonus and regenPerKm come solely from gear.
- Changes
  - Do not introduce standalone `speedBonus` or `regenPerKm` params; resolve them from equipped gear during `ActiveRaid` construction (0 if none).
  - `maxHp` is set to the starting `hp` at raid start; do not model a separate `maxHp` input.
- Acceptance
  - Changing equipped gear changes computed time and end‑of‑raid hp via the runner.

Stage 8 — Reach and Unlocks via Quests Only
- Goal: gate raids by reach and increase reach only via quest completion at end of raid.
- Changes
  - Respect `reachRequired` when filtering/selecting raids.
  - On successful completion, process quest rewards that may grant `+reach` and unlock new raids; perform unlocks at this step only.
- Acceptance
  - Increasing reach occurs exclusively as part of end‑of‑raid quest resolution; newly unlocked raids become available thereafter.

Backlog (post‑WalkEncounter)
- FightEncounter: stats, turn loop, overtime death, Aspirator perk hook, log entries.
- LootEncounter + LootMonsterEncounter: roll logic, bag volume, perks, log entries.
- QuestEncounter: add quest lib, effects, mid‑bucket placement, and end‑of‑raid checks.
- Gear/Perks/Weight/Volume systems and loadouts; save per‑raid gear choice.
- Mutations on success: weights and application per spec.
- UI/UX polish and art direction for the new raid flow.


Progress

- Stages 1–8 completed via straight-through migration. Incompatible legacy raid UI (cards, sliders, equipment selectors) was removed to avoid stubs.


Part 2: UI

Raids ui:
RaidSelection.vue:
At the top - a screen-wide carousel of raid cards. Each card is the name, + unlock info if it is locked. unlock info is reach required + a big lock icon overlayed on top of the card.
RaidSetup.vue:
The rest of the tab shows the raid setup.
RaidDetails.vue:
On the left half:
Your Health and Damage are shown (with respect to selected gear)
A line which states the distance that needs to be covered, then progress bar representing weight/maxWeight, then speed, then 'Walking time: 10m'. This info is based on WalkEncounters of the raid
On the right half - RaidQuests.vue (see below)

Then the table of enemy encounters based on FightEncounter.
Each row is name, 'Health', 'Chance to hit them', 'Chance to block their attack'
The values shown are calculated based on the monster stats and the chosen gear. This will be teh actual values for when the raid starts.

Then a similar table (of a single row for LootEncounters
titles: '' (blank), 'Count', 'Find item chance'
info: 'Scavenge sites', actual count, looting chance with respect to chosen gear

RaidGear.vue:
Then a table with GearCategories for columns. If a category has no unlocked items it is not shown.
Unlocked gear items are displayed there. Clicking them selects/unselects them and the stats are recalculated.
Each items is GearItem.vue.
it has a picture, a name, a price and a hint.
the hint shows everything this item does
selecting an item adds its price to gameState.selectedGearPrice. Unselecting it subtracts it from selectedGearPrice.
items you can't afford are shows in red but are NOT disabled. But the deploy button (see below) is disabled if you can't affford the selected gear. This is done to allow the player to preview the effects of gear they can't afford yet.

Then there are estimations:
survival chance approximation, time approximation. (For now these must be stubbed)
Then there is a big 'Deploy' button.


RaidQuests.vue:
each quest for which prerequisits are unlocked and which fits the selected raid is shown as a card in a tile grid.
This card shows the name. Hovering it shows hint with more info - what exactly does the quest change in the raid and what condition it requires, how much time (based on added QuestEncounters) is will add.
selecting it applies its mutations and stats to the raid.

Deploying to raid is cmd which copies the stats to ActiveRaid and runs the raid.
Selecting/unselecting a agear item is cmd which adds/subtracts selectedGearPrice. Also the selected gear is stored in gameState.loadouts.
Selecting a raid is cmd which updates selectedGearPrice based on the stored loadout of that new raid. UI updates which items are selected.

gameState.raid should be modified by cmds so that the resulting stats from gear would already be computed for UI to show.

Due to the fact that selecting raids switches loadout, we can end up in a situation where the loadout is more expensive than the credits teh player has. This is a valid situation. We should disable the deploy button in this case.


RaidOutcomeModal.vue

This will be displaying the raid log.
It is going display events one thing at a time, let them animate for some time and continue to net item.
There is goign to be fast-forward button which displays the log in its entirety.
At the top there is goign to be a special progress bar: for each Encounter there is going to be ◌ symbol which converts to ◉ when the encounter is added to the log.
The log is a list of items with sub-items.
We need to handle WalkEncounter for now, this is a single item.
"Walked 1 km in 10m 45s." Optionally, if hpBefore != hpAfter, "Regenerated X health"

The default timing for this is 1 second * clamp(DEFAULT_SPEED / speed, 1, 2)
Speed at the time of travel should be specified in the WalkEncounter log entry.

Once all log entries are shown, the fast-forward button is replaced with Raid More, and Refine buttons
