// Stub EventDefinition for /core/ compatibility
// This project doesn't use BehTree events, but core files import this

export interface EventDefinition {
  id: string;
  [key: string]: any;
}
