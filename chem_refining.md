The new way to refine items into resources.
The old one using recipes is scrapped.

Each item has a chemical structure so to say. This is a hexagonal 2d pattern of essences (essences playing the role of atoms in a molecule) called "molecule".
The molecules are pre-determined in game data. They store the 2d arrangement as well as the connections (purely visual) between the "atoms".
The player will drag "molecules" onto a hex grid of the refining machine (called wafer) trying to fill all space and create higher level patterns (called signatures) like a 'hex ring' of 'line of 4' of the same color.
Signatures will grant additional yield/speed bonuses.
The player will be able to increase the size of the wafer for chronotraces.
Molecules can be rotated by dragging the item over rotator areas.
Molecules can't overlap in the wafer.
Molecules must be placed entirely inside the wafer.

Unfilled space increases failure chance.

Last used arrangements (called blueprint) on the wafer will be saved and if the player has fitting items - they will be suggested for player to auto-arrange.


Rules for molecules (not enforced, since molecules are defined statically at compile time in manual way)
Each essence has valency (red = 2, blue = 3, green = 1)
If two atoms are next to each other they must be connected
When multiple options are available, atoms try to distance themselves from each other
If distancing is ambiguos - molecule can't exist
It is assumed that library does not contain several molecules of identical structure (rotation wise)
But a mirrored molecule is considered different. (as long as it doesn't have mirror symmetry)

Hex grid is represented as 2d plane. Basis vectors are right and left+up.


Molecule data:
atoms: {color : string, {x, y} : Point2}
connections {from {x, y} : Point2, to {x, y} : Point2}

Wafer is represented as a 2d array. Origin is at 20 (global constant value). length is constant - 2x the origin.
Elements are cells which contain information about what's placed there.
WaferCell:
{x, y} : Point2
enabled : bool
itemIdx // index in the wafer flat array
essence : string
canBeUpgraded : bool //cached info. cell can be upgraded if it's not enabled and has at least two enabled neighbors
signatures : number[] //indexes of the signature they participate in (indexes array in wafer)

Wafer also contains a flat list of all items (each as a single string, multiple similar strings if added multiple times) added to it.
Also a flat list of connections (for display).

Wafer also contains derived values like
total number of each essence
failure chance
signatures
{
  cells:Point2[]
  yieldBonus:number
  speedBonus:number
  name:string
  color:string
}


Wafer is stored in gameState.

Features:
molecules can be rotated
When placed, they can be moved or removed
hovering over it highlights the entire molecule
clicking on an item in the flat list removes it from wafer

Signature handling:
when a molecule is placed/removed the list of signature is recalculated

Signature.ts is a module handling this.

SignatureLib contains possible signatures
They are enumerated in signatures.ts
Signature lib items looks like this:
{
  name:string
  cells:Point2[] //relative distances. first item is always 0,0, may be omited in signatures.ts, added when parsing
  yieldBonus:number
  speedBonus:number
  supersedes:string[] //id of sub-signature
  rank:number //omited, calculated when parsed, unique, defines which signatures to search first. Equals to the sum of suuperseded signature ranks + 1
}
Fields are not optional, but items in signatures.ts may omit yield or speed (0 assumed)

Signature must be comprised of one color entirely.
So algo tries to apply each of the signatures to each of the cells of wafer in 12 ways (roations + reflections).
It uses the first cell's color as base.
It starts from the highest rank signatures.

Signature may succeed only once for a given color. If found, it's not checked any more, nor are any superseded signatures. (i.e. if we found a line of 5, we shouldn't search for line of 4)


