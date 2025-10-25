import type { Point2 } from './core/math';

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
}
