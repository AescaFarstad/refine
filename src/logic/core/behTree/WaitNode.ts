import { BehNode } from './BehNode';
import { NodeResult } from './BehTreeTypes';
import { GameState } from '../../GameState';

export interface WaitNodeParams {
  durationMin: number;
  durationMax?: number;
  name?: string;
}

/**
 * A node that waits for a specified duration before completing.
 * The duration can be a fixed value or a random value within a range.
 */
export class WaitNode extends BehNode {
  private readonly _durationMin: number;
  private readonly _durationMax: number | undefined;
  private _timer: number = 0;

  /**
   * @param params The parameters for the wait node.
   * @param params.durationMin The minimum duration to wait, in seconds. Must be non-negative.
   * @param params.durationMax The maximum duration to wait, in seconds. If provided, a random duration between min and max will be chosen. Must be >= durationMin.
   * @param params.name The name of the node.
   */
  constructor({ durationMin, durationMax, name = 'Wait' }: WaitNodeParams) {
    super(name);
    if (durationMin < 0) {
      throw new Error(`WaitNode: durationMin must be non-negative, but was ${durationMin}`);
    }
    if (durationMax !== undefined && durationMax < durationMin) {
      throw new Error(`WaitNode: durationMax (${durationMax}) must be greater than or equal to durationMin (${durationMin})`);
    }
    this._durationMin = durationMin;
    this._durationMax = durationMax;
  }

  init(state: GameState): void {    
    if (this._durationMax !== undefined && this._durationMax > this._durationMin) {
      const value = state.random.get();
      this._timer = value * (this._durationMax - this._durationMin) + this._durationMin;
    } else {
      this._timer = this._durationMin;
    }

    if (this._timer <= 0) {
      this.parent?.report(NodeResult.SUCCESS, state, this);
      return;
    }

    this.root.invoker?.addUpdateListener(this);
  }

  update(deltaTime: number, state: GameState): void {

    this._timer -= deltaTime;
    if (this._timer <= 0) {
      this.parent?.report(NodeResult.SUCCESS, state, this);
    }
  }

  exit(): void {
    this.root.invoker?.removeUpdateListener(this);
    this._timer = 0;
  }
} 
