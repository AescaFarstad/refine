import type { GameState } from "../../GameState";
import { BehNode } from "./BehNode";
import type { IBehNode, IContainerNode, IBehTree } from "./BehTreeTypes";
import { NodeResult } from "./BehTreeTypes";
import { C } from "../../lib/C";

export class SequencerNode extends BehNode implements IContainerNode {
  public readonly children: IBehNode[];
  protected currentIndex: number = -1;

  constructor(name: string, children: IBehNode[]) {
    super(name);
    this.children = children;
  }

  public wireTree(root: IBehTree, parent: IContainerNode | undefined): void {
    super.wireTree(root, parent);
    for (const child of this.children) {
      child.wireTree(root, this);
    }
  }

  public init(state: GameState): void {
    super.init(state);
    if (C.BEH_LOG_VERBOSE) {
      console.log(`[BehTree] ${this.getHierarchicalPath()} started.`);
    }
    this.currentIndex = 0;
    if (this.children.length > 0) {
      this.children[this.currentIndex].init(state);
    } else {
      // If there are no children, succeed immediately.
      this.parent?.report(NodeResult.SUCCESS, state, this);
    }
  }

  public exit(): void {
    if (this.currentIndex >= 0 && this.currentIndex < this.children.length) {
      this.children[this.currentIndex].exit();
    }
    super.exit();
  }

  public report(result: NodeResult, state: GameState, child: IBehNode): void {
    if (child !== this.children[this.currentIndex]) {
      return; // Ignore reports from children that are not the current one.
    }

    if (result === NodeResult.SUCCESS) {
      // Exit the completed child
      child.exit();      this.currentIndex++;
      if (this.currentIndex < this.children.length) {
        // If there are more children, initialize the next one.
        const nextChild = this.children[this.currentIndex];
        nextChild.init(state);
      } else {
        // All children have succeeded.
        this.parent?.report(NodeResult.SUCCESS, state, this);
      }
    } else { // NodeResult.FAILURE
      // If any child fails, the whole sequencer fails.
      child.exit();
      this.parent?.report(NodeResult.FAILURE, state, this);
    }
  }
} 