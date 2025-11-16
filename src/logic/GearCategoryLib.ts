export interface GearCategoryDefinition {
  id: string;
  name: string;
  unlockCost: number[]; // cost per slot unlocked (skill points, or credits later)
  // Optional flags
  hidden?: boolean;     // not shown in UI lists
  unlimited?: boolean;  // no slot limits for this category
}
