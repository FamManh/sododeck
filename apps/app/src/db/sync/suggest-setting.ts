/** "Did you mean …?" for a misspelt DBML column setting (046 R9). Pure. */
const SETTINGS = [
  'pk',
  'primary key',
  'null',
  'not null',
  'unique',
  'increment',
  'default',
  'note',
  'ref',
] as const;

function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(
        (row[j] ?? 0) + 1,
        (next[j - 1] ?? 0) + 1,
        (row[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    row = next;
  }
  return row[b.length] ?? 0;
}

/** The closest known setting within two edits, or `undefined` (also for an exact match). */
export function suggestDbmlSetting(word: string): string | undefined {
  const text = word.trim().toLowerCase();
  if (text === '' || (SETTINGS as readonly string[]).includes(text)) return undefined;
  let best: string | undefined;
  let bestDistance = 3;
  for (const setting of SETTINGS) {
    const d = distance(text, setting);
    if (d < bestDistance) {
      best = setting;
      bestDistance = d;
    }
  }
  return best;
}
