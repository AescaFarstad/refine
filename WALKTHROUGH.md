# Chemistry Refining System - Implementation Walkthrough

**Status**: Stage 2 Complete (including event integration) ✅  
**Build Status**: Passing ✅  
**Manual Testing**: Required (dev server needed)

---

## What Was Built

Replaced the recipe-based refining system with a new hex grid chemistry system where players place item molecules onto a hex wafer grid.

### Stage 0: Foundations

#### Molecule Data Structures

Extended [ItemLib.ts](file:///mnt/WoB/WOB/web_rep/refine/src/logic/ItemLib.ts#L3-L39) with axial coordinate types and molecule definitions:
- [Point2](file:///mnt/WoB/WOB/web_rep/refine/src/logic/ItemLib.ts#10-14): Axial hex coordinates (q, r)
- [MoleculeAtom](file:///mnt/WoB/WOB/web_rep/refine/src/logic/ItemLib.ts#15-20): Colored hex cell at axial position
- [MoleculeConnection](file:///mnt/WoB/WOB/web_rep/refine/src/logic/ItemLib.ts#21-25): Visual connection between atoms
- [Molecule](file:///mnt/WoB/WOB/web_rep/refine/src/logic/ItemLib.ts#26-30): Collection of atoms and connections
- [ItemDefinition](file:///mnt/WoB/WOB/web_rep/refine/src/logic/ItemLib.ts#31-40): Extended with optional `molecule` field

#### Test Molecules

Added 15 test molecules to [items.ts](file:///mnt/WoB/WOB/web_rep/refine/src/data/items.ts):

| Pattern | Items | Use Case |
|---------|-------|----------|
| 1-atom | `lucky_coin`, `light_bulb` | Simplest molecules |
| 2-atom lines | `rat_remains`, `flower_remains`, `padlock`, `window_latch` | Horizontal/vertical orientation testing |
| 3-atom shapes | `wrench`, `door_handle`, `iodine_bottle`, `old_cigarettes`, `bicycle_pedal` | L-shapes, triangles, V-shapes |
| 4-atom T-shape | `insulation_tape` | Complex branching |
| 4-atom line | `chain_link` | Long straight molecules |
| 7-atom ring | `mechanical_clock` | Signature detection testing (Stage 3) |
| 10-atom complex | `tea_brick` | Large irregular patterns |

#### HexMath.ts

Created [HexMath.ts](file:///mnt/WoB/WOB/web_rep/refine/src/logic/HexMath.ts) - axial coordinate utilities:
- **Vector operations**: [axialAdd](file:///mnt/WoB/WOB/web_rep/refine/src/logic/HexMath.ts#19-22), [axialSubtract](file:///mnt/WoB/WOB/web_rep/refine/src/logic/HexMath.ts#23-26), [axialScale](file:///mnt/WoB/WOB/web_rep/refine/src/logic/HexMath.ts#27-30), [axialEqual](file:///mnt/WoB/WOB/web_rep/refine/src/logic/HexMath.ts#31-34)
- **Neighbors**: [axialNeighbors](file:///mnt/WoB/WOB/web_rep/refine/src/logic/HexMath.ts#35-38), [axialNeighbor](file:///mnt/WoB/WOB/web_rep/refine/src/logic/HexMath.ts#39-43) (6 directions)
- **Distance**: [axialDistance](file:///mnt/WoB/WOB/web_rep/refine/src/logic/HexMath.ts#44-50) (Manhattan in hex space)
- **Rotations**: [axialRotateCW](file:///mnt/WoB/WOB/web_rep/refine/src/logic/HexMath.ts#51-65), [axialRotateCCW](file:///mnt/WoB/WOB/web_rep/refine/src/logic/HexMath.ts#66-69) (60° increments)
- **Reflections**: [axialReflectQ](file:///mnt/WoB/WOB/web_rep/refine/src/logic/HexMath.ts#70-73), [axialReflectR](file:///mnt/WoB/WOB/web_rep/refine/src/logic/HexMath.ts#74-77), [axialReflectDiag](file:///mnt/WoB/WOB/web_rep/refine/src/logic/HexMath.ts#78-81)
- **Pixel conversion**: [axialToPixel](file:///mnt/WoB/WOB/web_rep/refine/src/logic/HexMath.ts#82-87), [pixelToAxial](file:///mnt/WoB/WOB/web_rep/refine/src/logic/HexMath.ts#88-97) (with rounding)
- **Ranges**: [axialRing](file:///mnt/WoB/WOB/web_rep/refine/src/logic/HexMath.ts#122-137), [axialRange](file:///mnt/WoB/WOB/web_rep/refine/src/logic/HexMath.ts#138-151), [axialBounds](file:///mnt/WoB/WOB/web_rep/refine/src/logic/HexMath.ts#152-174)

All hex math isolated in this module (no ad-hoc calculations elsewhere).

#### DrawHex.ts

Created [DrawHex.ts](file:///mnt/WoB/WOB/web_rep/refine/src/logic/DrawHex.ts) - canvas rendering primitives:
- [drawHexagon](file:///mnt/WoB/WOB/web_rep/refine/src/logic/DrawHex.ts#17-58): Draw flat-top hexagon at pixel coordinates
- [drawHexAt](file:///mnt/WoB/WOB/web_rep/refine/src/logic/DrawHex.ts#59-69): Draw hexagon at axial coordinates
- [drawConnection](file:///mnt/WoB/WOB/web_rep/refine/src/logic/DrawHex.ts#70-89): Draw line between pixel points
- [drawGrid](file:///mnt/WoB/WOB/web_rep/refine/src/logic/DrawHex.ts#104-115): Draw multiple hexagons
- [drawHighlight](file:///mnt/WoB/WOB/web_rep/refine/src/logic/DrawHex.ts#116-131): Draw outline around hexagon
- [clearCanvas](file:///mnt/WoB/WOB/web_rep/refine/src/logic/DrawHex.ts#142-145), [clearRect](file:///mnt/WoB/WOB/web_rep/refine/src/logic/DrawHex.ts#132-141): Canvas clearing utilities
- [getEssenceColor](file:///mnt/WoB/WOB/web_rep/refine/src/logic/DrawHex.ts#146-155): Map essence names to colors (#ff4444 red, #4444ff blue, #44ff44 green, #ffdd44 yellow)

Pure presentation layer with no game logic.

---

### Stage 1: Core Logic

#### Molecule.ts

Created [Molecule.ts](file:///mnt/WoB/WOB/web_rep/refine/src/logic/Molecule.ts) with utility functions:
- [getMoleculeBounds](file:///mnt/WoB/WOB/web_rep/refine/src/logic/Molecule.ts#5-16): Calculate bounding box
- [getMoleculeEssences](file:///mnt/WoB/WOB/web_rep/refine/src/logic/Molecule.ts#17-26): Count atoms by color

Other transformation functions (rotate, translate) were deleted by user - functionality inlined where needed for simplicity.

#### Wafer.ts

Created [Wafer.ts](file:///mnt/WoB/WOB/web_rep/refine/src/logic/Wafer.ts) - hex grid state management:

**Data structures**:
- [WaferCell](file:///mnt/WoB/WOB/web_rep/refine/src/logic/Wafer.ts#5-14): Individual hex cell (enabled/disabled, occupied/empty, essence color)
- [PlacedItem](file:///mnt/WoB/WOB/web_rep/refine/src/logic/Wafer.ts#15-20): Molecule with placement position and rotation
- [Wafer](file:///mnt/WoB/WOB/web_rep/refine/src/logic/Wafer.ts#29-41): Complete grid state (Map of cells, placed items, cached totals)

**Core functions**:
- [createWafer(radius)](file:///mnt/WoB/WOB/web_rep/refine/src/logic/Wafer.ts#54-90): Initialize grid (default radius = 3)
- [canPlaceMolecule()](file:///mnt/WoB/WOB/web_rep/refine/src/logic/Wafer.ts#104-120): Validate placement (bounds check, collision check, enabled cells)
- [placeMolecule()](file:///mnt/WoB/WOB/web_rep/refine/src/logic/Wafer.ts#121-149): Add molecule to grid
- [removeMolecule()](file:///mnt/WoB/WOB/web_rep/refine/src/logic/Wafer.ts#150-168): Remove molecule by index
- [moveMolecule()](file:///mnt/WoB/WOB/web_rep/refine/src/logic/Wafer.ts#169-193): Reposition molecule with offset
- [getEnabledCells()](file:///mnt/WoB/WOB/web_rep/refine/src/logic/Wafer.ts#194-203): Get all active grid cells
- [enableCellWithFloodfill()](file:///mnt/WoB/WOB/web_rep/refine/src/logic/Wafer.ts#239-273): Grow grid (Stage 3 feature)

**Derived values** (auto-updated):
- Essence totals by color
- Empty cell count
- Enabled cell count

Grid is fixed-size centered at origin (±20 in each axis).

#### RefinePreview.ts

Created [RefinePreview.ts](file:///mnt/WoB/WOB/web_rep/refine/src/logic/RefinePreview.ts) - refining outcome calculations:

**[computeRefinePreviewChem(wafer)](file:///mnt/WoB/WOB/web_rep/refine/src/logic/RefinePreview.ts#24-58)** returns:
- Time: Fixed 4 hours
- Failure chance: 5% per empty cell (0-100%)
- Base yield: 100% (no recipe quality in chem system)
- Expected outputs: Using existing essence formulas
  - Red × 10 = Credits
  - Green × 1 = Temporal Flux
  - Blue × 10 = Chronotraces
- Signature bonuses: Stubbed to 0 (Stage 3 feature)

**[rollSuccess(failurePct)](file:///mnt/WoB/WOB/web_rep/refine/src/logic/RefinePreview.ts#75-78)**: Random success roll  
**[calculateOutputs(preview, succeeded)](file:///mnt/WoB/WOB/web_rep/refine/src/logic/RefinePreview.ts#60-73)**: Compute actual rewards

---

### Stage 2: UI Components & Event Integration

#### WaferView.vue

Created [WaferView.vue](file:///mnt/WoB/WOB/web_rep/refine/src/components/WaferView.vue) - 3-layer canvas renderer:

**Canvas Layers** (bottom to top):
1. `gridCanvas`: Static enabled cells (gray #1a1a1a fill, #444 border)
2. `moleculesCanvas`: Placed molecules (essence colors, black border)
3. `overlayCanvas`: Ghost molecule preview (green if valid, red if invalid)

**Rendering**:
- Hex size: 22px radius
- Canvas: 800×600px
- Origin: Center of canvas
- Uses [DrawHex.ts](file:///mnt/WoB/WOB/web_rep/refine/src/logic/DrawHex.ts) for all drawing

**Interaction**:
- Mousemove: Converts pixel → axial, emits `hover` event
- Click: Emits `click` event with axial coordinates
- Reactive rendering on wafer/ghost changes

#### Wafer.vue

Created [Wafer.vue](file:///mnt/WoB/WOB/web_rep/refine/src/components/Wafer.vue) - main orchestrator:

**Layout** (grid: 800px canvas + flexible preview):
- Left: `WaferView` component
- Right: Preview panel

**Preview Panel** shows:
- Essence totals (colored badges: 5R, 3G, 2B)
- Expected credits/chrono/flux with symbols (✦⧗∿)
- Failure chance % (green <25%, orange 25-50%, red >50%)
- Fixed time: 4 hours
- Placed items list (click to remove)
- "Start Refining" button (disabled if empty)

**Drag-Drop Logic**:
- Receives `draggingItem` prop from parent
- On hover: Creates ghost molecule at cursor position
  - Inline translation: atoms/connections offset by hover position
  - Validates placement → green/red highlight
- On click: Places molecule if valid
- Ghost clears after successful placement

**State**:
- Local wafer instance (created with [createWafer(3)](file:///mnt/WoB/WOB/web_rep/refine/src/logic/Wafer.ts#54-90))
- Ghost molecule/position/valid flags
- Computed preview via [computeRefinePreviewChem()](file:///mnt/WoB/WOB/web_rep/refine/src/logic/RefinePreview.ts#24-58)

#### Refine.vue Integration

Modified [Refine.vue](file:///mnt/WoB/WOB/web_rep/refine/src/components/Refine.vue) - **complete replacement**:

**Removed**:
- Recipe selection ([Recipes.vue](file:///mnt/WoB/WOB/web_rep/refine/src/components/Recipes.vue), [LoadRefinery.vue](file:///mnt/WoB/WOB/web_rep/refine/src/components/LoadRefinery.vue))
- Staged items tracking
- Essence completion checks
- Recipe ingredients logic

**New Implementation**:
- Left panel: [Wafer.vue](file:///mnt/WoB/WOB/web_rep/refine/src/components/Wafer.vue) component
- Right panel: [AllItems.vue](file:///mnt/WoB/WOB/web_rep/refine/src/components/AllItems.vue) (unchanged)
- [onPickItem](file:///mnt/WoB/WOB/web_rep/refine/src/components/Refine.vue#33-44): Loads item molecule from [items.ts](file:///mnt/WoB/WOB/web_rep/refine/src/data/items.ts), sets `draggingItem`
- [onRefineStart](file:///mnt/WoB/WOB/web_rep/refine/src/components/Refine.vue#46-48): Dispatches `CmdStartRefining` with wafer state

Grid layout: 2fr (Wafer) + 1fr (AllItems)

#### Event System Integration ✅

**GameState Changes** ([GameState.ts](file:///mnt/WoB/WOB/web_rep/refine/src/logic/GameState.ts)):
- Added `wafer: Wafer | null` field
- Removed legacy `loadedRecipe` and `recipeStartedAt` fields

**Command System** ([InputCommands.ts](file:///mnt/WoB/WOB/web_rep/refine/src/logic/input/InputCommands.ts)):
- Modified `CmdStartRefining` to accept `wafer: Wafer` instead of `recipeId` and `items`

**Input Handler** ([InputProcessor.ts](file:///mnt/WoB/WOB/web_rep/refine/src/logic/input/InputProcessor.ts)):
- `CmdStartRefining` handler:
  - Counts items from placed molecules
  - Consumes items from inventory based on molecule placements
  - Stores wafer in GameState
  - Schedules completion with fixed 4-hour duration

**Event Handler** ([EvtProcessor.ts](file:///mnt/WoB/WOB/web_rep/refine/src/logic/evt/EvtProcessor.ts)):
- `EvtRefineryDone` handler:
  - Uses `computeRefinePreviewChem()` for preview calculation
  - Uses `rollSuccess()` for success/failure roll
  - Uses `calculateOutputs()` for reward calculation
  - Clears wafer after completion

**UI State Sync** ([UIState.ts](file:///mnt/WoB/WOB/web_rep/refine/src/logic/UIState.ts)):
- Updated to check `game.wafer` instead of `game.loadedRecipe`
- Calculates progress when `EvtRefineryDone` is scheduled
- Uses chemistry preview functions for display

---

## File Changes

### New Files (7)

| File | Lines | Purpose |
|------|-------|---------|
| [src/logic/HexMath.ts](file:///mnt/WoB/WOB/web_rep/refine/src/logic/HexMath.ts) | 240 | Axial coordinate math |
| [src/logic/DrawHex.ts](file:///mnt/WoB/WOB/web_rep/refine/src/logic/DrawHex.ts) | 156 | Canvas hex rendering |
| [src/logic/Molecule.ts](file:///mnt/WoB/WOB/web_rep/refine/src/logic/Molecule.ts) | 25 | Molecule utilities |
| [src/logic/Wafer.ts](file:///mnt/WoB/WOB/web_rep/refine/src/logic/Wafer.ts) | 273 | Grid state management |
| [src/logic/RefinePreview.ts](file:///mnt/WoB/WOB/web_rep/refine/src/logic/RefinePreview.ts) | 79 | Outcome calculations |
| [src/components/WaferView.vue](file:///mnt/WoB/WOB/web_rep/refine/src/components/WaferView.vue) | 169 | Hex grid canvas |
| [src/components/Wafer.vue](file:///mnt/WoB/WOB/web_rep/refine/src/components/Wafer.vue) | 307 | Main UI orchestrator |

### Modified Files (7)

| File | Changes |
|------|---------|
| [src/logic/ItemLib.ts](file:///mnt/WoB/WOB/web_rep/refine/src/logic/ItemLib.ts) | Added molecule types (Point2, MoleculeAtom, etc), extended ItemDefinition |
| [src/data/items.ts](file:///mnt/WoB/WOB/web_rep/refine/src/data/items.ts) | Added molecule field to 15 items |
| [src/components/Refine.vue](file:///mnt/WoB/WOB/web_rep/refine/src/components/Refine.vue) | Complete rewrite for chem system, added command dispatch |
| [src/logic/GameState.ts](file:///mnt/WoB/WOB/web_rep/refine/src/logic/GameState.ts) | Added wafer field, removed legacy recipe fields |
| [src/logic/input/InputCommands.ts](file:///mnt/WoB/WOB/web_rep/refine/src/logic/input/InputCommands.ts) | Modified CmdStartRefining to accept Wafer |
| [src/logic/input/InputProcessor.ts](file:///mnt/WoB/WOB/web_rep/refine/src/logic/input/InputProcessor.ts) | Updated handler to process wafer and consume items |
| [src/logic/evt/EvtProcessor.ts](file:///mnt/WoB/WOB/web_rep/refine/src/logic/evt/EvtProcessor.ts) | Updated to use chemistry calculations |
| [src/logic/UIState.ts](file:///mnt/WoB/WOB/web_rep/refine/src/logic/UIState.ts) | Updated to sync wafer state instead of recipe |

---

## Build Verification

✅ **TypeScript compilation successful**

```bash
npm run build
# ✓ 141 modules transformed
# ✓ built in 1.43s
```

All imports resolved, no typing errors, event system fully integrated.

---

## Manual Testing Checklist

Once dev server is running (`npm run dev`):

- [ ] Navigate to Refine tab
- [ ] Verify hex grid renders with enabled cells
- [ ] Pick item from AllItems (only items with molecules work)
- [ ] Verify ghost molecule follows cursor
- [ ] Verify ghost turns red over invalid positions
- [ ] Verify ghost turns green over valid positions
- [ ] Click to place molecule
- [ ] Verify essence totals update
- [ ] Verify expected outputs show correct values
- [ ] Click placed item to remove
- [ ] Place multiple molecules
- [ ] Click "Start Refining" button
- [ ] Verify time advances and event fires
- [ ] Verify refining completes and grants resources
- [ ] Verify wafer is cleared after completion
- [ ] Verify outcome modal displays

---

## Stage 3 Features (Deferred)

Not implemented yet:
- Signature detection and bonuses
- Wafer growth (expand grid)
- Blueprints (save/load layouts)

---

## Technical Notes

**Design Decisions**:
- Axial coordinates chosen over offset (cleaner rotation math)
- Inline translation logic instead of helper functions (user preference)
- Function comments removed for cleaner code (user preference)
- Fixed 4-hour time (no recipe-based variation)
- 5% failure per empty cell (simple linear scaling)
- Event system uses wafer directly (no intermediate serialization)

**Performance**:
- Grid canvas cached (only redraws on cell enable/disable)
- Molecules canvas redraws on placement changes
- Overlay canvas redraws on every mouse move (ghost molecule)
- No performance issues expected with current grid size (±20 radius)

**Code Quality**:
- No ESLint errors
- TypeScript strict mode passing
- All imports resolved
- Hex math isolated in single module
- Pure functions where possible (Molecule, HexMath, DrawHex)
- Mutable state clearly marked (Wafer, GameState)

**Event Flow**:
1. User clicks "Start Refining" → `CmdStartRefining` dispatched
2. InputProcessor consumes items, stores wafer, schedules `EvtRefineryDone`
3. Time advances via game loop
4. `EvtRefineryDone` fires → calculates success, grants rewards, clears wafer
5. UI shows outcome modal
