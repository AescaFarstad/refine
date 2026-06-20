import { axialToPixel } from '../logic/HexMath';
import { getOracleWaferCells, getOracleWaferCellKey } from '../logic/Oracle';
import type { Point2 } from '../logic/core/math';

export const ORACLE_WAFER_HEX_SIZE = 16;
const STROKE_PADDING = 2;

function hexCorners(center: Point2): Point2[] {
  const points: Point2[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = ((60 * i) - 30) * (Math.PI / 180);
    points.push({
      x: center.x + ORACLE_WAFER_HEX_SIZE * Math.cos(angle),
      y: center.y + ORACLE_WAFER_HEX_SIZE * Math.sin(angle),
    });
  }
  return points;
}

const centers = getOracleWaferCells().map(point => axialToPixel(point, ORACLE_WAFER_HEX_SIZE));
const corners = centers.flatMap(hexCorners);
const minX = Math.min(...corners.map(point => point.x));
const minY = Math.min(...corners.map(point => point.y));
const maxX = Math.max(...corners.map(point => point.x));
const maxY = Math.max(...corners.map(point => point.y));

export const oracleWaferSvg = {
  width: maxX - minX + STROKE_PADDING * 2,
  height: maxY - minY + STROKE_PADDING * 2,
};

export const oracleWaferVisualCells = getOracleWaferCells().map((point) => {
  const center = axialToPixel(point, ORACLE_WAFER_HEX_SIZE);
  const shiftedCenter = {
    x: center.x - minX + STROKE_PADDING,
    y: center.y - minY + STROKE_PADDING,
  };
  return {
    key: getOracleWaferCellKey(point),
    point,
    center: shiftedCenter,
    points: hexCorners(shiftedCenter).map(corner => `${corner.x},${corner.y}`).join(' '),
  };
});
