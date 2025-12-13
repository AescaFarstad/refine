import type { ResearchDataFile } from '../logic/ResearchLib';

const researchData: ResearchDataFile = {
  tier_0: {
    strength_0: {
      effect: 'giveStrength',
      amount: 5,
    },
    looting_0: {
      effect: 'giveLooting',
      amount: 5,
    },
    volume_0: {
      effect: 'giveVolume',
      amount: 5,
    },
    unlock_medicine_0: {
      effect: 'unlockGear',
      gearIds: ['painkillers'],
    },
  },
  tier_1: {
    strength_1: {
      effect: 'giveStrength',
      amount: 7,
    },
    looting_1: {
      effect: 'giveLooting',
      amount: 7,
    },
    volume_1: {
      effect: 'giveVolume',
      amount: 7,
    },
    unlock_support_gear_1: {
      effect: 'unlockGear',
      gearIds: ['scout_binoculars', 'trauma_kit'],
    },
  },
};

export default researchData;
