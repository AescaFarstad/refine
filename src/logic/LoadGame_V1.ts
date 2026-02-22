import { GameState } from "./GameState";
import SeededRandom from "./core/SeededRandom";
import { clearWafer, getCell, placeMolecule } from "./Wafer";
import { computeEffectiveEssences } from "./RefinePreview";
import { axialToIndex, calculateVisibility, indexToAxial, initResearchCells } from "./Research";
import { getPivotHex, rotateMolecule, translateMolecule } from "./MoleculeUtils";
import type { EncounterDef } from "./RaidLib";
import { recomputeActiveRaidEstimates, recomputeActiveRaidParams } from "./Raid";
import { applyMazeNexusPlacementAtCell, computeMazeResourceSpawns, resetMazeTransient } from "./Maze";

// This file must not contain fallbacks for anything. Fail fast.

type AnonymousObject = Record<string, unknown>;
const RESEARCH_OWNED_CELLS_KEY = "researchOwnedCells";
const RESEARCH_NEXUS_IDS_KEY = "researchNexusIds";
const CELL_PAIR_SEPARATOR = "  ";

interface SavedWaferItem {
  id: string;
  rotation: number;
  x: number;
  y: number;
}

interface ParsedSavedWafer {
  enabledCells: SavedPoint[];
  placedItems: SavedWaferItem[];
}

interface SavedPoint {
  x: number;
  y: number;
}

const REQUIRED_KEYS: readonly string[] = [
  "version",
  "gameTime",
  "random",
  "wafer",
  "raid",
  RESEARCH_OWNED_CELLS_KEY,
  RESEARCH_NEXUS_IDS_KEY,
  "unlockedRaids",
  "items",
  "rawNexusLib",
];

function isObjectRecord(value: unknown): value is AnonymousObject {
  return typeof value === "object" && value !== null;
}

function reviveValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(reviveValue);
  }

  if (!isObjectRecord(value)) {
    return value;
  }

  const out: AnonymousObject = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = reviveValue(v);
  }
  return out;
}

function parseSavedPointsString(value: unknown): SavedPoint[] | false {
  if (typeof value !== "string") return false;
  if (value.length === 0) return [];
  const chunks = value.split(CELL_PAIR_SEPARATOR);
  const out: SavedPoint[] = [];
  for (const chunk of chunks) {
    const parts = chunk.split(" ");
    if (parts.length !== 2) return false;
    const x = Number(parts[0]);
    const y = Number(parts[1]);
    if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
    out.push({ x, y });
  }
  return out;
}

function parseOwnedResearchCells(value: unknown): number[] | false {
  const points = parseSavedPointsString(value);
  if (points === false) return false;

  const out: number[] = [];
  for (const p of points) {
    const idx = axialToIndex(p.x, p.y);
    if (idx === -1) return false;
    out.push(idx);
  }
  return out;
}

function parseSavedWafer(value: unknown): ParsedSavedWafer | false {
  if (!isObjectRecord(value)) return false;
  const enabledCellsInput = value.enabledCells;
  const placedItemsInput = value.placedItems;
  if (!Array.isArray(placedItemsInput)) return false;

  const enabledCells = parseSavedPointsString(enabledCellsInput);
  if (enabledCells === false) return false;

  const placedItems: SavedWaferItem[] = [];
  for (const rawItem of placedItemsInput) {
    if (!isObjectRecord(rawItem)) return false;
    if (typeof rawItem.id !== "string") return false;
    if (typeof rawItem.rotation !== "number") return false;
    if (typeof rawItem.x !== "number" || typeof rawItem.y !== "number") return false;
    placedItems.push({
      id: rawItem.id,
      rotation: rawItem.rotation,
      x: rawItem.x,
      y: rawItem.y,
    });
  }

  return { enabledCells, placedItems };
}

interface SavedNexusPlacement {
  nexusId: string;
  placementId: number;
  idx: number;
}

interface SavedNexusLibEntry {
  price: number;
  priceIncrease: number[];
}

interface SavedRaidLibEntry {
  baseLootChance: number;
  items: string[];
  encounters: Array<{ count: number; encounter: EncounterDef }>;
  zoneCollapseSec: number;
}

