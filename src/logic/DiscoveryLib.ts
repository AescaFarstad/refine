export const DISCOVERY = {
  GEAR: 'gear',
  GEAR_UPGRADE_MODAL_OPENED: 'gear_upgrade_modal_opened',
  SHARDS: 'shards',
  SIGNATURES: 'signatures',
  DAMAGE_BREAKDOWN: 'damage_breakdown',
  TIME_BREAKDOWN: 'time_breakdown',
  REFINE_YIELD: 'refine_yield',
  CYAN_YIELD: 'cyan_yield',
  MAZE_NAVIGATION: 'maze_navigation',
  // Tab discoveries (unlocked)
  TAB_REFINE: 'tab_refine',
  TAB_RESEARCH: 'tab_research',
  TAB_MAZE: 'tab_maze',
  // Tab visited discoveries
  TAB_REFINE_VISITED: 'tab_refine_visited',
  TAB_RESEARCH_VISITED: 'tab_research_visited',
  TAB_MAZE_VISITED: 'tab_maze_visited',
} as const;

// Prefer using `DISCOVERY.*` literals, but allow ad-hoc string ids too.
export type DiscoveryId = (typeof DISCOVERY)[keyof typeof DISCOVERY] | string;
