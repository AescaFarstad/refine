import type { Point2 } from './core/math';
import type { Reward } from './Reward';
import type { DiscoveryId } from './DiscoveryLib';

export type ResearchNodeType = 'obstacle' | 'empty' | 'stat' | 'gear' | 'resource' | 'discovery' | 'void';

export type ResearchArchetypeIcon =
  | { kind: 'none' }
  | { kind: 'glyph'; glyph: string; scale?: number; offset?: Point2 }
  | { kind: 'itemImage'; key: string; scale?: number; offset?: Point2 };

export interface ResearchArchetypeDef {
  type: ResearchNodeType;
  covert?: boolean;
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
  rewards: Reward[];
}

export interface ResearchPlacementInput {
  archetypeId: string;
  cells: Point2 | Point2[];
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
  covert: boolean;
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
  rewards: Reward[];
}

export function isResearchArchetypeRevealedByDiscovery(
  archetype: ResearchArchetype,
  discoveries: Readonly<Record<string, true>>,
): boolean {
  return archetype.revealingDiscovery !== '' && discoveries[archetype.revealingDiscovery] === true;
}


export interface ResearchNodeInstance {
  nodeId: number;
  archetypeId: string;
  cells: Point2[];
  centerCell: Point2 | null;
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
      const arch: ResearchArchetype = {
        id,
        type: input.type,
        covert: input.covert ?? false,
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
        rewards: input.rewards,
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
            covert: false,
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
            rewards: [{ kind: 'unlock_gear', gearId: gearId }],
          };
          this.archetypes.set(arch.id, arch);
        }
      }
    }

    // Load Placements
    let nodeIndex = 0;

    placements.forEach((input) => {
      const baseCells = Array.isArray(input.cells) ? input.cells : [input.cells];
      const cells = typeof input.radius === 'number'
        ? generateRadiusCells(baseCells, input.radius)
        : baseCells;
      const instance: ResearchNodeInstance = {
        nodeId: nodeIndex++,
        archetypeId: input.archetypeId,
        cells: cells,
        centerCell: input.centerCell ?? null,
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
          centerCell: null,
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