Common components:
DrawMolecule.ts - module with functions which takes canvases and calls draw functions to create required image.
MoleculeImg - represents canvas with a molecule drawn at a given scale and given rotation
WaferImg - the canvas with molecules placed (they are drawn to it
waferView.vue the root component for wafer holding canvases with multiple levels (i.e base molecules, temporaty highlights, buttons for growing the wafer etc)
wafer.vue - even more root component, holds WaferView and flat lists and info about predicted results of refining etc

MoleculeImg is used for displaying blueprints as well.


When the player clicks Refine the rest of the game continues as before. Instead of recipe yields, times is awlays 4 hours, failure chance is based on essences and empty cells (each empty adds 5% failure chance). The output is based on essences used (red = credits, green = time flux, blue = chronotraces) some other essences may increase yield/speed/success. To be added later.


Wafer growth:
Cells that can be upgraded display + sign. Hovering over it draws which cells will be added. Clicking adds the cells. This costs (100 * number of upgrades purchased) chronotraces.
Which cells are added: the one clicked + floodfill of all possible neighboring cells eligible for upgrade. The price does not depend on the number of cells.

Can't exceed wafer array size.


Blueprints:
When player clicks refine the layout is saved as a blueprint. Last 100 blueprints are kept.
Blueprint lists items used and their coordinates + rotations.
it has a flag for "available" - it is calculated each time player items change (refined or received from raid).
available blueprints are displayed in UI. Clicking them fills the wafer with corresponding items.


When player starts dragging an item - its molecule is displayed.


Implementation Plan (Single Cutover)

- No fallbacks or dual modes. The legacy recipe system is replaced entirely by the chem system. During development the refine tab does not need to be operational at all times.
- Logging policy: only log errors and abnormal behavior. No routine debug/info logging in production code.

Stages
- Stage 0 — Foundations
  - Add HexMath.ts: hex coordinate system utilities (axial basis: right and left+up), 60° rotations/reflections, neighbor/ distance, point ↔ axial mapping, axial ↔ screen mapping, hex rounding, layout helpers.
  - Add DrawHex.ts: common hex drawing primitives (grid cells, cell highlights, connections/edges, compositing molecule canvases into cells). DrawHex is presentation-only (no game logic).
  - Data normalization rule: no optional properties in lib items at runtime. Raw data may omit fields, but parsing/normalization in Lib fills defaults so all runtime types are fully populated.

- Stage 1 — Core Chem Types
  - Molecule.ts: atoms (color, axial x,y), connections (visual only), immutable rotation/reflection helpers, bounds.
  - Wafer.ts: fixed-size hex grid, place/move/remove/rotate molecules, collision and bounds checks, enabled cells, cached totals by essence, empty-cell count. No wafer growth yet.
  - Preview.ts: compute expected outputs from wafer state. Time = fixed 4h. Failure chance = emptyCells * 5% (clamped to 0..100). Yield% baseline = 100%. Signatures are deferred.

- Stage 2 — UI Minimal Loop
  - Wafer.vue (new):
    - WaferView with canvas layers of WaferImg using DrawHex.ts for grid, placed molecules, hover/selection.
    - Shows preview (credits/chrono/flux, failure%, time).
  - Start Refining: dispatch command to schedule 4h batch. Inventory gets reduced at this moment based on placed molecules.
  - Completion: success roll = 100% - failure%. On success, grant outputs; then clear wafer.

- Stage 3 — Quality of Life (deferred features)
  - Signatures: add SignatureLib + scanning in 12 symmetries, supersede rules, single success per color. Feed yield/speed bonuses into Preview.
  - Wafer growth: upgradeable cells (+ button, floodfill visualization), pricing and limits.
  - Blueprints: save last 100 layouts; mark availability based on inventory; one-click apply.

Rules and Constraints
- Hex math extraction: all hex coordinate transforms and rotations live in HexMath.ts. No ad-hoc hex math in UI or logic modules.
- Item placement does not consume items until Refine is clicked. Removal/move operations are free and reversible before refining starts.
- No auto-place: there is no automatic placement on click; interaction is via drag (and rotators for orientation).
- Drawing separation: DrawHex.ts is purely for rendering hex primitives, connections, and copying molecule images into cells; it contains no domain logic.
- Data normalization: lib parsing fills defaults so runtime objects have no optional properties (raw data may omit fields; parsing supplies them).

Replacement Scope
- The current refining logic and recipes are removed and replaced by wafer/molecule refining. There should be no temporary fallbacks or compatibility layers.


View Structure (Detailed)

- Wafer.vue (replaces LoadRefinery.vue)
  - Replaces recipe UI entirely; owns layout and top-level state (idle/placing/running).
  - Left: waferView.vue (canvas stack). Right: InventoryPanel + PreviewPanel (+ optional PlacedList).
  - While refining runs: disables placement/move/remove and shows progress/remaining time overlay.
  - Shows essence totals from wafer, expected credits/chrono/flux, yield% (100% now), failure% (empties × 5%), time (4h fixed).
  - Start Refining button; disabled if wafer invalid/empty or already running.
  - Compact list of placed items not grouped; click selects placed item.


- WaferView.vue (canvas stack orchestrator)
  - Canvases: gridCanvas (static cells), moleculesCanvas (placed molecules), overlayCanvas (ghost/hover/selection). Optional DOM uiOverlay for rotator zones and growth buttons (later).
  - Uses HexMath.ts for axial math and hit testing; DrawHex.ts for grid primitives and compositing molecule images.

- DrawMolecule.ts (image helpers)
  - Builds MoleculeImg canvases at scale × rotation from atoms/connections.

- Interaction specifics
  - Drag-from-inventory to wafer: ghost follows cursor; invalid placement shows red ghost and drop is rejected.
  - Rotate: rotator wedges (uiOverlay) rotate on hover while dragging.
  - Move: drag to reposition; Click to remove.

- States & visuals
  - Idle: hover cell highlight; grid visible.
  - Ghost: red border when invalid.
  - Selected: outline/halo for footprint.

- Performance and caching
  - grid is static, molecules are on separate convas, redrawn fully on change. Highlights on separate canvaces (below and on top for different highlights)
  - MoleculeImg drawn once. The canvas is rotated when the molecule is rotated.

- Data flow and inventory consumption
  - GameState holds wafer state.
  - On EvtRefineryDone, grant outputs, clear wafer, show outcome.
