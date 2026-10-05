/**
 * Line-oriented parser for the sequence-diagram subset in contracts/mermaid-mapping.md. Blocks
 * (`alt`, `loop`, …) are flattened: messages keep their reading order and the block's label rides
 * on the first message it covers. Pure, no DOM.
 */
import { cleanLabel } from './clean-text';
import type { PreparedText, SourceLine } from './detect';
import { LIMITS, MermaidImportError, skippedLine, type SkippedLine } from './import-report';

export interface ParsedParticipant {
  /** Mermaid id: used only to join messages, never stored. */
  key: string;
  label: string;
  actor: boolean;
}

export interface ParsedMessage {
  from: string;
  to: string;
  /** Empty when the message has no text. */
  label: string;
  dashed: boolean;
  /** Labels of the blocks that open right before this message, e.g. `alt: paid`; first covered only. */
  block?: string;
  line: number;
}

export interface ParsedSequence {
  title?: string;
  /** In order of first appearance. */
  participants: ParsedParticipant[];
  messages: ParsedMessage[];
  /** A block such as `alt` or `loop` was flattened into reading order. */
  flattened: boolean;
  skipped: SkippedLine[];
}

const ARROW = String.raw`(-->>|->>|-->|->|--\)|-\)|--x|-x)`;
const MESSAGE = new RegExp(`^\\s*(.+?)\\s*${ARROW}\\s*([+-])?\\s*([^:]+?)\\s*(?::\\s*(.*))?$`);
const DASHED = new Set(['-->>', '-->', '--)', '--x']);
const BLOCK_OPEN = /^(alt|opt|loop|par|critical|break)\b\s*(.*)$/;
const BLOCK_PART = /^(else|and|option)\b\s*(.*)$/;

export function parseSequence(prepared: PreparedText): ParsedSequence {
  const [, ...body] = prepared.lines;
  const participants = new Map<string, ParsedParticipant>();
  const messages: ParsedMessage[] = [];
  const skipped: SkippedLine[] = [...prepared.extra];
  const open: boolean[] = [];
  let pending: string[] = [];
  let title = prepared.title;
  let flattened = false;

  const skip = (entry: SourceLine, reason: SkippedLine['reason']) => {
    skipped.push(skippedLine(entry.line, entry.text, reason));
  };

  const ensure = (key: string, label?: string, actor?: boolean) => {
    const known = participants.get(key);
    if (known === undefined) {
      if (participants.size >= LIMITS.nodes) {
        throw new MermaidImportError('too-large', `more than ${LIMITS.nodes} participants`);
      }
      participants.set(key, { key, label: label ?? key, actor: actor ?? false });
    } else if (label !== undefined) {
      // A declaration after first use still names and types the participant.
      known.label = label;
      known.actor = actor ?? known.actor;
    }
  };

  const annotation = (kind: string, text: string) => (text === '' ? kind : `${kind}: ${text}`);

  for (const entry of body) {
    const text = entry.text.trim();
    if (text === '') continue;

    const title_ = /^title\b:?\s*(.*)$/i.exec(text);
    if (title_ !== null) {
      const value = cleanLabel(title_[1] ?? '');
      if (value !== '') title = value;
      continue;
    }

    const declared = /^(participant|actor)\s+(.+)$/.exec(text);
    if (declared !== null) {
      const rest = declared[2] ?? '';
      const metadata = rest.includes('@{');
      const head = metadata ? rest.slice(0, rest.indexOf('@{')).trim() : rest;
      const named = /^(\S+?)(?:\s+as\s+(.+))?$/.exec(head);
      if (named === null || named[1] === undefined) {
        skip(entry, 'unreadable');
        continue;
      }
      const label = cleanLabel(named[2] ?? named[1]);
      ensure(named[1], label === '' ? named[1] : label, declared[1] === 'actor');
      if (metadata) skip(entry, 'unsupported');
      continue;
    }

    if (/^(box|create|destroy)\b/.test(text)) {
      skip(entry, 'unsupported');
      continue;
    }
    if (/^autonumber\b/.test(text)) {
      skip(entry, 'appearance');
      continue;
    }
    if (/^(activate|deactivate)\s/.test(text) || /^note\b/i.test(text)) {
      skip(entry, 'flattened');
      continue;
    }
    if (/^links?\b/.test(text)) {
      skip(entry, 'interaction');
      continue;
    }
    if (/^rect\b/.test(text)) {
      open.push(false);
      skip(entry, 'appearance');
      continue;
    }

    const opener = BLOCK_OPEN.exec(text);
    if (opener !== null) {
      open.push(true);
      flattened = true;
      pending.push(annotation(opener[1] ?? '', cleanLabel(opener[2] ?? '')));
      skip(entry, 'flattened');
      continue;
    }
    const part = BLOCK_PART.exec(text);
    if (part !== null) {
      if (open.length === 0) {
        skip(entry, 'unreadable');
        continue;
      }
      pending.push(annotation(part[1] ?? '', cleanLabel(part[2] ?? '')));
      skip(entry, 'flattened');
      continue;
    }
    if (/^end$/.test(text)) {
      if (open.pop() === undefined) skip(entry, 'unreadable');
      continue;
    }

    const message = MESSAGE.exec(text);
    if (message === null || message[1] === undefined || message[4] === undefined) {
      skip(entry, 'unreadable');
      continue;
    }
    if (messages.length >= LIMITS.links) {
      throw new MermaidImportError('too-large', `more than ${LIMITS.links} messages`);
    }
    const from = message[1];
    const to = message[4];
    ensure(from);
    ensure(to);
    const parsed: ParsedMessage = {
      from,
      to,
      label: cleanLabel(message[5] ?? ''),
      dashed: DASHED.has(message[2] ?? ''),
      line: entry.line,
    };
    if (pending.length > 0) {
      parsed.block = pending.join('\n');
      pending = [];
    }
    messages.push(parsed);
  }

  const result: ParsedSequence = {
    participants: [...participants.values()],
    messages,
    flattened,
    skipped,
  };
  if (title !== undefined) result.title = title;
  return result;
}
