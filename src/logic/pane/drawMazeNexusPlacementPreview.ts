import atlasStorage from '../AtlasStorage';
import { axialToPixel } from '../HexMath';
import type { Point2 } from '../ItemLib';
import { axialToIndex } from '../Research';
import {
  getMazeNexusItemPlacementCells,
  getMazeNexusLimitBlockingDisks,
  getMazeNexusPlacementAffectedSpawnIndexes,
  getMazeNexusPlacementCentroidUnit,
  getMazeNexusItemPlacementRotationStep,
} from '../Maze';
import { MAZE_RESOURCE_SPECS } from '../MazeResourceVisuals';
import type { ReadonlyGameState } from '../UIState';
import { computeHexBoundary } from '../hexBoundary';
import {
  NEXUS_ATLAS_TILE_PADDING,
  NEXUS_ATLAS_TILE_SIZE,
} from '../NexusPreviewCanvas';
import { traceSmoothHexBoundary } from '../drawSmoothBoundary';

const ANTIVOID_PANEL_ID = 'antivoid_panel';
const UNIT_ORIGIN: Point2 = { x: 0, y: 0 };
const ANTIVOID_PREVIEW_SMOOTHNESS = 1.15;
const ANTIVOID_PREVIEW_CONCAVE_BLEND = 0.85;
const ANTIVOID_PREVIEW_CONCAVE_BLEND_NU = 0.35;

export interface MazeNexusPlacementPreviewRenderOptions {
  gs: ReadonlyGameState;
  nexusItemId: string;
  anchor: Point2;
  valid: boolean;
  origin: Point2;
  hexSize: number;
}

function getNexusPreviewDrawSize(
  gs: ReadonlyGameState,
  nexusItemId: string,
  hexSize: number,
): { w: number; h: number } {
  const def = gs.lib.nexusItems.get(nexusItemId)!;
  const loops = computeHexBoundary(def.placableInstanceDescription.cells).map(loop => loop.points);
  if (loops.length === 0) {
    const fallbackScale = Math.max(
      def.placableInstanceDescription.glyphScale,
      def.placableInstanceDescription.imageScale,
    );
    const fallback = hexSize * 1.2 * fallbackScale;
    return { w: fallback, h: fallback };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const loop of loops) {
    for (const p of loop) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }

  const rawW = maxX - minX;
  const rawH = maxY - minY;
  const available = NEXUS_ATLAS_TILE_SIZE - NEXUS_ATLAS_TILE_PADDING * 2;
  const previewHexSize = Math.min(available / (rawW || 1), available / (rawH || 1));
  const scale = hexSize / previewHexSize;
  return { w: NEXUS_ATLAS_TILE_SIZE * scale, h: NEXUS_ATLAS_TILE_SIZE * scale };
}

function getAntiVoidAffectedCells(
  gs: ReadonlyGameState,
  anchor: Point2,
  placementCells: readonly Point2[],
  effectRadius: number,
): Point2[] {
  if (effectRadius <= 0) return [];

  const centroid = getMazeNexusPlacementCentroidUnit(placementCells);
  const radiusPx = effectRadius * Math.sqrt(3);
  const radiusPxSq = radiusPx * radiusPx;
  const hexRadius = Math.max(0, Math.ceil(effectRadius) + 1);

  const affectedCells: Point2[] = [];
  let hasOwnedNearby = false;

  for (let dx = -hexRadius; dx <= hexRadius; dx++) {
    const minDy = Math.max(-hexRadius, -dx - hexRadius);
    const maxDy = Math.min(hexRadius, -dx + hexRadius);
    for (let dy = minDy; dy <= maxDy; dy++) {
      const axial = { x: anchor.x + dx, y: anchor.y + dy };
      const idx = axialToIndex(axial.x, axial.y);
      if (idx === -1) continue;

      const cell = gs.researchCells[idx]!;
      if (cell.owned) {
        hasOwnedNearby = true;
      }

      const pixel = axialToPixel(axial, 1, UNIT_ORIGIN);
      const px = pixel.x - centroid.x;
      const py = pixel.y - centroid.y;
      if (px * px + py * py > radiusPxSq) continue;
      if (cell.blocked) {
        affectedCells.push(axial);
      }
    }
  }

  if (!hasOwnedNearby) {
    return [];
  }

  return affectedCells;
}

