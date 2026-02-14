import type { GameState } from '../GameState';
import { loadFromJson, saveToJson } from '../SaveLoad';
import {
  readSaveSlotValue,
  requestPersistentStorage,
  writeSaveSlotValue,
  type SaveSlotValue,
} from '../storage/SaveSlotStorage';

export const DEV_SAVE_SLOT_COUNT = 5;

const EXCLUDED_KEYS = new Set([
  'raidSimulation',
  'acknowledgedRaidOutcome',
  'discoveryCounter',
  // Runtime/visual-only state (not part of save format)
  'lastMoveError',
  'lastMoveErrorUntil',
  'pendingTimeFlux',
  'pendingTimeFluxNext',
  'currentTime',
  'playerAnim',
  'demonAnims',
  'solveHoldUntil',
  'playerVisualPos',
  'demonVisualPos',
  'visualTakenKeys',
  'pendingMove',
]);
const MISMATCH_CONTEXT_RADIUS = 160;
const DEV_SLOT_SAVE_KEY_PREFIX = 'dev-save-slot-json-';
const DEV_SLOT_RAW_KEY_PREFIX = 'dev-save-slot-raw-';
const DEV_SLOT_NAMESPACE = 'dev-raw-v1';

interface NormalizeState {
  ids: Map<object, number>;
  nextId: number;
}

export interface SaveLoadMismatch {
  index: number;
  totalDifferences: number;
  leftChar: string;
  rightChar: string;
  leftBefore: string;
  leftAfter: string;
  rightBefore: string;
  rightAfter: string;
}

export interface SaveLoadRoundtripTestResult {
  equal: boolean;
  saveJson: string;
  originalRawJson: string;
  roundTripRawJson: string;
  loadFailed: boolean;
  loadFailureReason: string;
  mismatch: SaveLoadMismatch | null;
}

export interface DevSaveSlotLoadResult {
  slotIndex: number;
  exists: boolean;
  saveJson: string;
  rawJson: string;
  loadFailed: boolean;
  loadFailureReason: string;
  loadedState: GameState | null;
}

export interface DevSaveSlotCompareResult {
  slotIndex: number;
  hasSavedRaw: boolean;
  currentRawJson: string;
  savedRawJson: string;
  equal: boolean;
  mismatch: SaveLoadMismatch | null;
}

function createSpecialValue(type: string, value: string): Record<string, string> {
  return { $type: type, value };
}

function normalizePrimitive(value: unknown): unknown {
  if (value === null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return value;
    return createSpecialValue('Number', String(value));
  }
  if (typeof value === 'bigint') {
    return createSpecialValue('BigInt', value.toString());
  }
  if (typeof value === 'undefined') {
    return createSpecialValue('Undefined', '');
  }
  if (typeof value === 'function') {
    return createSpecialValue('Function', value.name);
  }
  if (typeof value === 'symbol') {
    return createSpecialValue('Symbol', String(value.description ?? ''));
  }
  return null;
}

function normalizeValue(value: unknown, state: NormalizeState): unknown {
  const primitive = normalizePrimitive(value);
  if (primitive !== null || value === null) return primitive;

  if (value instanceof Date) {
    return createSpecialValue('Date', value.toISOString());
  }

  if (value instanceof RegExp) {
    return createSpecialValue('RegExp', value.toString());
  }

  const objectValue = value as object;
  const existingId = state.ids.get(objectValue);
  if (existingId !== undefined) {
    return { $ref: existingId };
  }

  const id = state.nextId++;
  state.ids.set(objectValue, id);

  if (Array.isArray(value)) {
    return {
      $id: id,
      $type: 'Array',
      items: value.map((item) => normalizeValue(item, state)),
    };
  }

  if (value instanceof Map) {
    const entries = Array.from(value.entries()).map(([key, mapValue]) => {
      return [
        normalizeValue(key, state),
        normalizeValue(mapValue, state),
      ] as const;
    });
    entries.sort((a, b) => JSON.stringify(a[0]).localeCompare(JSON.stringify(b[0])));
    return {
      $id: id,
      $type: 'Map',
      entries,
    };
  }

  if (value instanceof Set) {
    const values = Array.from(value.values()).map((setValue) => normalizeValue(setValue, state));
    values.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    return {
      $id: id,
      $type: 'Set',
      values,
    };
  }

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((key) => !EXCLUDED_KEYS.has(key))
    .sort((a, b) => a.localeCompare(b));
  const out: Record<string, unknown> = {
    $id: id,
    $type: 'Object',
  };

  for (const key of keys) {
    out[key] = normalizeValue(obj[key], state);
  }

  return out;
}

export function stringifyRaw(value: unknown): string {
  const normalized = normalizeValue(value, {
    ids: new Map<object, number>(),
    nextId: 1,
  });
  return JSON.stringify(normalized);
}

function getCharLabel(value: string, index: number): string {
  if (index >= value.length) return '<EOF>';
  const ch = value[index]!;
  switch (ch) {
    case '\n':
      return '\\n';
    case '\r':
      return '\\r';
    case '\t':
      return '\\t';
    default:
      return ch;
  }
}

function getBefore(value: string, index: number): string {
  const start = Math.max(0, index - MISMATCH_CONTEXT_RADIUS);
  return value.slice(start, index);
}

function getAfter(value: string, index: number): string {
  const end = Math.min(value.length, index + MISMATCH_CONTEXT_RADIUS);
  return value.slice(index, end);
}

