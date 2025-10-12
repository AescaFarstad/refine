export interface RaidDefinition {
  id: string;
  name: string;
  difficulty: number;
  itemDropDifficulty: number;
  durationMin: number;
  itemDropRate: number;
  items: {
    common: string[];
    uncommon: string[];
    rare: string[];
    legendary: string[];
  };
}
