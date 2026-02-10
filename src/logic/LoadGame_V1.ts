import { GameState } from "./GameState";
import SeededRandom from "./core/SeededRandom";
import { IceMaze } from "../maze/IceMaze";
import { Actor, ActorType } from "../maze/Chase";
import { clearWafer, getCell, placeMolecule } from "./Wafer";
import { computeEffectiveEssences } from "./RefinePreview";
import { axialToIndex, calculateVisibility, initResearchCells } from "./Research";
import { getPivotHex, rotateMolecule, translateMolecule } from "./MoleculeUtils";
import { parseRaidDefinitions } from "./RaidLib";
import type { RaidDefinition, RawRaidDefinition } from "./RaidLib";
import { recomputeActiveRaidEstimates, recomputeActiveRaidParams } from "./Raid";

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

interface SavedMazeDemon {
  id: number;
  x: number;
  y: number;
}

interface SavedMazeSettings {
  x: number;
  y: number;
  seed: number;
  spawn: SavedPoint;
  keys: SavedPoint[];
  spawnProbability: number;
  maxDemons: number;
  artefacts: Array<{ type: number; x: number; y: number }>;
  fill: SavedPoint[];
}

interface SavedMazeState {
  randomSeed: number;
  player: SavedPoint;
  demons: SavedMazeDemon[];
  takenKeys: boolean[];
  keysCollected: number;
  turn: number;
  failed: boolean;
  numEyes: number;
  freezeLeft: number;
  nextActorId: number;
  artefactsTaken: boolean[];
}

