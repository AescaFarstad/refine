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
const MAZE_CELL_OUTER_STROKE_COLOR = 'rgba(7, 14, 22, 0.62)';
const MAZE_CELL_OUTER_STROKE_WIDTH = 6;
const MAZE_CELL_INNER_STROKE_COLOR = 'rgba(180, 226, 240, 0.4)';
const MAZE_CELL_INNER_STROKE_WIDTH = 2.5;
const MAZE_BOUNDARY_SMOOTHNESS = 0.8;
const MAZE_BOUNDARY_CONCAVE_BLEND = 0.7;
const MAZE_BOUNDARY_CONCAVE_BLEND_NU = 0.45;
const MAZE_TAKEN_GLYPH_COLOR = 'rgba(120, 120, 120, 0.4)';
const MAZE_GLYPH_BG_FILL_COLOR = 'rgba(6, 14, 22, 0.4)';
const MAZE_GLYPH_BG_STROKE_COLOR = 'rgba(173, 216, 230, 0.22)';
const MAZE_TAKEN_GLYPH_BG_FILL_COLOR = 'rgba(6, 14, 22, 0.22)';
const MAZE_TAKEN_GLYPH_BG_STROKE_COLOR = 'rgba(173, 216, 230, 0.1)';
const MAZE_GLYPH_BG_RADIUS_SCALE = 0.62;
const MAZE_GLYPH_BG_STROKE_WIDTH = 1.2;
const MAZE_ENTRANCE_ICON_SCALE = 0.72;

function hashCoord01(x: number, y: number): number {
  const xi = Math.round(x * 1024);
  const yi = Math.round(y * 1024);
  let h = Math.imul(xi, 374761393) ^ Math.imul(yi, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function preprocessConcaveLoop(loop: readonly Point2[], blendK: number, blendNu: number): Point2[] {
  const pointCount = loop.length - 1;
  if (pointCount < 3 || blendK <= 0) return loop.slice(0, pointCount);

  const source = loop.slice(0, pointCount);
  const adjusted = source.map((p) => ({ x: p.x, y: p.y }));

  let area2 = 0;
  for (let i = 0; i < pointCount; i++) {
    const a = source[i]!;
    const b = source[(i + 1) % pointCount]!;
    area2 += a.x * b.y - a.y * b.x;
  }
  const areaSign = Math.sign(area2);
  if (areaSign === 0) return adjusted;

  for (let i = 0; i < pointCount; i++) {
    const prev = source[(i - 1 + pointCount) % pointCount]!;
    const pos = source[i]!;
    const next = source[(i + 1) % pointCount]!;
    const inX = pos.x - prev.x;
    const inY = pos.y - prev.y;
    const outX = next.x - pos.x;
    const outY = next.y - pos.y;
    const turn = inX * outY - inY * outX;
    const isConcave = turn * areaSign < 0;
    if (!isConcave) continue;

    const rnd = hashCoord01(pos.x, pos.y);
    const localBlendK = blendK + (rnd * 2 - 1) * blendNu;
    const avgX = (prev.x + next.x) * 0.5;
    const avgY = (prev.y + next.y) * 0.5;
    adjusted[i] = {
      x: pos.x * (1 - localBlendK) + avgX * localBlendK,
      y: pos.y * (1 - localBlendK) + avgY * localBlendK,
    };
  }

  return adjusted;
}

function traceBoundaryPath(
  ctx: CanvasRenderingContext2D,
  loops: readonly Point2[][],
  origin: Point2,
  scale: number,
  offset: Point2 = { x: 0, y: 0 },
): void {
  ctx.beginPath();
  for (const loop of loops) {
    const points = preprocessConcaveLoop(
      loop,
      MAZE_BOUNDARY_CONCAVE_BLEND,
      MAZE_BOUNDARY_CONCAVE_BLEND_NU,
    );
    const pointCount = points.length;
    const first = points[0]!;
    ctx.moveTo(origin.x + offset.x + first.x * scale, origin.y + offset.y + first.y * scale);
    for (let i = 0; i < pointCount; i++) {
      const p0 = points[(i - 1 + pointCount) % pointCount]!;
      const p1 = points[i]!;
      const p2 = points[(i + 1) % pointCount]!;
      const p3 = points[(i + 2) % pointCount]!;

      const c1x = p1.x + ((p2.x - p0.x) * MAZE_BOUNDARY_SMOOTHNESS) / 6;
      const c1y = p1.y + ((p2.y - p0.y) * MAZE_BOUNDARY_SMOOTHNESS) / 6;
      const c2x = p2.x - ((p3.x - p1.x) * MAZE_BOUNDARY_SMOOTHNESS) / 6;
      const c2y = p2.y - ((p3.y - p1.y) * MAZE_BOUNDARY_SMOOTHNESS) / 6;

      ctx.bezierCurveTo(
        origin.x + offset.x + c1x * scale,
        origin.y + offset.y + c1y * scale,
        origin.x + offset.x + c2x * scale,
        origin.y + offset.y + c2y * scale,
        origin.x + offset.x + p2.x * scale,
        origin.y + offset.y + p2.y * scale,
      );
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
    ctx.fillStyle = MAZE_CELL_FILL_COLOR;
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
    const bgRadius = glyphSize * MAZE_GLYPH_BG_RADIUS_SCALE;
    const glyphYOffset = spawn.resourceKey === 'credits' ? 2 : 1;

    ctx.save();
    ctx.beginPath();
    ctx.arc(pixel.x, pixel.y, bgRadius, 0, Math.PI * 2);
    ctx.fillStyle = taken ? MAZE_TAKEN_GLYPH_BG_FILL_COLOR : MAZE_GLYPH_BG_FILL_COLOR;
    ctx.fill();
    ctx.strokeStyle = taken ? MAZE_TAKEN_GLYPH_BG_STROKE_COLOR : MAZE_GLYPH_BG_STROKE_COLOR;
    ctx.lineWidth = MAZE_GLYPH_BG_STROKE_WIDTH;
    ctx.stroke();

    ctx.font = `bold ${glyphSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = taken ? MAZE_TAKEN_GLYPH_COLOR : spec.color;
    ctx.fillText(spec.glyph, pixel.x, pixel.y + glyphYOffset);
    ctx.restore();
  }
}
