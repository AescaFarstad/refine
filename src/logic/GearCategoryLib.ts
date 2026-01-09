export interface GearCategoryDefinition {
  id: string;
  name: string;
  unlockCost: number[]; // cost per slot unlocked (skill points, or credits later)
  // Optional flags
  hidden?: boolean;     // not shown in UI lists
  unlimited?: boolean;  // no slot limits for this category
}

export type RawGearCategoryDefinition = Omit<GearCategoryDefinition, 'id'>;

export function parseGearCategoryDefinitions(raw: Record<string, RawGearCategoryDefinition>): Map<string, GearCategoryDefinition> {
  const map = new Map<string, GearCategoryDefinition>();
  for (const key in raw) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    map.set(key, { ...raw[key], id: key });
  }
  return map;
}