function parseResearchNexusIds(value: unknown): SavedNexusPlacement[] | false {
  if (typeof value !== "string") return false;
  if (value.length === 0) return [];
  const chunks = value.split(CELL_PAIR_SEPARATOR);
  const out: SavedNexusPlacement[] = [];
  for (const chunk of chunks) {
    const parts = chunk.split(" ");
    if (parts.length !== 4) return false;
    const nexusId = parts[0]!;
    if (nexusId.length === 0) return false;
    const placementId = Number(parts[1]);
    if (!Number.isInteger(placementId) || placementId <= 0) return false;
    const x = Number(parts[2]);
    const y = Number(parts[3]);
    if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
    const idx = axialToIndex(x, y);
    if (idx === -1) return false;
    out.push({ nexusId, placementId, idx });
  }
  return out;
}

function isEncounterDef(value: unknown): value is EncounterDef {
  if (!isObjectRecord(value)) return false;
  const type = value.type;
  if (typeof type !== "string") return false;
  switch (type) {
    case "PreparationEncounter":
      if (typeof value.timeSpentSec !== "number" || !Number.isFinite(value.timeSpentSec)) return false;
      if (typeof value.damageBonus !== "number" || !Number.isFinite(value.damageBonus)) return false;
      if (typeof value.hpBonus !== "number" || !Number.isFinite(value.hpBonus)) return false;
      if (typeof value.blockChanceBonus !== "number" || !Number.isFinite(value.blockChanceBonus)) return false;
      if (!Array.isArray(value.tacticNames)) return false;
      for (const tacticName of value.tacticNames) {
        if (typeof tacticName !== "string") return false;
      }
      if (typeof value.gearId !== "string") return false;
      if (typeof value.gearImage !== "string") return false;
      return true;
    case "WalkEncounter":
      return true;
    case "LootEncounter":
      return true;
    case "MonsterLootEncounter":
      return typeof value.monsterId === "string";
    case "FightEncounter":
      return typeof value.monsterId === "string";
    case "QuestEncounter":
      return typeof value.questId === "string";
    default:
      return false;
  }
}

function isSavedRaidLibRecord(value: unknown): value is Record<string, SavedRaidLibEntry> {
  if (!isObjectRecord(value)) return false;
  for (const rawRaid of Object.values(value)) {
    if (!isObjectRecord(rawRaid)) return false;
    if (typeof rawRaid.baseLootChance !== "number" || !Number.isFinite(rawRaid.baseLootChance)) return false;
    if (!Array.isArray(rawRaid.items)) return false;
    for (const itemId of rawRaid.items) {
      if (typeof itemId !== "string") return false;
    }
    if (!Array.isArray(rawRaid.encounters)) return false;
    for (const step of rawRaid.encounters) {
      if (!isObjectRecord(step)) return false;
      if (typeof step.count !== "number" || !Number.isFinite(step.count)) return false;
      if (!isEncounterDef(step.encounter)) return false;
    }
    if (typeof rawRaid.zoneCollapseSec !== "number" || !Number.isFinite(rawRaid.zoneCollapseSec)) return false;
  }
  return true;
}

function copyEncounterDef(source: EncounterDef): EncounterDef {
  switch (source.type) {
    case "PreparationEncounter":
      return {
        type: source.type,
        timeSpentSec: source.timeSpentSec,
        damageBonus: source.damageBonus,
        hpBonus: source.hpBonus,
        blockChanceBonus: source.blockChanceBonus,
        tacticNames: source.tacticNames.slice(),
        gearId: source.gearId,
        gearImage: source.gearImage,
      };
    case "WalkEncounter":
      return { type: source.type };
    case "LootEncounter":
      return { type: source.type };
    case "MonsterLootEncounter":
      return {
        type: source.type,
        monsterId: source.monsterId,
        injected: source.injected,
      };
    case "FightEncounter":
      return {
        type: source.type,
        monsterId: source.monsterId,
        injected: source.injected,
      };
    case "QuestEncounter":
      return {
        type: source.type,
        questId: source.questId,
      };
  }
}

function copySavedRaidEncounters(encounters: SavedRaidLibEntry["encounters"]): SavedRaidLibEntry["encounters"] {
  return encounters.map(step => ({
    count: step.count,
    encounter: copyEncounterDef(step.encounter),
  }));
}

