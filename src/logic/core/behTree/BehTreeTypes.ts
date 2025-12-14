import type { GameState } from '../../GameState';
import type { EventDefinition } from '../../lib/definitions/EventDefinition';

export enum NodeResult {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE'
}

export type TreeDefinitionFn = () => IBehTree;

export type TreeDefinitionRegistry = Record<string, TreeDefinitionFn>;


export interface IEventListener {
  uid: string; // Unique identifier for the listener
  handleEvent?(eventDef: EventDefinition, state: GameState): void;
  update?(deltaTime: number, state: GameState): void;
}

export interface IContainerNode extends IBehNode {
  readonly children: IBehNode[];
  report(result: NodeResult, state: GameState, child: IBehNode): void;
}

export interface IBehNode extends IEventListener {
  name: string;
  type: string; //coincides with the name of the class
  root: IBehTree;
  parent?: IContainerNode; //Root has no parent
  wireTree(root: IBehTree, parent: IContainerNode | undefined): void;
  init(state: GameState): void;
  exit(): void;
  getHierarchicalPath(): string;
}

export interface IBehTree extends IContainerNode {
  invoker?: IInvoker;
  blackboard: Record<string, any>; //No references, only plain data. Prefer to store data in gameState if possible.
}

/**
 * The Invoker manages all behavior trees and their event/update subscriptions
 */
export interface IInvoker {
  trees: IBehTree[];
  completedTrees: string[];
  eventListeners: Map<string, IEventListener[]>;
  updateListeners: IEventListener[];
  update(deltaTime: number, state: GameState): void;
  handleEvent(eventDef: EventDefinition, state: GameState): void;
  addTree(tree: IBehTree, state: GameState): void;
  reportTreeComplete(tree: IBehTree): void;
  addEventListener(eventName: string, listener: IEventListener): void;
  removeEventListener(listener: IEventListener): void;
  addUpdateListener(listener: IEventListener): void;
  removeUpdateListener(listener: IEventListener): void;
}

export type ExecLambda = (node: IBehNode, state: GameState) => void;

export type EvalLambda = (node: IBehNode, state: GameState) => boolean;

export type EventLambda = (
  node: IBehNode, 
  eventDef: EventDefinition, 
  state: GameState
) => void;