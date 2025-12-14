import { SequencerNode } from "./SequencerNode";
import { NodeResult } from "./BehTreeTypes";
import type { GameState } from "../../GameState";
import type { IBehNode } from "./BehTreeTypes";

export class SelectorNode extends SequencerNode {
  constructor(name: string, children: IBehNode[]) {
    super(name, children);
  }

  public report(result: NodeResult, state: GameState, child: IBehNode): void {
    if (child !== this.children[this.currentIndex]) {
      return; // Ignore reports from children that are not the current one.
    }

    if (result === NodeResult.SUCCESS) {
      // If any child succeeds, the whole selector succeeds.
      child.exit();
      this.parent?.report(NodeResult.SUCCESS, state, this);
      return;
    }

    // NodeResult.FAILURE
    child.exit();
    this.currentIndex++;
    if (this.currentIndex < this.children.length) {
      // More children in the sequence, try the next one.
      const nextChild = this.children[this.currentIndex];
      nextChild.init(state);
    } else {
      // All children have failed.
      this.parent?.report(NodeResult.FAILURE, state, this);
    }
  }
} 