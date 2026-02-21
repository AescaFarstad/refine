import { axialToPixel } from './HexMath';
import { RESOURCE_SPECS } from './Resources';
import { getOwnedMazeEntrances, getOwnedMazeNexuses } from './Maze';
import type { Point2 } from './ItemLib';
import type { ReadonlyGameState } from './UIState';
import { computeHexBoundary } from './hexBoundary';
import atlasStorage from './AtlasStorage';
import { indexToAxial } from './Research';
import { traceSmoothHexBoundary } from './drawSmoothBoundary';
import { drawNexusItemVisuals, type NexusVisualCell } from './drawNexusItemVisuals';

const RESOURCE_GLOW_RADIUS_SCALE = 1.8;
const RESOURCE_GLOW_ALPHA = 0.18;
const TAKEN_RESOURCE_GLOW_ALPHA = 0.05;
const RESOURCE_HIGHLIGHT_SCALE = 1.14;
const RESOURCE_HIGHLIGHT_GLOW_BOOST = 0.22;
const RESOURCE_HIGHLIGHT_RING_STROKE_WIDTH = 1.4;
const TAKEN_GLYPH_COLOR = 'rgba(120, 120, 120, 0.4)';
const GLYPH_BG_FILL_COLOR = 'rgba(4, 16, 20, 0.45)';
const GLYPH_BG_STROKE_COLOR = 'rgba(140, 210, 205, 0.2)';
const TAKEN_GLYPH_BG_FILL_COLOR = 'rgba(4, 16, 20, 0.22)';
const TAKEN_GLYPH_BG_STROKE_COLOR = 'rgba(140, 210, 205, 0.1)';
const GLYPH_BG_RADIUS_SCALE = 0.62;
const GLYPH_BG_STROKE_WIDTH = 1.2;
const ENTRANCE_ICON_SCALE = 0.72;
const NEXUS_ICON_SCALE = 1.1;
const NEXUS_ITEM_COLOR = 'rgba(248, 250, 252, 0.96)';
const NEXUS_ITEM_GLOW_COLOR = '#e2e8f0';
const STONE_SHRINK = 0.82;
const STONE_SHADOW_COLOR = 'rgba(0, 0, 0, 0.4)';
const STONE_SHADOW_OFFSET = { x: 2, y: 3 };
const STONE_FILL_TOP = 'rgb(52, 58, 64)';
const STONE_FILL_MID = 'rgb(62, 68, 72)';
const STONE_FILL_BOT = 'rgb(44, 48, 54)';
const STONE_OUTER_STROKE_COLOR = 'rgba(10, 10, 14, 0.65)';
const STONE_OUTER_STROKE_WIDTH = 4;
const STONE_INNER_STROKE_COLOR = 'rgba(160, 170, 180, 0.3)';
const STONE_INNER_STROKE_WIDTH = 1.8;

const traceBoundaryPath = traceSmoothHexBoundary;

type NexusPlacementGroup = {
  placementId: number;
  nexusId: string;
  cells: Point2[];
};

type MazeNexusPassableRendererArgs = {
  ctx: CanvasRenderingContext2D;
  game: ReadonlyGameState;
  origin: Point2;
  hexSize: number;
  glyphSize: number;
  group: NexusPlacementGroup;
  takenSet: ReadonlySet<string>;
};

type MazeNexusImpassableRendererArgs = {
  ctx: CanvasRenderingContext2D;
  game: ReadonlyGameState;
  origin: Point2;
  hexSize: number;
  stoneHexSize: number;
  group: NexusPlacementGroup;
  takenSet: ReadonlySet<string>;
};

type MazeNexusItemRenderer = {
  renderPassableGroup(args: MazeNexusPassableRendererArgs): void;
  renderImpassableGroup(args: MazeNexusImpassableRendererArgs): void;
};

export const mazeNexusItemRendererRegistry = new Map<string, MazeNexusItemRenderer>();

function hexAlphaSuffix(alpha: number): string {
  return Math.round(alpha * 255).toString(16).padStart(2, '0');
}

function drawMazeResearchSymbol(
  ctx: CanvasRenderingContext2D,
  game: ReadonlyGameState,
  center: Point2,
  hexSize: number,
  archetypeId: string,
  iconScaleBase: number,
): void {
  const archetype = game.lib.research.archetypes.get(archetypeId)!;
  const icon = archetype.ownedIcon ?? archetype.icon;

  if (icon.kind === 'glyph') {
    const iconScale = icon.scale ?? 1;
    const iconOffset = icon.offset ?? { x: 0, y: 0 };
    const glyphSize = Math.max(12, hexSize * 1.05 * iconScale * iconScaleBase);
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
    const iconMaxSize = hexSize * 1.2 * iconScaleBase;
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
      drawH,
    );
    ctx.restore();
    return;
  }

  throw new Error(`Unsupported maze symbol icon kind: ${icon.kind}`);
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

