import type { Molecule, Point2 } from './ItemLib';
import { axialBounds, axialToPixel, pixelToAxialFloat, axialRotateCW, axialRound, axialAdd, axialSubtract } from './HexMath';


export function getMoleculeBounds(molecule: Molecule): { min: Point2; max: Point2; width: number; height: number } {
  const points: Point2[] = molecule.atoms.map(a => ({ x: a.x, y: a.y }));
  const { min, max } = axialBounds(points);

  return {
    min,
    max,
    width: max.x - min.x + 1,
    height: max.y - min.y + 1,
  };
}

export function getMoleculeEssences(molecule: Molecule): Record<string, number> {
  const essences: Record<string, number> = {};

  for (const atom of molecule.atoms) {
    essences[atom.color] = (essences[atom.color] || 0) + 1;
  }

  return essences;
}

export function getMoleculeCentroid(molecule: Molecule): Point2 {
  if (molecule.atoms.length === 0) return { x: 0, y: 0 };
  let sumX = 0;
  let sumY = 0;
  for (const atom of molecule.atoms) {
    sumX += atom.x;
    sumY += atom.y;
  }
  return { x: sumX / molecule.atoms.length, y: sumY / molecule.atoms.length };
}

export function getPivotHex(molecule: Molecule): Point2 {
  return axialRound(getMoleculeCentroid(molecule));
}

// Geometry helpers for snapping/translation (no DOM/canvas side-effects)

export function translateMolecule(molecule: Molecule, offset: Point2): Molecule {
  return {
    atoms: molecule.atoms.map(a => ({ ...a, x: a.x + offset.x, y: a.y + offset.y })),
    connections: molecule.connections.map(c => ({
      from: { x: c.from.x + offset.x, y: c.from.y + offset.y },
      to: { x: c.to.x + offset.x, y: c.to.y + offset.y },
    })),
  };
}

export function rotateMoleculeAroundPivot(molecule: Molecule, steps: number, pivot: Point2): Molecule {
  if (steps === 0) return molecule;

  // To rotate around pivot: translate by -pivot, rotate, translate by +pivot
  const negPivot = { x: -pivot.x, y: -pivot.y };

  return {
    atoms: molecule.atoms.map(a => {
      // Translate to origin relative to pivot
      const rel = axialAdd({ x: a.x, y: a.y }, negPivot);
      // Rotate
      const rot = axialRotateCW(rel, steps);
      // Translate back
      const final = axialAdd(rot, pivot);
      return { ...a, x: final.x, y: final.y };
    }),
    connections: molecule.connections.map(c => {
      const fromRel = axialAdd(c.from, negPivot);
      const toRel = axialAdd(c.to, negPivot);
      const fromRot = axialRotateCW(fromRel, steps);
      const toRot = axialRotateCW(toRel, steps);
      return {
        from: axialAdd(fromRot, pivot),
        to: axialAdd(toRot, pivot),
      };
    }),
  };
}

export function rotateMolecule(molecule: Molecule, steps: number): Molecule {
  const pivot = getPivotHex(molecule);
  return rotateMoleculeAroundPivot(molecule, steps, pivot);
}

export function getAtomCenterBBoxPx(
  molecule: Molecule,
  hexSize: number,
  origin: Point2
): { minX: number; minY: number; maxX: number; maxY: number; centerPx: { x: number; y: number } } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const a of molecule.atoms) {
    const p = axialToPixel({ x: a.x, y: a.y }, hexSize, origin);
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const centerPx = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  return { minX, minY, maxX, maxY, centerPx };
}

export function getCenterAxial(
  molecule: Molecule,
  hexSize: number,
  origin: Point2
): Point2 {
  const { centerPx } = getAtomCenterBBoxPx(molecule, hexSize, origin);
  return pixelToAxialFloat(centerPx, hexSize, origin);
}

export function bestIntegerOffsetToHex(
  molecule: Molecule,
  hoverAx: Point2,
  hexSize: number,
  origin: Point2
): Point2 {
  const centerAxFloat = getCenterAxial(molecule, hexSize, origin);
  const targetCenterPx = axialToPixel(hoverAx, hexSize, origin);

  const dx = hoverAx.x - centerAxFloat.x;
  const dy = hoverAx.y - centerAxFloat.y;
  const base = { x: Math.round(dx), y: Math.round(dy) } as Point2;
  const candidates: Point2[] = [
    base,
    { x: base.x + 1, y: base.y },
    { x: base.x - 1, y: base.y },
    { x: base.x, y: base.y + 1 },
    { x: base.x, y: base.y - 1 },
    { x: base.x + 1, y: base.y - 1 },
    { x: base.x - 1, y: base.y + 1 },
  ];
  let best = base;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const cand of candidates) {
    const cenAx = { x: centerAxFloat.x + cand.x, y: centerAxFloat.y + cand.y } as Point2;
    const cenPx = axialToPixel(cenAx, hexSize, origin);
    const dxp = cenPx.x - targetCenterPx.x;
    const dyp = cenPx.y - targetCenterPx.y;
    const d2 = dxp * dxp + dyp * dyp;
    if (d2 < bestDist) { bestDist = d2; best = cand; }
  }
  return best;
}

export function translateForSnap(
  molecule: Molecule,
  hoverAx: Point2,
  hexSize: number,
  origin: Point2
): { translated: Molecule; offset: Point2 } {
  // Align the molecule's pivot (rounded centroid) to the hovered hex
  const pivot = getPivotHex(molecule);
  const offset = axialSubtract(hoverAx, pivot);
  return { translated: translateMolecule(molecule, offset), offset };
}
