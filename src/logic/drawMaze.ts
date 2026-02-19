import { axialToPixel } from './HexMath';
import { RESOURCE_SPECS } from './Resources';
import { getOwnedMazeEntrances, getOwnedMazeNexuses } from './Maze';
import type { Point2 } from './ItemLib';
import type { ReadonlyGameState } from './UIState';
import { computeOwnedResearchBoundary, computeHexBoundary } from './hexBoundary';
import atlasStorage from './AtlasStorage';
import { indexToAxial, axialToIndex } from './Research';
import { traceSmoothHexBoundary } from './drawSmoothBoundary';

const MAZE_SHADOW_COLOR = 'rgba(0, 0, 0, 0.55)';
const MAZE_SHADOW_OFFSET = { x: 3, y: 4 };
const MAZE_CELL_FILL_COLOR_TOP = 'rgb(34, 68, 74)';
const MAZE_CELL_FILL_COLOR_MID = 'rgb(44, 84, 88)';
const MAZE_CELL_FILL_COLOR_BOT = 'rgb(28, 56, 64)';
const MAZE_RESOURCE_GLOW_RADIUS_SCALE = 1.8;
const MAZE_RESOURCE_GLOW_ALPHA = 0.18;
const MAZE_TAKEN_RESOURCE_GLOW_ALPHA = 0.05;
const MAZE_RESOURCE_HIGHLIGHT_SCALE = 1.14;
const MAZE_RESOURCE_HIGHLIGHT_GLOW_BOOST = 0.22;
const MAZE_RESOURCE_HIGHLIGHT_RING_STROKE_WIDTH = 1.4;
const MAZE_CELL_OUTER_STROKE_COLOR = 'rgba(4, 18, 22, 0.65)';
const MAZE_CELL_OUTER_STROKE_WIDTH = 6;
const MAZE_CELL_INNER_STROKE_COLOR = 'rgba(140, 220, 210, 0.32)';
const MAZE_CELL_INNER_STROKE_WIDTH = 2.5;
const MAZE_TAKEN_GLYPH_COLOR = 'rgba(120, 120, 120, 0.4)';
const MAZE_GLYPH_BG_FILL_COLOR = 'rgba(4, 16, 20, 0.45)';
const MAZE_GLYPH_BG_STROKE_COLOR = 'rgba(140, 210, 205, 0.2)';
const MAZE_TAKEN_GLYPH_BG_FILL_COLOR = 'rgba(4, 16, 20, 0.22)';
const MAZE_TAKEN_GLYPH_BG_STROKE_COLOR = 'rgba(140, 210, 205, 0.1)';
const MAZE_GLYPH_BG_RADIUS_SCALE = 0.62;
const MAZE_GLYPH_BG_STROKE_WIDTH = 1.2;
const MAZE_ENTRANCE_ICON_SCALE = 0.72;
const MAZE_NEXUS_ICON_SCALE = 1.1;
const MAZE_NEXUS_ITEM_COLOR = 'rgba(248, 250, 252, 0.96)';
const MAZE_NEXUS_ITEM_GLOW_COLOR = '#e2e8f0';
const MAZE_STONE_SHRINK = 0.82;
const MAZE_STONE_SHADOW_COLOR = 'rgba(0, 0, 0, 0.4)';
const MAZE_STONE_SHADOW_OFFSET = { x: 2, y: 3 };
const MAZE_STONE_FILL_TOP = 'rgb(52, 58, 64)';
const MAZE_STONE_FILL_MID = 'rgb(62, 68, 72)';
const MAZE_STONE_FILL_BOT = 'rgb(44, 48, 54)';
const MAZE_STONE_OUTER_STROKE_COLOR = 'rgba(10, 10, 14, 0.65)';
const MAZE_STONE_OUTER_STROKE_WIDTH = 4;
const MAZE_STONE_INNER_STROKE_COLOR = 'rgba(160, 170, 180, 0.3)';
const MAZE_STONE_INNER_STROKE_WIDTH = 1.8;

