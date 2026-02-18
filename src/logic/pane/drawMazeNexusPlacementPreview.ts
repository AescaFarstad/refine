import atlasStorage from '../AtlasStorage';
import { axialToPixel } from '../HexMath';
import type { Point2 } from '../ItemLib';
import {
  getMazeNexusItemPlacementCells,
  getMazeNexusLimitBlockingDisks,
  getMazeNexusPlacementAffectedSpawnIndexes,
  getMazeNexusPlacementCentroidUnit,
} from '../Maze';
import { RESOURCE_SPECS } from '../Resources';
import type { ReadonlyGameState } from '../UIState';

export interface MazeNexusPlacementPreviewRenderOptions {
  gs: ReadonlyGameState;
  nexusItemId: string;
  anchor: Point2;
  valid: boolean;
  origin: Point2;
  hexSize: number;
}

export function renderMazeNexusPlacementPreview(
  ctx: CanvasRenderingContext2D,
  options: MazeNexusPlacementPreviewRenderOptions,
): void {
  const { gs, nexusItemId, anchor, valid, origin, hexSize } = options;
  const cells = getMazeNexusItemPlacementCells(gs, nexusItemId, anchor);
  const def = gs.lib.nexusItems.get(nexusItemId)!;

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

    if (valid) {
      const affectedSpawnIndexes = getMazeNexusPlacementAffectedSpawnIndexes(gs, nexusItemId, anchor);
      for (const spawnIndex of affectedSpawnIndexes) {
        const spawn = gs.mazeResourceSpawns[spawnIndex]!;
        const pixel = axialToPixel(spawn.cell, hexSize, origin);

        const spec = RESOURCE_SPECS[spawn.resourceKey];
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

  const pid = def.placableInstanceDescription;
  const imageKey = pid.image;
  if (imageKey) {
    const frame = atlasStorage.getItemsFrame(imageKey);
    if (frame) {
      const source = atlasStorage.getItemsSource();
      const iconMaxSize = hexSize * 1.2;
      const scale = Math.min(iconMaxSize / frame.w, iconMaxSize / frame.h);
      const drawW = frame.w * scale;
      const drawH = frame.h * scale;
      ctx.save();
      ctx.globalAlpha = 0.95;
      ctx.drawImage(
        source,
        frame.x, frame.y, frame.w, frame.h,
        cx - drawW / 2, cy - drawH / 2, drawW, drawH,
      );
      ctx.restore();
      return;
    }
  }

  const text = def.glyph || def.name.charAt(0);
  const glyphSize = Math.max(12, hexSize * 1.05);
  ctx.save();
  ctx.font = `bold ${glyphSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(248, 250, 252, 0.96)';
  ctx.fillText(text, cx, cy + 1);
  ctx.restore();
}
