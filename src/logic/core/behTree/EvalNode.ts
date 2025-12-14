import type { GameState } from "../../GameState";
import { BehNode } from "./BehNode";
import type { EvalLambda } from "./BehTreeTypes";
import { NodeResult } from "./BehTreeTypes";
import { C } from "../../lib/C";

export class EvalNode extends BehNode {
  private readonly lambda: EvalLambda;

  constructor(name: string, lambda: EvalLambda) {
    super(name);
    this.lambda = lambda;
  }

  public init(state: GameState): void {
    if (C.BEH_LOG_VERBOSE) {
      console.log(`[BehTree] ${this.getHierarchicalPath()} started.`);
    }
    try {
      const result = this.lambda(this, state);
      this.parent?.report(result ? NodeResult.SUCCESS : NodeResult.FAILURE, state, this);
    } catch (error) {
      console.error(`[BehTree] Error in ${this.getHierarchicalPath()}:`, error);
      this.parent?.report(NodeResult.FAILURE, state, this);
    }
  }
} 