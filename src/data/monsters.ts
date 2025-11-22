import type { MonsterDefinition } from '../logic/MonsterLib';

// Minimal seed monsters used for MonsterLootEncounter source.
// Values are placeholders until FightEncounter is implemented.
const monsters: Record<string, Omit<MonsterDefinition, 'id'>> = {
  rat: {
    name: 'Distorted',
    hp: 5,
    dodge: 10,
    accuracy: 20,
    damage: 1,
    lootItemId: 'rat_remains',
  },
  soldier: {
    name: 'Flower human',
    hp: 20,
    dodge: 15,
    accuracy: 40,
    damage: 1,
    lootItemId: 'flower_remains',
  },
};

export default monsters;
