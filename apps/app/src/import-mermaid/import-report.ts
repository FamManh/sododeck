/**
 * What a Mermaid import tells the user (data-model.md, 056): what was mapped, what was skipped and
 * why, and the typed errors that create nothing. Pure, so it runs in the library worker.
 */

export type SkipReason =
  | 'appearance' // style, classDef, class, linkStyle
  | 'interaction' // click, callback
  | 'unsupported' // syntax outside the accepted subset
  | 'unreadable' // not understood
  | 'flattened' // sequence blocks, notes, activations
  | 'extra-diagram'; // a second diagram in the same text

export interface SkippedLine {
  /** 1-based, in the text as given. */
  line: number;
  /** The line, trimmed to `EXCERPT_LENGTH` characters. */
  text: string;
  reason: SkipReason;
}

export interface ImportReport {
  kind: 'flowchart' | 'sequence';
  counts: { components: number; connections: number; groups: number; steps: number };
  /** All of them, no cap (the UI scrolls). */
  skipped: SkippedLine[];
  /** e.g. "Branching in sequence blocks was flattened". */
  notes: string[];
}

/** Limits that bound worker time and deck size (research R8, FR-018). */
export const LIMITS = {
  textBytes: 512 * 1024,
  nodes: 2000,
  links: 4000,
} as const;

export const EXCERPT_LENGTH = 120;

export function skippedLine(line: number, text: string, reason: SkipReason): SkippedLine {
  const trimmed = text.trim();
  return {
    line,
    text: trimmed.length > EXCERPT_LENGTH ? `${trimmed.slice(0, EXCERPT_LENGTH - 1)}…` : trimmed,
    reason,
  };
}

export type MermaidErrorCode = 'empty' | 'unsupported-type' | 'nothing-readable' | 'too-large';

/**
 * A refused import. `detail` is what the message needs: the unsupported keyword, the first problem
 * line (`line N: text`), or the limit that was exceeded.
 */
export class MermaidImportError extends Error {
  constructor(
    readonly code: MermaidErrorCode,
    readonly detail: string = '',
  ) {
    super(detail === '' ? code : `${code}: ${detail}`);
    this.name = 'MermaidImportError';
  }
}

const REASON_TEXT: Record<SkipReason, string> = {
  appearance: 'Styling is not imported.',
  interaction: 'Clicks and links on diagrams are not imported.',
  unsupported: 'This syntax is not supported yet.',
  unreadable: 'This line could not be read.',
  flattened: 'Kept in reading order; the block, note or activation itself is not imported.',
  'extra-diagram': 'Only the first diagram is imported.',
};

/** A plain sentence for a skip reason. */
export function describeReason(reason: SkipReason): string {
  return REASON_TEXT[reason];
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "12 components, 14 connections, 2 groups" / "…, 1 flow with 10 steps". */
export function summaryText(report: ImportReport): string {
  const { components, connections, groups, steps } = report.counts;
  const parts = [plural(components, 'component'), plural(connections, 'connection')];
  if (report.kind === 'flowchart') {
    parts.push(plural(groups, 'group'));
  } else {
    parts.push(`1 flow with ${plural(steps, 'step')}`);
  }
  return parts.join(', ');
}
