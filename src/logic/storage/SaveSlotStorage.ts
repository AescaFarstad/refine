const SAVE_SLOT_DB_NAME = 'save-slots-db';
const SAVE_SLOT_DB_VERSION = 1;
const SAVE_SLOT_DB_STORE = 'save-slots';

interface SaveSlotRecord {
  key: string;
  namespace: string;
  slotIndex: number;
  saveJson: string;
  rawJson: string;
}

export interface SaveSlotValue {
  namespace: string;
  slotIndex: number;
  saveJson: string;
  rawJson: string;
}

function createSlotKey(namespace: string, slotIndex: number): string {
  return `${namespace}:${slotIndex}`;
}

function openSaveSlotDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SAVE_SLOT_DB_NAME, SAVE_SLOT_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore(SAVE_SLOT_DB_STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function requestPersistentStorage(): Promise<void> {
  if (!navigator.storage?.persist) return;
  await navigator.storage.persist();
}

export async function writeSaveSlotValue(
  namespace: string,
  slotIndex: number,
  saveJson: string,
  rawJson: string,
): Promise<void> {
  const db = await openSaveSlotDb();
  const key = createSlotKey(namespace, slotIndex);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SAVE_SLOT_DB_STORE, 'readwrite');
    const record: SaveSlotRecord = {
      key,
      namespace,
      slotIndex,
      saveJson,
      rawJson,
    };
    tx.objectStore(SAVE_SLOT_DB_STORE).put(record);
    tx.oncomplete = () => {
      resolve();
    };
    tx.onerror = () => {
      reject(tx.error);
    };
    tx.onabort = () => {
      reject(tx.error);
    };
  });
  db.close();
}

export async function readSaveSlotValue(namespace: string, slotIndex: number): Promise<SaveSlotValue | null> {
  const db = await openSaveSlotDb();
  const key = createSlotKey(namespace, slotIndex);
  const record = await new Promise<SaveSlotRecord | null>((resolve, reject) => {
    const tx = db.transaction(SAVE_SLOT_DB_STORE, 'readonly');
    const request = tx.objectStore(SAVE_SLOT_DB_STORE).get(key);
    request.onsuccess = () => {
      const result = request.result as SaveSlotRecord | undefined;
      resolve(result ?? null);
    };
    request.onerror = () => {
      reject(request.error);
    };
    tx.onerror = () => {
      reject(tx.error);
    };
    tx.onabort = () => {
      reject(tx.error);
    };
  });
  db.close();
  if (record === null) return null;
  return {
    namespace: record.namespace,
    slotIndex: record.slotIndex,
    saveJson: record.saveJson,
    rawJson: record.rawJson,
  };
}
