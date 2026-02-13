import type { Molecule } from './ItemLib';
import type { Reward } from './Reward';

export type SignatureMolecule = Omit<Molecule, 'connections'>;

export interface SignatureDefinition {
  id: string;
  name: string;
  level: number;
  group: string;
  molecule: SignatureMolecule;
  color: string;
  rewards: Reward[];
}

export type RawSignatureLayoutDefinition = {
  molecule: SignatureMolecule;
};

export type RawSignatureDefinition = {
  name: string;
  layout: string;
  colors: string[];
  rewards?: readonly Reward[];
  level?: number;
  group?: string;
};

function resolveLayoutColor(color: string, colors: string[]): string {
  const m = /^color_(\d+)$/.exec(color);
  if (!m) return color;
  return colors[Number.parseInt(m[1]!, 10) - 1]!;
}

function computeSignatureColorFromColors(colors: string[]): string {
  const uniqueColors = new Set(colors);
  if (uniqueColors.size === 1) return Array.from(uniqueColors)[0]!;
  return 'white';
}

export function parseSignatureDefinitions(
  rawSignatures: Record<string, RawSignatureDefinition>,
  rawLayouts: Record<string, RawSignatureLayoutDefinition>
): Map<string, SignatureDefinition> {
  function instantiateMolecule(layout: RawSignatureLayoutDefinition, colors: string[]): SignatureMolecule {
    return {
      atoms: layout.molecule.atoms.map(a => ({
        ...a,
        color: resolveLayoutColor(a.color, colors),
      })),
    };
  }

  const map = new Map<string, SignatureDefinition>();
  for (const [id, d] of Object.entries(rawSignatures)) {
    const layout = rawLayouts[d.layout];
    if (!layout) {
      throw new Error(`Signature '${id}': layout '${d.layout}' not found in rawLayouts`);
    }
    const molecule = instantiateMolecule(layout, d.colors);
    map.set(id, {
      id,
      name: d.name,
      level: d.level ?? 1,
      group: d.group ?? 'default',
      molecule,
      color: computeSignatureColorFromColors(d.colors),
      rewards: [...(d.rewards ?? [])],
    });
  }
  return map;
}
