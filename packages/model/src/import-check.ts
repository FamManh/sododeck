/**
 * Reading an imported deck file as text (062 R5): one pass that either refuses the file with every
 * problem it can find, sorted in file order, or loads it and lists what the user should know
 * about the opened deck. Pure and deterministic (SC-003); the library worker calls it, so nothing
 * here runs on the main thread. Never throws for user input.
 */
import { FORMAT_VERSION } from '@sododeck/schema';

import { isRecord } from './convert';
import { loadDeck, type LoadedDeck } from './deck';
import { DeckValidationError } from './errors';
import { CATALOGUE } from './problem-codes';
import { issueEntry, sortEntries, type ProblemEntry } from './problem-entry';

export type DeckTextResult =
  /** Refused: nothing may be added. Entries are sorted and never empty. */
  | { ok: false; entries: ProblemEntry[] }
  /** Loaded. Entries are what the opened deck should say (062 US2); empty for a clean deck. */
  | { ok: true; loaded: LoadedDeck; entries: ProblemEntry[] };

/** 1-based line and column of a character offset. */
function lineColumn(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let start = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) {
      line += 1;
      start = i + 1;
    }
  }
  return { line, column: Math.min(offset, text.length) - start + 1 };
}

/**
 * Where the engine says the JSON broke: its `line L column C` (V8 since Node 22, Firefox), else
 * its `position N`, else the end of the text for "unexpected end". Undefined when it says nothing.
 */
function jsonErrorLocation(
  message: string,
  text: string,
): { line: number; column: number } | undefined {
  const at = /line (\d+) column (\d+)/i.exec(message);
  if (at !== null) return { line: Number(at[1]), column: Number(at[2]) };
  const position = /position (\d+)/i.exec(message);
  if (position !== null) return lineColumn(text, Number(position[1]));
  if (/end of (JSON )?(input|data)/i.test(message)) return lineColumn(text, text.length);
  return undefined;
}

/** The engine's reason without the location and the echoed text, as a sentence fragment. */
function jsonErrorReason(message: string): string {
  const reason = message
    .replace(/^JSON(\.parse:| Parse error:)\s*/i, '')
    .replace(/\s+in JSON at position.*$/is, '')
    .replace(/\s+at line \d+ column \d+.*$/is, '')
    .replace(/,\s*".*" is not valid JSON$/is, '')
    .trim();
  if (reason === '') return 'the text could not be read';
  return reason.charAt(0).toLowerCase() + reason.slice(1);
}

function invalidJson(error: unknown, text: string): ProblemEntry {
  const message = error instanceof Error ? error.message : String(error);
  const where = jsonErrorLocation(message, text);
  return {
    code: 'invalid-json',
    severity: 'error',
    ...(where ?? {}),
    message: `The file is not valid JSON: ${jsonErrorReason(message).replace(/\.$/, '')}.`,
    fix:
      where === undefined
        ? CATALOGUE['invalid-json'].fix
        : `Fix the JSON syntax at line ${String(where.line)}, column ${String(where.column)} (often a missing comma or quote just before it).`,
  };
}

/** A `version` above the one this app reads, which no other check should judge. */
function newerVersion(input: unknown): ProblemEntry | undefined {
  if (!isRecord(input) || typeof input.version !== 'number') return undefined;
  if (input.version <= FORMAT_VERSION) return undefined;
  return {
    code: 'unsupported-version',
    severity: 'error',
    path: '/version',
    message: `The file is written for format version ${String(input.version)}; this app reads version ${String(FORMAT_VERSION)}.`,
    evidence: String(input.version),
    fix: CATALOGUE['unsupported-version'].fix,
  };
}

/** Reads `text` as a deck file: refused with every problem, or loaded (062 R5). */
export function inspectDeckText(text: string): DeckTextResult {
  const body = text.startsWith('﻿') ? text.slice(1) : text;
  let input: unknown;
  try {
    input = JSON.parse(body);
  } catch (error) {
    return { ok: false, entries: [invalidJson(error, body)] };
  }
  const version = newerVersion(input);
  if (version !== undefined) return { ok: false, entries: [version] };
  let loaded: LoadedDeck;
  try {
    loaded = loadDeck(input);
  } catch (error) {
    if (!(error instanceof DeckValidationError)) throw error;
    return {
      ok: false,
      entries: sortEntries(error.issues.map((issue) => issueEntry(issue, input))),
    };
  }
  return { ok: true, loaded, entries: [] };
}
