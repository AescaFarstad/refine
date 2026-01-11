import type { Molecule } from './ItemLib';

export type SignatureMolecule = Omit<Molecule, 'connections'>;

export interface SignatureDefinition {
  id: string;
  name: string;
  level: number;
  group: string;
  molecule: SignatureMolecule;
}

export type RawSignatureDefinition = {
  name: string;
  level?: number;
  group?: string;
  molecule?: SignatureMolecule;
};

export function parseSignatureDefinitions(raw: Record<string, RawSignatureDefinition>): Map<string, SignatureDefinition> {
  const defaultMolecule: SignatureMolecule = {
    atoms: [{ color: 'gray', x: 0, y: 0 }],
  };

  const map = new Map<string, SignatureDefinition>();
  for (const [id, d] of Object.entries(raw)) {
    map.set(id, {
      id,
      name: d.name,
      level: d.level ?? 1,
      group: d.group ?? 'default',
      molecule: d.molecule ?? defaultMolecule,
    });
  }
  return map;
}
