/** A plain JSON object (not null, not an array). Kept apart from `convert.ts` so it needs no Yjs. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
