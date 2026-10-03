/**
 * Merging an outside change into a field's unsaved typing (036 research R7). Pure. `base` is the
 * document value the draft was typed over, `theirs` the document value after a change from
 * elsewhere (another tab), `draft` what the field shows. Each differs from `base` by one splice;
 * the outside splice is replayed onto the draft, so the next write keeps both texts.
 */

interface Splice {
  /** Replaced range `[start, end)` of the text it applies to. */
  start: number;
  end: number;
  text: string;
}

/** The single splice turning `from` into `to` (common prefix and suffix kept). */
function diff(from: string, to: string): Splice {
  const shortest = Math.min(from.length, to.length);
  let start = 0;
  while (start < shortest && from.charCodeAt(start) === to.charCodeAt(start)) start++;
  let suffix = 0;
  while (
    suffix < shortest - start &&
    from.charCodeAt(from.length - 1 - suffix) === to.charCodeAt(to.length - 1 - suffix)
  ) {
    suffix++;
  }
  return { start, end: from.length - suffix, text: to.slice(start, to.length - suffix) };
}

/** The outside splice expressed on the draft, and the merged text. */
function rebase(base: string, theirs: string, draft: string): { text: string; splice: Splice } {
  const outside = diff(base, theirs);
  const local = diff(base, draft);
  const apply = (splice: Splice) => ({
    splice,
    text: draft.slice(0, splice.start) + splice.text + draft.slice(splice.end),
  });
  // Outside change before the local one (an insert at the same point goes first).
  if (outside.end <= local.start) return apply(outside);
  // After it: shift by what the local edit added or removed.
  if (outside.start >= local.end) {
    const shift = local.text.length - (local.end - local.start);
    return apply({ start: outside.start + shift, end: outside.end + shift, text: outside.text });
  }
  // Overlapping: keep the local text whole, drop the base text either side deleted, and put the
  // outside text next to the local text, on the side where it started.
  const start = Math.min(outside.start, local.start);
  const end = Math.max(outside.end, local.end);
  const before = base.slice(Math.min(outside.end, local.start), local.start);
  const after = base.slice(local.end, Math.max(outside.start, local.end));
  const middle =
    outside.start < local.start
      ? outside.text + before + local.text + after
      : local.text + outside.text + after;
  const text = base.slice(0, start) + middle + base.slice(end);
  return { text, splice: diff(draft, text) };
}

/** The draft with the outside change between `base` and `theirs` applied to it. */
export function rebaseDraft(base: string, theirs: string, draft: string): string {
  return rebase(base, theirs, draft).text;
}

/**
 * Where a caret at `caret` in the draft goes in the rebased draft: unchanged before the outside
 * change, shifted after it, at the end of the change when inside text it replaced.
 */
export function rebaseCaret(base: string, theirs: string, draft: string, caret: number): number {
  const { splice } = rebase(base, theirs, draft);
  if (caret <= splice.start) return caret;
  if (caret >= splice.end) return caret + splice.text.length - (splice.end - splice.start);
  return splice.start + splice.text.length;
}
