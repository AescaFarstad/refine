import { drawHexagon } from './DrawHex';
import { axialToPixel } from './HexMath';
import { indexToAxial } from './Research';
import type { Point2 } from './ItemLib';
import type { ReadonlyGameState } from './UIState';

const MAZE_CELL_FILL_COLOR = 'rgb(34, 117, 152)';

export function renderMazeBaseLayer(
  ctx: CanvasRenderingContext2D,
  game: ReadonlyGameState,
  origin: Point2,
  hexSize: number,
  cellFillSize: number
): void {
  const cells = game.researchCells;

  for (let idx = 0; idx < cells.length; idx++) {
    const cell = cells[idx]!;
    if (!cell.owned) continue;

    const axial = indexToAxial(idx);
    const center = axialToPixel({ x: axial.x, y: axial.y }, hexSize, origin);

    drawHexagon(ctx, center, cellFillSize, {
      fillColor: MAZE_CELL_FILL_COLOR,
      strokeColor: 'rgba(0, 0, 0, 0)',
      lineWidth: 0,
    });
  }
}
