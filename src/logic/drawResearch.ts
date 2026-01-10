import type { GameState } from './GameState';
import type { ResearchArchetype } from './ResearchLib';
import type { Lib } from './Lib';
import type { GearDefinition } from './GearLib';
import { RESEARCH_PANE_SIZE } from './Const';
import { indexToAxial } from './Research';
import { axialToPixel } from './HexMath';
import { drawHexagon } from './DrawHex';
import type { Point2 } from './ItemLib';
import atlasStorage from './AtlasStorage';
import { computeMaxSquareForHexNode, type MaxSquareResult } from './MaxSquareInHexNode';
import { getResourceSpecByAnyKey } from './Resources';

const RESEARCH_COLOR_OWNED_BG = 'rgb(50, 140, 80)';
const RESEARCH_COLOR_UNOWNED_BG = 'rgb(35, 45, 70)';
const RESEARCH_COLOR_SPECIAL_OVERT_UNOWNED_BG = 'rgb(140, 110, 25)'; // yellowish for special nodes
const RESEARCH_COLOR_OBSTACLE_MARKER = 'rgba(131, 145, 164, 0.9)';

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
  speed: { kind: 'itemImage', key: 'trainers', offsetX: 0, offsetY: 0, scale: 1.0 },
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
}

export function renderResearchBaseLayer(
  ctx: CanvasRenderingContext2D,
  game: GameState,
  lib: Lib,
  origin: Point2,
  hexSize: number,
  backgroundHexSize: number
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
    const info: ResearchCellInfo = {
      idx,
      axial: { x: axial.x, y: axial.y },
      owned: cell.owned,
      archetypeId: cell.archetypeId,
      nodeId: cell.nodeId,
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
    const gearDef = getGearDefinitionForArchetype(lib, archetype);

    if (group.length > 1) {
      drawMergedNode(ctx, group, archetype, isOwned, origin, hexSize, backgroundHexSize, gearDef);
    } else {
      drawSingleCell(ctx, group[0], archetype, isOwned, origin, hexSize, backgroundHexSize, gearDef);
    }
  });

  for (const info of singleCells) {
    const archetype = lib.research.archetypes.get(info.archetypeId) || null;
    if (archetype && archetype.type === 'void') {
      continue;
    }
    const gearDef = getGearDefinitionForArchetype(lib, archetype);
    drawSingleCell(ctx, info, archetype, info.owned, origin, hexSize, backgroundHexSize, gearDef);
  }
}

function getGearDefinitionForArchetype(lib: Lib, archetype: ResearchArchetype | null): GearDefinition | null {
  if (!archetype) return null;
  const reward = archetype.rewards.find(r => r.kind === 'unlock_gear');
  if (!reward || reward.kind !== 'unlock_gear') return null;
  return lib.gear.get(reward.gearId) || null;
}

function getVisualStyle(archetype: ResearchArchetype | null, owned: boolean): {
  fillColor: string;
} {
  if (owned) {
    return {
      fillColor: RESEARCH_COLOR_OWNED_BG,
    };
  }

  const isSpecialOvert =
    !!archetype &&
    !archetype.covert &&
    (archetype.type === 'stat' || archetype.type === 'gear' || archetype.type === 'resource' || archetype.type === 'discovery');

  return {
    fillColor: isSpecialOvert ? RESEARCH_COLOR_SPECIAL_OVERT_UNOWNED_BG : RESEARCH_COLOR_UNOWNED_BG,
  };
}

function drawMergedNode(
  ctx: CanvasRenderingContext2D,
  cells: ResearchCellInfo[],
  archetype: ResearchArchetype | null,
  owned: boolean,
  origin: Point2,
  hexSize: number,
  backgroundHexSize: number,
  gearDef: GearDefinition | null
): void {
  const style = getVisualStyle(archetype, owned);
  ctx.save();
  ctx.fillStyle = style.fillColor;
  ctx.globalAlpha = 1;
  ctx.beginPath();

  for (const info of cells) {
    const center = axialToPixel(info.axial, hexSize, origin);
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i + Math.PI / 6;
      const x = center.x + backgroundHexSize * Math.cos(angle);
      const y = center.y + backgroundHexSize * Math.sin(angle);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
  }

  ctx.fill();
  ctx.restore();

  drawNodeOverlay(ctx, cells, archetype, owned, origin, hexSize, gearDef);
}