export function renderMazeNexusPlacementPreview(
  ctx: CanvasRenderingContext2D,
  options: MazeNexusPlacementPreviewRenderOptions,
): void {
  const { gs, nexusItemId, anchor, valid, origin, hexSize } = options;
  const cells = getMazeNexusItemPlacementCells(gs, nexusItemId, anchor);
  const def = gs.lib.nexusItems.get(nexusItemId)!;
  const rotationStep = getMazeNexusItemPlacementRotationStep(gs, nexusItemId);

  const centroidUnit = getMazeNexusPlacementCentroidUnit(cells);
  const cx = origin.x + centroidUnit.x * hexSize;
  const cy = origin.y + centroidUnit.y * hexSize;

  const limitRadius = def.limitRadius;
  if (limitRadius > 0) {
    const limitRadiusPx = limitRadius * hexSize * Math.sqrt(3);
    const blockingDisks = getMazeNexusLimitBlockingDisks(gs, nexusItemId, anchor);

    ctx.save();
    ctx.fillStyle = 'rgba(255, 48, 48, 0.12)';
    ctx.strokeStyle = 'rgba(255, 70, 70, 0.35)';
    ctx.lineWidth = 1.2;
    for (const disk of blockingDisks) {
      const diskX = origin.x + disk.centerUnit.x * hexSize;
      const diskY = origin.y + disk.centerUnit.y * hexSize;
      ctx.beginPath();
      ctx.arc(diskX, diskY, limitRadiusPx, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  const effectRadius = def.effectRadius;
  if (effectRadius > 0) {
    const radiusPx = effectRadius * hexSize * Math.sqrt(3);

    const radGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radiusPx);
    radGrad.addColorStop(0, 'rgba(120, 220, 230, 0.06)');
    radGrad.addColorStop(0.7, 'rgba(120, 220, 230, 0.04)');
    radGrad.addColorStop(1, 'rgba(120, 220, 230, 0)');
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radiusPx, 0, Math.PI * 2);
    ctx.fillStyle = radGrad;
    ctx.fill();

    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(140, 220, 230, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    if (nexusItemId === ANTIVOID_PANEL_ID) {
      const affectedCells = getAntiVoidAffectedCells(gs, anchor, cells, effectRadius);
      if (affectedCells.length > 0) {
        const loops = computeHexBoundary(affectedCells).map(loop => loop.points);
        ctx.save();
        traceSmoothHexBoundary(ctx, loops, origin, hexSize, undefined, {
          smoothness: ANTIVOID_PREVIEW_SMOOTHNESS,
          concaveBlend: ANTIVOID_PREVIEW_CONCAVE_BLEND,
          concaveBlendNu: ANTIVOID_PREVIEW_CONCAVE_BLEND_NU,
        });
        ctx.fillStyle = valid ? 'rgba(220, 120, 80, 0.30)' : 'rgba(220, 120, 80, 0.16)';
        ctx.fill('evenodd');
        ctx.strokeStyle = valid ? 'rgba(255, 180, 130, 0.9)' : 'rgba(255, 180, 130, 0.5)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
      }
    }

    if (valid) {
      const affectedSpawnIndexes = getMazeNexusPlacementAffectedSpawnIndexes(gs, nexusItemId, anchor);
      for (const spawnIndex of affectedSpawnIndexes) {
        const spawn = gs.mazeResourceSpawns[spawnIndex]!;
        const pixel = axialToPixel(spawn.cell, hexSize, origin);

        const spec = MAZE_RESOURCE_SPECS[spawn.resourceKey];
        const glowR = hexSize * 1.6;

        ctx.save();
        const glow = ctx.createRadialGradient(pixel.x, pixel.y, 0, pixel.x, pixel.y, glowR);
        glow.addColorStop(0, spec.color + '50');
        glow.addColorStop(0.5, spec.color + '20');
        glow.addColorStop(1, spec.color + '00');
        ctx.beginPath();
        ctx.arc(pixel.x, pixel.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
        ctx.restore();
      }
    }
  }

  if (!valid) return;

  const nexusFrame = atlasStorage.getNexusFrame(`nexus:${nexusItemId}`)!;
  const source = atlasStorage.getNexusSource();
  const drawSize = getNexusPreviewDrawSize(gs, nexusItemId, hexSize);
  ctx.save();
  ctx.translate(cx, cy);
  if (rotationStep !== 0) {
    ctx.rotate(rotationStep * Math.PI / 3);
  }
  ctx.drawImage(
    source,
    nexusFrame.x, nexusFrame.y, nexusFrame.w, nexusFrame.h,
    -drawSize.w / 2, -drawSize.h / 2, drawSize.w, drawSize.h,
  );
  ctx.restore();
}
