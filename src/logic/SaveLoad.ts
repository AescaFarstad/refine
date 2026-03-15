import { GameState } from "./GameState";
import SeededRandom from "./core/SeededRandom";
import { loadGame_V1 } from "./LoadGame_V1";
import type { Wafer } from "./Wafer";
import { getPivotHex } from "./MoleculeUtils";
import { indexToAxial } from "./Research";
import type { EncounterDef } from "./RaidLib";

type AnonymousObject = Record<string, unknown>;
const RESEARCH_OWNED_CELLS_KEY = "researchOwnedCells";
const RESEARCH_NEXUS_IDS_KEY = "researchNexusIds";
const CELL_PAIR_SEPARATOR = "  ";
const AUTOSAVE_LOCAL_STORAGE_KEY = "autosave-json-v1";
const AUTOSAVE_MIN_INTERVAL_MS = 2000;

let lastAutosaveAtMs = 0;
let autosaveTimerId: number | null = null;
let pendingAutosaveJson: string = "";
let autosaveEnabled = true;

interface SavedWaferCell {
  x: number;
  y: number;
}

interface SavedWaferItem {
  id: string;
  rotation: number;
  x: number;
  y: number;
}

interface SerializedWafer {
  enabledCells: string;
  placedItems: SavedWaferItem[];
}

interface SerializedNexusOverride {
  price: number;
  priceIncrease: number[];
}

interface SerializedRaidOverride {
  baseLootChance: number;
  items: string[];
  encounters: Array<{ count: number; encounter: EncounterDef }>;
  zoneCollapseSec: number;
}

function isObjectRecord(value: unknown): value is AnonymousObject {
  return typeof value === "object" && value !== null;
}

function saveReplacer(key: string, value: unknown): unknown {
  if (key === "lib") return undefined;
  if (key === "researchCells") return undefined;
  if (key === "wafer") return undefined;
  if (key === "raidSimulation") return undefined;
  if (key === "acknowledgedRaidOutcome") return undefined;
  if (key === "discoveryCounter") return undefined;
  if (key === "effectiveGearById") return undefined;
  // Maze transient + derived (not persisted)
  if (key === "maze") return undefined;
  if (key === "mazeVisibility") return undefined;
  if (key === "mazeResourceSpawns") return undefined;

  if (key === "random" && value instanceof SeededRandom) {
    return value.getSeed();
  }

  if (value instanceof Map) {
    return Array.from(value.entries());
  }

  return value;
}

function serializeWafer(wafer: Wafer): SerializedWafer {
  const enabledCells: SavedWaferCell[] = [];
  for (const cell of wafer.cells.values()) {
    if (cell.enabled) enabledCells.push({ x: cell.x, y: cell.y });
  }

  const placedItems: SavedWaferItem[] = [];
  for (const item of wafer.items) {
    if (!item) continue;
    const pivot = getPivotHex(item.molecule);
    placedItems.push({
      id: item.id,
      rotation: item.rotation,
      x: pivot.x,
      y: pivot.y,
    });
  }

  const enabledCellsStr = enabledCells.map(c => `${c.x} ${c.y}`).join(CELL_PAIR_SEPARATOR);
  return { enabledCells: enabledCellsStr, placedItems };
}

function collectOwnedResearchCellsString(gameState: GameState): string {
  const out: string[] = [];
  for (let i = 0; i < gameState.researchCells.length; i++) {
    if (!gameState.researchCells[i]!.owned) continue;
    const p = indexToAxial(i);
    out.push(`${p.x} ${p.y}`);
  }
  return out.join(CELL_PAIR_SEPARATOR);
}

function collectResearchNexusIdsString(gameState: GameState): string {
  const out: string[] = [];
  for (let i = 0; i < gameState.researchCells.length; i++) {
    const cell = gameState.researchCells[i]!;
    const nexusId = cell.nexusId;
    if (!nexusId) continue;
    if (!Number.isInteger(cell.nexusPlacementId) || cell.nexusPlacementId <= 0) {
      throw new Error(`Invalid nexus placement id at cell index ${i}`);
    }
    const p = indexToAxial(i);
    out.push(`${nexusId} ${cell.nexusPlacementId} ${p.x} ${p.y}`);
  }
  return out.join(CELL_PAIR_SEPARATOR);
}

function cloneSerializable<T>(value: T): T {
  return structuredClone(value);
}

function serializeRawRaidLib(gameState: GameState): Record<string, SerializedRaidOverride> {
  const out: Record<string, SerializedRaidOverride> = {};
  for (const raid of gameState.lib.raids.values()) {
    out[raid.id] = {
      baseLootChance: raid.baseLootChance,
      items: raid.items.slice(),
      encounters: raid.encounters.map(step => ({
        count: step.count,
        encounter: cloneSerializable(step.encounter),
      })),
      zoneCollapseSec: raid.zoneCollapseSec,
    };
  }
  return out;
}