function parseSavedRawRaidLib(value: unknown): Map<string, SavedRaidLibEntry> | false {
  if (value === undefined) return new Map<string, SavedRaidLibEntry>();
  if (!isSavedRaidLibRecord(value)) return false;
  const out = new Map<string, SavedRaidLibEntry>();
  for (const [id, rawRaid] of Object.entries(value)) {
    out.set(id, {
      baseLootChance: rawRaid.baseLootChance,
      items: rawRaid.items.slice(),
      encounters: copySavedRaidEncounters(rawRaid.encounters),
      zoneCollapseSec: rawRaid.zoneCollapseSec,
    });
  }
  return out;
}

function isSavedNexusLibRecord(value: unknown): value is Record<string, SavedNexusLibEntry> {
  if (!isObjectRecord(value)) return false;
  for (const rawNexusItem of Object.values(value)) {
    if (!isObjectRecord(rawNexusItem)) return false;
    if (typeof rawNexusItem.price !== "number" || !Number.isFinite(rawNexusItem.price)) return false;
    if (!Array.isArray(rawNexusItem.priceIncrease)) return false;
    for (const priceIncreaseValue of rawNexusItem.priceIncrease) {
      if (typeof priceIncreaseValue !== "number" || !Number.isFinite(priceIncreaseValue)) return false;
    }
  }
  return true;
}

function parseSavedRawNexusLib(value: unknown): Map<string, SavedNexusLibEntry> | false {
  if (!isSavedNexusLibRecord(value)) return false;
  const out = new Map<string, SavedNexusLibEntry>();
  for (const [id, rawNexusItem] of Object.entries(value)) {
    out.set(id, {
      price: rawNexusItem.price,
      priceIncrease: rawNexusItem.priceIncrease.slice(),
    });
  }
  return out;
}

function applySavedRawRaidLib(gameState: GameState, savedRaids: Map<string, SavedRaidLibEntry>): boolean {
  if (savedRaids.size !== gameState.lib.raids.size) return false;
  for (const targetId of gameState.lib.raids.keys()) {
    if (!savedRaids.has(targetId)) return false;
  }

  for (const [sourceId, sourceRaid] of savedRaids.entries()) {
    const targetRaid = gameState.lib.raids.get(sourceId);
    if (!targetRaid) return false;
    targetRaid.baseLootChance = sourceRaid.baseLootChance;
    targetRaid.items = sourceRaid.items.slice();
    targetRaid.encounters = sourceRaid.encounters.map(step => ({
      count: step.count,
      encounter: copyEncounterDef(step.encounter),
    }));
    targetRaid.zoneCollapseSec = sourceRaid.zoneCollapseSec;
    const allPotentialItems = new Set(targetRaid.allPotentialItems);
    for (const itemId of targetRaid.items) {
      allPotentialItems.add(itemId);
    }
    targetRaid.allPotentialItems = Array.from(allPotentialItems);
  }

  for (const raid of gameState.lib.raids.values()) {
    raid.itemPoolsByRarity = gameState.lib.buildItemPoolsByRarity(raid.items);
  }

  return true;
}

function applySavedRawNexusLib(gameState: GameState, savedNexusItems: Map<string, SavedNexusLibEntry>): boolean {
  if (savedNexusItems.size !== gameState.lib.nexusItems.size) return false;
  for (const targetId of gameState.lib.nexusItems.keys()) {
    if (!savedNexusItems.has(targetId)) return false;
  }

  for (const [sourceId, sourceEntry] of savedNexusItems.entries()) {
    const targetEntry = gameState.lib.nexusItems.get(sourceId);
    if (!targetEntry) return false;
    targetEntry.price = sourceEntry.price;
    targetEntry.priceIncrease = sourceEntry.priceIncrease.slice();
  }

  return true;
}

