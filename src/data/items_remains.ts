import type { Molecule } from '../logic/ItemLib';


const remainsDefinitions: Record<string, { name: string; volume: number; rarity?: number; molecule?: Molecule }> = {
  burdock_remains: {
    name: 'Burdock Seeds',
    volume: 1,
    rarity: 1,
    molecule: {
      atoms: [
        { color: 'red', x: 0, y: 0 },
      ],
      connections: [],
    },
  },
  hound_remains: {
    name: 'Xeno Hound Liver',
    volume: 1,
    rarity: 1,
    molecule: {
      atoms: [
        { color: 'red', x: 0, y: 0 },
        { color: 'red', x: 1, y: 0 },
      ],
      connections: [
        { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
      ],
    },
  },
  distorted_remains: {
    name: 'Distorted Brains',
    volume: 1,
    rarity: 1,
    molecule: {
      atoms: [
        { color: 'red', x: 0, y: 0 },
        { color: 'red', x: 1, y: 0 },
        { color: 'red', x: 2, y: 0 },
      ],
      connections: [
        { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
        { from: { x: 1, y: 0 }, to: { x: 2, y: 0 } },
      ],
    },
  },
  flower_remains: {
    name: 'Flower Human Roots',
    volume: 1,
    rarity: 1,
    molecule: {
      atoms: [
        { color: 'blue', x: 0, y: 0 },
        { color: 'blue', x: 1, y: 0 },
        { color: 'blue', x: 2, y: 0 },
      ],
      connections: [
        { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
        { from: { x: 1, y: 0 }, to: { x: 2, y: 0 } },
      ],
    },
  },
  stalker_remains: {
    name: 'Invisible Stalker Dust',
    volume: 1,
    rarity: 1,
    molecule: {
      atoms: [
        { color: 'green', x: 0, y: 0 },
        { color: 'green', x: 1, y: 0 },
        { color: 'green', x: 2, y: 0 },
      ],
      connections: [
        { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
        { from: { x: 1, y: 0 }, to: { x: 2, y: 0 } },
      ],
    },
  },
  spikder_remains: {
    name: 'Spikder Spikes',
    volume: 2,
    rarity: 1,
    molecule: {
      atoms: [
        { color: 'red', x: 1, y: -1 },
        { color: 'red', x: -1, y: 0 },
        { color: 'blue', x: 0, y: 0 },
        { color: 'red', x: 0, y: 1 },
      ],
      connections: [
        { from: { x: 0, y: 0 }, to: { x: 1, y: -1 } },
        { from: { x: 0, y: 0 }, to: { x: -1, y: 0 } },
        { from: { x: 0, y: 0 }, to: { x: 0, y: 1 } },
      ],
    },
  },
  scorch_remains: {
    name: 'Scorch Ash',
    volume: 2,
    rarity: 1,
    molecule: {
      atoms: [
        { color: 'red', x: -1, y: 0 },
        { color: 'yellow', x: 0, y: 0 },
        { color: 'red', x: 1, y: 0 },
      ],
      connections: [
        { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
        { from: { x: -1, y: 0 }, to: { x: 0, y: 0 } },
      ],
    },
  },
  octopus_remains: {
    name: 'Black Octopus Glands',
    volume: 6,
    rarity: 1,
    molecule: {
      atoms: [
        { color: 'gray', x: 0, y: -1 },
        { color: 'gray', x: 1, y: -1 },
        { color: 'gray', x: -1, y: 0 },
        { color: 'indigo', x: 0, y: 0 },
        { color: 'gray', x: 1, y: 0 },
        { color: 'gray', x: -1, y: 1 },
        { color: 'gray', x: 0, y: 1 },
      ],
      connections: [
        { from: { x: 0, y: 0 }, to: { x: 1, y: -1 } },
        { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
        { from: { x: 0, y: 0 }, to: { x: 0, y: 1 } },
        { from: { x: 0, y: 0 }, to: { x: -1, y: 1 } },
        { from: { x: 0, y: 0 }, to: { x: -1, y: 0 } },
        { from: { x: 0, y: 0 }, to: { x: 0, y: -1 } },
      ],
    },
  },
  lightning_remains: {
    name: 'Lightning Zealot Ectoplasm',
    volume: 1,
    rarity: 1,
    molecule: {
      atoms: [
        { color: 'gray', x: 0, y: -1 },
        { color: 'yellow', x: -1, y: 0 },
        { color: 'yellow', x: 0, y: 0 },
        { color: 'gray', x: -1, y: 1 },
      ],
      connections: [
        { from: { x: -1, y: 0 }, to: { x: 0, y: -1 } },
        { from: { x: 0, y: 0 }, to: { x: -1, y: 1 } },
        { from: { x: 0, y: -1 }, to: { x: 0, y: 0 } },
        { from: { x: -1, y: 1 }, to: { x: -1, y: 0 } },
      ],
    },
  },
  dendroid_remains: {
    name: 'Dendroid Bark',
    volume: 1,
    rarity: 1,
    molecule: {
      atoms: [
        { color: 'gray', x: -1, y: 0 },
        { color: 'yellow', x: 0, y: 0 },
        { color: 'gray', x: 1, y: 0 },
      ],
      connections: [
        { from: { x: -1, y: 0 }, to: { x: 0, y: 0 } },
        { from: { x: 1, y: 0 }, to: { x: 0, y: 0 } },
      ],
    },
  },
  soldier_remains: {
    name: 'Turned Soldier Radio',
    volume: 1,
    rarity: 2,
    molecule: {
      atoms: [
        { color: 'yellow', x: -1, y: 0 },
        { color: 'yellow', x: 1, y: 0 },
      ],
      connections: [
        { from: { x: -1, y: 0 }, to: { x: 1, y: 0 } },
      ],
    },
  },
  squid_remains: {
    name: 'Car Squid Spark Plug',
    volume: 1,
    rarity: 1,
    molecule: {
      atoms: [
        { color: 'yellow', x: 0, y: -2 },
        { color: 'gold', x: 0, y: 0 },
        { color: 'yellow', x: 2, y: 0 },
        { color: 'yellow', x: -2, y: 2 },
      ],
      connections: [
        { from: { x: 0, y: 0 }, to: { x: 0, y: -2 } },
        { from: { x: 0, y: 0 }, to: { x: 2, y: 0 } },
        { from: { x: 0, y: 0 }, to: { x: -2, y: 2 } },
      ],
    },
  },
  devourer_remains: {
    name: 'Devourer Swarm Coils',
    volume: 1,
    rarity: 1,
    molecule: {
      atoms: [
        { color: 'gray', x: 1, y: -1 },
        { color: 'gray', x: -1, y: 0 },
        { color: 'orange', x: 0, y: 0 },
        { color: 'gray', x: 0, y: 1 },
      ],
      connections: [
        { from: { x: 0, y: 0 }, to: { x: 1, y: -1 } },
        { from: { x: 0, y: 0 }, to: { x: 0, y: 1 } },
        { from: { x: 0, y: 0 }, to: { x: -1, y: 0 } },
      ],
    },
  },
  hive_remains: {
    name: 'The Hive Sting',
    volume: 1,
    rarity: 1,
    molecule: {
      atoms: [
        { color: 'yellow', x: 1, y: -1 },
        { color: 'yellow', x: 0, y: 0 },
        { color: 'yellow', x: 1, y: 0 },
      ],
      connections: [
        { from: { x: 1, y: -1 }, to: { x: 0, y: 0 } },
        { from: { x: 1, y: 0 }, to: { x: 1, y: -1 } },
        { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
      ],
    },
  },
  finger_remains: {
    name: 'Devil\'s Finger Scale',
    volume: 1,
    rarity: 1,
    molecule: {
      atoms: [
        { color: 'orange', x: -1, y: 0 },
        { color: 'orange', x: 1, y: 0 },
      ],
      connections: [
        { from: { x: -1, y: 0 }, to: { x: 1, y: 0 } },
      ],
    },
  },
  hedgehog_remains: {
    name: 'Hedgehog Shell',
    volume: 1,
    rarity: 1,
    molecule: {
      atoms: [
        { color: 'gray', x: -1, y: -2 },
        { color: 'orange', x: 1, y: -2 },
        { color: 'gray', x: 3, y: -2 },
        { color: 'orange', x: -2, y: 0 },
        { color: 'yellow', x: 0, y: 0 },
        { color: 'orange', x: 2, y: 0 },
        { color: 'gray', x: -3, y: 2 },
        { color: 'orange', x: -1, y: 2 },
        { color: 'gray', x: 1, y: 2 },
      ],
      connections: [
        { from: { x: 1, y: -2 }, to: { x: 0, y: 0 } },
        { from: { x: 2, y: 0 }, to: { x: 0, y: 0 } },
        { from: { x: -2, y: 0 }, to: { x: 0, y: 0 } },
        { from: { x: -1, y: 2 }, to: { x: 0, y: 0 } },
        { from: { x: -1, y: -2 }, to: { x: 1, y: -2 } },
        { from: { x: -1, y: -2 }, to: { x: -2, y: 0 } },
        { from: { x: 3, y: -2 }, to: { x: 1, y: -2 } },
        { from: { x: 3, y: -2 }, to: { x: 2, y: 0 } },
        { from: { x: 1, y: 2 }, to: { x: -1, y: 2 } },
        { from: { x: 1, y: 2 }, to: { x: 2, y: 0 } },
        { from: { x: -3, y: 2 }, to: { x: -2, y: 0 } },
        { from: { x: -3, y: 2 }, to: { x: -1, y: 2 } },
      ],
    },
  },
};

export default remainsDefinitions;
