export const DISCOVERY = {
  GEAR_UPGRADE_MODAL_OPENED: 'gear_upgrade_modal_opened',
  SHARDS: 'shards',
  SIGNATURES: 'signatures',
  DAMAGE_BREAKDOWN: 'damage_breakdown',
  TIME_BREAKDOWN: 'time_breakdown',
} as const;

// Prefer using `DISCOVERY.*` literals, but allow ad-hoc string ids too.
export type DiscoveryId = (typeof DISCOVERY)[keyof typeof DISCOVERY] | string;
