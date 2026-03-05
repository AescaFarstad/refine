import { isResearchArchetypeRevealedByDiscovery } from './ResearchLib';
import { RESEARCH_PANE_SIZE } from './Const';
import { indexToAxial } from './Research';
import { axialToPixel } from './HexMath';
import { drawHexagon } from './DrawHex';
import type { Point2 } from './ItemLib';
import atlasStorage from './AtlasStorage';
import { computeMaxSquareForHexNode, type MaxSquareResult } from './MaxSquareInHexNode';
import { getResourceSpecByAnyKey } from './Resources';
import { computeHexBoundary } from './hexBoundary';
import type { ReadonlyGameState, ReadonlyLib, ReadonlyResearchArchetype } from './UIState';

type GearIconDefinition = { readonly image: string };

const RESEARCH_COLOR_OWNED_BG = 'rgb(50, 140, 80)';
const RESEARCH_COLOR_UNOWNED_BG = 'rgb(35, 45, 70)';
const RESEARCH_COLOR_SPECIAL_UNOWNED_BG = 'rgb(140, 110, 25)'; // yellowish for special nodes
const RESEARCH_COLOR_OBSTACLE_MARKER = '#444f60';
const RESEARCH_COLOR_OBSTACLE_MARKER_ANTIVOID = '#2b3445';
const HEX_DIRECTION_ROTATION_STEP_RAD = -Math.PI / 3;

interface StatIconSpec {
  offsetX: number;
  offsetY: number;
}

type ResearchStatIconKind = 'glyph' | 'itemImage';

interface ResearchStatIconSpec extends StatIconSpec {
  kind: ResearchStatIconKind;
  key: string;
  scale: number;
}

const RESEARCH_STAT_ICON_SPECS: Record<string, ResearchStatIconSpec> = {
  damage: { kind: 'glyph', key: '✴', offsetX: 0.5, offsetY: 2, scale: 1.0 },
  health: { kind: 'glyph', key: '❤︎', offsetX: 0, offsetY: 3, scale: 1.0 },
  volume: { kind: 'glyph', key: '⌞ ⌝', offsetX: 0, offsetY: 2, scale: 1.0 },
  baseMaxWeight: { kind: 'itemImage', key: 'weight', offsetX: 0.5, offsetY: 0, scale: 1.0 },
  researchRevealRadius: { kind: 'itemImage', key: 'eye', offsetX: 0, offsetY: 0, scale: 1.3 },
  speed: { kind: 'itemImage', key: 'hermes_shoe', offsetX: 0, offsetY: 0, scale: 1.3 },
  itemBans: { kind: 'glyph', key: '✕', offsetX: 0, offsetY: 3, scale: 1.2 },
  uniqueItemsBonusYield: { kind: 'itemImage', key: 'recycle_3', offsetX: 0, offsetY: 3, scale: 1.3 },
};

const RESOURCE_ICON_OFFSETS: Record<string, StatIconSpec> = {
  credits: { offsetX: 0, offsetY: 2 },
  chronotraces: { offsetX: 0, offsetY: 0 },
  timeFlux: { offsetX: 0, offsetY: 1 },
  shards: { offsetX: 0, offsetY: 0 },
  shardDust: { offsetX: 0, offsetY: 0 },
  skillPoints: { offsetX: 0, offsetY: 0 },
};

export function getStatGlyph(statKey: string): string {
  const icon = getStatIcon(statKey);
  return icon.kind === 'glyph' ? icon.key : '⾘';
}

export function getResourceGlyph(resourceKey: string): string {
  return getResourceSpecByAnyKey(resourceKey).glyph;
}

export type ResearchStatIcon =
  | { kind: 'glyph'; key: string }
  | { kind: 'itemImage'; key: string };

export function getStatIcon(statKey: string): ResearchStatIcon {
  const spec = RESEARCH_STAT_ICON_SPECS[statKey];
  if (!spec) return { kind: 'glyph', key: '⾘' };
  return { kind: spec.kind, key: spec.key };
}

const nodeSquareCache: Map<number, MaxSquareResult> = new Map();

