/**
 * The rule a picture `path` must follow (068, rule I9). It lives here, the lowest package, so the
 * format rule, the model and the skill helper share one implementation.
 */

export type PathViolation =
  | 'empty'
  | 'too-long'
  | 'backslash'
  | 'absolute'
  | 'colon'
  | 'empty-segment'
  | 'dot-segment'
  | 'inner-parent'
  | 'no-file-name'
  | 'control-char';

const MAX_PATH_LENGTH = 1024;
// eslint-disable-next-line no-control-regex -- the point is to refuse control characters
const CONTROL_CHAR = /[\u0000-\u001f\u007f]/;

/** A sentence for each violation, used by I9's message and the skill helper. */
export const PATH_VIOLATION_TEXT: Record<PathViolation, string> = {
  empty: 'is empty.',
  'too-long': `is longer than ${String(MAX_PATH_LENGTH)} characters.`,
  backslash: 'uses "\\"; write "/" between folders.',
  absolute: 'starts with "/"; it must be relative to the deck file.',
  colon: 'contains ":"; drive letters and URLs are not allowed.',
  'empty-segment': 'has an empty folder name ("//" or a trailing "/").',
  'dot-segment': 'has a "." folder; leave it out.',
  'inner-parent': 'has ".." after a folder name; ".." may only come first.',
  'no-file-name': 'has no file name; it ends in "..".',
  'control-char': 'contains a control character.',
};

/** The first rule `path` breaks, or null when it is a valid picture path (068 R2). Pure. */
export function checkPicturePath(path: string): PathViolation | null {
  if (path === '') return 'empty';
  if (path.length > MAX_PATH_LENGTH) return 'too-long';
  if (path.includes('\\')) return 'backslash';
  if (path.startsWith('/')) return 'absolute';
  if (path.includes(':')) return 'colon';
  if (CONTROL_CHAR.test(path)) return 'control-char';
  const segments = path.split('/');
  if (segments.some((segment) => segment === '')) return 'empty-segment';
  if (segments.some((segment) => segment === '.')) return 'dot-segment';
  let leading = true;
  for (const segment of segments) {
    if (segment !== '..') leading = false;
    else if (!leading) return 'inner-parent';
  }
  if (segments[segments.length - 1] === '..') return 'no-file-name';
  return null;
}
