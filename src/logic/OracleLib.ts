export interface OracleDefinition {
  id: string;
  signatureId: string;
  riddle: string;
}

export type RawOracleDefinition = Omit<OracleDefinition, 'id'>;

export function parseOracleDefinitions(
  raw: Record<string, RawOracleDefinition>
): Map<string, OracleDefinition> {
  const result = new Map<string, OracleDefinition>();
  for (const [id, def] of Object.entries(raw)) {
    result.set(id, {
      id,
      signatureId: def.signatureId,
      riddle: def.riddle,
    });
  }
  return result;
}
