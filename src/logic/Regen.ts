export function applySignedHpRegen(hp: number, maxHp: number, regen: number): number {
  if (regen > 0) return hp + Math.min(regen, Math.max(0, maxHp - hp));
  if (regen < 0) return Math.max(0, hp + regen);
  return hp;
}