function serializeRawNexusLib(gameState: GameState): Record<string, SerializedNexusOverride> {
  const out: Record<string, SerializedNexusOverride> = {};
  for (const nexusItem of gameState.lib.nexusItems.values()) {
    out[nexusItem.id] = {
      price: nexusItem.price,
      priceIncrease: nexusItem.priceIncrease.slice(),
    };
  }
  return out;
}

function serializeGameState(gameState: GameState): AnonymousObject {
  const out = JSON.parse(JSON.stringify(gameState, saveReplacer)) as AnonymousObject;
  out[RESEARCH_OWNED_CELLS_KEY] = collectOwnedResearchCellsString(gameState);
  out[RESEARCH_NEXUS_IDS_KEY] = collectResearchNexusIdsString(gameState);
  out.wafer = serializeWafer(gameState.wafer);
  out.rawRaidLib = serializeRawRaidLib(gameState);
  out.rawNexusLib = serializeRawNexusLib(gameState);
  return out;
}

function utf8ToBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToUtf8(value: string): string {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function saveToJson(gameState: GameState): string {
  return JSON.stringify(serializeGameState(gameState));
}

export function saveToObject(gameState: GameState): AnonymousObject {
  return serializeGameState(gameState);
}

export function saveToBase64(gameState: GameState): string {
  return utf8ToBase64(saveToJson(gameState));
}

function readSaveVersion(input: AnonymousObject): number | false {
  const version = input.version;
  if (typeof version !== "number" || !Number.isFinite(version)) return false;
  return version;
}

function loadByVersion(version: number, input: unknown): GameState | false {
  switch (version) {
    case 1:
      return loadGame_V1(input);
    default:
      return false;
  }
}

export function loadFromObject(input: unknown): GameState | false {
  if (!isObjectRecord(input)) return false;

  try {
    const version = readSaveVersion(input);
    if (version === false) return false;
    return loadByVersion(version, input);
  } catch {
    return false;
  }
}

export function loadFromJson(json: string): GameState | false {
  try {
    return loadFromObject(JSON.parse(json));
  } catch {
    return false;
  }
}

export function loadFromBase64(base64: string): GameState | false {
  try {
    return loadFromJson(base64ToUtf8(base64));
  } catch {
    return false;
  }
}

function writeAutosaveNowJson(json: string): void {
  localStorage.setItem(AUTOSAVE_LOCAL_STORAGE_KEY, json);
  lastAutosaveAtMs = Date.now();
  console.log("[Save] autosaved");
}

export function setAutosaveEnabled(enabled: boolean): void {
  autosaveEnabled = enabled;
  if (!autosaveEnabled) {
    cancelPendingAutosave();
  }
}

export function saveAutosave(gameState: GameState): void {
  if (!autosaveEnabled) return;
  pendingAutosaveJson = saveToJson(gameState);

  const now = Date.now();
  const elapsed = now - lastAutosaveAtMs;

  if (elapsed >= AUTOSAVE_MIN_INTERVAL_MS && autosaveTimerId === null) {
    const next = pendingAutosaveJson;
    pendingAutosaveJson = "";
    if (next.length > 0) writeAutosaveNowJson(next);
    return;
  }

  if (autosaveTimerId !== null) {
    return;
  }

  const waitMs = Math.max(0, AUTOSAVE_MIN_INTERVAL_MS - elapsed);
  autosaveTimerId = window.setTimeout(() => {
    autosaveTimerId = null;
    const next = pendingAutosaveJson;
    pendingAutosaveJson = "";
    if (next.length > 0) writeAutosaveNowJson(next);
  }, waitMs);
}

export function cancelPendingAutosave(): void {
  if (autosaveTimerId !== null) {
    clearTimeout(autosaveTimerId);
    autosaveTimerId = null;
  }
  pendingAutosaveJson = "";
}

export function flushAutosave(gameState?: GameState): void {
  if (!autosaveEnabled) return;
  const nextPending = pendingAutosaveJson;
  cancelPendingAutosave();
  if (gameState) {
    writeAutosaveNowJson(saveToJson(gameState));
    return;
  }
  if (nextPending.length === 0) return;
  writeAutosaveNowJson(nextPending);
}

export function loadAutosave(): GameState | false {
  if (!autosaveEnabled) return false;
  const json = localStorage.getItem(AUTOSAVE_LOCAL_STORAGE_KEY);
  if (json === null || json.length === 0) return false;
  return loadFromJson(json);
}

export function wipeAutosave(): void {
  cancelPendingAutosave();
  lastAutosaveAtMs = 0;
  localStorage.removeItem(AUTOSAVE_LOCAL_STORAGE_KEY);
}
