import { BehNode } from './BehNode';
import type { GameState } from '../../GameState';
import type { EventDefinition } from '../../lib/definitions/EventDefinition';
import { NodeResult } from './BehTreeTypes';
import { C } from '../../lib/C';

export type EventProcessLambda = (eventDef: EventDefinition, node: BehNode, state: GameState) => boolean;

export class AwaitAndProcessEventNode extends BehNode {
  private readonly eventId: string;
  private readonly processLambda: EventProcessLambda;
  private readonly eventFilter?: (eventDef: EventDefinition) => boolean;

  constructor(
    name: string,
    eventId: string,
    processLambda: EventProcessLambda,
    eventFilter?: (eventDef: EventDefinition) => boolean
  ) {
    super(name);
    this.eventId = eventId;
    this.processLambda = processLambda;
    this.eventFilter = eventFilter;
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
  }

  public exit(): void {
    this.root.invoker?.removeEventListener(this);
  }

  public handleEvent(eventDef: EventDefinition, state: GameState): void {
    if (eventDef.id !== this.eventId) {
      return;
    }

    // Check if event matches our filter (if provided)
    if (this.eventFilter && !this.eventFilter(eventDef)) {
      return;
    }

    if (C.BEH_LOG_VERBOSE) {
      console.log(`[BehTree] ${this.getHierarchicalPath()} caught event '${this.eventId}'.`);
    }

    // Process the event using the lambda
    const success = this.processLambda(eventDef, this, state);    if (C.BEH_LOG_VERBOSE) {
      console.log(`[BehTree] ${this.getHierarchicalPath()} event processing ${success ? 'succeeded' : 'failed'}.`);
    }

    // Report result to parent
    this.parent?.report(success ? NodeResult.SUCCESS : NodeResult.FAILURE, state, this);
  }
} 