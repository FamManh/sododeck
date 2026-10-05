/**
 * `validate` and `lint` as pure functions over the file text (027 research R3). Both read the
 * file exactly as the app's import does (`inspectDeckText`, 062), so the skill and the app's
 * Copy problems can never disagree; lint adds the skill's authoring checks.
 */
import {
  CATALOGUE,
  inspectDeckText,
  isCode,
  problemReport,
  sortEntries,
  type ProblemEntry,
  type ProblemReport,
} from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';

import { authoringChecks, type AuthoringOptions } from './authoring';

export interface CheckResult {
  report: ProblemReport;
  /** The loaded file, when it could be loaded. */
  file?: SododeckFile;
}

/** Families that `validate` owns: whether the app can open the file at all. */
const LOAD_FAMILIES = new Set(['file', 'format-rule', 'load']);

const isLoadEntry = (entry: ProblemEntry) =>
  isCode(entry.code) && LOAD_FAMILIES.has(CATALOGUE[entry.code].family);

function parse(text: string): SododeckFile {
  const body = text.startsWith('﻿') ? text.slice(1) : text;
  // Only called after inspectDeckText accepted the text, so it is a valid deck file.
  return JSON.parse(body) as SododeckFile;
}

/** The file-format and load problems of `text`: would the app open it? */
export function validateText(text: string, name: string, app: string): CheckResult {
  const result = inspectDeckText(text);
  if (!result.ok) {
    return {
      report: problemReport({
        source: { kind: 'file', name },
        status: 'refused',
        app,
        entries: result.entries,
      }),
    };
  }
  return {
    report: problemReport({
      source: { kind: 'file', name },
      status: 'opened',
      app,
      entries: result.entries.filter(isLoadEntry),
    }),
    file: parse(text),
  };
}

/** Everything validate reports, plus the problems list and the authoring checks. */
export function lintText(
  text: string,
  name: string,
  app: string,
  options: AuthoringOptions = {},
): CheckResult {
  const result = inspectDeckText(text);
  if (!result.ok) {
    return {
      report: problemReport({
        source: { kind: 'file', name },
        status: 'refused',
        app,
        entries: result.entries,
      }),
    };
  }
  const file = parse(text);
  return {
    report: problemReport({
      source: { kind: 'file', name },
      status: 'opened',
      app,
      entries: sortEntries([...result.entries, ...authoringChecks(file, options)]),
    }),
    file,
  };
}

export const hasErrors = (report: ProblemReport) => report.counts.error > 0;