export interface ResearchCellInfo {
  idx: number;
  axial: Point2;
  owned: boolean;
  archetypeId: string;
  nodeId: number;
  filledByAntiVoid: boolean;
  centerCell?: Point2;
}

export function renderResearchBaseLayer(
  ctx: CanvasRenderingContext2D,
  game: ReadonlyGameState,
  lib: ReadonlyLib,
  origin: Point2,
  hexSize: number,
  backgroundHexSize: number,
  ownedBackgroundHexSize: number,
): void {
  const cells = game.researchCells;
  if (!cells || cells.length === 0) return;

  const totalCells = RESEARCH_PANE_SIZE * RESEARCH_PANE_SIZE;

  const nodeGroups = new Map<number, ResearchCellInfo[]>();
  const singleCells: ResearchCellInfo[] = [];

  for (let idx = 0; idx < totalCells && idx < cells.length; idx++) {
    const cell = cells[idx];
    if (!cell || !cell.revealed) continue;

    const archetype = lib.research.archetypes.get(cell.archetypeId) || null;
    // Void nodes are never drawn.
    if (archetype && archetype.type === 'void') continue;

    const axial = indexToAxial(idx);
    const nodeInstance = cell.nodeId != null && cell.nodeId >= 0
      ? lib.research.nodes.get(cell.nodeId)
      : null;
    const info: ResearchCellInfo = {
      idx,
      axial: { x: axial.x, y: axial.y },
      owned: cell.owned,
      archetypeId: cell.archetypeId,
      nodeId: cell.nodeId,
      filledByAntiVoid: cell.filledByAntiVoid,
      centerCell: nodeInstance?.centerCell,
    };

    if (cell.nodeId != null && cell.nodeId >= 0) {
      let arr = nodeGroups.get(cell.nodeId);
      if (!arr) {
        arr = [];
        nodeGroups.set(cell.nodeId, arr);
      }
      arr.push(info);
    } else {
      singleCells.push(info);
    }
  }

  nodeGroups.forEach((group) => {
    if (!group.length) return;
    const first = group[0];
    const archetype = lib.research.archetypes.get(first.archetypeId) || null;
    const isOwned = group.some(c => c.owned);
    const groupBackgroundHexSize = isOwned ? ownedBackgroundHexSize : backgroundHexSize;
    const gearDef = getGearDefinitionForArchetype(lib, archetype);

    if (group.length > 1) {
      drawMergedNode(ctx, game, group, archetype, isOwned, origin, hexSize, groupBackgroundHexSize, gearDef);
    } else {
      drawSingleCell(ctx, game, group[0], archetype, isOwned, origin, hexSize, groupBackgroundHexSize, gearDef);
    }
  });

  for (const info of singleCells) {
    const archetype = lib.research.archetypes.get(info.archetypeId) || null;
    if (archetype && archetype.type === 'void') {
      continue;
    }
    const cellBackgroundHexSize = info.owned ? ownedBackgroundHexSize : backgroundHexSize;
    const gearDef = getGearDefinitionForArchetype(lib, archetype);
    drawSingleCell(ctx, game, info, archetype, info.owned, origin, hexSize, cellBackgroundHexSize, gearDef);
  }
}

function getGearDefinitionForArchetype(lib: ReadonlyLib, archetype: ReadonlyResearchArchetype | null): GearIconDefinition | null {
  if (!archetype) return null;
  const reward = archetype.rewards.find(r => r.kind === 'unlock_gear' || r.kind === 'countable_gear');
  if (!reward) return null;
  if (reward.kind === 'unlock_gear' || reward.kind === 'countable_gear') {
    return lib.gear.get(reward.gearId) || null;
  }
  return null;
}

function getVisualStyle(archetype: ReadonlyResearchArchetype | null, owned: boolean): {
  fillColor: string;
} {
  if (owned) {
    return {
      fillColor: RESEARCH_COLOR_OWNED_BG,
    };
  }

  const isSpecial =
    !!archetype &&
    (archetype.type === 'stat' || archetype.type === 'gear' || archetype.type === 'resource' || archetype.type === 'discovery' || archetype.type === 'refining');

  return {
    fillColor: isSpecial ? RESEARCH_COLOR_SPECIAL_UNOWNED_BG : RESEARCH_COLOR_UNOWNED_BG,
  };
}

