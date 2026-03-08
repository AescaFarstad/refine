import type { RaidDefinition } from './RaidLib';

export type Essence = Record<string, number>;

export const DEFAULT_ESSENCE_KEYS: string[] = [
  'red',
  'blue',
  'green',
  'yellow',
  'red_s',
  'blue_s',
  'green_s',
  'yellow_s',
  'cyan',
  'orange',
  'indigo',
  'crimson',
  'emerald',
  'gold',
  'gray',
  'magenta',
];

// Axial coordinates: basis vectors are right (q) and left+up (r)
export interface Point2 {
  x: number; // q coordinate (right)
  y: number; // r coordinate (left+up)
}

export interface MoleculeAtom {
  color: string; // essence color: 'red', 'blue', 'green', 'yellow', etc.
  x: number; // axial q
  y: number; // axial r
}

export interface MoleculeConnection {
  from: Point2;
  to: Point2;
}

export interface Molecule {
  atoms: MoleculeAtom[];
  connections: MoleculeConnection[];
}

export interface ItemDefinition {
  id: string;
  name: string;
  volume: number;
  essence: Essence;
  remains: boolean;
  // Rarity used for loot tables (always normalized to string values)
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  molecule: Molecule;
  order: number;
  score: number;
}

export type RawItemDefinition = Omit<ItemDefinition, 'id' | 'essence' | 'rarity' | 'order' | 'score' | 'molecule' | 'remains'> & {
  molecule?: Molecule;
  essence?: Essence;
  rarity?: number | ItemDefinition['rarity'];
  devOnly?: boolean;
};

export function processItemDefinitions(
  defs: Record<string, RawItemDefinition>
): Record<string, ItemDefinition & { devOnly?: boolean }> {
  const extraEssenceScores: Record<string, number> = {
    magenta: 1,
    red: 1,
    blue: 1,
    green: 1,
    cyan: 3,
    indigo: 2,
    crimson: 2,
    emerald: 2,
    yellow: 5,
    orange: 7,
    gold: 11,
  };

  const defaultMolecule: Molecule = {
    atoms: [{ color: 'gray', x: 0, y: 0 }],
    connections: [],
  };

  const result: Record<string, ItemDefinition & { devOnly?: boolean }> = {};
  for (const [key, def] of Object.entries(defs)) {
    const essence: Essence = {};
    for (const k of DEFAULT_ESSENCE_KEYS) essence[k] = 0;

    const molecule = def.molecule ?? defaultMolecule;

    if (def.molecule) {
      // Clear any manually defined essence if molecule exists, or just add to it?
      // Requirement: "essence count should be derived from the molecule"
      // So we overwrite/calculate it.
      for (const atom of molecule.atoms) {
        essence[atom.color] = (essence[atom.color] ?? 0) + 1;
      }
    } else if (def.essence) {
      for (const [k, v] of Object.entries(def.essence)) essence[k] = v;
    }

    // Normalize rarity from number to string
    let rarity: 'common' | 'uncommon' | 'rare' | 'legendary' = 'common';
    if (typeof def.rarity === 'number') {
      const rarityMap = ['common', 'uncommon', 'rare', 'legendary'] as const;
      rarity = rarityMap[Math.min(Math.max(def.rarity - 1, 0), 3)];
    } else if (def.rarity) {
      rarity = def.rarity;
    }

    let scoreRaw = 0;
    for (const [k, v] of Object.entries(essence)) {
      if (!v) continue;
      scoreRaw += v;
      const extra = extraEssenceScores[k];
      if (extra) scoreRaw += v * extra;
    }
    const score = scoreRaw / def.volume;

    result[key] = {
      ...def,
      id: key,
      essence,
      remains: key.endsWith('_remains'),
      rarity,
      molecule,
      order: 0,
      score,
    };
  }
  return result;
}

export function parseItemDefinitionsWithOrder(
  raw: Record<string, ItemDefinition & { devOnly?: boolean }>,
  raids: Iterable<RaidDefinition>
): Map<string, ItemDefinition> {
  const map = new Map<string, ItemDefinition>();
  for (const key in raw) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    const d = raw[key];

    let rarity: ItemDefinition['rarity'];
    if (typeof d.rarity === 'string') {
      rarity = d.rarity;
    } else {
      const rn = Number.isFinite(d.rarity) ? Number(d.rarity) : 1;
      rarity = (rn >= 4
        ? 'legendary'
        : rn === 3
          ? 'rare'
          : rn === 2
            ? 'uncommon'
            : 'common') as ItemDefinition['rarity'];
    }

    map.set(key, {
      id: key,
      name: d.name,
      volume: d.volume,
      essence: d.essence,
      remains: d.remains,
      rarity,
      molecule: d.molecule,
      order: 999999,
      score: d.score,
    });
  }

  const itemToRaid = new Map<string, number>();
  for (const raid of raids) {
    for (const itemId of raid.items) {
      if (!itemToRaid.has(itemId)) itemToRaid.set(itemId, raid.order);
    }
  }

  const devItems: string[] = [];
  const remainsItems: string[] = [];
  const raidItems: Map<number, string[]> = new Map();
  const otherItems: string[] = [];

  for (const itemId of map.keys()) {
    const d = raw[itemId];
    const isDev = d.devOnly === true;
    const isRemains = d.remains;
    const raidOrder = itemToRaid.get(itemId);

    if (isDev) {
      devItems.push(itemId);
    } else if (isRemains) {
      remainsItems.push(itemId);
    } else if (raidOrder !== undefined) {
      let arr = raidItems.get(raidOrder);
      if (!arr) {
        arr = [];
        raidItems.set(raidOrder, arr);
      }
      arr.push(itemId);
    } else {
      otherItems.push(itemId);
    }
  }

  devItems.sort();
  remainsItems.sort();
  otherItems.sort();
  for (const items of raidItems.values()) items.sort();

  let currentOrder = 0;

  for (const itemId of devItems) map.get(itemId)!.order = currentOrder++;
  for (const itemId of remainsItems) map.get(itemId)!.order = currentOrder++;

  const sortedRaidOrders = Array.from(raidItems.keys()).sort((a, b) => a - b);
  for (const raidOrder of sortedRaidOrders) {
    const items = raidItems.get(raidOrder)!;
    for (const itemId of items) map.get(itemId)!.order = currentOrder++;
  }

  for (const itemId of otherItems) map.get(itemId)!.order = currentOrder++;

  return map;
}