function hexAlphaSuffix(alpha: number): string {
  return Math.round(alpha * 255).toString(16).padStart(2, '0');
}

const traceBoundaryPath = traceSmoothHexBoundary;

function drawMazeEntranceSymbol(
  ctx: CanvasRenderingContext2D,
  game: ReadonlyGameState,
  center: Point2,
  hexSize: number,
): void {
  const archetype = game.lib.research.archetypes.get('disc_maze_navigation')!;
  const icon = archetype.ownedIcon ?? archetype.icon;

  if (icon.kind === 'glyph') {
    const iconScale = icon.scale ?? 1;
    const iconOffset = icon.offset ?? { x: 0, y: 0 };
    const glyphSize = Math.max(12, hexSize * 1.05 * iconScale * MAZE_ENTRANCE_ICON_SCALE);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${glyphSize}px sans-serif`;
    ctx.fillStyle = 'rgba(248, 250, 252, 0.96)';
    ctx.fillText(icon.glyph, center.x + iconOffset.x, center.y + iconOffset.y + 2);
    ctx.restore();
    return;
  }

  if (icon.kind === 'itemImage') {
    const source = atlasStorage.getItemsSource();
    const frame = atlasStorage.getItemsFrame(icon.key)!;
    const iconScale = icon.scale ?? 1;
    const iconOffset = icon.offset ?? { x: 0, y: 0 };
    const iconMaxSize = hexSize * 1.2 * MAZE_ENTRANCE_ICON_SCALE;
    const scale = Math.min(iconMaxSize / frame.w, iconMaxSize / frame.h) * iconScale;
    const drawW = frame.w * scale;
    const drawH = frame.h * scale;

    ctx.save();
    ctx.translate(center.x + iconOffset.x, center.y + iconOffset.y);
    ctx.drawImage(
      source,
      frame.x,
      frame.y,
      frame.w,
      frame.h,
      -drawW / 2,
      -drawH / 2,
      drawW,
      drawH
    );
    ctx.restore();
  }
}

function drawMazeNexusSymbol(
  ctx: CanvasRenderingContext2D,
  game: ReadonlyGameState,
  center: Point2,
  hexSize: number,
): void {
  const archetype = game.lib.research.archetypes.get('disc_maze_nexus')!;
  const icon = archetype.ownedIcon ?? archetype.icon;

  if (icon.kind === 'glyph') {
    const iconScale = icon.scale ?? 1;
    const iconOffset = icon.offset ?? { x: 0, y: 0 };
    const glyphSize = Math.max(12, hexSize * 1.05 * iconScale * MAZE_NEXUS_ICON_SCALE);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${glyphSize}px sans-serif`;
    ctx.fillStyle = 'rgba(248, 250, 252, 0.96)';
    ctx.fillText(icon.glyph, center.x + iconOffset.x, center.y + iconOffset.y + 2);
    ctx.restore();
    return;
  }

  if (icon.kind === 'itemImage') {
    const source = atlasStorage.getItemsSource();
    const frame = atlasStorage.getItemsFrame(icon.key)!;
    const iconScale = icon.scale ?? 1;
    const iconOffset = icon.offset ?? { x: 0, y: 0 };
    const iconMaxSize = hexSize * 1.2 * MAZE_NEXUS_ICON_SCALE;
    const scale = Math.min(iconMaxSize / frame.w, iconMaxSize / frame.h) * iconScale;
    const drawW = frame.w * scale;
    const drawH = frame.h * scale;

    ctx.save();
    ctx.translate(center.x + iconOffset.x, center.y + iconOffset.y);
    ctx.drawImage(
      source,
      frame.x,
      frame.y,
      frame.w,
      frame.h,
      -drawW / 2,
      -drawH / 2,
      drawW,
      drawH
    );
    ctx.restore();
  }
}

