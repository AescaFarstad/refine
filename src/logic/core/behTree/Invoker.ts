import type { GameState } from "../../GameState";
import type { EventDefinition } from "../../lib/definitions/EventDefinition";
import type { IBehTree, IInvoker, IEventListener } from "./BehTreeTypes";
import { C } from "../../lib/C";

export class Invoker implements IInvoker {
  public trees: IBehTree[] = [];
  public completedTrees: string[] = [];
  public eventListeners: Map<string, IEventListener[]> = new Map();
  public updateListeners: IEventListener[] = [];

  private listenersMutationCount = 0;

  public addTree(tree: IBehTree, state: GameState): void {
    if (C.BEH_LOG_VERBOSE) {
      console.log(`[Invoker] Adding and initializing tree: ${tree.name}`);
    }
    tree.invoker = this;
    this.trees.push(tree);
    tree.init(state);
  }

  public reportTreeComplete(tree: IBehTree): void {
    if (C.BEH_LOG_VERBOSE) {
      console.log(`[Invoker] Tree completed: ${tree.name}`);
    }
    this.trees = this.trees.filter(t => t.uid !== tree.uid);
    if (!this.completedTrees.includes(tree.name)) {
      this.completedTrees.push(tree.name);
    }
  }  public update(deltaTime: number, state: GameState): void {
    const initialMutationCount = this.listenersMutationCount;
    const listenersToUpdate = [...this.updateListeners];

    for (const listener of listenersToUpdate) {
      if (initialMutationCount === this.listenersMutationCount) {
        // Fast path: No mutations have occurred.
        listener.update?.(deltaTime, state);
      } else {
        // Slow path: The listeners array has been modified.
        // Check if the listener still exists before updating.
        if (this.updateListeners.find(l => l.uid === listener.uid)) {
          listener.update?.(deltaTime, state);
        }
      }
    }
  }

  public handleEvent(eventDef: EventDefinition, state: GameState): void {
    const listenersForEvent = this.eventListeners.get(eventDef.id);
    if (!listenersForEvent || listenersForEvent.length === 0) {
      return;
    }

    if (C.BEH_LOG_VERBOSE) {
      console.log(`[Invoker] Handling event: ${eventDef.id} for ${listenersForEvent.length} listeners.`);
    }    const initialMutationCount = this.listenersMutationCount;
    const listenersToProcess = [...listenersForEvent];

    for (const listener of listenersToProcess) {
       if (initialMutationCount === this.listenersMutationCount) {
        // Fast path: No mutations.
        listener.handleEvent?.(eventDef, state);
      } else {
        // Slow path: Check for existence in the current list for this event.
        const currentListeners = this.eventListeners.get(eventDef.id);
        if (currentListeners?.find(l => l.uid === listener.uid)) {
          listener.handleEvent?.(eventDef, state);
        }
      }
    }
  }

  public addEventListener(eventName: string, listener: IEventListener): void {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, []);
    }
    const listeners = this.eventListeners.get(eventName)!;
    if (!listeners.find(l => l.uid === listener.uid)) {
      listeners.push(listener);
      this.listenersMutationCount++;
    }
  }

  public removeEventListener(listener: IEventListener): void {
    for (const listeners of this.eventListeners.values()) {
      const index = listeners.findIndex(l => l.uid === listener.uid);
      if (index > -1) {
        listeners.splice(index, 1);
        this.listenersMutationCount++;
      }
    }
  }

  public addUpdateListener(listener: IEventListener): void {
    if (!this.updateListeners.find(l => l.uid === listener.uid)) {
      this.updateListeners.push(listener);
      this.listenersMutationCount++;
    }
  }

  public removeUpdateListener(listener: IEventListener): void {
    const initialLength = this.updateListeners.length;
    this.updateListeners = this.updateListeners.filter(l => l.uid !== listener.uid);
    if (this.updateListeners.length !== initialLength) {
      this.listenersMutationCount++;
    }
  }
} 