function traceHexBoundaryPath(
  ctx: CanvasRenderingContext2D,
  loops: readonly (readonly Point2[])[],
  origin: Point2,
  hexSize: number,
): void {
  ctx.beginPath();
  for (const loop of loops) {
    const first = loop[0]!;
    ctx.moveTo(origin.x + first.x * hexSize, origin.y + first.y * hexSize);
    for (let i = 1; i < loop.length; i++) {
      const p = loop[i]!;
      ctx.lineTo(origin.x + p.x * hexSize, origin.y + p.y * hexSize);
    }
    ctx.closePath();
  }
}

interface NodeRenderPlacement {
  centerX: number;
  centerY: number;
  layoutMaxIconSize: number | null;
}

function getCachedNodeLayout(cells: readonly ResearchCellInfo[]): MaxSquareResult | null {
  const nodeId = cells[0]!.nodeId;
  if (nodeId < 0) return null;
  let layout: MaxSquareResult | null | undefined = nodeSquareCache.get(nodeId);
  if (!layout) {
    layout = computeMaxSquareForHexNode(cells.map(info => info.axial));
    if (layout) {
      nodeSquareCache.set(nodeId, layout);
    }
  }
  return layout || null;
}

function computeAverageCellCenter(
  cells: readonly ResearchCellInfo[],
  hexSize: number,
  origin: Point2,
): Point2 {
  let sumX = 0;
  let sumY = 0;
  for (const info of cells) {
    const pixel = axialToPixel(info.axial, hexSize, origin);
    sumX += pixel.x;
    sumY += pixel.y;
  }
  return {
    x: sumX / cells.length,
    y: sumY / cells.length,
  };
}

function computeNodeRenderPlacement(
  cells: readonly ResearchCellInfo[],
  hexSize: number,
  origin: Point2,
): NodeRenderPlacement {
  const layout = getCachedNodeLayout(cells);
  const specifiedCenterCell = cells[0]!.centerCell;

  if (specifiedCenterCell) {
    const pixel = axialToPixel(specifiedCenterCell, hexSize, origin);
    return {
      centerX: pixel.x,
      centerY: pixel.y,
      layoutMaxIconSize: layout ? layout.side * hexSize * 0.9 : null,
    };
  }

  if (layout) {
    return {
      centerX: layout.center.x * hexSize + origin.x,
      centerY: layout.center.y * hexSize + origin.y,
      layoutMaxIconSize: layout.side * hexSize * 0.9,
    };
  }

  const avg = computeAverageCellCenter(cells, hexSize, origin);
  return {
    centerX: avg.x,
    centerY: avg.y,
    layoutMaxIconSize: null,
  };
}

