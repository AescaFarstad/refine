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
}

export function processItemDefinitions(
  defs: Record<string, Omit<ItemDefinition, 'id' | 'essence'> & { essence?: Essence }>
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
    result[key] = {
      ...def,
      id: key,
      essence,
    } as ItemDefinition;
  }
  return result;
}
