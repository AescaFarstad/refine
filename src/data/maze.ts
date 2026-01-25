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
    description: 'Open grid. One finish key. No demons, no eyes.',
    reward: [
      { kind: 'resource', resource: 'chronotraces', amount: 30 }
    ],
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
    reward: [
      { kind: 'resource', resource: 'chronotraces', amount: 70 }
    ],
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
    reward: [
      { kind: 'countable_gear', gearId: 'zone_crystal', amount: 5 },
    ],
    useFixedLayout: true,
    spawn: { x: 3, y: 7 },
    keys: [{ x: 3, y: 1 }, { x: 3, y: 3 }, { x: 3, y: 6 }],
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
    description: 'Adds an Eye artefact for visibility flair.',
    reward: [
      { kind: 'resource', resource: 'credits', amount: 1250 }
    ],
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
    description: 'Collect a single key to finish.',
    reward: [
      { kind: 'resource', resource: 'chronotraces', amount: 250 }
    ],
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
    description: 'Two keys, still no enemies.',
    reward: [
      { kind: 'resource', resource: 'credits', amount: 1400 },
      { kind: 'resource', resource: 'chronotraces', amount: 200 }
    ],
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
    description: 'One slow-spawning demon.',
    reward: [
      { kind: 'resource', resource: 'credits', amount: 1500 },
      { kind: 'resource', resource: 'chronotraces', amount: 300 },
      { kind: 'resource', resource: 'shardDust', amount: 100 }
    ],
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
    description: 'Two keys with occasional demons and a freeze.',
    reward: [
      { kind: 'resource', resource: 'credits', amount: 2750 },
      { kind: 'resource', resource: 'shardDust', amount: 250 }
    ],
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
    description: 'Demons and multiple keys for the final challenge.',
    reward: [
      { kind: 'resource', resource: 'credits', amount: 10000 },
      { kind: 'resource', resource: 'shardDust', amount: 500 },
      { kind: 'resource', resource: 'skillPoints', amount: 1 }
    ]
  },
};

export default mazeDefinitions;
