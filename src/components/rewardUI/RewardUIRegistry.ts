import type { Component } from 'vue';
import RUIPoetsScribbles from './RUIPoetsScribbles.vue';
import RUIChurchSymbols from './RUIChurchSymbols.vue';

export const REWARD_UI_COMPONENTS: Record<string, Component> = {
  poets_scribbles: RUIPoetsScribbles,
  church_symbols: RUIChurchSymbols,
};

export const REWARD_UI_KEYS = Object.keys(REWARD_UI_COMPONENTS) as string[];
