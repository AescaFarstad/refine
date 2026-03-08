export const SPECIAL_ESSENCE_BASE_BY_KEY: Record<string, 'red' | 'green' | 'blue' | 'yellow'> = {
  red_s: 'red',
  green_s: 'green',
  blue_s: 'blue',
  yellow_s: 'yellow',
};

export const SPECIAL_ESSENCE_KEY_BY_BASE: Record<'red' | 'green' | 'blue' | 'yellow', string> = {
  red: 'red_s',
  green: 'green_s',
  blue: 'blue_s',
  yellow: 'yellow_s',
};

export function getEssenceColorFamily(essence: string | null | undefined): string {
  if (!essence) return '';
  return SPECIAL_ESSENCE_BASE_BY_KEY[essence] ?? essence;
}

export function isSpecialEssence(essence: string | null | undefined): boolean {
  if (!essence) return false;
  return SPECIAL_ESSENCE_BASE_BY_KEY[essence] !== undefined;
}

export function convertFamilyEssence(essence: string, targetFamily: 'red' | 'green' | 'blue' | 'yellow'): string {
  return isSpecialEssence(essence) ? SPECIAL_ESSENCE_KEY_BY_BASE[targetFamily] : targetFamily;
}

export function isYellowFamilyEssence(essence: string): boolean {
  return getEssenceColorFamily(essence) === 'yellow';
}