function countDifferences(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  let count = 0;
  for (let i = 0; i < max; i++) {
    if (a[i] !== b[i]) count++;
  }
  return count;
}

function findMismatch(a: string, b: string): SaveLoadMismatch | null {
  const min = Math.min(a.length, b.length);
  for (let i = 0; i < min; i++) {
    if (a[i] === b[i]) continue;
    return {
      index: i,
      totalDifferences: countDifferences(a, b),
      leftChar: getCharLabel(a, i),
      rightChar: getCharLabel(b, i),
      leftBefore: getBefore(a, i),
      leftAfter: getAfter(a, i),
      rightBefore: getBefore(b, i),
      rightAfter: getAfter(b, i),
    };
  }
  if (a.length === b.length) return null;
  return {
    index: min,
    totalDifferences: countDifferences(a, b),
    leftChar: getCharLabel(a, min),
    rightChar: getCharLabel(b, min),
    leftBefore: getBefore(a, min),
    leftAfter: getAfter(a, min),
    rightBefore: getBefore(b, min),
    rightAfter: getAfter(b, min),
  };
}

function getSlotSuffix(slotIndex: number): string {
  return String(slotIndex + 1);
}

function getSlotSaveKey(slotIndex: number): string {
  return `${DEV_SLOT_SAVE_KEY_PREFIX}${getSlotSuffix(slotIndex)}`;
}

function getSlotRawKey(slotIndex: number): string {
  return `${DEV_SLOT_RAW_KEY_PREFIX}${getSlotSuffix(slotIndex)}`;
}

function readLegacyDevSaveSlotRecord(slotIndex: number): SaveSlotValue | null {
  const saveJson = localStorage.getItem(getSlotSaveKey(slotIndex)) ?? '';
  const rawJson = localStorage.getItem(getSlotRawKey(slotIndex)) ?? '';
  if (saveJson.length === 0) return null;
  return {
    namespace: DEV_SLOT_NAMESPACE,
    slotIndex,
    saveJson,
    rawJson,
  };
}

export async function saveGameStateToDevSlot(gameState: GameState, slotIndex: number): Promise<void> {
  await requestPersistentStorage();
  const saveJson = saveToJson(gameState);
  const rawJson = stringifyRaw(gameState);
  await writeSaveSlotValue(DEV_SLOT_NAMESPACE, slotIndex, saveJson, rawJson);
  localStorage.removeItem(getSlotSaveKey(slotIndex));
  localStorage.removeItem(getSlotRawKey(slotIndex));
}

export async function loadGameStateFromDevSlot(slotIndex: number): Promise<DevSaveSlotLoadResult> {
  const indexedSlot = await readSaveSlotValue(DEV_SLOT_NAMESPACE, slotIndex);
  const legacySlot = readLegacyDevSaveSlotRecord(slotIndex);
  const slot = indexedSlot ?? legacySlot;
  const saveJson = slot?.saveJson ?? '';
  const rawJson = slot?.rawJson ?? '';

  if (saveJson.length === 0) {
    return {
      slotIndex,
      exists: false,
      saveJson,
      rawJson,
      loadFailed: false,
      loadFailureReason: '',
      loadedState: null,
    };
  }

  const loaded = loadFromJson(saveJson);
  if (loaded === false) {
    return {
      slotIndex,
      exists: true,
      saveJson,
      rawJson,
      loadFailed: true,
      loadFailureReason: 'Slot JSON exists but is malformed.',
      loadedState: null,
    };
  }

  return {
    slotIndex,
    exists: true,
    saveJson,
    rawJson,
    loadFailed: false,
    loadFailureReason: '',
    loadedState: loaded,
  };
}

export async function compareGameStateWithDevSlot(gameState: GameState, slotIndex: number): Promise<DevSaveSlotCompareResult> {
  const currentRawJson = stringifyRaw(gameState);
  const indexedSlot = await readSaveSlotValue(DEV_SLOT_NAMESPACE, slotIndex);
  const savedRawJson = indexedSlot?.rawJson ?? (localStorage.getItem(getSlotRawKey(slotIndex)) ?? '');

  if (savedRawJson.length === 0) {
    return {
      slotIndex,
      hasSavedRaw: false,
      currentRawJson,
      savedRawJson,
      equal: false,
      mismatch: null,
    };
  }

  const mismatch = findMismatch(currentRawJson, savedRawJson);
  return {
    slotIndex,
    hasSavedRaw: true,
    currentRawJson,
    savedRawJson,
    equal: mismatch === null,
    mismatch,
  };
}

export function runSaveLoadRoundtripTest(gameState: GameState): SaveLoadRoundtripTestResult {
  const originalRawJson = stringifyRaw(gameState);
  const saveJson = saveToJson(gameState);
  const loaded = loadFromJson(saveJson);
  if (loaded === false) {
    return {
      equal: false,
      saveJson,
      originalRawJson,
      roundTripRawJson: '',
      loadFailed: true,
      loadFailureReason: 'Failed to load JSON produced by saveToJson.',
      mismatch: null,
    };
  }

  const roundTripRawJson = stringifyRaw(loaded);
  const mismatch = findMismatch(originalRawJson, roundTripRawJson);

  return {
    equal: mismatch === null,
    saveJson,
    originalRawJson,
    roundTripRawJson,
    loadFailed: false,
    loadFailureReason: '',
    mismatch,
  };
}
