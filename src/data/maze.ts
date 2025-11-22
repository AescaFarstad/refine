import type { MazeDefinition } from '../logic/MazeLib';

function centerSpawn(x: number, y: number) { return { x: Math.max(1, Math.floor(x / 2)), y: Math.max(1, Math.floor(y / 2)) }; }

export const mazeDefinitions: Record<string, Omit<MazeDefinition, 'id'>> = {
  maze_1: {
    name: 'Free Run',
    x: 7, y: 7,
    keyNum: 1,
    minReachable: 15,
    optimumScore: 8,
    // Demonstrates a fixed author-defined layout (open grid)
    useFixedLayout: true,
    spawn: { x: 1, y: 3 },
    keys: [{ x: 5, y: 2 }],
    fill: [{ x: 2, y: 2 }, { x: 2, y: 3 }, { x: 5, y: 1 }, { x: 4, y: 4 }, { x: 5, y: 4 }],
    spawnProbability: 0,
    maxDemons: 0,
    artefacts: [],
    description: 'Open grid. One finish key. No demons, no eyes.'
  },
  maze_2: {
    name: 'Walls Intro',
    x: 7, y: 7,
    keyNum: 2,
    minReachable: 20,
    optimumScore: 12,
    spawnProbability: 0,
    maxDemons: 0,
    artefacts: [],
    description: 'Some random walls. Still safe.',
    useFixedLayout: true,
    spawn: { x: 1, y: 3 },
    keys: [{ x: 3, y: 4 }],
    fill: [{ x: 2, y: 4 }, { x: 3, y: 1 }, { x: 3, y: 2 }, { x: 4, y: 5 }],
  },
  maze_3: {
    name: 'Sliding Paths',
    x: 9, y: 9,
    keyNum: 3,
    minReachable: 30,
    optimumScore: 18,
    spawnProbability: 0,
    maxDemons: 0,
    artefacts: [],
    description: 'More obstacles for ice-sliding decisions.',
    useFixedLayout: true,
    spawn: { x: 3, y: 7 },
    keys: [{ x: 3, y: 1 },{ x: 3, y: 3 },{ x: 3, y: 6 }],
    fill: [{ x: 7, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 1, y: 4 }, { x: 6, y: 4 }, { x: 1, y: 5 }, { x: 4, y: 6 }, { x: 7, y: 6 }, { x: 2, y: 7 }, { x: 7, y: 7 }],
  },
  maze_4: {
    name: 'Single Eye',
    x: 12, y: 12,
    keyNum: 1,
    minReachable: 30,
    optimumScore: 10,
    spawnProbability: 0,
    maxDemons: 0,
    artefacts: [],
    description: 'Adds an Eye artefact for visibility flair.'
  },
  maze_5: {
    name: 'Key Intro',
    x: 14, y: 14,
    keyNum: 1,
    minReachable: 30,
    optimumScore: 16,
    spawnProbability: 0,
    maxDemons: 0,
    artefacts: [],
    description: 'Collect a single key to finish.'
  },
  maze_6: {
    name: 'Two Keys',
    x: 14, y: 14,
    keyNum: 2,
    minReachable: 30,
    optimumScore: 26,
    spawnProbability: 0,
    maxDemons: 0,
    artefacts: [],
    description: 'Two keys, still no enemies.'
  },
  maze_7: {
    name: 'Slow Demon',
    x: 18, y: 14,
    keyNum: 3,
    minReachable: 50,
    optimumScore: 30,
    spawnProbability: 0.0,
    maxDemons: 1,
    artefacts: [],
    description: 'One slow-spawning demon.'
  },
  maze_8: {
    name: 'More Demons',
    x: 36, y: 24,
    keyNum: 1,
    minReachable: 100,
    optimumScore: 36,
    spawnProbability: 0.0,
    maxDemons: 2,
    artefacts: [],
    description: 'Two keys with occasional demons and a freeze.'
  },
  maze_9: {
    name: 'Finale',
    x: 36, y: 24,
    keyNum: 9,
    minReachable: 120,
    optimumScore: 100,
    spawnProbability: 0.3,
    maxDemons: 3,
    artefacts: [],
    description: 'Demons and multiple keys for the final challenge.'
  },
};

export default mazeDefinitions;
