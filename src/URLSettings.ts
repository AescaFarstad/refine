export interface URLSettings {
  seed: number | null;
  cheat: boolean;
  noSave: boolean;
}

export function readURLSettings(): URLSettings {
  const params = new URLSearchParams(window.location.search);
  const rawSeed = params.get('seed');
  const cheat = params.has('cheat');
  const noSave = params.has('nosave');

  if (rawSeed === null) {
    return { seed: null, cheat, noSave };
  }
  if (!/^-?\d+$/.test(rawSeed)) {
    throw new Error(`Invalid seed URL parameter: ${rawSeed}`);
  }

  const seed = Number(rawSeed);
  if (!Number.isSafeInteger(seed)) {
    throw new Error(`Seed URL parameter is out of range: ${rawSeed}`);
  }

  return { seed, cheat, noSave };
}
