# Behavior Tree System Design

## Overview

The Behavior Tree (BehTree) system provides a flexible, event-driven approach to orchestrating complex game logic sequences such as:
- Game stage progression (tutorial → main game)
- Branching dialogs with conditions and consequences
- Quest sequences with multiple paths and outcomes

## Core Architecture

### Key Components

1. **Invoker** - The central manager that:
   - Maintains all active behavior trees
   - Distributes update ticks to listening nodes
   - Routes game events to listening nodes
   - Tracks completed trees

2. **BehTree** - The root node of a behavior tree that:
   - Extends SequencerNode functionality
   - Reports completion to the Invoker
   - Provides root reference to all child nodes

3. **BehNode** - The base interface for all nodes that:
   - Maintains hierarchical relationships (parent/children)
   - Implements `init()`/`exit()` lifecycle
   - When its task is complete, it calls `report()` on its parent container to signal success or failure.
   - Can subscribe to events or updates

4. **IContainerNode** - An interface for nodes that contain other nodes (e.g., SequencerNode, BehTree). It:
  - Implements the `report()` method to handle results from its children.
  - Is responsible for orchestrating its children's lifecycle (`init`/`exit`).

### Integration Points

```typescript
// In GameState
invoker: Invoker = new Invoker();

// In GameState.update()
this.invoker.update(deltaTime, this);

// In EventProcessor.processSingleEvent()
state.invoker.handleEvent(eventDef, state, context);
```

## Design Principles

### 1. **Implicit RUNNING State**
- No explicit RUNNING state is tracked
- A node is considered "running" between `init()` and `report()`
- Parent waits for child's report (synchronous or asynchronous)

### 2. **Lifecycle Guarantees**
- If `init()` is called on a node, `exit()` is guaranteed to be called later when the node's execution finishes (either by succeeding, failing, or being interrupted).
- A node's `update()` or `handleEvent()` methods will only be called after `init()` has been called and before `exit()` has been called.
- Nodes must handle interruption gracefully at any time.
- Cleanup (removing listeners, etc.) happens in `exit()`.
- Nodes should not call their init or exit, this is the parent's job. (BehTree is the sole exception)

### 3. **Stateless Lambdas**
- All lambda functions must be pure/stateless
- Context is passed through arguments, not closures
- State modifications happen through GameState
- This enables tree recreation from definitions

### 4. **Event-Driven Execution**
- Unlike traditional tick-based behavior trees
- Nodes can subscribe to game events
- More efficient for narrative/quest systems

### 5. **Plain Data Context**
- BehTreeContext contains only serializable data
- No object references allowed
- Suitable for save/load functionality

## Node Development Rules

