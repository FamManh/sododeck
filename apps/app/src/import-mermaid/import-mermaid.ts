/**
 * Mermaid text → deck file (056): the one entry the library worker calls. Flowcharts come back
 * without positions (the layout worker places them); sequence diagrams come back placed. Throws
 * `MermaidImportError`; an error creates nothing.
 */
import type { SododeckFile } from '@sododeck/schema';

import { diagramType, prepare, type PreparedText } from './detect';
import { flowchartToDeck } from './flowchart-to-deck';
import { LIMITS, MermaidImportError, type ImportReport } from './import-report';
import { parseFlowchart, type FlowDirection } from './parse-flowchart';
import { parseSequence } from './parse-sequence';
import { sequenceToDeck } from './sequence-to-deck';

export interface MermaidImport {
  file: SododeckFile;
  report: ImportReport;
  /** The flowchart's direction; `null` when the file is already placed (sequence diagrams). */
  direction: FlowDirection | null;
}

function firstProblem(prepared: PreparedText, unreadable?: { line: number; text: string }): string {
  const entry = unreadable ?? prepared.lines[0];
  return entry === undefined ? '' : `line ${entry.line}: ${entry.text.trim().slice(0, 120)}`;
}

export function importMermaidText(text: string): MermaidImport {
  if (text.trim() === '') throw new MermaidImportError('empty');
  if (new TextEncoder().encode(text).length > LIMITS.textBytes) {
    throw new MermaidImportError('too-large', `more than ${LIMITS.textBytes / 1024} KB of text`);
  }
  const prepared = prepare(text);
  if (prepared.lines.length === 0) throw new MermaidImportError('empty');
  const type = diagramType(prepared.lines);
  if (type === 'none') throw new MermaidImportError('nothing-readable', firstProblem(prepared));
  if (typeof type === 'object') throw new MermaidImportError('unsupported-type', type.unsupported);

  if (type === 'flowchart') {
    const parsed = parseFlowchart(prepared);
    if (parsed.nodes.length === 0) {
      const bad = parsed.skipped.find((s) => s.reason === 'unreadable');
      throw new MermaidImportError('nothing-readable', firstProblem(prepared, bad));
    }
    const { file, report } = flowchartToDeck(parsed);
    return { file, report, direction: parsed.direction };
  }

  const parsed = parseSequence(prepared);
  if (parsed.participants.length === 0) {
    const bad = parsed.skipped.find((s) => s.reason === 'unreadable');
    throw new MermaidImportError('nothing-readable', firstProblem(prepared, bad));
  }
  const { file, report } = sequenceToDeck(parsed);
  return { file, report, direction: null };
}
