import type { Component } from 'vue';
import RUIPoetsScribbles from './RUIPoetsScribbles.vue';
import RUIChurchSymbols from './RUIChurchSymbols.vue';
import RUISignatureComplete from './RUISignatureComplete.vue';
import RUIMagentsCrystals from './RUIMagentsCrystals.vue';
import RUIEssenceYieldBonus from './RUIEssenceYieldBonus.vue';

export const REWARD_UI_COMPONENTS: Record<string, Component> = {
  poets_scribbles: RUIPoetsScribbles,
  church_symbols: RUIChurchSymbols,
  signature_complete: RUISignatureComplete,
  RUIMagentsCrystals: RUIMagentsCrystals,
  RUIEssenceYieldBonus: RUIEssenceYieldBonus,
};

export const REWARD_UI_KEYS = Object.keys(REWARD_UI_COMPONENTS) as string[];
