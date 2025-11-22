import type { GearCategoryDefinition } from '../logic/GearCategoryLib';

// All categories per new_concept.md; ids are lowercase
const gearCategories: Record<string, Omit<GearCategoryDefinition, 'id'>> = {
  weapons:     { name: 'Weapons',     unlockCost: [1, 2, 3] },
  accessories: { name: 'Accessories', unlockCost: [1, 2, 3] },
  armor:       { name: 'Armor',       unlockCost: [1, 2, 3] },
  bags:        { name: 'Bags',        unlockCost: [1, 2, 3] },
  devices:     { name: 'Devices',     unlockCost: [1, 2, 3] },
  companions:  { name: 'Companions',  unlockCost: [1, 2, 3] },
  grenades:    { name: 'Grenades',    unlockCost: [1, 2, 3] },
  medicine:    { name: 'Medicine',    unlockCost: [1, 2, 3] },
  tactics:     { name: 'Tactics',     unlockCost: [1, 2, 3] },
  // Special internal category: not shown in UI, no slot limits
  hidden:      { name: 'Hidden',      unlockCost: [], hidden: true, unlimited: true },
};

export default gearCategories;
