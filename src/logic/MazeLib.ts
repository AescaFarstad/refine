import type { Point2 } from './core/math';
import type { Reward } from './Reward';

export type ArtefactName = 'BOMB' | 'EYE' | 'FREEZE';

export interface MazeDefinition {
  id: string;
  name: string;
  x: number; y: number;
  // Generator inputs
  keyNum: number;           // 1..12
  minReachable: number;     // minimum reachable cells from best corner
  optimumScore: number;     // desired optimal total moves
  // If true, use provided spawn/keys/fill exactly and skip generation
  useFixedLayout?: boolean;
  // Enemy/artefact settings
  spawnProbability?: number;
  maxDemons?: number;
  artefacts?: Array<{ type: ArtefactName; x: number; y: number }>;
  // Generator output (authoritative layout used for play)
  // When provided in data, these override generated values.
  // If `useFixedLayout` is true, these must be complete and are used as-is.
  spawn?: Point2;
  keys?: Array<Point2>;
  fill?: Array<Point2>;
  // Optional text
  description?: string;
  reward: Reward[];
}

export type RawMazeDefinition = Omit<MazeDefinition, 'id'>;

export function parseMazeDefinitions(raw: Record<string, RawMazeDefinition>): Map<string, MazeDefinition> {
  const map = new Map<string, MazeDefinition>();
  for (const key in raw) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    map.set(key, { ...raw[key], id: key });
  }
  return map;
}

export function buildOrderedMazeLevels(map: Map<string, MazeDefinition>): MazeDefinition[] {
  const arr: Array<{ idx: number; id: string; def: MazeDefinition }> = [];
  map.forEach((def, id) => {
    const m = /^l(\d+)_/.exec(id);
    const idx = m ? parseInt(m[1] || '0', 10) : Number.POSITIVE_INFINITY;
    arr.push({ idx: isNaN(idx) ? Number.POSITIVE_INFINITY : idx, id, def });
  });
  arr.sort((a, b) => (a.idx === b.idx ? (a.id < b.id ? -1 : 1) : a.idx - b.idx));
  return arr.map(o => o.def);
}
