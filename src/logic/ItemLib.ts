export interface Essence {
  red?: number;
  blue?: number;
  [key: string]: number | undefined;
}

export interface ItemDefinition {
  id: string;
  name: string;
  volume: number;
  essence: Essence;
  // Rarity used for loot tables (always normalized to string values)
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
}