function buildTakenSet(
  takenCells: readonly { readonly x: number; readonly y: number }[],
  visuallyTakenCellKeys?: ReadonlySet<string>,
): Set<string> {
  const takenSet = new Set<string>();
  for (const t of takenCells) {
    takenSet.add(`${t.x},${t.y}`);
  }
  if (visuallyTakenCellKeys) {
    for (const key of visuallyTakenCellKeys) {
      takenSet.add(key);
    }
  }
  return takenSet;
}

export function renderMazeTerrainLayer(
  ctx: CanvasRenderingContext2D,
  game: ReadonlyGameState,
  origin: Point2,
  hexSize: number,
  _cellFillSize: number,
): void {
  const cells = game.researchCells;
  const loops = computeOwnedResearchBoundary(cells);
  if (loops.length > 0) {
    // Shadow as one union shape, respecting holes.
    ctx.save();
    traceBoundaryPath(ctx, loops, origin, hexSize, MAZE_SHADOW_OFFSET);
    ctx.fillStyle = MAZE_SHADOW_COLOR;
    ctx.fill('evenodd');
    ctx.restore();

    // Main maze silhouette and border — gradient fill for depth.
    ctx.save();
    traceBoundaryPath(ctx, loops, origin, hexSize);

    // Compute vertical bounds for gradient
    let minY = Infinity;
    let maxY = -Infinity;
    for (const loop of loops) {
      for (const p of loop) {
        const py = origin.y + p.y * hexSize;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
    }
    const grad = ctx.createLinearGradient(0, minY, 0, maxY);
    grad.addColorStop(0, MAZE_CELL_FILL_COLOR_TOP);
    grad.addColorStop(0.45, MAZE_CELL_FILL_COLOR_MID);
    grad.addColorStop(1, MAZE_CELL_FILL_COLOR_BOT);
    ctx.fillStyle = grad;
    ctx.fill('evenodd');

    traceBoundaryPath(ctx, loops, origin, hexSize);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = MAZE_CELL_OUTER_STROKE_COLOR;
    ctx.lineWidth = MAZE_CELL_OUTER_STROKE_WIDTH;
    ctx.stroke();

    traceBoundaryPath(ctx, loops, origin, hexSize);
    ctx.strokeStyle = MAZE_CELL_INNER_STROKE_COLOR;
    ctx.lineWidth = MAZE_CELL_INNER_STROKE_WIDTH;
    ctx.stroke();
    ctx.restore();
  }

}

export function renderMazeFurnitureLayer(
  ctx: CanvasRenderingContext2D,
  game: ReadonlyGameState,
  origin: Point2,
  hexSize: number,
  takenCells: readonly { readonly x: number; readonly y: number }[],
  highlightedResourceCellKeys?: ReadonlySet<string>,
  visuallyTakenCellKeys?: ReadonlySet<string>,
): void {
  const cells = game.researchCells;
  const takenSet = buildTakenSet(takenCells, visuallyTakenCellKeys);

  const ownedEntrances = getOwnedMazeEntrances(game);
  for (const entrance of ownedEntrances) {
    const center = axialToPixel(entrance, hexSize, origin);
    drawMazeEntranceSymbol(ctx, game, center, hexSize);
  }

  const ownedNexuses = getOwnedMazeNexuses(game);
  for (const nexus of ownedNexuses) {
    const center = axialToPixel(nexus, hexSize, origin);
    drawMazeNexusSymbol(ctx, game, center, hexSize);
  }

  // Draw resource glyphs
  const spawns = game.mazeResourceSpawns;
  const glyphSize = Math.max(12, hexSize * 1.05);

  for (const spawn of spawns) {
    const cellKey = `${spawn.cell.x},${spawn.cell.y}`;
    const pixel = axialToPixel(spawn.cell, hexSize, origin);
    const taken = takenSet.has(cellKey);
    const highlighted = highlightedResourceCellKeys?.has(cellKey) === true;
    const spec = RESOURCE_SPECS[spawn.resourceKey];
    const scale = highlighted ? MAZE_RESOURCE_HIGHLIGHT_SCALE : 1;
    const bgRadius = glyphSize * MAZE_GLYPH_BG_RADIUS_SCALE * scale;
    const glyphYOffset = spawn.resourceKey === 'credits' ? 2 : 1;

    ctx.save();

    // Soft colored glow behind the icon
    const glowRadius = bgRadius * MAZE_RESOURCE_GLOW_RADIUS_SCALE;
    const glowAlphaBase = taken ? MAZE_TAKEN_RESOURCE_GLOW_ALPHA : MAZE_RESOURCE_GLOW_ALPHA;
    const glowAlpha = Math.min(1, glowAlphaBase + (highlighted ? MAZE_RESOURCE_HIGHLIGHT_GLOW_BOOST : 0));
    const glowGrad = ctx.createRadialGradient(pixel.x, pixel.y, 0, pixel.x, pixel.y, glowRadius);
    glowGrad.addColorStop(0, spec.color + hexAlphaSuffix(glowAlpha));
    glowGrad.addColorStop(1, spec.color + '00');
    ctx.beginPath();
    ctx.arc(pixel.x, pixel.y, glowRadius, 0, Math.PI * 2);
    ctx.fillStyle = glowGrad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(pixel.x, pixel.y, bgRadius, 0, Math.PI * 2);
    ctx.fillStyle = taken ? MAZE_TAKEN_GLYPH_BG_FILL_COLOR : MAZE_GLYPH_BG_FILL_COLOR;
    ctx.fill();
    ctx.strokeStyle = taken ? MAZE_TAKEN_GLYPH_BG_STROKE_COLOR : MAZE_GLYPH_BG_STROKE_COLOR;
    ctx.lineWidth = MAZE_GLYPH_BG_STROKE_WIDTH;
    ctx.stroke();

    if (highlighted) {
      ctx.beginPath();
      ctx.arc(pixel.x, pixel.y, bgRadius + (hexSize * 0.12), 0, Math.PI * 2);
      ctx.strokeStyle = spec.color + hexAlphaSuffix(taken ? 0.35 : 0.7);
      ctx.lineWidth = MAZE_RESOURCE_HIGHLIGHT_RING_STROKE_WIDTH;
      ctx.stroke();
    }

    ctx.font = `bold ${glyphSize * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = taken ? MAZE_TAKEN_GLYPH_COLOR : spec.color;
    ctx.fillText(spec.glyph, pixel.x, pixel.y + glyphYOffset);
    ctx.restore();
  }

  // Draw nexus items — impassable ones get stone hex shapes, passable ones get glyph circles
  const nexusDefs = game.lib.nexusItems;

  // Collect impassable nexus cells and group by placed item id.
  const stoneGroupsByPlacementId = new Map<number, { cells: Point2[]; nexusId: string }>();
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (!cell.owned || !cell.nexusId) continue;
    const def = nexusDefs.get(cell.nexusId);
    if (!def || def.placableInstanceDescription?.passable !== false) continue;
    if (!Number.isInteger(cell.nexusPlacementId) || cell.nexusPlacementId <= 0) {
      throw new Error(`Invalid nexusPlacementId for impassable nexus at index ${i}`);
    }
    const axial = indexToAxial(i);
    const existingGroup = stoneGroupsByPlacementId.get(cell.nexusPlacementId);
    if (existingGroup) {
      if (existingGroup.nexusId !== cell.nexusId) {
        throw new Error(`Mixed nexus ids for placement id ${cell.nexusPlacementId}`);
      }
      existingGroup.cells.push(axial);
    } else {
      stoneGroupsByPlacementId.set(cell.nexusPlacementId, { cells: [axial], nexusId: cell.nexusId });
    }
  }
  const stoneGroups = Array.from(stoneGroupsByPlacementId.values());

  // Draw each stone group as a solid hex shape
  const stoneHexSize = hexSize * MAZE_STONE_SHRINK;
  for (const group of stoneGroups) {
    const loops = computeHexBoundary(group.cells);
    if (loops.length === 0) continue;

    // Compute centroid in pixel space to keep stone centered when shrunk
    let cx = 0, cy = 0;
    for (const c of group.cells) {
      const p = axialToPixel(c, 1, { x: 0, y: 0 });
      cx += p.x;
      cy += p.y;
    }
    cx /= group.cells.length;
    cy /= group.cells.length;

    // Adjusted origin so the centroid stays in the same pixel position
    const stoneOrigin = {
      x: origin.x + cx * (hexSize - stoneHexSize),
      y: origin.y + cy * (hexSize - stoneHexSize),
    };

    // Shadow
    ctx.save();
    traceBoundaryPath(ctx, loops, stoneOrigin, stoneHexSize, MAZE_STONE_SHADOW_OFFSET);
    ctx.fillStyle = MAZE_STONE_SHADOW_COLOR;
    ctx.fill('evenodd');
    ctx.restore();

    // Gradient fill
    ctx.save();
    traceBoundaryPath(ctx, loops, stoneOrigin, stoneHexSize);

    let minY = Infinity, maxY = -Infinity;
    for (const loop of loops) {
      for (const p of loop) {
        const py = stoneOrigin.y + p.y * stoneHexSize;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
    }
    const stoneGrad = ctx.createLinearGradient(0, minY, 0, maxY);
    stoneGrad.addColorStop(0, MAZE_STONE_FILL_TOP);
    stoneGrad.addColorStop(0.45, MAZE_STONE_FILL_MID);
    stoneGrad.addColorStop(1, MAZE_STONE_FILL_BOT);
    ctx.fillStyle = stoneGrad;
    ctx.fill('evenodd');

    // Outer stroke
    traceBoundaryPath(ctx, loops, stoneOrigin, stoneHexSize);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = MAZE_STONE_OUTER_STROKE_COLOR;
    ctx.lineWidth = MAZE_STONE_OUTER_STROKE_WIDTH;
    ctx.stroke();

    // Inner stroke
    traceBoundaryPath(ctx, loops, stoneOrigin, stoneHexSize);
    ctx.strokeStyle = MAZE_STONE_INNER_STROKE_COLOR;
    ctx.lineWidth = MAZE_STONE_INNER_STROKE_WIDTH;
    ctx.stroke();
    ctx.restore();

    // Draw icon/glyph on each cell of the stone group
    const def = nexusDefs.get(group.nexusId)!;
    const pid = def.placableInstanceDescription;
    const imageKey = pid?.image;
    for (const cellAxial of group.cells) {
      const pixel = axialToPixel(cellAxial, hexSize, origin);
      const taken = takenSet.has(`${cellAxial.x},${cellAxial.y}`);

      ctx.save();
      if (imageKey) {
        const frame = atlasStorage.getItemsFrame(imageKey);
        if (frame) {
          const source = atlasStorage.getItemsSource();
          const iconMaxSize = stoneHexSize * 1.2;
          const scale = Math.min(iconMaxSize / frame.w, iconMaxSize / frame.h);
          const drawW = frame.w * scale;
          const drawH = frame.h * scale;
          if (taken) ctx.globalAlpha = 0.35;
          ctx.drawImage(
            source,
            frame.x, frame.y, frame.w, frame.h,
            pixel.x - drawW / 2, pixel.y - drawH / 2, drawW, drawH,
          );
          ctx.restore();
          continue;
        }
      }
      const text = def.glyph || def.name.charAt(0);
      const stoneGlyphSize = Math.max(12, stoneHexSize * 1.05);
      ctx.font = `bold ${stoneGlyphSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = taken ? MAZE_TAKEN_GLYPH_COLOR : MAZE_NEXUS_ITEM_COLOR;
      ctx.fillText(text, pixel.x, pixel.y + 1);
      ctx.restore();
    }
  }

  // Draw passable nexus item glyphs (non-impassable)
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (!cell.owned || !cell.nexusId) continue;

    const def = nexusDefs.get(cell.nexusId);
    if (!def) continue;
    if (def.placableInstanceDescription?.passable === false) continue;

    const axial = indexToAxial(i);
    const pixel = axialToPixel(axial, hexSize, origin);
    const taken = takenSet.has(`${axial.x},${axial.y}`);
    const bgRadius = glyphSize * MAZE_GLYPH_BG_RADIUS_SCALE;

    ctx.save();

    // Soft white glow
    const glowRadius = bgRadius * MAZE_RESOURCE_GLOW_RADIUS_SCALE;
    const glowAlpha = taken ? MAZE_TAKEN_RESOURCE_GLOW_ALPHA : MAZE_RESOURCE_GLOW_ALPHA;
    const glowGrad = ctx.createRadialGradient(pixel.x, pixel.y, 0, pixel.x, pixel.y, glowRadius);
    glowGrad.addColorStop(0, MAZE_NEXUS_ITEM_GLOW_COLOR + hexAlphaSuffix(glowAlpha));
    glowGrad.addColorStop(1, MAZE_NEXUS_ITEM_GLOW_COLOR + '00');
    ctx.beginPath();
    ctx.arc(pixel.x, pixel.y, glowRadius, 0, Math.PI * 2);
    ctx.fillStyle = glowGrad;
    ctx.fill();

    // Background circle
    ctx.beginPath();
    ctx.arc(pixel.x, pixel.y, bgRadius, 0, Math.PI * 2);
    ctx.fillStyle = taken ? MAZE_TAKEN_GLYPH_BG_FILL_COLOR : MAZE_GLYPH_BG_FILL_COLOR;
    ctx.fill();
    ctx.strokeStyle = taken ? MAZE_TAKEN_GLYPH_BG_STROKE_COLOR : MAZE_GLYPH_BG_STROKE_COLOR;
    ctx.lineWidth = MAZE_GLYPH_BG_STROKE_WIDTH;
    ctx.stroke();

    const pid = def.placableInstanceDescription;
    const imageKey = pid?.image;
    if (imageKey) {
      const frame = atlasStorage.getItemsFrame(imageKey);
      if (frame) {
        const source = atlasStorage.getItemsSource();
        const iconMaxSize = hexSize * 1.2;
        const scale = Math.min(iconMaxSize / frame.w, iconMaxSize / frame.h);
        const drawW = frame.w * scale;
        const drawH = frame.h * scale;
        if (taken) {
          ctx.globalAlpha = 0.35;
        }
        ctx.drawImage(
          source,
          frame.x, frame.y, frame.w, frame.h,
          pixel.x - drawW / 2, pixel.y - drawH / 2, drawW, drawH,
        );
        ctx.restore();
        continue;
      }
    }

    // Fallback: draw glyph text (e.g. "x2")
    const text = def.glyph || def.name.charAt(0);
    ctx.font = `bold ${glyphSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = taken ? MAZE_TAKEN_GLYPH_COLOR : MAZE_NEXUS_ITEM_COLOR;
    ctx.fillText(text, pixel.x, pixel.y + 1);
    ctx.restore();
  }
}

export function renderMazeBaseLayer(
  ctx: CanvasRenderingContext2D,
  game: ReadonlyGameState,
  origin: Point2,
  hexSize: number,
  cellFillSize: number,
  takenCells: readonly { readonly x: number; readonly y: number }[],
  highlightedResourceCellKeys?: ReadonlySet<string>,
  visuallyTakenCellKeys?: ReadonlySet<string>,
): void {
  renderMazeTerrainLayer(ctx, game, origin, hexSize, cellFillSize);
  renderMazeFurnitureLayer(
    ctx,
    game,
    origin,
    hexSize,
    takenCells,
    highlightedResourceCellKeys,
    visuallyTakenCellKeys,
  );
}
