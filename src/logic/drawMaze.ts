import { axialToPixel } from './HexMath';
import { axialToIndex } from './Research';
import { RESOURCE_SPECS } from './Resources';
import { MAZE_ENTRANCE } from './Maze';
import type { Point2 } from './ItemLib';
import type { ReadonlyGameState } from './UIState';
import { computeOwnedResearchBoundary } from './hexBoundary';
import atlasStorage from './AtlasStorage';

const MAZE_SHADOW_COLOR = 'rgba(0, 0, 0, 0.55)';
const MAZE_SHADOW_OFFSET = { x: 3, y: 4 };
const MAZE_CELL_FILL_COLOR = 'rgb(59, 81, 90)';
const MAZE_CELL_STROKE_COLOR = 'rgba(165, 214, 228, 0.45)';
const MAZE_CELL_STROKE_WIDTH = 4;
const MAZE_TAKEN_GLYPH_COLOR = 'rgba(120, 120, 120, 0.4)';
const MAZE_ENTRANCE_ICON_SCALE = 0.9;

function traceBoundaryPath(
  ctx: CanvasRenderingContext2D,
  loops: readonly Point2[][],
  origin: Point2,
  scale: number,
  offset: Point2 = { x: 0, y: 0 },
): void {
  ctx.beginPath();
  for (const loop of loops) {
    const first = loop[0]!;
    ctx.moveTo(origin.x + offset.x + first.x * scale, origin.y + offset.y + first.y * scale);
    for (let i = 1; i < loop.length; i++) {
      const p = loop[i]!;
      ctx.lineTo(origin.x + offset.x + p.x * scale, origin.y + offset.y + p.y * scale);
    }
    ctx.closePath();
  }
}

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

export function renderMazeBaseLayer(
  ctx: CanvasRenderingContext2D,
  game: ReadonlyGameState,
  origin: Point2,
  hexSize: number,
  cellFillSize: number,
  takenCells: readonly { readonly x: number; readonly y: number }[],
): void {
  const cells = game.researchCells;
  const takenSet = new Set<string>();
  for (const t of takenCells) {
    takenSet.add(`${t.x},${t.y}`);
  }

  const loops = computeOwnedResearchBoundary(cells);
  if (loops.length > 0) {
    // Shadow as one union shape, respecting holes.
    ctx.save();
    traceBoundaryPath(ctx, loops, origin, hexSize, MAZE_SHADOW_OFFSET);
    ctx.fillStyle = MAZE_SHADOW_COLOR;
    ctx.fill('evenodd');
    ctx.restore();

    // Main maze silhouette and border.
    ctx.save();
    traceBoundaryPath(ctx, loops, origin, hexSize);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = MAZE_CELL_STROKE_COLOR;
    ctx.lineWidth = MAZE_CELL_STROKE_WIDTH;
    ctx.stroke();
    traceBoundaryPath(ctx, loops, origin, hexSize);
    ctx.fillStyle = MAZE_CELL_FILL_COLOR;
    ctx.fill('evenodd');
    ctx.restore();
  }

  const entranceIdx = axialToIndex(MAZE_ENTRANCE.x, MAZE_ENTRANCE.y);
  if (entranceIdx !== -1 && cells[entranceIdx]!.owned) {
    const center = axialToPixel(MAZE_ENTRANCE, hexSize, origin);
    drawMazeEntranceSymbol(ctx, game, center, hexSize);
  }

  // Draw resource glyphs
  const spawns = game.mazeResourceSpawns;
  const glyphSize = Math.max(12, hexSize * 1.05);

  for (const spawn of spawns) {
    const pixel = axialToPixel(spawn.cell, hexSize, origin);
    const taken = takenSet.has(`${spawn.cell.x},${spawn.cell.y}`);
    const spec = RESOURCE_SPECS[spawn.resourceKey];

    ctx.save();
    ctx.font = `bold ${glyphSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = taken ? MAZE_TAKEN_GLYPH_COLOR : spec.color;
    ctx.fillText(spec.glyph, pixel.x, pixel.y + 1);
    ctx.restore();
  }
}
