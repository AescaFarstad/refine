export interface URLSettings {
  seed: number | null;
  cheat: boolean;
  quickstart: boolean;
  noSave: boolean;
  loadSlotIndex: number | null;
}

export function readURLSettings(): URLSettings {
  const params = new URLSearchParams(window.location.search);
  const rawSeed = params.get('seed');
  const cheat = params.has('cheat');
  const quickstart = params.has('quickstart');
  const noSave = params.has('nosave');
  const rawLoad = params.get('load');

  let loadSlotIndex: number | null = null;
  if (rawLoad !== null) {
    if (!/^\d+$/.test(rawLoad)) {
      throw new Error(`Invalid load URL parameter: ${rawLoad}`);
    }
    const loadValue = Number(rawLoad);
    if (loadValue < 1) {
      throw new Error(`Load URL parameter must be >= 1: ${rawLoad}`);
    }
    loadSlotIndex = loadValue - 1;
  }

  if (rawSeed === null) {
    return { seed: null, cheat, quickstart, noSave, loadSlotIndex };
  }
  if (!/^-?\d+$/.test(rawSeed)) {
    throw new Error(`Invalid seed URL parameter: ${rawSeed}`);
  }

  const seed = Number(rawSeed);
  if (!Number.isSafeInteger(seed)) {
    throw new Error(`Seed URL parameter is out of range: ${rawSeed}`);
  }

  return { seed, cheat, quickstart, noSave, loadSlotIndex };
}
