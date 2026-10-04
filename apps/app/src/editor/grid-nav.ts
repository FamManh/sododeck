/**
 * 2-D arrow movement over sections of tiles (the Add palette, the icon picker). Each section is
 * a list of ids laid out `columns` wide; left / right walk the flat list, up / down keep the
 * column, move to the neighbouring section at its edge and clamp to a short last row.
 */
export function neighbour(
  sections: readonly (readonly string[])[],
  from: string,
  key: string,
  columns: number,
): string | null {
  const flat = sections.flat();
  const at = flat.indexOf(from);
  if (at < 0) return null;
  if (key === 'ArrowRight') return flat[at + 1] ?? null;
  if (key === 'ArrowLeft') return flat[at - 1] ?? null;
  const si = sections.findIndex((ids) => ids.includes(from));
  const section = sections[si];
  if (section === undefined) return null;
  const i = section.indexOf(from);
  const col = i % columns;
  if (key === 'ArrowDown') {
    if (i + columns < section.length) return section[i + columns] ?? null;
    const next = sections[si + 1];
    return next === undefined ? null : (next[Math.min(col, next.length - 1)] ?? null);
  }
  if (key === 'ArrowUp') {
    if (i - columns >= 0) return section[i - columns] ?? null;
    const prev = sections[si - 1];
    if (prev === undefined) return null;
    const lastRow = Math.floor((prev.length - 1) / columns) * columns;
    return prev[Math.min(lastRow + col, prev.length - 1)] ?? null;
  }
  return null;
}
