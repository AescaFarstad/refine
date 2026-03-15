import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

interface PlacementNode {
  archetypeId: string;
  cells: Array<{ x: number; y: number }>;
  oracleSlot?: boolean;
  radius: number;
  centerCell?: { x: number; y: number };
  type: string; // 'gear' | 'stat' | 'resource' | 'discovery' | etc.
  autocenter?: boolean;
  initiallyOwned?: boolean;
}

interface SaveResearchBody {
  placements: PlacementNode[];
  emptyCells: Array<{ x: number; y: number }>;
  voidCells: Array<{ x: number; y: number }>;
}

function formatStringLiteral(value: string): string {
  return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

function formatPoint(point: { x: number; y: number }): string {
  return `{ x: ${point.x}, y: ${point.y} }`;
}

function formatCells(cells: Array<{ x: number; y: number }>): string {
  if (cells.length === 1) {
    return formatPoint(cells[0]!);
  }
  return `[${cells.map(formatPoint).join(', ')}]`;
}

function hasImplicitCenterCell(node: PlacementNode): boolean {
  if (!node.centerCell) return false;
  if (node.radius <= 0) return false;
  if (node.cells.length !== 1) return false;
  const cell = node.cells[0]!;
  return cell.x === node.centerCell.x && cell.y === node.centerCell.y;
}

function formatPlacement(node: PlacementNode): string {
  let line = `  { archetypeId: ${formatStringLiteral(node.archetypeId)}, cells: ${formatCells(node.cells)}`;
  if (node.oracleSlot) {
    line += ', oracleSlot: true';
  }
  if (node.radius > 0) {
    line += `, radius: ${node.radius}`;
  }
  if (node.centerCell && !node.autocenter && !hasImplicitCenterCell(node)) {
    line += `, centerCell: ${formatPoint(node.centerCell)}`;
  }
  if (node.initiallyOwned) {
    line += `, initiallyOwned: true`;
  }
  line += ' },';
  return line;
}

function formatPoint2Array(coords: Array<{ x: number; y: number }>): string {
  const sorted = [...coords].sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
  const lines: string[] = [];
  for (let i = 0; i < sorted.length; i += 6) {
    const chunk = sorted.slice(i, i + 6);
    lines.push('  ' + chunk.map(p => `{ x: ${p.x}, y: ${p.y} }`).join(', ') + ',');
  }
  return lines.join('\n');
}

function buildPaneFile(exportName: string, placements: PlacementNode[]): string {
  const lines = placements.map(formatPlacement);
  return `import type { ResearchPlacementInput } from '../logic/ResearchLib';

export const ${exportName}: ResearchPlacementInput[] = [
${lines.join('\n')}
];
`;
}

export function saveResearchPlugin(): Plugin {
  return {
    name: 'save-research-pane',
    configureServer(server) {
      server.middlewares.use('/__dev/save-research-pane', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }

        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const data: SaveResearchBody = JSON.parse(body);
            const dataDir = path.resolve(__dirname, 'src/data');

            // Split placements by type
            const gear: PlacementNode[] = [];
            const stats: PlacementNode[] = [];
            const special: PlacementNode[] = [];

            for (const node of data.placements) {
              if (node.type === 'gear') {
                gear.push(node);
              } else if (node.type === 'stat' || node.type === 'resource') {
                stats.push(node);
              } else {
                // discovery, refining, hub, etc.
                special.push(node);
              }
            }

            // Write category files
            fs.writeFileSync(path.join(dataDir, 'pane_gear.ts'), buildPaneFile('paneGear', gear));
            fs.writeFileSync(path.join(dataDir, 'pane_stats.ts'), buildPaneFile('paneStats', stats));
            fs.writeFileSync(path.join(dataDir, 'pane_special.ts'), buildPaneFile('paneSpecial', special));

            // Write empty/void cells into research_pane.ts
            const emptyCode = formatPoint2Array(data.emptyCells);
            const voidCode = formatPoint2Array(data.voidCells);

            const researchPaneContent = `import type { ResearchPlacementInput } from '../logic/ResearchLib';
import type { Point2 } from '../logic/core/math';
import { paneGear } from './pane_gear';
import { paneStats } from './pane_stats';
import { paneSpecial } from './pane_special';
export const researchPane: ResearchPlacementInput[] = [...paneSpecial, ...paneGear, ...paneStats,];

export const researchPaneEmptyCells: Point2[] = [
${emptyCode}
];

export const researchPaneVoidCells: Point2[] = [
${voidCode}
];
`;
            fs.writeFileSync(path.join(dataDir, 'research_pane.ts'), researchPaneContent);

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              ok: true,
              counts: {
                gear: gear.length,
                stats: stats.length,
                special: special.length,
                emptyCells: data.emptyCells.length,
                voidCells: data.voidCells.length,
              },
            }));
          } catch (err: any) {
            console.error('[save-research-pane]', err);
            res.statusCode = 500;
            res.end(JSON.stringify({ ok: false, error: err.message }));
          }
        });
      });
    },
  };
}
