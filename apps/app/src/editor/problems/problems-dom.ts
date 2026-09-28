/** Rows shown before "Show all" (015 FR-016). */
export const PROBLEM_ROW_CAP = 200;

const ROW = '[data-problem-row]';

/** Moves keyboard focus to the first problem row, if the list is on screen. */
export function focusFirstProblem(): boolean {
  const row = document.querySelector<HTMLElement>(ROW);
  row?.focus();
  return row !== null;
}
