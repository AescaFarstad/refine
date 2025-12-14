import type { GameState } from "../../GameState";
import type { EventDefinition } from "../../lib/definitions/EventDefinition";
import { BehNode } from "./BehNode";
import { NodeResult } from "./BehTreeTypes";
import { C } from "../../lib/C";

type EventPredicate = (node: AwaitEventNode, eventDef: EventDefinition) => boolean;

export class AwaitEventNode extends BehNode {
  private readonly eventId: string;
  private readonly predicate?: EventPredicate;

  constructor(name: string, eventId: string, predicate?: EventPredicate) {
    super(name);
    this.eventId = eventId;
    this.predicate = predicate;
  }

  public init(state: GameState): void {
    if (this.root.invoker) {
      if (C.BEH_LOG_VERBOSE) {
        console.log(`[BehTree] ${this.getHierarchicalPath()} started, awaiting event '${this.eventId}'.`);
      }
      this.root.invoker.addEventListener(this.eventId, this);
    } else {
      console.error(`[BehTree] ${this.getHierarchicalPath()} cannot listen for event without an invoker.`);
      this.parent?.report(NodeResult.FAILURE, state, this);
    }
  }  public exit(): void {
    this.root.invoker?.removeEventListener(this);
  }

  public handleEvent(eventDef: EventDefinition, state: GameState): void {
    if (eventDef.id === this.eventId && (!this.predicate || this.predicate(this, eventDef))) {
      if (C.BEH_LOG_VERBOSE) {
        console.log(`[BehTree] ${this.getHierarchicalPath()} caught event '${this.eventId}' and predicate passed.`);
      }
      this.parent?.report(NodeResult.SUCCESS, state, this);
    }
  }
} 