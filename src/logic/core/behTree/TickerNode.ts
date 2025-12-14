import { BehNode } from './BehNode';
import { NodeResult } from './BehTreeTypes';
import type { GameState } from '../../GameState';
import { C } from '../../lib/C';

export type TickerPredicate = (node: TickerNode, state: GameState) => boolean;

/**
 * A node that subscribes to game ticks and evaluates a predicate function on each tick.
 * It remains in an implicit "running" state until the predicate returns true, 
 * at which point it reports SUCCESS.
 */
export class TickerNode extends BehNode {
  private predicate: TickerPredicate;
  private isSubscribed = false;
  private hasLoggedUpdate = false;
  private hasLoggedCondition = false;

  constructor(name: string, predicate: TickerPredicate) {
    super(name);
    this.predicate = predicate;
  }

  public init(state: GameState): void {
    super.init(state);
    if (C.BEH_LOG_VERBOSE) {
      console.log(`[BehTree] ${this.getHierarchicalPath()} started, awaiting condition.`);
    }
    console.log(`[BehTree] ${this.getHierarchicalPath()} initializing. Condition: gameTime (${state.gameTime}) >= canAddNodeAt (${this.root.blackboard.canAddNodeAt})`);

    // Check the condition immediately. If it's already true, we can succeed right away.
    if (this.predicate(this, state)) {
      console.log(`[BehTree] ${this.getHierarchicalPath()} condition MET on init. Reporting SUCCESS immediately.`);
      this.parent?.report(NodeResult.SUCCESS, state, this);
    } else {
      console.log(`[BehTree] ${this.getHierarchicalPath()} condition NOT met on init. Subscribing to updates.`);
      // Otherwise, subscribe to updates to check again on subsequent game ticks.
      this.root.invoker?.addUpdateListener(this);
      this.isSubscribed = true;
    }
  }

  public exit(): void {
    if (this.isSubscribed) {
      this.root.invoker?.removeUpdateListener(this);
      this.isSubscribed = false;
    }
    super.exit();
  }

  public update(_deltaTime: number, state: GameState): void {
    if (!this.hasLoggedUpdate) {
      console.log(`[BehTree] ${this.getHierarchicalPath()} is being updated.`);
      this.hasLoggedUpdate = true;
    }    if (!this.hasLoggedCondition) {
      console.log(`[BehTree] ${this.getHierarchicalPath()} checking condition: gameTime=${state.gameTime}, canAddNodeAt=${this.root.blackboard.canAddNodeAt}`);
      this.hasLoggedCondition = true;
    }

    // On each tick, re-evaluate the predicate.
    if (this.predicate(this, state)) {
      if (C.BEH_LOG_VERBOSE) {
        console.log(`[BehTree] ${this.getHierarchicalPath()} condition met. Reporting SUCCESS.`);
      }
      // Once the condition is met, report success. The parent will call exit() in response.
      this.parent?.report(NodeResult.SUCCESS, state, this);
    }
    // If the condition is not met, we do nothing and implicitly remain in the "running" state.
  }
} 