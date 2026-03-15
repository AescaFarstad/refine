import { copy, type Point2 } from './core/math';
import type { Reward } from './Reward';
import type { DiscoveryId } from './DiscoveryLib';
import type { MazeResourceSpawn } from './GameState';

export type ResearchNodeType = 'obstacle' | 'empty' | 'stat' | 'gear' | 'resource' | 'discovery' | 'refining' | 'void';

export type ResearchArchetypeIcon =
  | { kind: 'none' }
  | { kind: 'glyph'; glyph: string; scale?: number; offset?: Point2 }
  | { kind: 'itemImage'; key: string; scale?: number; offset?: Point2 };

export interface ResearchObstacleVisualInput {
  direction?: number;
  highlightCells?: number;
}

export interface ResearchObstacleVisualDef {
  direction: number;
  highlightCells: number;
}

export interface ResearchArchetypeDef {
  type: ResearchNodeType;
  title?: string;
  description?: string;
  ownedTitle?: string;
  ownedDescription?: string;
  revealingDiscovery?: DiscoveryId;
  revealedTitle?: string;
  revealedDescription?: string;
  icon?: ResearchArchetypeIcon;
  ownedIcon?: ResearchArchetypeIcon;
  revealedIcon?: ResearchArchetypeIcon;
  obstacleVisual?: ResearchObstacleVisualInput;
  rewards: Reward[];
  spawnResource?: MazeResourceSpawn['resourceKey'];
  autocenter?: boolean;
}

export interface ResearchPlacementInput {
  archetypeId: string;
  cells: Point2 | Point2[];
  oracleSlot?: boolean;
  /**
   * Optional hex radius around the provided cell(s).
   * When specified, the final node cells are generated as the union
   * of all hexes within this radius around each provided center cell.
   * If radius is 0 or negative, the placement falls back to the raw cells.
   */
  radius?: number;
  /**
   * Optional central cell for icon/glyph placement.
   * If not specified, the center is computed automatically.
   */
  centerCell?: Point2;
  initiallyOwned?: boolean;
}

export interface ResearchArchetype {
  id: string;
  type: ResearchNodeType;
  title: string;
  description: string;
  ownedTitle: string;
  ownedDescription: string;
  revealingDiscovery: DiscoveryId | '';
  revealedTitle: string;
  revealedDescription: string;
  icon: ResearchArchetypeIcon;
  ownedIcon: ResearchArchetypeIcon | null;
  revealedIcon: ResearchArchetypeIcon;
  obstacleVisual: ResearchObstacleVisualDef;
  rewards: Reward[];
  spawnResource: MazeResourceSpawn['resourceKey'] | null;
  autocenter: boolean;
}

export function isResearchArchetypeRevealedByDiscovery(
  archetype: { readonly revealingDiscovery: DiscoveryId | '' },
  discoveries: Readonly<Record<string, true>>,
): boolean {
  return archetype.revealingDiscovery !== '' && discoveries[archetype.revealingDiscovery] === true;
}


export interface ResearchNodeInstance {
  nodeId: number;
  archetypeId: string;
  cells: Point2[];
  oracleSlot: boolean;
  centerCell?: Point2;
  initiallyOwned: boolean;
}

function generateRadiusCells(centers: Point2[], radius: number): Point2[] {
  const result: Point2[] = [];
  const seen = new Set<string>();

  const r = Math.floor(radius);
  if (r <= 0 || !Number.isFinite(r)) {
    for (const c of centers) {
      const key = `${c.x},${c.y}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({ x: c.x, y: c.y });
      }
    }
    return result;
  }

  for (const center of centers) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        const dz = -dx - dy;
        const dist = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
        if (dist > r) continue;

        const x = center.x + dx;
        const y = center.y + dy;
        const key = `${x},${y}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push({ x, y });
        }
      }
    }
  }

  return result;
}

export class ResearchLib {
  public archetypes: Map<string, ResearchArchetype> = new Map();
  public nodes: Map<number, ResearchNodeInstance> = new Map();

  constructor() { }