function buildNexusPlacementGroups(
  game: ReadonlyGameState,
  passable: boolean,
): NexusPlacementGroup[] {
  const groupsByPlacementId = new Map<number, NexusPlacementGroup>();
  for (let i = 0; i < game.researchCells.length; i++) {
    const cell = game.researchCells[i]!;
    if (!cell.owned || !cell.nexusId) continue;

    const def = game.lib.nexusItems.get(cell.nexusId)!;
    if (def.placableInstanceDescription.passable !== passable) continue;

    if (!Number.isInteger(cell.nexusPlacementId) || cell.nexusPlacementId <= 0) {
      throw new Error(`Invalid nexusPlacementId for nexus item at index ${i}`);
    }

    const placementId = cell.nexusPlacementId;
    const axial = indexToAxial(i);
    const existing = groupsByPlacementId.get(placementId);
    if (existing) {
      if (existing.nexusId !== cell.nexusId) {
        throw new Error(`Mixed nexus ids for placement id ${placementId}`);
      }
      existing.cells.push(axial);
    } else {
      groupsByPlacementId.set(placementId, { placementId, nexusId: cell.nexusId, cells: [axial] });
    }
  }
  return Array.from(groupsByPlacementId.values());
}

function getGroupCenterUnit(cells: readonly Point2[]): Point2 {
  let cx = 0;
  let cy = 0;
  for (const c of cells) {
    const p = axialToPixel(c, 1, { x: 0, y: 0 });
    cx += p.x;
    cy += p.y;
  }
  return { x: cx / cells.length, y: cy / cells.length };
}

function drawPassableItemGlow(
  ctx: CanvasRenderingContext2D,
  pixel: Point2,
  bgRadius: number,
  taken: boolean,
): void {
  const glowRadius = bgRadius * RESOURCE_GLOW_RADIUS_SCALE;
  const glowAlpha = taken ? TAKEN_RESOURCE_GLOW_ALPHA : RESOURCE_GLOW_ALPHA;
  const glowGrad = ctx.createRadialGradient(pixel.x, pixel.y, 0, pixel.x, pixel.y, glowRadius);
  glowGrad.addColorStop(0, NEXUS_ITEM_GLOW_COLOR + hexAlphaSuffix(glowAlpha));
  glowGrad.addColorStop(1, NEXUS_ITEM_GLOW_COLOR + '00');
  ctx.beginPath();
  ctx.arc(pixel.x, pixel.y, glowRadius, 0, Math.PI * 2);
  ctx.fillStyle = glowGrad;
  ctx.fill();
}

function drawPassableItemBackground(
  ctx: CanvasRenderingContext2D,
  pixel: Point2,
  bgRadius: number,
  taken: boolean,
): void {
  ctx.beginPath();
  ctx.arc(pixel.x, pixel.y, bgRadius, 0, Math.PI * 2);
  ctx.fillStyle = taken ? TAKEN_GLYPH_BG_FILL_COLOR : GLYPH_BG_FILL_COLOR;
  ctx.fill();
  ctx.strokeStyle = taken ? TAKEN_GLYPH_BG_STROKE_COLOR : GLYPH_BG_STROKE_COLOR;
  ctx.lineWidth = GLYPH_BG_STROKE_WIDTH;
  ctx.stroke();
}