function drawCenteredGlyph(
  ctx: CanvasRenderingContext2D,
  glyph: string,
  centerX: number,
  centerY: number,
  fontSize: number,
  alpha: number,
  rotationRad: number = 0,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(248, 250, 252, 0.96)';
  ctx.translate(centerX, centerY);
  if (rotationRad !== 0) {
    ctx.rotate(rotationRad);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.fillText(glyph, 0, 0);
  ctx.restore();
}

function drawCenteredItemImage(
  ctx: CanvasRenderingContext2D,
  imageKey: string,
  centerX: number,
  centerY: number,
  maxIconSize: number,
  alpha: number,
  scaleMultiplier: number = 1,
  rotationRad: number = 0,
): void {
  const source = atlasStorage.getItemsSource();
  const frame = atlasStorage.getItemsFrame(imageKey);
  if (!source || !frame) return;

  const scale = Math.min(maxIconSize / frame.w, maxIconSize / frame.h) * scaleMultiplier;
  const drawW = frame.w * scale;
  const drawH = frame.h * scale;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(centerX, centerY);
  if (rotationRad !== 0) {
    ctx.rotate(rotationRad);
  }
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

function drawMergedNode(
  ctx: CanvasRenderingContext2D,
  game: ReadonlyGameState,
  cells: ResearchCellInfo[],
  archetype: ReadonlyResearchArchetype | null,
  owned: boolean,
  origin: Point2,
  hexSize: number,
  backgroundHexSize: number,
  gearDef: GearIconDefinition | null
): void {
  const style = getVisualStyle(archetype, owned);
  const loops = computeHexBoundary(cells.map((cell) => cell.axial)).map(loop => loop.points);
  const placement = computeNodeRenderPlacement(cells, 1, { x: 0, y: 0 });

  const mergedOrigin: Point2 = {
    x: origin.x + placement.centerX * (hexSize - backgroundHexSize),
    y: origin.y + placement.centerY * (hexSize - backgroundHexSize),
  };

  ctx.save();
  ctx.fillStyle = style.fillColor;
  ctx.globalAlpha = 1;
  traceHexBoundaryPath(ctx, loops, mergedOrigin, backgroundHexSize);
  ctx.fill('evenodd');

  // Preserve original per-hex diminished footprint at the outer boundary
  // while the merged boundary fill removes internal seams.
  for (const info of cells) {
    const center = axialToPixel(info.axial, hexSize, origin);
    drawHexagon(ctx, center, backgroundHexSize, {
      fillColor: style.fillColor,
      strokeColor: 'rgba(0, 0, 0, 0)',
      lineWidth: 0,
    });
  }
  ctx.restore();

  drawNodeOverlay(ctx, game, cells, archetype, owned, origin, hexSize, gearDef);
}

function drawSingleCell(
  ctx: CanvasRenderingContext2D,
  game: ReadonlyGameState,
  info: ResearchCellInfo,
  archetype: ReadonlyResearchArchetype | null,
  owned: boolean,
  origin: Point2,
  hexSize: number,
  backgroundHexSize: number,
  gearDef: GearIconDefinition | null
): void {
  const style = getVisualStyle(archetype, owned);
  const center = axialToPixel(info.axial, hexSize, origin);
  const isObstacleLike = !!archetype && archetype.type === 'obstacle';

  if (!isObstacleLike || owned) {
    drawHexagon(ctx, center, backgroundHexSize, {
      fillColor: style.fillColor,
      strokeColor: 'rgba(0, 0, 0, 0)',
      lineWidth: 0,
    });
  }

  drawNodeOverlay(ctx, game, [info], archetype, owned, origin, hexSize, gearDef);
}

function drawNodeOverlay(
  ctx: CanvasRenderingContext2D,
  game: ReadonlyGameState,
  cells: ResearchCellInfo[],
  archetype: ReadonlyResearchArchetype | null,
  owned: boolean,
  origin: Point2,
  hexSize: number,
  gearDef: GearIconDefinition | null
): void {
  if (!archetype) return;

  const type = archetype.type;

  if (type === 'obstacle') {
    if (owned) return;
    drawObstacleMarkerForNode(ctx, cells, origin, hexSize);
    if (archetype.icon.kind !== 'none') {
      const iconRotationRad = archetype.obstacleVisual.direction * HEX_DIRECTION_ROTATION_STEP_RAD;
      drawArchetypeIconForNode(ctx, game, cells, archetype, owned, origin, hexSize, iconRotationRad);
    }
    return;
  }

  if (type === 'gear' && gearDef) {
    drawGearIconForNode(ctx, cells, gearDef, owned, origin, hexSize);
    return;
  }

  if (archetype.icon.kind !== 'none') {
    drawArchetypeIconForNode(ctx, game, cells, archetype, owned, origin, hexSize);
    return;
  }

  if (type === 'stat') {
    drawStatIconForNode(ctx, cells, archetype, owned, origin, hexSize);
    return;
  }

  if (type === 'resource') {
    drawResourceIconForNode(ctx, cells, archetype, owned, origin, hexSize);
    return;
  }
}

function drawObstacleMarkerForNode(
  ctx: CanvasRenderingContext2D,
  cells: ResearchCellInfo[],
  origin: Point2,
  hexSize: number
): void {
  const radius = hexSize * 0.75;

  ctx.save();

  for (const info of cells) {
    ctx.fillStyle = info.filledByAntiVoid
      ? RESEARCH_COLOR_OBSTACLE_MARKER_ANTIVOID
      : RESEARCH_COLOR_OBSTACLE_MARKER;
    const p = axialToPixel(info.axial, hexSize, origin);
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawArchetypeIconForNode(
  ctx: CanvasRenderingContext2D,
  game: ReadonlyGameState,
  cells: ResearchCellInfo[],
  archetype: ReadonlyResearchArchetype,
  owned: boolean,
  origin: Point2,
  hexSize: number,
  iconRotationRad: number = 0
): void {
  if (!cells.length) return;

  const isRevealedByDiscovery = isResearchArchetypeRevealedByDiscovery(archetype, game.discoveries);
  const icon = (owned && archetype.ownedIcon)
      ? archetype.ownedIcon
      : isRevealedByDiscovery
        ? archetype.revealedIcon
      : archetype.icon;
  if (icon.kind === 'none') return;
  const placement = computeNodeRenderPlacement(cells, hexSize, origin);
  const centerX = placement.centerX;
  const centerY = placement.centerY;
  const maxIconSize = placement.layoutMaxIconSize;

  if (icon.kind === 'glyph') {
    if (archetype.type === 'obstacle') {
      const iconScale = icon.scale ?? 1;
      const iconOffset = icon.offset ?? { x: 0, y: 0 };
      drawCenteredObstacleArrowIcon(
        ctx,
        centerX + iconOffset.x,
        centerY + iconOffset.y,
        maxIconSize,
        hexSize,
        iconScale,
        iconRotationRad,
        owned ? 1 : 0.95,
      );
      return;
    }

    const iconScale = icon.scale ?? 1;
    const iconOffset = icon.offset ?? { x: 0, y: 0 };
    const baseSize = hexSize * 1.05;
    const glyphSize = baseSize * iconScale;
    const fontSize = Math.max(12, glyphSize);
    drawCenteredGlyph(
      ctx,
      icon.glyph,
      centerX + iconOffset.x,
      centerY + iconOffset.y + 2,
      fontSize,
      owned ? 1 : 0.95,
      iconRotationRad,
    );
    return;
  }

  const iconScale = icon.scale ?? 1;
  const iconOffset = icon.offset ?? { x: 0, y: 0 };
  drawCenteredItemImage(
    ctx,
    icon.key,
    centerX + iconOffset.x,
    centerY + iconOffset.y,
    (maxIconSize != null ? maxIconSize : hexSize * 1.6) * 0.75,
    owned ? 1 : 0.9,
    iconScale,
    iconRotationRad,
  );
}

function drawCenteredObstacleArrowIcon(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  maxIconSize: number | null,
  hexSize: number,
  iconScale: number,
  iconRotationRad: number,
  alpha: number,
): void {
  const base = maxIconSize != null ? maxIconSize : hexSize * 1.12;
  const size = Math.max(6, base * 0.63 * iconScale);
  const points: Point2[] = [
    // Symbol-like arrow silhouette (similar to ➤), points to +X.
    { x: 0.66 * size, y: 0 },
    { x: -0.2 * size, y: -0.5 * size },
    { x: -0.06 * size, y: -0.1 * size },
    { x: -0.62 * size, y: -0.06 * size },
    { x: -0.62 * size, y: 0.06 * size },
    { x: -0.06 * size, y: 0.1 * size },
    { x: -0.2 * size, y: 0.5 * size },
  ];
  const centroid = polygonCentroid(points);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(248, 250, 252, 0.96)';
  ctx.translate(centerX, centerY);
  if (iconRotationRad !== 0) {
    ctx.rotate(iconRotationRad);
  }

  ctx.beginPath();
  ctx.moveTo(points[0]!.x - centroid.x, points[0]!.y - centroid.y);
  for (let i = 1; i < points.length; i++) {
    const p = points[i]!;
    ctx.lineTo(p.x - centroid.x, p.y - centroid.y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function polygonCentroid(points: Point2[]): Point2 {
  let area2 = 0;
  let cx = 0;
  let cy = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const p0 = points[i]!;
    const p1 = points[(i + 1) % n]!;
    const cross = p0.x * p1.y - p1.x * p0.y;
    area2 += cross;
    cx += (p0.x + p1.x) * cross;
    cy += (p0.y + p1.y) * cross;
  }

  const area = area2 * 0.5;
  if (area === 0) {
    return { x: 0, y: 0 };
  }

  const inv = 1 / (6 * area);
  return { x: cx * inv, y: cy * inv };
}

function getStatIconSpec(statKey: string | undefined): ResearchStatIconSpec | null {
  if (!statKey) return null;
  const spec = RESEARCH_STAT_ICON_SPECS[statKey];
  return spec || null;
}

function drawStatIconForNode(
  ctx: CanvasRenderingContext2D,
  cells: ResearchCellInfo[],
  archetype: ReadonlyResearchArchetype,
  owned: boolean,
  origin: Point2,
  hexSize: number
): void {
  const reward = archetype.rewards.find(r => r.kind === 'stat');
  if (!reward || reward.kind !== 'stat') return;
  const spec = getStatIconSpec(reward.stat);
  if (!spec) return;
  if (!cells.length) return;
  const placement = computeNodeRenderPlacement(cells, hexSize, origin);
  let centerX = placement.centerX;
  let centerY = placement.centerY;
  const layoutMaxIconSize = placement.layoutMaxIconSize;

  centerX += spec.offsetX;
  centerY += spec.offsetY;

  if (spec.kind === 'glyph') {
    const glyphSize = layoutMaxIconSize != null ? layoutMaxIconSize : hexSize * 1.1;
    const fontSize = Math.max(12, glyphSize * spec.scale);
    drawCenteredGlyph(ctx, spec.key, centerX, centerY, fontSize, owned ? 1 : 0.95);
    return;
  }
  drawCenteredItemImage(
    ctx,
    spec.key,
    centerX,
    centerY,
    (layoutMaxIconSize != null ? layoutMaxIconSize : hexSize * 1.6) * 0.75,
    owned ? 1 : 0.9,
    spec.scale,
  );
}

function drawResourceIconForNode(
  ctx: CanvasRenderingContext2D,
  cells: ResearchCellInfo[],
  archetype: ReadonlyResearchArchetype,
  owned: boolean,
  origin: Point2,
  hexSize: number
): void {
  const reward = archetype.rewards.find(r => r.kind === 'resource');
  if (!reward || reward.kind !== 'resource') return;
  const resourceKey = reward.resource;
  if (!resourceKey) return;
  if (!cells.length) return;

  const offsets = RESOURCE_ICON_OFFSETS[resourceKey]!;
  const glyph = getResourceSpecByAnyKey(resourceKey).glyph;
  const placement = computeNodeRenderPlacement(cells, hexSize, origin);
  let centerX = placement.centerX;
  let centerY = placement.centerY;
  const maxIconSize = placement.layoutMaxIconSize;

  centerX += offsets.offsetX;
  centerY += offsets.offsetY;

  const glyphSize = maxIconSize != null ? maxIconSize : hexSize * 1.1;
  const fontSize = Math.max(12, glyphSize);
  drawCenteredGlyph(ctx, glyph, centerX, centerY, fontSize, owned ? 1 : 0.95);
}

function drawGearIconForNode(
  ctx: CanvasRenderingContext2D,
  cells: ResearchCellInfo[],
  gearDef: GearIconDefinition,
  owned: boolean,
  origin: Point2,
  hexSize: number
): void {
  const imageKey = gearDef.image;
  if (!imageKey) return;
  const placement = computeNodeRenderPlacement(cells, hexSize, origin);
  drawCenteredItemImage(
    ctx,
    imageKey,
    placement.centerX,
    placement.centerY,
    placement.layoutMaxIconSize != null ? placement.layoutMaxIconSize : hexSize * 1.6,
    owned ? 1 : 0.9,
  );
}
