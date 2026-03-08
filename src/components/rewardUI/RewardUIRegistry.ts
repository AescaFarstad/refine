import type { Component } from 'vue';
import RUIPoetsScribbles from './RUIPoetsScribbles.vue';
import RUIChurchSymbols from './RUIChurchSymbols.vue';
import RUISignatureComplete from './RUISignatureComplete.vue';
import RUIMagentaCrystals from './RUIMagentaCrystals.vue';
import RUIBlackFractals from './RUIBlackFractals.vue';
import RUIWhiteSpice from './RUIWhiteSpice.vue';
import RUIEssenceYieldBonus from './RUIEssenceYieldBonus.vue';
import RUIYouWon from './RUIYouWon.vue';

export const REWARD_UI_COMPONENTS: Record<string, Component> = {
  poets_scribbles: RUIPoetsScribbles,
  church_symbols: RUIChurchSymbols,
  signature_complete: RUISignatureComplete,
  RUIMagentaCrystals: RUIMagentaCrystals,
  RUIBlackFractals: RUIBlackFractals,
  RUIWhiteSpice: RUIWhiteSpice,
  RUIEssenceYieldBonus: RUIEssenceYieldBonus,
  you_won: RUIYouWon,
};

export const REWARD_UI_KEYS = Object.keys(REWARD_UI_COMPONENTS) as string[];
