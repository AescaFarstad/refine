export type Essence = Record<string, number>;

export const DEFAULT_ESSENCE_KEYS: string[] = [
  'red',
  'blue',
  'green',
  'yellow',
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
  // Rarity used for loot tables (always normalized to string values)
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  molecule: Molecule;
  order: number;
  score: number;
}

export type RawItemDefinition = Omit<ItemDefinition, 'id' | 'essence' | 'rarity' | 'order' | 'score' | 'molecule'> & {
  molecule?: Molecule;
  essence?: Essence;
  rarity?: number | ItemDefinition['rarity'];
};

export function processItemDefinitions(
  defs: Record<string, RawItemDefinition>
): Record<string, ItemDefinition> {
  const extraEssenceScores: Record<string, number> = {
    magenta: -3,
    red: 1,
    blue: 1,
    green: 1,
    cyan: 1,
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

  const result: Record<string, ItemDefinition> = {};
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
      rarity,
      molecule,
      order: 0,
      score,
    };
  }
  return result;
}
