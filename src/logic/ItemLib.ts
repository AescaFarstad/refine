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
}

