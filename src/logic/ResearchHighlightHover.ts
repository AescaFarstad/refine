export type ResearchHighlightHover =
  | { kind: 'resource'; archetypeId: string }
  | { kind: 'stat'; archetypeId: string }
  | { kind: 'discovery' };