function drawImpassableStoneShell(
  ctx: CanvasRenderingContext2D,
  group: NexusPlacementGroup,
  origin: Point2,
  hexSize: number,
  stoneHexSize: number,
): { centerPixel: Point2 } | null {
  const loops = computeHexBoundary(group.cells);
  if (loops.length === 0) return null;

  const centerUnit = getGroupCenterUnit(group.cells);
  const stoneOrigin = {
    x: origin.x + centerUnit.x * (hexSize - stoneHexSize),
    y: origin.y + centerUnit.y * (hexSize - stoneHexSize),
  };

  ctx.save();
  traceBoundaryPath(ctx, loops, stoneOrigin, stoneHexSize, STONE_SHADOW_OFFSET);
  ctx.fillStyle = STONE_SHADOW_COLOR;
  ctx.fill('evenodd');
  ctx.restore();

  ctx.save();
  traceBoundaryPath(ctx, loops, stoneOrigin, stoneHexSize);

  let minY = Infinity;
  let maxY = -Infinity;
  for (const loop of loops) {
    for (const p of loop) {
      const py = stoneOrigin.y + p.y * stoneHexSize;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
  }
  const stoneGrad = ctx.createLinearGradient(0, minY, 0, maxY);
  stoneGrad.addColorStop(0, STONE_FILL_TOP);
  stoneGrad.addColorStop(0.45, STONE_FILL_MID);
  stoneGrad.addColorStop(1, STONE_FILL_BOT);
  ctx.fillStyle = stoneGrad;
  ctx.fill('evenodd');

  traceBoundaryPath(ctx, loops, stoneOrigin, stoneHexSize);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = STONE_OUTER_STROKE_COLOR;
  ctx.lineWidth = STONE_OUTER_STROKE_WIDTH;
  ctx.stroke();

  traceBoundaryPath(ctx, loops, stoneOrigin, stoneHexSize);
  ctx.strokeStyle = STONE_INNER_STROKE_COLOR;
  ctx.lineWidth = STONE_INNER_STROKE_WIDTH;
  ctx.stroke();
  ctx.restore();

  return {
    centerPixel: {
      x: origin.x + centerUnit.x * hexSize,
      y: origin.y + centerUnit.y * hexSize,
    },
  };
}

const defaultNexusItemRenderer: MazeNexusItemRenderer = {
  renderPassableGroup(args: MazeNexusPassableRendererArgs): void {
    const { ctx, game, origin, hexSize, glyphSize, group, takenSet } = args;
    const def = game.lib.nexusItems.get(group.nexusId)!;
    const pid = def.placableInstanceDescription;
    const bgRadius = glyphSize * GLYPH_BG_RADIUS_SCALE;
    const text = def.glyph || def.name.charAt(0);
    const centerUnit = getGroupCenterUnit(group.cells);
    const centerPixel = { x: origin.x + centerUnit.x * hexSize, y: origin.y + centerUnit.y * hexSize };

    let anyTaken = false;
    const visualCells: NexusVisualCell[] = [];
    for (const cellAxial of group.cells) {
      const pixel = axialToPixel(cellAxial, hexSize, origin);
      const taken = takenSet.has(`${cellAxial.x},${cellAxial.y}`);
      anyTaken ||= taken;

      ctx.save();
      drawPassableItemGlow(ctx, pixel, bgRadius, taken);
      if (pid.showStandardBackground) {
        drawPassableItemBackground(ctx, pixel, bgRadius, taken);
      }
      ctx.restore();

      visualCells.push({
        pixel,
        glyphColor: taken ? TAKEN_GLYPH_COLOR : NEXUS_ITEM_COLOR,
        imageOpacityMul: taken ? 0.35 : 1,
        glyphOpacityMul: 1,
      });
    }

    drawNexusItemVisuals({
      ctx,
      cells: visualCells,
      centerPixel,
      imageKey: pid.image,
      iconMaxSize: hexSize * 1.2,
      glyphText: text,
      glyphSize,
      glyphPlacement: pid.glyphPlacement,
      opacity: pid.opacity,
      centerGlyphColor: anyTaken ? TAKEN_GLYPH_COLOR : NEXUS_ITEM_COLOR,
      centerGlyphOpacityMul: 1,
    });

  },

  renderImpassableGroup(args: MazeNexusImpassableRendererArgs): void {
    const { ctx, game, origin, hexSize, stoneHexSize, group, takenSet } = args;
    const shell = drawImpassableStoneShell(ctx, group, origin, hexSize, stoneHexSize);
    if (shell === null) return;

    const def = game.lib.nexusItems.get(group.nexusId)!;
    const pid = def.placableInstanceDescription;
    const text = def.glyph || def.name.charAt(0);
    const glyphSize = Math.max(12, stoneHexSize * 1.05);

    let anyTaken = false;
    const visualCells: NexusVisualCell[] = [];
    for (const cellAxial of group.cells) {
      const pixel = axialToPixel(cellAxial, hexSize, origin);
      const taken = takenSet.has(`${cellAxial.x},${cellAxial.y}`);
      anyTaken ||= taken;

      visualCells.push({
        pixel,
        glyphColor: taken ? TAKEN_GLYPH_COLOR : NEXUS_ITEM_COLOR,
        imageOpacityMul: taken ? 0.35 : 1,
        glyphOpacityMul: 1,
      });
    }

    drawNexusItemVisuals({
      ctx,
      cells: visualCells,
      centerPixel: shell.centerPixel,
      imageKey: pid.image,
      iconMaxSize: stoneHexSize * 1.2,
      glyphText: text,
      glyphSize,
      glyphPlacement: pid.glyphPlacement,
      opacity: pid.opacity,
      centerGlyphColor: anyTaken ? TAKEN_GLYPH_COLOR : NEXUS_ITEM_COLOR,
      centerGlyphOpacityMul: 1,
    });

  },
};

function resolveNexusItemRenderer(nexusId: string): MazeNexusItemRenderer {
  return mazeNexusItemRendererRegistry.get(nexusId) ?? defaultNexusItemRenderer;
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
  const takenSet = buildTakenSet(takenCells, visuallyTakenCellKeys);

  const ownedEntrances = getOwnedMazeEntrances(game);
  for (const entrance of ownedEntrances) {
    const center = axialToPixel(entrance, hexSize, origin);
    drawMazeResearchSymbol(ctx, game, center, hexSize, 'disc_maze_navigation', ENTRANCE_ICON_SCALE);
  }

  const ownedNexuses = getOwnedMazeNexuses(game);
  for (const nexus of ownedNexuses) {
    const center = axialToPixel(nexus, hexSize, origin);
    drawMazeResearchSymbol(ctx, game, center, hexSize, 'disc_maze_nexus', NEXUS_ICON_SCALE);
  }

  const spawns = game.mazeResourceSpawns;
  const glyphSize = Math.max(12, hexSize * 1.05);

  for (const spawn of spawns) {
    const cellKey = `${spawn.cell.x},${spawn.cell.y}`;
    const pixel = axialToPixel(spawn.cell, hexSize, origin);
    const taken = takenSet.has(cellKey);
    const highlighted = highlightedResourceCellKeys?.has(cellKey) === true;
    const spec = RESOURCE_SPECS[spawn.resourceKey];
    const scale = highlighted ? RESOURCE_HIGHLIGHT_SCALE : 1;
    const bgRadius = glyphSize * GLYPH_BG_RADIUS_SCALE * scale;
    const glyphYOffset = spawn.resourceKey === 'credits' ? 2 : 1;

    ctx.save();

    const glowRadius = bgRadius * RESOURCE_GLOW_RADIUS_SCALE;
    const glowAlphaBase = taken ? TAKEN_RESOURCE_GLOW_ALPHA : RESOURCE_GLOW_ALPHA;
    const glowAlpha = Math.min(1, glowAlphaBase + (highlighted ? RESOURCE_HIGHLIGHT_GLOW_BOOST : 0));
    const glowGrad = ctx.createRadialGradient(pixel.x, pixel.y, 0, pixel.x, pixel.y, glowRadius);
    glowGrad.addColorStop(0, spec.color + hexAlphaSuffix(glowAlpha));
    glowGrad.addColorStop(1, spec.color + '00');
    ctx.beginPath();
    ctx.arc(pixel.x, pixel.y, glowRadius, 0, Math.PI * 2);
    ctx.fillStyle = glowGrad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(pixel.x, pixel.y, bgRadius, 0, Math.PI * 2);
    ctx.fillStyle = taken ? TAKEN_GLYPH_BG_FILL_COLOR : GLYPH_BG_FILL_COLOR;
    ctx.fill();
    ctx.strokeStyle = taken ? TAKEN_GLYPH_BG_STROKE_COLOR : GLYPH_BG_STROKE_COLOR;
    ctx.lineWidth = GLYPH_BG_STROKE_WIDTH;
    ctx.stroke();

    if (highlighted) {
      ctx.beginPath();
      ctx.arc(pixel.x, pixel.y, bgRadius + (hexSize * 0.12), 0, Math.PI * 2);
      ctx.strokeStyle = spec.color + hexAlphaSuffix(taken ? 0.35 : 0.7);
      ctx.lineWidth = RESOURCE_HIGHLIGHT_RING_STROKE_WIDTH;
      ctx.stroke();
    }

    ctx.font = `bold ${glyphSize * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = taken ? TAKEN_GLYPH_COLOR : spec.color;
    ctx.fillText(spec.glyph, pixel.x, pixel.y + glyphYOffset);
    ctx.restore();
  }

  const impassableGroups = buildNexusPlacementGroups(game, false);
  const stoneHexSize = hexSize * STONE_SHRINK;
  for (const group of impassableGroups) {
    const renderer = resolveNexusItemRenderer(group.nexusId);
    renderer.renderImpassableGroup({
      ctx,
      game,
      origin,
      hexSize,
      stoneHexSize,
      group,
      takenSet,
    });
  }

  const passableGroups = buildNexusPlacementGroups(game, true);
  for (const group of passableGroups) {
    const renderer = resolveNexusItemRenderer(group.nexusId);
    renderer.renderPassableGroup({
      ctx,
      game,
      origin,
      hexSize,
      glyphSize,
      group,
      takenSet,
    });
  }
}
