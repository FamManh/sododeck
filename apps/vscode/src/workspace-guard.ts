import { checkPicturePath, PATH_VIOLATION_TEXT, type PathViolation } from '@sododeck/schema';

import type { FilePort, Loc, WorkspacePort } from './ports';

export type Resolved = { ok: true; loc: Loc } | { ok: false; reason: string };

const NONE: ReadonlySet<PathViolation> = new Set();
const LINK_TOLERATED: ReadonlySet<PathViolation> = new Set([
  'dot-segment',
  'inner-parent',
  'empty-segment',
  'no-file-name',
]);

export const OUTSIDE_WORKSPACE = 'outside the workspace';

interface GuardPorts {
  files: FilePort;
  workspace: WorkspacePort;
}

function inside(root: string, path: string): boolean {
  const base = root.endsWith('/') ? root.slice(0, -1) : root;
  return path === base || path.startsWith(`${base}/`);
}

/** The location a path really points at: links resolved, even when the file does not exist yet. */
async function realLocation(files: FilePort, loc: Loc): Promise<Loc> {
  if (files.scheme(loc) !== 'file') return loc;
  const tail: string[] = [];
  let current = loc;
  for (;;) {
    if (await files.exists(current)) break;
    const parent = files.dirname(current);
    if (parent === current) break;
    tail.unshift(files.basename(current));
    current = parent;
  }
  const real = await files.realpath(current);
  return tail.length === 0 ? real : files.join(real, tail.join('/'));
}

/**
 * Where a picture path of the deck at `deckLoc` really is, and whether that is inside the
 * workspace (R9, FR-019). Judged on the resolved location including links, so a link inside the
 * workspace that points out is refused. Nothing is read or written here; callers act only on `ok`.
 * A deck outside every workspace folder may reach only its own folder.
 */
export async function resolveInside(
  deckLoc: Loc,
  relPath: string,
  ports: GuardPorts,
  options: { kind?: 'picture' | 'link' } = {},
): Promise<Resolved> {
  const { files } = ports;
  const violation = checkPicturePath(relPath);
  // A link may be written `./a/../b.md`; the lexical join below settles it. Everything else the
  // picture rule refuses (absolute, drive letters, backslashes, control characters) stays refused.
  const tolerated = options.kind === 'link' ? LINK_TOLERATED : NONE;
  if (violation !== null && !tolerated.has(violation)) {
    return { ok: false, reason: `The path ${PATH_VIOLATION_TEXT[violation]}` };
  }

  return resolveLocInside(deckLoc, files.join(files.dirname(deckLoc), relPath), ports);
}

/**
 * The same check for a location that is already known (a search result): its real location,
 * links followed, must be inside the workspace, or inside the deck's own folder when the deck is
 * outside every workspace folder.
 */
export async function resolveLocInside(
  deckLoc: Loc,
  target: Loc,
  ports: GuardPorts,
): Promise<Resolved> {
  const { files, workspace } = ports;
  const deckFolder = files.dirname(deckLoc);
  const fold = (path: string): string => (files.caseInsensitive ? path.toLowerCase() : path);

  const [realTarget, realDeckFolder] = await Promise.all([
    realLocation(files, target),
    realLocation(files, deckFolder),
  ]);
  const roots = await Promise.all(workspace.folders().map((f) => realLocation(files, f)));
  const deckInWorkspace = roots.some((r) => inside(fold(r), fold(realDeckFolder)));
  const allowed = deckInWorkspace ? roots : [realDeckFolder];

  if (!allowed.some((r) => inside(fold(r), fold(realTarget)))) {
    return { ok: false, reason: OUTSIDE_WORKSPACE };
  }
  return { ok: true, loc: target };
}
