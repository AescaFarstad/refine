import type { RawTransmutationDefinition } from '../logic/TransmutationLib';

const transmutation: Record<string, RawTransmutationDefinition> = {
  tesseract: {
    name: 'Tesseract',
    price: {
      gear: { philosophers_stone: 1, zone_crystal: 1, fractal: 1 },
      resources: { chronotraces: 100 },
    },
    priceIncrease: {},
    result: { kind: 'gear', gearId: 'tesseract' },
  },
  scaffold: {
    name: 'Scaffold',
    price: {
      gear: { philosophers_stone: 1, zone_crystal: 1, spice: 1 },
      resources: { credits: 1000 },
    },
    priceIncrease: {},
    result: { kind: 'gear', gearId: 'scaffold' },
  },
  skill_point: {
    name: 'Skill Point',
    price: {
      gear: { philosophers_stone: 1, fractal: 1, spice: 1 },
      resources: { chronotraces: 100 },
    },
    priceIncrease: {},
    result: { kind: 'resource', resource: 'skillPoints' },
  },
};

export default transmutation;
