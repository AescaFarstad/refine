It is going to be a hex grid with research nodes. Called Research Pane.
A node can occupy more than one hex cell, a but it is a continuos blob of cells.
The whole thing can be panned and zoomed.
It is goign to consist of multiple canvas layers - the base and the highlights.

There is going to be a lib which loads archetypes (types of nodes) and placements (instances on the grid).
By default all nodes are single cell obstacles unless defined otherwise.

A cell can belong to a special node, can be owned, can be hidden or revealed, can be overt or covert.

We start with the central r=2 part as owned.
Everything within the current `gameState.researchRevealRadius` (default 5) is revealed. The rest is hidden.
If node is partially revealed, all hexes of that node are revealed.

The user will use chronotraces to convert nodes to owned. This will trigger special effects - like unlocking new gear, or adding resources or other bonuses.
Each next converted obstacle/covert node costs more than the previous one. RESEARCH_OBSTACLE_PRICE = 100 RESEARCH_OBSTACLE_PRICE_GROWTH = 20
Some nodes are empty and do not const anything to own.

When the user hovers over the pane, UI shows the price and the nodes that will be unlocked. Under the hood it calculates the cheapest way to own the cell which the user hovers over. Obstacles and covert nodes are the only things that cost something to own. This calculation also converts to owned all nodes that are free to convert - every empty or overt neighbor.

At the top of the research tab, a hover overlay summarizes the current path as:

- `Research N nodes for X ⧖`
- `Clear M ⬤ in the path`

This overlay is only shown when the total chrono price `X` is greater than zero.

CmdResearchNode is teh user input when they click a non-owned node.

When ownership changes, new revealed cells are calculated.

Types of nodes:
obstacle
empty
give stat (i.e. damage, volume, max weight etc)
unlock gear
give resource
void (non-traversable, non-ownable, not drawn)

Covert means it looks and works like an obstacle, but when owned it also does it's usual special effects. So covert 'give resource' node will const chronotraces to own, but upon ownership will give its resource. Overt nodes display what they are and cost nothing.

In gameState research pane is represented as a 2d array of research cells. Size = RESEARCH_PANE_SIZE = 50
To indicate that a cell belongs to the same node we're going to have `nodeId` (int) referenced in the cell. nodeId == -1 are always single cell nodes. This is teh default for all not-specified nodes. Cells also track their current `archetypeId` (string), which can change (e.g. obstacle -> empty).
The lib manages `ResearchArchetype` definitions and `ResearchNodeInstance` placements. `ResearchCell` in GameState holds the runtime state.

Pathfinding: since the lowest price involves going through the least number of covert or obstacle nodes, wi can use the weight of 1 for each such cell and weight 0 for every other cell.

The hex coordinate system should match that which is already used in the game i.e. in wafer.

## Implementation Plan

### Stage 1: Core Data Structures & State
*   **Goal**: Establish the data model for the research grid and integrate it into the GameState.
*   **Tasks**:
    *   **ResearchLib**:
        *   Create `src/logic/ResearchLib.ts`.
        *   Define `ResearchArchetypeDef` (dictionary of node types).
        *   Define `ResearchPlacementInput` (list of placements).
        *   Implement loading logic to populate `ResearchLib` from data files.
        *   Create `src/data/research_archetypes.ts` and `src/data/research_pane.ts`.
    *   **GameState**:
        *   Update `GameState.ts` to include:
            *   `researchCells`: 2D array (50x50) of `ResearchCell` objects.
            *   `ResearchCell` contains: `nodeId` (number, -1 if empty), `archetypeId` (string), `revealed` (boolean), `owned` (boolean).
            *   `researchOwnedCount`: Number of purchased cells (for price calculation).
    *   **UIState**:
        *   Update `src/logic/UIState.ts` to sync `researchOwnedCount` to allow reactive redraws of the base layer.

### Stage 2: Logic & Pathfinding
*   **Goal**: Implement the rules for visibility, cost calculation, and pathfinding.
*   **Tasks**:
    *   **Orchestrator**:
        *   Create `src/logic/Research.ts`: Module with functions operating directly on `GameState`.
    *   **Pathfinding**:
        *   Create `src/logic/ResearchPath.ts`.
        *   Implement BFS/Floodfill algorithms.
        *   **Optimization**: Use static reusable variables (arrays, not dicts) for auxiliary data structures (visited sets, queues) to avoid GC pressure. Use index-based access.
    *   **Logic**:
        *   Implement `calculateVisibility` (reveal radius).
        *   Implement `findCheapestPath` (weighted search: Obstacle/Covert=1, Empty/Overt=0).
        *   Implement cost scaling logic based on `researchOwnedCount`.

### Stage 3: Visualization (Base Layer)
*   **Goal**: Render the static background grid.
*   **Tasks**:
    *   **Component**: Update `src/components/Research.vue`.
    *   **Rendering**:
        *   Implement **Base Layer** canvas.
        *   **Merged Nodes**: Draw hexes of the same node as a merged shape (visually connected).
        *   **Shapes**: Draw other cells as standard hexes.
        *   **Overlays**: Draw images/icons on top of Obstacles/Covert nodes.
        *   **Colors**: Use greenish background for owned nodes.
        *   **Transformation**: Visually transform owned Obstacle/Covert nodes into Empty nodes.
        *   **Visibility**: Do not draw unrevealed cells.
    *   **Reactivity**: Use `uiState.researchOwnedCount` to trigger base layer redraws.
    *   **Interaction**:
        *   Implement Mouse Hover: Convert pixel coordinates to Axial coordinates.
        *   Implement **Pan & Zoom** controls.

### Stage 4: Visualization (Highlight Layer) & Interaction
*   **Goal**: Handle user input and dynamic feedback.
*   **Tasks**:
    *   **Highlight Layer**:
        *   Implement a second canvas layer for dynamic highlights.
        *   Draw the "cheapest path" preview on hover.
    *   **Commands**:
        *   Implement `CmdResearchNode`:
            *   Validate path and cost.
            *   Deduct currency.
            *   Update `researchCells` and `researchOwnedCount`.
            *   Trigger effects (unlocks, stats).

### Stage 5: Content & Polish
*   **Goal**: Fill the grid with content and improve UX.
*   **Tasks**:
    *   Populate `ResearchLib` with meaningful content.
    *   Add animations for unlocking and revealing fog.
    *   Add tooltips and detailed UI for node info.

## Currently Implemented Extras (not fully documented above)

*   There is a developer-only edit panel for the research pane that can toggle cells between obstacle / empty / void and export updated empty/void cell lists for data files.
*   Research cells track additional runtime fields for effective cost and blocked/void status, and there are dedicated empty/void cell lists in data for finer control over layout.
*   Placement data supports radius-based multi-cell nodes and an `initiallyOwned` flag to mark specific nodes as owned from the start.
*   The UI includes extra visual feedback such as coordinate/status labels, stat/gear icons rendered over nodes, and a detailed highlight of the current cheapest path including paid cells.
*   When research unlocks affect core stats, raid previews are automatically refreshed so those changes are reflected immediately in raid estimates.
