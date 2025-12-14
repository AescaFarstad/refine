import { SequencerNode } from "./SequencerNode";
import { NodeResult } from "./BehTreeTypes";
import type { GameState } from "../../GameState";
import type { IBehNode } from "./BehTreeTypes";

export class RepeatNode extends SequencerNode {
  constructor(name: string, children: IBehNode[]) {
    super(name, children);
  }

  public report(result: NodeResult, state: GameState, child: IBehNode): void {
    if (child !== this.children[this.currentIndex]) {
      return; // Ignore reports from children that are not the current one.
    }

    if (result === NodeResult.FAILURE) {
      child.exit();
      this.parent?.report(NodeResult.FAILURE, state, this);
      return;
    }

    // NodeResult.SUCCESS
    child.exit();
    this.currentIndex++;
    if (this.currentIndex < this.children.length) {
      // More children in the sequence, run the next one.
      const nextChild = this.children[this.currentIndex];
      nextChild.init(state);
    } else {
      // End of sequence, loop back to the beginning.
      this.currentIndex = 0;
      if (this.children.length > 0) {
        const firstChild = this.children[this.currentIndex];
        firstChild.init(state);
      } else {
        // If there are no children, this would be an infinite loop.
        // To be safe, we just succeed.
        this.parent?.report(NodeResult.SUCCESS, state, this);
      }
    }
  }
} 