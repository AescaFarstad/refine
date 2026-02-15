import { GameState } from "./GameState";
import SeededRandom from "./core/SeededRandom";
import { clearWafer, getCell, placeMolecule } from "./Wafer";
import { computeEffectiveEssences } from "./RefinePreview";
import { axialToIndex, calculateVisibility, initResearchCells } from "./Research";
import { getPivotHex, rotateMolecule, translateMolecule } from "./MoleculeUtils";
import { parseRaidDefinitions } from "./RaidLib";
import type { RaidDefinition, RawRaidDefinition } from "./RaidLib";
import { recomputeActiveRaidEstimates, recomputeActiveRaidParams } from "./Raid";
import { computeMazeResourceSpawns, resetMazeTransient } from "./Maze";

// This file must not contain fallbacks for anything. Fail fast.

type AnonymousObject = Record<string, unknown>;
const RESEARCH_OWNED_CELLS_KEY = "researchOwnedCells";
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
  "unlockedRaids",
  "items",
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

function isRawRaidDefinitionRecord(value: unknown): value is Record<string, RawRaidDefinition> {
  if (!isObjectRecord(value)) return false;
  for (const rawRaid of Object.values(value)) {
    if (!isObjectRecord(rawRaid)) return false;
  }
  return true;
}

function parseSavedRawRaidLib(value: unknown): Map<string, RaidDefinition> | false {
  if (value === undefined) return new Map<string, RaidDefinition>();
  if (!isRawRaidDefinitionRecord(value)) return false;

  try {
    const parsed = parseRaidDefinitions(value);
    return parsed.raids;
  } catch {
    return false;
  }
}

function applySavedRawRaidLib(gameState: GameState, savedRaids: Map<string, RaidDefinition>): boolean {
  if (savedRaids.size !== gameState.lib.raids.size) return false;
  for (const raidId of gameState.lib.raids.keys()) {
    if (!savedRaids.has(raidId)) return false;
  }

  for (const [raidId, savedRaid] of savedRaids.entries()) {
    const raid = gameState.lib.raids.get(raidId);
    if (!raid) return false;

    raid.name = savedRaid.name;
    raid.locationImageId = savedRaid.locationImageId;
    raid.description = savedRaid.description;
    raid.order = savedRaid.order;
    raid.baseLootChance = savedRaid.baseLootChance;
    raid.zoneCollapseSec = savedRaid.zoneCollapseSec;
    raid.zoneCollapseStepPerMutation = savedRaid.zoneCollapseStepPerMutation;
    raid.items = savedRaid.items.slice();
    raid.encounters = savedRaid.encounters.map(step => ({
      count: step.count,
      encounter: { ...step.encounter },
    }));
    raid.initialMutations = savedRaid.initialMutations.map(mutation => ({ ...mutation }));
    for (const itemId of raid.items) {
      if (!raid.allPotentialItems.includes(itemId)) {
        raid.allPotentialItems.push(itemId);
      }
    }
    raid.itemPoolsByRarity = gameState.lib.buildItemPoolsByRarity(raid.items);
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

  const gameState = new GameState();
  const mutableGameState = gameState as unknown as AnonymousObject;

  for (const [k, v] of Object.entries(input)) {
    if (k === "lib" || k === "version" || k === "researchCells" || k === RESEARCH_OWNED_CELLS_KEY || k === "wafer" || k === "maze" || k === "rawRaidLib") continue;
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
