import type { Point2 } from './ItemLib';
import { axialToPixel } from './HexMath';

/**
 * DrawHex: Hex grid rendering primitives
 * Pure presentation layer - no game logic
 * Uses pointy-top hex orientation
 */

export const UNIT_HEX_POINTS: ReadonlyArray<Point2> = (() => {
    const points: Point2[] = [];
    const angleOffset = Math.PI / 6;
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i + angleOffset;
        points.push({ x: Math.cos(angle), y: Math.sin(angle) });
    }
    return points;
})();

export interface HexDrawOptions {
    fillColor?: string;
    strokeColor?: string;
    lineWidth?: number;
    alpha?: number;
}

export function drawHexagon(
    ctx: CanvasRenderingContext2D,
    center: Point2,
    hexSize: number,
    options: HexDrawOptions = {}
): void {
    const {
        fillColor,
        strokeColor = '#000000',
        lineWidth = 1,
        alpha = 1,
    } = options;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = lineWidth;

    // Draw hexagon path (pointy-top orientation)
    ctx.beginPath();
    for (let i = 0; i < UNIT_HEX_POINTS.length; i++) {
        const p = UNIT_HEX_POINTS[i];
        const x = center.x + hexSize * p.x;
        const y = center.y + hexSize * p.y;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();

    if (fillColor) {
        ctx.fillStyle = fillColor;
        ctx.fill();
    }

    ctx.strokeStyle = strokeColor;
    ctx.stroke();

    ctx.restore();
}

export function drawHexAt(
    ctx: CanvasRenderingContext2D,
    axial: Point2,
    hexSize: number,
    origin: Point2,
    options: HexDrawOptions = {}
): void {
    const pixel = axialToPixel(axial, hexSize, origin);
    drawHexagon(ctx, pixel, hexSize, options);
}

export function drawConnection(
    ctx: CanvasRenderingContext2D,
    from: Point2,
    to: Point2,
    color: string = '#000000',
    lineWidth: number = 2
): void {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    ctx.restore();
}

export function drawConnectionAt(
    ctx: CanvasRenderingContext2D,
    fromAxial: Point2,
    toAxial: Point2,
    hexSize: number,
    origin: Point2,
    color: string = '#000000',
    lineWidth: number = 2
): void {
    const fromPixel = axialToPixel(fromAxial, hexSize, origin);
    const toPixel = axialToPixel(toAxial, hexSize, origin);
    drawConnection(ctx, fromPixel, toPixel, color, lineWidth);
}

export function drawGrid(
    ctx: CanvasRenderingContext2D,
    cells: Point2[],
    hexSize: number,
    origin: Point2,
    options: HexDrawOptions = {}
): void {
    for (const cell of cells) {
        drawHexAt(ctx, cell, hexSize, origin, options);
    }
}

export function drawHighlight(
    ctx: CanvasRenderingContext2D,
    axial: Point2,
    hexSize: number,
    origin: Point2,
    color: string = '#ffff00',
    lineWidth: number = 3
): void {
    const pixel = axialToPixel(axial, hexSize, origin);
    drawHexagon(ctx, pixel, hexSize * 1.1, {
        strokeColor: color,
        lineWidth,
        alpha: 0.8,
    });
}

export interface PlusDrawOptions {
    color?: string;
    lineWidth?: number;
    sizeFactor?: number;
}

export function drawPlus(
    ctx: CanvasRenderingContext2D,
    center: Point2,
    hexSize: number,
    options: PlusDrawOptions = {}
): void {
    const {
        color = '#ffffff',
        lineWidth = 2,
        sizeFactor = 0.4,
    } = options;

    const r = hexSize * sizeFactor;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';

    ctx.beginPath();
    // vertical
    ctx.moveTo(center.x, center.y - r);
    ctx.lineTo(center.x, center.y + r);
    // horizontal
    ctx.moveTo(center.x - r, center.y);
    ctx.lineTo(center.x + r, center.y);
    ctx.stroke();

    ctx.restore();
}

export function drawPlusAt(
    ctx: CanvasRenderingContext2D,
    axial: Point2,
    hexSize: number,
    origin: Point2,
    options: PlusDrawOptions = {}
): void {
    const pixel = axialToPixel(axial, hexSize, origin);
    drawPlus(ctx, pixel, hexSize, options);
}

export function clearRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number
): void {
    ctx.clearRect(x, y, width, height);
}

export function clearCanvas(ctx: CanvasRenderingContext2D): void {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}
