export class AdaptiveRoll {
  private _debt: number = 0;
  private _k: number;
  private _step: number;
  private _modCap: number;
  private _tolerance: number;

  constructor(options?: { k?: number; step?: number; modCap?: number; tolerance?: number; debt?: number }) {
    this._k = options?.k ?? 0.15;
    this._step = options?.step ?? 0.05;
    this._modCap = options?.modCap ?? 0.5;
    this._tolerance = options?.tolerance ?? 0;
    this._debt = options?.debt ?? 0;
  }

  getDebt(): number {
    return this._debt;
  }

  setDebt(debt: number): void {
    this._debt = debt;
  }

  reset(): void {
    this._debt = 0;
  }

  getModifier(basePFail: number): number {
    const p = clamp01(basePFail);
    const u = 4 * p * (1 - p);
    const effectiveDebt = Math.abs(this._debt) > this._tolerance ? this._debt : 0;
    const raw = effectiveDebt * this._k * u;
    const quantized = Math.round(raw / this._step) * this._step;
    const capped = clamp(quantized, -this._modCap, this._modCap);
    const effective = clamp01(p + capped);
    return effective - p;
  }

  getEffectivePFail(basePFail: number): number {
    return clamp01(basePFail + this.getModifier(basePFail));
  }

  record(basePFail: number, failed: boolean): void {
    const p = clamp01(basePFail);
    this._debt += p - (failed ? 1 : 0);
  }
}

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

function clamp01(x: number): number {
  return clamp(x, 0, 1);
}

export default AdaptiveRoll;