function rehydrateGameState(input: AnonymousObject): GameState | false {
  for (const requiredKey of REQUIRED_KEYS) {
    if (!(requiredKey in input)) return false;
  }

  if (typeof input.version !== "number") return false;
  const ownedResearchCells = parseOwnedResearchCells(input[RESEARCH_OWNED_CELLS_KEY]);
  if (ownedResearchCells === false) return false;
  const savedWafer = parseSavedWafer(input.wafer);
  if (savedWafer === false) return false;
  const savedRawRaidLib = parseSavedRawRaidLib(input.rawRaidLib);
  if (savedRawRaidLib === false) return false;
  const savedRawNexusLib = parseSavedRawNexusLib(input.rawNexusLib);
  if (savedRawNexusLib === false) return false;
  const nexusPlacements = parseResearchNexusIds(input[RESEARCH_NEXUS_IDS_KEY]);
  if (nexusPlacements === false) return false;

  const gameState = new GameState();
  if (!applySavedRawNexusLib(gameState, savedRawNexusLib)) return false;
  const mutableGameState = gameState as unknown as AnonymousObject;

  for (const [k, v] of Object.entries(input)) {
    if (k === "lib" || k === "version" || k === "researchCells" || k === RESEARCH_OWNED_CELLS_KEY || k === RESEARCH_NEXUS_IDS_KEY || k === "wafer" || k === "maze" || k === "mazeVisibility" || k === "rawRaidLib" || k === "rawNexusLib") continue;
    mutableGameState[k] = v;
  }
  gameState.discoveryCounter = 0;

  const random = input.random;
  if (typeof random !== "number") return false;
  gameState.random = new SeededRandom(random);

  if (!(gameState.random instanceof SeededRandom)) return false;

  for (const cell of gameState.wafer.cells.values()) {
    cell.enabled = false;
  }
  for (const enabled of savedWafer.enabledCells) {
    const cell = getCell(gameState.wafer, enabled);
    if (!cell) return false;
    cell.enabled = true;
  }
  clearWafer(gameState.wafer);
  for (const placedItem of savedWafer.placedItems) {
    const itemDef = gameState.lib.items.get(placedItem.id)!;
    const rotatedMolecule = rotateMolecule(itemDef.molecule, placedItem.rotation);
    const pivot = getPivotHex(rotatedMolecule);
    const translatedMolecule = translateMolecule(rotatedMolecule, {
      x: placedItem.x - pivot.x,
      y: placedItem.y - pivot.y,
    });
    const placed = placeMolecule(gameState.wafer, placedItem.id, translatedMolecule, placedItem.rotation);
    if (!placed) return false;
  }
  computeEffectiveEssences(gameState.wafer);

  initResearchCells(gameState, gameState.lib.research);
  for (const cell of gameState.researchCells) {
    if (!cell.blocked) cell.owned = false;
  }
  for (const idx of ownedResearchCells) {
    if (idx < 0 || idx >= gameState.researchCells.length) return false;
    const cell = gameState.researchCells[idx]!;
    if (cell.blocked) return false;
    cell.owned = true;
  }
  let ownedPaidCount = 0;
  for (const cell of gameState.researchCells) {
    if (cell.owned && cell.cost > 0) ownedPaidCount++;
  }
  gameState.researchOwnedCount = ownedPaidCount;

  let maxPlacementId = 0;
  for (const placement of nexusPlacements) {
    if (placement.idx >= 0 && placement.idx < gameState.researchCells.length) {
      applyMazeNexusPlacementAtCell(gameState, placement.nexusId, placement.placementId, indexToAxial(placement.idx));
      if (placement.placementId > maxPlacementId) {
        maxPlacementId = placement.placementId;
      }
    }
  }
  gameState.mazeNextNexusPlacementId = maxPlacementId + 1;

  calculateVisibility(gameState, gameState.lib.research);

  resetMazeTransient(gameState);
  computeMazeResourceSpawns(gameState, gameState.lib.research);

  if (!applySavedRawRaidLib(gameState, savedRawRaidLib)) return false;

  if (gameState.raid.id.length > 0 && gameState.lib.raids.has(gameState.raid.id)) {
    recomputeActiveRaidParams(gameState, gameState.raid.id);
    recomputeActiveRaidEstimates(gameState, 100);
  }

  return gameState;
}

export function loadGame_V1(input: unknown): GameState | false {
  if (!isObjectRecord(input)) return false;
  const revived = reviveValue(input);
  if (!isObjectRecord(revived)) return false;
  return rehydrateGameState(revived);
}
