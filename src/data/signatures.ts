import type { RawSignatureDefinition } from '../logic/SignatureLib';

const signatures: Record<string, RawSignatureDefinition> = {
  starter_mark: {
    name: 'Objectify',
    group: 'starter',
    level: 1,
    molecule: {
      atoms: [
        { color: 'red', x: 1, y: -3 },
        { color: 'red', x: 0, y: -2 },
        { color: 'red', x: 1, y: -2 },
        { color: 'red', x: -1, y: -1 },
        { color: 'red', x: 1, y: -1 },
        { color: 'red', x: -2, y: 0 },
        { color: 'red', x: 1, y: 0 },
        { color: 'red', x: -3, y: 1 },
        { color: 'red', x: -2, y: 1 },
        { color: 'red', x: -1, y: 1 },
        { color: 'red', x: 0, y: 1 },
        { color: 'red', x: 1, y: 1 },
      ],
    },
  },
  red_triad: {
    name: 'Summarize',
    group: 'starter',
    level: 1,
    molecule: {
      atoms: [
        { color: 'blue', x: 0, y: -2 },
        { color: 'blue', x: 1, y: -2 },
        { color: 'blue', x: 2, y: -2 },
        { color: 'blue', x: -1, y: -1 },
        { color: 'blue', x: 2, y: -1 },
        { color: 'blue', x: -2, y: 0 },
        { color: 'blue', x: 2, y: 0 },
        { color: 'blue', x: -2, y: 1 },
        { color: 'blue', x: 1, y: 1 },
        { color: 'blue', x: -2, y: 2 },
        { color: 'blue', x: -1, y: 2 },
        { color: 'blue', x: 0, y: 2 },
      ],
    },
  },
  trtrvvtrrt: {
    name: 'Encapsulate',
    group: 'starter',
    level: 1,
    molecule: {
      atoms: [
        { color: 'blue', x: -1, y: -2 },
        { color: 'blue', x: 0, y: -2 },
        { color: 'blue', x: 1, y: -2 },
        { color: 'blue', x: 2, y: -2 },
        { color: 'blue', x: 3, y: -2 },
        { color: 'blue', x: -1, y: -1 },
        { color: 'blue', x: 2, y: -1 },
        { color: 'blue', x: -1, y: 0 },
        { color: 'blue', x: 1, y: 0 },
        { color: 'blue', x: -1, y: 1 },
        { color: 'blue', x: 0, y: 1 },
        { color: 'blue', x: -1, y: 2 },
      ],
    },
  },
  mesmerize: {
    name: 'Mesmerize',
    group: 'starter',
    level: 1,
    molecule: {
      atoms: [
        { color: 'red', x: 0, y: -2 },
        { color: 'red', x: 2, y: -2 },
        { color: 'red', x: 0, y: -1 },
        { color: 'red', x: 1, y: -1 },
        { color: 'red', x: -2, y: 0 },
        { color: 'red', x: -1, y: 0 },
        { color: 'red', x: 0, y: 0 },
        { color: 'red', x: 1, y: 0 },
        { color: 'red', x: 2, y: 0 },
        { color: 'red', x: -1, y: 1 },
        { color: 'red', x: 0, y: 1 },
        { color: 'red', x: -2, y: 2 },
        { color: 'red', x: 0, y: 2 },
      ]
    },
  },
};

export default signatures;
