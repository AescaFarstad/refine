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
    blue_up_upgrade_0: {
      effect: 'recipeUpgrade',
      upgradeId: 'blue_down',
    },
    quality_upgrade_0: {
      effect: 'recipeUpgrade',
      upgradeId: 'increase_quality',
    },
    give_recipe_c5_0: {
      effect: 'giveRecipe',
      upgradeId: 'c5',
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
    green_up_upgrade_1: {
      effect: 'recipeUpgrade',
      upgradeId: 'green_up',
    },
    quality_upgrade_1: {
      effect: 'recipeUpgrade',
      upgradeId: 'increase_quality',
    },
  },
};

export default researchData;