  public load(
    archetypes: Record<string, ResearchArchetypeDef>,
    placements: ResearchPlacementInput[],
    emptyCells: Point2[] = [],
    voidCells: Point2[] = [],
    gearMap?: Map<string, any>,
  ) {
    this.archetypes.clear();
    this.nodes.clear();

    // Load Archetypes (manual definitions)
    for (const id in archetypes) {
      const input = archetypes[id];
      const obstacleVisualInput = input.obstacleVisual ?? {};
      const obstacleVisual: ResearchObstacleVisualDef = {
        direction: ((Math.trunc(obstacleVisualInput.direction ?? 0) % 6) + 6) % 6,
        highlightCells: Math.max(0, Math.trunc(obstacleVisualInput.highlightCells ?? 0)),
      };
      const arch: ResearchArchetype = {
        id,
        type: input.type,
        title: input.title ?? '',
        description: input.description ?? '',
        ownedTitle: input.ownedTitle ?? '',
        ownedDescription: input.ownedDescription ?? '',
        revealingDiscovery: input.revealingDiscovery ?? '',
        revealedTitle: input.revealedTitle ?? '',
        revealedDescription: input.revealedDescription ?? '',
        icon: input.icon ?? { kind: 'none' },
        ownedIcon: input.ownedIcon ?? null,
        revealedIcon: input.revealedIcon ?? { kind: 'none' },
        obstacleVisual,
        rewards: input.rewards,
        spawnResource: input.spawnResource ?? null,
        autocenter: input.autocenter ?? false,
      };
      this.archetypes.set(arch.id, arch);
    }

    // Auto-generate gear archetypes from gear library
    if (gearMap) {
      for (const [gearId, gearDef] of gearMap.entries()) {
        const archetypeId = `gear_${gearId}`;
        // Only add if not already manually defined
        if (!this.archetypes.has(archetypeId)) {
          const arch: ResearchArchetype = {
            id: archetypeId,
            type: 'gear',
            title: '',
            description: '',
            ownedTitle: '',
            ownedDescription: '',
            revealingDiscovery: '',
            revealedTitle: '',
            revealedDescription: '',
            icon: { kind: 'none' },
            ownedIcon: null,
            revealedIcon: { kind: 'none' },
            obstacleVisual: { direction: 0, highlightCells: 0 },
            rewards: [{ kind: 'unlock_gear', gearId: gearId }],
            spawnResource: null,
            autocenter: false,
          };
          this.archetypes.set(arch.id, arch);
        }
      }
    }

    // Load Placements
    let nodeIndex = 0;

    placements.forEach((input) => {
      const baseCells = Array.isArray(input.cells) ? input.cells : [input.cells];
      const hasRadius = typeof input.radius === 'number';
      const cells = hasRadius
        ? generateRadiusCells(baseCells, input.radius ?? 0)
        : baseCells;
      const archetype = archetypes[input.archetypeId];
      let centerCell: Point2 | undefined = input.centerCell
        ? copy(input.centerCell)
        : hasRadius
          ? copy(baseCells[0]!)
          : undefined;
      if (!centerCell && archetype?.autocenter && cells.length > 0) {
        let sx = 0, sy = 0;
        for (const c of cells) { sx += c.x; sy += c.y; }
        centerCell = { x: Math.round(sx / cells.length), y: Math.round(sy / cells.length) };
      }
      const instance: ResearchNodeInstance = {
        nodeId: nodeIndex++,
        archetypeId: input.archetypeId,
        cells: cells,
        oracleSlot: input.oracleSlot ?? false,
        centerCell,
        initiallyOwned: input.initiallyOwned ?? false,
      };

      if (!this.archetypes.has(instance.archetypeId)) {
        console.error(`Research placement refers to unknown archetype: ${instance.archetypeId}`);
      }

      this.nodes.set(instance.nodeId, instance);
    });

    const addSingleCellNodes = (points: Point2[], archetypeId: string) => {
      for (const p of points) {
        const instance: ResearchNodeInstance = {
          nodeId: nodeIndex++,
          archetypeId,
          cells: [{ x: p.x, y: p.y }],
          oracleSlot: false,
          initiallyOwned: false,
        };

        if (!this.archetypes.has(instance.archetypeId)) {
          console.error(`Research placement refers to unknown archetype: ${instance.archetypeId}`);
        }

        this.nodes.set(instance.nodeId, instance);
      }
    };

    if (emptyCells.length > 0) {
      addSingleCellNodes(emptyCells, 'empty');
    }
    if (voidCells.length > 0) {
      addSingleCellNodes(voidCells, 'void');
    }
  }


}