interface SavedMaze {
  settings: SavedMazeSettings;
  timeFluxAvailable: number;
  movesMade: number;
  cellTimeFlux: string;
  cellTimeFluxVersion: number;
  state: SavedMazeState;
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

function parseSavedPoint(value: unknown): SavedPoint | false {
  if (!isObjectRecord(value)) return false;
  if (typeof value.x !== "number" || typeof value.y !== "number") return false;
  return { x: value.x, y: value.y };
}

function parseSavedMaze(value: unknown): SavedMaze | false {
  if (!isObjectRecord(value)) return false;

  const settingsInput = value.settings;
  const stateInput = value.state;
  if (!isObjectRecord(settingsInput) || !isObjectRecord(stateInput)) return false;

  const settingsSpawn = parseSavedPoint(settingsInput.spawn);
  if (settingsSpawn === false) return false;
  const settingsKeysInput = settingsInput.keys;
  const settingsFillInput = settingsInput.fill;
  const settingsArtefactsInput = settingsInput.artefacts;
  if (!Array.isArray(settingsKeysInput) || !Array.isArray(settingsFillInput) || !Array.isArray(settingsArtefactsInput)) return false;

  const settingsKeys: SavedPoint[] = [];
  for (const keyPoint of settingsKeysInput) {
    const parsed = parseSavedPoint(keyPoint);
    if (parsed === false) return false;
    settingsKeys.push(parsed);
  }

  const settingsFill: SavedPoint[] = [];
  for (const fillPoint of settingsFillInput) {
    const parsed = parseSavedPoint(fillPoint);
    if (parsed === false) return false;
    settingsFill.push(parsed);
  }

  const settingsArtefacts: Array<{ type: number; x: number; y: number }> = [];
  for (const artefact of settingsArtefactsInput) {
    if (!isObjectRecord(artefact)) return false;
    if (typeof artefact.type !== "number" || typeof artefact.x !== "number" || typeof artefact.y !== "number") return false;
    settingsArtefacts.push({ type: artefact.type, x: artefact.x, y: artefact.y });
  }

  const statePlayer = parseSavedPoint(stateInput.player);
  if (statePlayer === false) return false;

  const stateDemonsInput = stateInput.demons;
  if (!Array.isArray(stateDemonsInput)) return false;
  const stateDemons: SavedMazeDemon[] = [];
  for (const demon of stateDemonsInput) {
    if (!isObjectRecord(demon)) return false;
    if (typeof demon.id !== "number" || typeof demon.x !== "number" || typeof demon.y !== "number") return false;
    stateDemons.push({ id: demon.id, x: demon.x, y: demon.y });
  }

  const stateTakenKeysInput = stateInput.takenKeys;
  const stateArtefactsTakenInput = stateInput.artefactsTaken;
  if (!Array.isArray(stateTakenKeysInput) || !Array.isArray(stateArtefactsTakenInput)) return false;
  const stateTakenKeys: boolean[] = [];
  for (const taken of stateTakenKeysInput) {
    if (typeof taken !== "boolean") return false;
    stateTakenKeys.push(taken);
  }
  const stateArtefactsTaken: boolean[] = [];
  for (const taken of stateArtefactsTakenInput) {
    if (typeof taken !== "boolean") return false;
    stateArtefactsTaken.push(taken);
  }

  if (typeof settingsInput.x !== "number" || typeof settingsInput.y !== "number" || typeof settingsInput.seed !== "number") return false;
  if (typeof settingsInput.spawnProbability !== "number" || typeof settingsInput.maxDemons !== "number") return false;

  if (typeof value.timeFluxAvailable !== "number" || typeof value.movesMade !== "number") return false;
  if (typeof value.cellTimeFlux !== "string" || typeof value.cellTimeFluxVersion !== "number") return false;

  if (typeof stateInput.randomSeed !== "number") return false;
  if (typeof stateInput.keysCollected !== "number" || typeof stateInput.turn !== "number") return false;
  if (typeof stateInput.failed !== "boolean" || typeof stateInput.numEyes !== "number") return false;
  if (typeof stateInput.freezeLeft !== "number" || typeof stateInput.nextActorId !== "number") return false;

  return {
    settings: {
      x: settingsInput.x,
      y: settingsInput.y,
      seed: settingsInput.seed,
      spawn: settingsSpawn,
      keys: settingsKeys,
      spawnProbability: settingsInput.spawnProbability,
      maxDemons: settingsInput.maxDemons,
      artefacts: settingsArtefacts,
      fill: settingsFill,
    },
    timeFluxAvailable: value.timeFluxAvailable,
    movesMade: value.movesMade,
    cellTimeFlux: value.cellTimeFlux,
    cellTimeFluxVersion: value.cellTimeFluxVersion,
    state: {
      randomSeed: stateInput.randomSeed,
      player: statePlayer,
      demons: stateDemons,
      takenKeys: stateTakenKeys,
      keysCollected: stateInput.keysCollected,
      turn: stateInput.turn,
      failed: stateInput.failed,
      numEyes: stateInput.numEyes,
      freezeLeft: stateInput.freezeLeft,
      nextActorId: stateInput.nextActorId,
      artefactsTaken: stateArtefactsTaken,
    },
  };
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

function parseCellTimeFlux(bits: unknown, width: number, height: number): boolean[][] | false {
  if (typeof bits !== "string") return false;
  if (bits.length !== width * height) return false;

  const out: boolean[][] = new Array(width);
  let i = 0;
  for (let x = 0; x < width; x++) {
    const column: boolean[] = new Array(height);
    for (let y = 0; y < height; y++) {
      const bit = bits.charCodeAt(i++);
      if (bit === 49) {
        column[y] = true;
      } else if (bit === 48) {
        column[y] = false;
      } else {
        return false;
      }
    }
    out[x] = column;
  }
  return out;
}

function rehydrateMaze(input: unknown): IceMaze | false {
  const saved = parseSavedMaze(input);
  if (saved === false) return false;

  const maze = new IceMaze(
    { x: saved.settings.x, y: saved.settings.y },
    saved.timeFluxAvailable,
    saved.settings.seed
  );
  maze.loadSettings(
    {
      x: saved.settings.x,
      y: saved.settings.y,
      spawn: saved.settings.spawn,
      keys: saved.settings.keys,
      spawnProbability: saved.settings.spawnProbability,
      maxDemons: saved.settings.maxDemons,
      artefacts: saved.settings.artefacts,
      fill: saved.settings.fill,
    },
    saved.settings.seed
  );

  const flux = parseCellTimeFlux(saved.cellTimeFlux, maze.dimensions.x, maze.dimensions.y);
  if (flux === false) return false;
  maze.cellTimeFlux = flux;
  maze.cellTimeFluxVersion = saved.cellTimeFluxVersion;
  maze.movesMade = saved.movesMade;
  maze.timeFluxAvailable = saved.timeFluxAvailable;

  const state = maze.state;
  state.random = new SeededRandom(saved.state.randomSeed);

  const playerCell = state.cells[saved.state.player.x]?.[saved.state.player.y];
  if (!playerCell) return false;
  state.player.cell = playerCell;
  state.player.previousCell = null;
  state.player.closeIn = -1;
  state.player.target = null;

  state.demons = [];
  for (const demonState of saved.state.demons) {
    const demonCell = state.cells[demonState.x]?.[demonState.y];
    if (!demonCell) return false;
    const demon = new Actor();
    demon.type = ActorType.DEMON;
    demon.cell = demonCell;
    demon.previousCell = null;
    demon.closeIn = -1;
    demon.target = null;
    demon.id = demonState.id;
    state.demons.push(demon);
  }

  if (saved.state.takenKeys.length !== state.keys.length) return false;
  state.takenKeys = saved.state.takenKeys.slice();
  const collectedKeys = state.takenKeys.reduce((acc, v) => acc + (v ? 1 : 0), 0);
  if (collectedKeys !== saved.state.keysCollected) return false;
  state.keysCollected = saved.state.keysCollected;

  state.turn = saved.state.turn;
  state.failed = saved.state.failed;
  state.numEyes = saved.state.numEyes;
  state.freezeLeft = saved.state.freezeLeft;
  state.nextActorId = saved.state.nextActorId;
  state.spawnProbability = saved.settings.spawnProbability;
  state.maxDemons = saved.settings.maxDemons;

  if (saved.state.artefactsTaken.length !== state.artefacts.length) return false;
  for (let i = 0; i < state.artefacts.length; i++) {
    state.artefacts[i]!.taken = saved.state.artefactsTaken[i]!;
  }

  const mutableMaze = maze as unknown as AnonymousObject;
  mutableMaze.playerVisualPos = { x: state.player.cell.x, y: state.player.cell.y };
  const demonVisualPos = new Map<number, SavedPoint>();
  for (const demon of state.demons) {
    demonVisualPos.set(demon.id, { x: demon.cell.x, y: demon.cell.y });
  }
  mutableMaze.demonVisualPos = demonVisualPos;
  mutableMaze.visualTakenKeys = state.takenKeys.slice();
  mutableMaze.playerAnim = null;
  mutableMaze.demonAnims = new Map<number, unknown>();
  mutableMaze.pendingMove = null;
  mutableMaze.pendingTimeFlux = [];
  mutableMaze.pendingTimeFluxNext = 0;
  mutableMaze.currentTime = 0;
  mutableMaze.solveHoldUntil = 0;
  mutableMaze.lastMoveError = "";
  mutableMaze.lastMoveErrorUntil = 0;

  return maze;
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

  const mazeInput = input.maze;
  if (mazeInput === null || mazeInput === undefined) {
    gameState.maze = null;
  } else {
    const maze = rehydrateMaze(mazeInput);
    if (maze === false) return false;
    gameState.maze = maze;
  }

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
