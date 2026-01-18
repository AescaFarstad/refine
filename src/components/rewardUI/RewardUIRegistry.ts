import type { Component } from 'vue';
import RUIPoetsScribbles from './RUIPoetsScribbles.vue';

export const REWARD_UI_COMPONENTS: Record<string, Component> = {
  poets_scribbles: RUIPoetsScribbles,
};

export const REWARD_UI_KEYS = Object.keys(REWARD_UI_COMPONENTS) as string[];
