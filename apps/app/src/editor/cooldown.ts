/** Returns a function that is true at most once every `ms` (the first call is true). */
export function createCooldown(ms: number, now: () => number = Date.now): () => boolean {
  let last = -Infinity;
  return () => {
    const t = now();
    if (t - last < ms) return false;
    last = t;
    return true;
  };
}
