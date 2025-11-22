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