### DO:
1. **Always call `parent.report()`** when done (unless you're the root)
2. **Implement `exit()`** if you have any cleanup:
   - Remove event listeners
   - Clear timers
   - Reset temporary state
3. **Use hierarchical naming** for debugging and persistence
4. **Keep lambdas stateless** - all state in GameState or context

### DON'T:
1. **Don't store mutable state in lambdas** - use context or GameState
2. **Don't forget to remove listeners** in `exit()`
3. **Don't call `init()` on children directly** - let parent orchestrate
4. **Don't assume synchronous completion** - nodes may report later
6. **Don't log excessively** - check `invoker.logVerbose` first

### LOGGING:
- log errors
- only log starts and successes if invoker.logVerbose

## Node Types

### Core Nodes (Implemented)

1. **ExecNode** - Executes a lambda function immediately
   ```typescript
   new ExecNode((node, state) => {
     state.startMinigame('Welcome');
   })
   ```

2. **AwaitEventNode** - Waits for a specific game event
   ```typescript
   new AwaitEventNode('minigameComplete', (node, eventDef, state) => {
     if (eventDef.name == 'Welcome')
       state.startMinigame('Ingress');
   })
   ```

3. **SequencerNode** - Executes children in sequence, waiting for each to succeed before starting the next. Fails if any child fails.
   ```typescript
   new SequencerNode('mySequence', [node1, node2, node3])
   ```

4. **SelectorNode** - Executes children in sequence, advancing to the next child if one fails. Succeeds as soon as a child succeeds, and fails only if all children have failed.
  ```typescript
  new SelectorNode('tryActions', [action1, action2, backupAction])
  ```

5. **RepeatNode** - Executes its child sequence repeatedly. Fails if the child sequence ever fails. Often used as the root of a main loop.
  ```typescript
  new RepeatNode('mainLoop', [
    // ... nodes to be repeated
  ])
  ```

6. **AnySuccessAllFailureNode** - A parallel node that initializes all children simultaneously. Succeeds as soon as any child succeeds. Fails only when all children have failed.
  ```typescript
  new AnySuccessAllFailureNode('parallelTasks', [
    new AwaitEventNode('playerInput'),
    new TickerNode('timeout', (n, s) => s.gameTime > 10)
  ])
  ```

7. **TickerNode** - Waits for a condition to become true. It checks the condition on every game update tick, remaining in an implicit running state. Succeeds when the condition is met.
  ```typescript
  new TickerNode('waitForReady', (node, state) => state.player.isReady)
  ```

8. **WaitNode** - Waits for a specified duration
   ```typescript
   new WaitNode({ durationMin: 2.5, name: 'wait_for_intro' }) // waits 2.5 seconds
   new WaitNode({ durationMin: 1, durationMax: 5, name: 'random_delay' }) // waits between 1 and 5 seconds
   ```

### Specialized Dialog Nodes

1. **CheckDNTypeNode** - Type checking for dialog nodes
   ```typescript
   new CheckDNTypeNode('checkMessage', 'message')
   new CheckDNTypeNode('checkChoice', 'choice')
   ```

### Planned Nodes

- **RandomSelectorNode** - Randomly selects a child
- **ParallelNode** variants (Any/All/Exhaust)
- **SelectNode** - Jumps to named node

## Error Handling

### Graceful Degradation
- Invalid data should result in FAILURE

## Save/Load Architecture

### Currnet State
- Save loading should be possible but it is not implemented

### What Will Get Saved
1. **Active tree names**: Which trees are running
2. **Node data**: The serializable state of nodes
3. **Active listeners**: Which nodes are listening to events


### Load Process
1. Create fresh trees from definitions
2. Restore nodes state
3. Re-subscribe active listeners

## Usage Examples

### Simple Sequence
```typescript
const tutorialTree = new BehTree('tutorial', [
  new ExecNode((n, s) => s.showDialog('welcome')),
  new AwaitEventNode('dialogClosed'),
  new ExecNode((n, s) => s.startMinigame('Tutorial')),
  new AwaitEventNode('minigameComplete'),
  new ExecNode((n, s) => s.unlockFeature('mainGame'))
]);
```


## Best Practices

1. **Name nodes descriptively**: Use the hierarchical path for debugging
3. **Use blackboard wisely**: Temporary state may go in blackboard if convenient, but the primary place for game state is in gameState! 
4. **Plan for interruption**: Any node might be exited early

## Dialog System Integration

### Starting Dialogs
```typescript
// In game code
startDialog('introDialog', 'player_intro_1', gameState);
// This will:
// 1. Create DialogState with empty history and unique name
// 2. Start the 'dialog' (or other specified) behavior tree
// 3. Set dialogName in tree blackboard
```

### Dialog Flow
1. **Initialization**: `initDialog` adds starting node to `DialogState.nodes`
2. **Processing**: Tree checks last node type and responds accordingly
3. **State Management**: `DialogState.nodes` maintains complete conversation history
4. **Choice Handling**: `makeDialogChoice()` adds choice to `choicesMade` and triggers event
5. **Completion**: When no next node exists, `dialogFinished` event is dispatched
