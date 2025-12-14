import { BehNode } from './BehNode';
import { NodeResult, IContainerNode, IBehNode, IBehTree } from './BehTreeTypes';
import type { GameState } from '../../GameState';
import { C } from '../../lib/C';

// Define a new enum for internal status tracking, including RUNNING
enum ChildNodeStatus {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  RUNNING = 'RUNNING'
}

/**
 * AnySuccessAllFailureNode runs all its children in parallel. It succeeds as soon as any of its children succeed.
 * If a child succeeds, all other running children are terminated.
 * It fails only when all of its children have failed.
 */
export class AnySuccessAllFailureNode extends BehNode implements IContainerNode {
  private readonly _children: IBehNode[];
  private _childrenStatus: ChildNodeStatus[];

  constructor(name: string, children: IBehNode[]) {
    super(name);
    this._children = children;
    this._childrenStatus = [];
  }

  public wireTree(root: IBehTree, parent: IContainerNode | undefined): void {
    super.wireTree(root, parent);
    for (const child of this._children) {
      child.wireTree(root, this);
    }
  }

  public init(state: GameState): void {
    if (this._children.length === 0) {
      this.parent?.report(NodeResult.SUCCESS, state, this);
      return;
    }

    this._childrenStatus = new Array(this._children.length).fill(ChildNodeStatus.RUNNING);
    this._children.forEach(child => {
      child.parent = this;
      child.init(state)
    });
  }

  public report(result: NodeResult, state: GameState, child: IBehNode): void {
    const childIndex = this._children.indexOf(child);
    if (childIndex === -1 || this._childrenStatus[childIndex] !== ChildNodeStatus.RUNNING) {
       // Ignore reports from unknown children or children that are not running
      return;
    }

    if (result === NodeResult.SUCCESS) {
      this._childrenStatus[childIndex] = ChildNodeStatus.SUCCESS;
      if (C.BEH_LOG_VERBOSE) {
        console.log(`[BehTree] ${this.getHierarchicalPath()} succeeded because child ${child.getHierarchicalPath()} succeeded.`);
      }
      // Report success to our parent and we are done. The exit() call from the parent will handle cleanup.
      this.parent?.report(NodeResult.SUCCESS, state, this);

    } else { // Child failed
      this._childrenStatus[childIndex] = ChildNodeStatus.FAILURE;
      const allFailed = this._childrenStatus.every(status => status === ChildNodeStatus.FAILURE);
      if (allFailed) {
        if (C.BEH_LOG_VERBOSE) {
          console.log(`[BehTree] ${this.getHierarchicalPath()} failed because all children failed.`);
        }
        this.parent?.report(NodeResult.FAILURE, state, this);
      }
    }
  }

  public exit(): void {
    this._children.forEach((child, index) => {
      if (this._childrenStatus[index] === ChildNodeStatus.RUNNING) {
        child.exit();
      }
    });
  }

  public get children(): IBehNode[] {
    return this._children;
  }
} 