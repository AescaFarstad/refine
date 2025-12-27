export interface Essence {
  red?: number;
  blue?: number;
  green?: number;
  yellow?: number;
  [key: string]: number | undefined;
}

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
  molecule?: Molecule; // Optional for now, will be required later
  order: number;
}

export function processItemDefinitions(
  defs: Record<string, Omit<ItemDefinition, 'id' | 'essence' | 'rarity' | 'order'> & { essence?: Essence; rarity?: number | 'common' | 'uncommon' | 'rare' | 'legendary' }>
): Record<string, ItemDefinition> {
  const result: Record<string, ItemDefinition> = {};
  for (const [key, def] of Object.entries(defs)) {
    const essence = { ...def.essence };
    if (def.molecule) {
      // Clear any manually defined essence if molecule exists, or just add to it?
      // Requirement: "essence count should be derived from the molecule"
      // So we overwrite/calculate it.
      for (const atom of def.molecule.atoms) {
        essence[atom.color] = (essence[atom.color] || 0) + 1;
      }
    }

    // Normalize rarity from number to string
    let rarity: 'common' | 'uncommon' | 'rare' | 'legendary' = 'common';
    if (typeof def.rarity === 'number') {
      const rarityMap = ['common', 'uncommon', 'rare', 'legendary'] as const;
      rarity = rarityMap[Math.min(Math.max(def.rarity - 1, 0), 3)];
    } else if (def.rarity) {
      rarity = def.rarity;
    }

    result[key] = {
      ...def,
      id: key,
      essence,
      rarity,
      order: 0,
    } as ItemDefinition;
  }
  return result;
}
