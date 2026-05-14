// Pure types + constants for validation gates, safe to import from client
// components. The runner lives in validators.ts (server-only).

export const VALIDATION_GATES = [
  'quality',
  'security',
  'bugs',
  'user-story-acceptance',
] as const;
export type ValidationGate = (typeof VALIDATION_GATES)[number];
