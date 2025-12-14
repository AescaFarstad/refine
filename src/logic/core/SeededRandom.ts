import { advanceSeed, seedToRandom } from './mathUtils';

export class SeededRandom {
  private _seed: number = 0;

  constructor(seed: number = 0) {
    this._seed = (seed === 0 ? Date.now() : seed) | 0;
  }

  init(seed: number): void {
    this._seed = seed | 0;
  }

  get(): number {
    const value = seedToRandom(this._seed);
    this._seed = advanceSeed(this._seed);
    return value;
  }

  peek(): number {
    return seedToRandom(this._seed);
  }

  get_in_range(min: number, max: number): number {
    let a = min;
    let b = max;
    if (b < a) {
      const t = a; a = b; b = t;
    }
    return this.get() * (b - a) + a;
  }
}

export default SeededRandom;