function drawSingleCell(
  ctx: CanvasRenderingContext2D,
  info: ResearchCellInfo,
  archetype: ResearchArchetype | null,
  owned: boolean,
  origin: Point2,
  hexSize: number,
  backgroundHexSize: number,
  gearDef: GearDefinition | null
): void {
  const style = getVisualStyle(archetype, owned);
  const center = axialToPixel(info.axial, hexSize, origin);

  drawHexagon(ctx, center, backgroundHexSize, {
    fillColor: style.fillColor,
    strokeColor: 'rgba(0, 0, 0, 0)',
    lineWidth: 0,
  });

  drawNodeOverlay(ctx, [info], archetype, owned, origin, hexSize, gearDef);
}

function drawNodeOverlay(
  ctx: CanvasRenderingContext2D,
  cells: ResearchCellInfo[],
  archetype: ResearchArchetype | null,
  owned: boolean,
  origin: Point2,
  hexSize: number,
  gearDef: GearDefinition | null
): void {
  if (!archetype) return;

  const type = archetype.type;
  const covert = !!archetype.covert;
  const isObstacleLike = type === 'obstacle' || covert;

  // Gear nodes: draw the gear icon centered over the combined cell area
  if (type === 'gear' && gearDef) {
    drawGearIconForNode(ctx, cells, gearDef, owned, origin, hexSize);
    return;
  }

  if (!covert && archetype.icon.kind !== 'none') {
    drawArchetypeIconForNode(ctx, cells, archetype, owned, origin, hexSize);
    return;
  }

  // Overt stat nodes: draw the stat icon (e.g. damage ✴) instead of obstacle markers.
  if (type === 'stat' && !covert) {
    drawStatIconForNode(ctx, cells, archetype, owned, origin, hexSize);
    return;
  }

  // Resource nodes: draw the resource icon
  if (type === 'resource' && !covert) {
    drawResourceIconForNode(ctx, cells, archetype, owned, origin, hexSize);
    return;
  }

  // Owned obstacle/covert nodes are visually treated as empty: no overlay.
  if (owned || !isObstacleLike) return;

  const radius = hexSize * 0.35;

  ctx.save();
  ctx.fillStyle = RESEARCH_COLOR_OBSTACLE_MARKER; // gray circle

  for (const info of cells) {
    const p = axialToPixel(info.axial, hexSize, origin);
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawArchetypeIconForNode(
  ctx: CanvasRenderingContext2D,
  cells: ResearchCellInfo[],
  archetype: ResearchArchetype,
  owned: boolean,
  origin: Point2,
  hexSize: number
): void {
  if (!cells.length) return;

  const icon = archetype.icon;
  if (icon.kind === 'none') return;

  const nodeId = cells[0].nodeId;
  const axialCells: Point2[] = cells.map(info => info.axial);

  let layout: MaxSquareResult | null | undefined = nodeId >= 0 ? nodeSquareCache.get(nodeId) : null;
  if (!layout) {
    layout = computeMaxSquareForHexNode(axialCells);
    if (layout && nodeId >= 0) {
      nodeSquareCache.set(nodeId, layout);
    }
  }

  let centerX: number;
  let centerY: number;
  let maxIconSize: number | null = null;

  if (layout) {
    centerX = layout.center.x * hexSize + origin.x;
    centerY = layout.center.y * hexSize + origin.y;
    maxIconSize = layout.side * hexSize * 0.9;
  } else {
    let sumX = 0;
    let sumY = 0;
    for (const cellInfo of cells) {
      const pixel = axialToPixel(cellInfo.axial, hexSize, origin);
      sumX += pixel.x;
      sumY += pixel.y;
    }
    centerX = sumX / cells.length;
    centerY = sumY / cells.length;
  }

  let fontSize = hexSize * 1.05;
  fontSize = Math.max(12, fontSize);
  if (maxIconSize != null) {
    fontSize = Math.min(fontSize, maxIconSize);
  }

  if (icon.kind === 'glyph') {
    ctx.save();
    ctx.globalAlpha = owned ? 1 : 0.95;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillStyle = 'rgba(248, 250, 252, 0.96)';
    ctx.fillText(icon.glyph, centerX, centerY + 2);
    ctx.restore();
    return;
  }

  const source = atlasStorage.getItemsSource();
  const frame = atlasStorage.getItemsFrame(icon.key);
  if (!source || !frame) return;

  const iconMaxSize = (maxIconSize != null ? maxIconSize : hexSize * 1.6) * 0.75;
  const scale = Math.min(iconMaxSize / frame.w, iconMaxSize / frame.h);
  const drawW = frame.w * scale;
  const drawH = frame.h * scale;

  ctx.save();
  ctx.globalAlpha = owned ? 1 : 0.9;
  ctx.translate(centerX, centerY);
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

function getStatIconSpec(statKey: string | undefined): ResearchStatIconSpec | null {
  if (!statKey) return null;
  const spec = RESEARCH_STAT_ICON_SPECS[statKey];
  return spec || null;
}

function drawStatIconForNode(
  ctx: CanvasRenderingContext2D,
  cells: ResearchCellInfo[],
  archetype: ResearchArchetype,
  owned: boolean,
  origin: Point2,
  hexSize: number
): void {
  const reward = archetype.rewards.find(r => r.kind === 'stat');
  if (!reward || reward.kind !== 'stat') return;
  const spec = getStatIconSpec(reward.stat);
  if (!spec) return;
  if (!cells.length) return;

  const nodeId = cells.length > 0 ? cells[0].nodeId : -1;
  const axialCells: Point2[] = cells.map(info => info.axial);

  let layout: MaxSquareResult | null | undefined = nodeId >= 0 ? nodeSquareCache.get(nodeId) : null;
  if (!layout) {
    layout = computeMaxSquareForHexNode(axialCells);
    if (layout && nodeId >= 0) {
      nodeSquareCache.set(nodeId, layout);
    }
  }

  let centerX: number;
  let centerY: number;
  let layoutMaxIconSize: number | null = null;

  if (layout) {
    centerX = layout.center.x * hexSize + origin.x;
    centerY = layout.center.y * hexSize + origin.y;
    layoutMaxIconSize = layout.side * hexSize * 0.9;
  } else {
    let sumX = 0;
    let sumY = 0;
    for (const cellInfo of cells) {
      const pixel = axialToPixel(cellInfo.axial, hexSize, origin);
      sumX += pixel.x;
      sumY += pixel.y;
    }
    centerX = sumX / cells.length;
    centerY = sumY / cells.length;
  }

  let fontSize = hexSize * 1.1;
  fontSize = Math.max(12, fontSize);
  if (layoutMaxIconSize != null) {
    fontSize = Math.min(fontSize, layoutMaxIconSize);
  }

  fontSize *= spec.scale;

  centerX += spec.offsetX;
  centerY += spec.offsetY;

  if (spec.kind === 'glyph') {
    ctx.save();
    ctx.globalAlpha = owned ? 1 : 0.95;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillStyle = 'rgba(248, 250, 252, 0.96)'; // light text on dark background
    ctx.fillText(spec.key, centerX, centerY);
    ctx.restore();
    return;
  }

  const source = atlasStorage.getItemsSource();
  const frame = atlasStorage.getItemsFrame(spec.key);
  if (!source || !frame) return;

  const iconMaxSize = (layoutMaxIconSize != null ? layoutMaxIconSize : hexSize * 1.6) * 0.75;
  const scale = Math.min(iconMaxSize / frame.w, iconMaxSize / frame.h) * spec.scale;
  const drawW = frame.w * scale;
  const drawH = frame.h * scale;

  ctx.save();
  ctx.globalAlpha = owned ? 1 : 0.9;
  ctx.translate(centerX, centerY);
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

function drawResourceIconForNode(
  ctx: CanvasRenderingContext2D,
  cells: ResearchCellInfo[],
  archetype: ResearchArchetype,
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

  const nodeId = cells.length > 0 ? cells[0].nodeId : -1;
  const axialCells: Point2[] = cells.map(info => info.axial);

  let layout: MaxSquareResult | null | undefined = nodeId >= 0 ? nodeSquareCache.get(nodeId) : null;
  if (!layout) {
    layout = computeMaxSquareForHexNode(axialCells);
    if (layout && nodeId >= 0) {
      nodeSquareCache.set(nodeId, layout);
    }
  }

  let centerX: number;
  let centerY: number;
  let maxIconSize: number | null = null;

  if (layout) {
    centerX = layout.center.x * hexSize + origin.x;
    centerY = layout.center.y * hexSize + origin.y;
    maxIconSize = layout.side * hexSize * 0.9;
  } else {
    let sumX = 0;
    let sumY = 0;
    for (const cellInfo of cells) {
      const pixel = axialToPixel(cellInfo.axial, hexSize, origin);
      sumX += pixel.x;
      sumY += pixel.y;
    }
    centerX = sumX / cells.length;
    centerY = sumY / cells.length;
  }

  let fontSize = hexSize * 1.1;
  fontSize = Math.max(12, fontSize);
  if (maxIconSize != null) {
    fontSize = Math.min(fontSize, maxIconSize);
  }

  centerX += offsets.offsetX;
  centerY += offsets.offsetY;

  ctx.save();
  ctx.globalAlpha = owned ? 1 : 0.95;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.fillStyle = 'rgba(248, 250, 252, 0.96)';
  ctx.fillText(glyph, centerX, centerY);
  ctx.restore();
}

function drawGearIconForNode(
  ctx: CanvasRenderingContext2D,
  cells: ResearchCellInfo[],
  gearDef: GearDefinition,
  owned: boolean,
  origin: Point2,
  hexSize: number
): void {
  const imageKey = gearDef.image;
  if (!imageKey) return;

  const source = atlasStorage.getItemsSource();
  const frame = atlasStorage.getItemsFrame(imageKey);
  if (!source || !frame) return;

  // Compute (and cache) the largest square that fits inside this node's hex blob.
  const nodeId = cells.length > 0 ? cells[0].nodeId : -1;
  const axialCells: Point2[] = cells.map(info => info.axial);

  let layout: MaxSquareResult | null | undefined = nodeId >= 0 ? nodeSquareCache.get(nodeId) : null;
  if (!layout) {
    layout = computeMaxSquareForHexNode(axialCells);
    if (layout && nodeId >= 0) {
      nodeSquareCache.set(nodeId, layout);
    }
  }

  let cx: number;
  let cy: number;
  let maxIconSize: number;

  if (layout) {
    // Map from normalized node space (hexSize=1, origin=0) into canvas space.
    cx = layout.center.x * hexSize + origin.x;
    cy = layout.center.y * hexSize + origin.y;
    maxIconSize = layout.side * hexSize * 0.9; // small margin inside the square
  } else {
    // Fallback: center on average of cell centers.
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    for (const info of cells) {
      const p = axialToPixel(info.axial, hexSize, origin);
      sumX += p.x;
      sumY += p.y;
      count++;
    }
    if (!count) return;
    cx = sumX / count;
    cy = sumY / count;
    maxIconSize = hexSize * 1.6;
  }

  const scale = Math.min(maxIconSize / frame.w, maxIconSize / frame.h);
  const drawW = frame.w * scale;
  const drawH = frame.h * scale;

  ctx.save();
  ctx.globalAlpha = owned ? 1 : 0.9;
  ctx.translate(cx, cy);
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
