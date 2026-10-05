/**
 * Line-oriented parser for the flowchart subset in contracts/mermaid-mapping.md (research R1):
 * structure only, no drawing. Unreadable lines are reported, never fatal. Pure, no DOM, so it
 * runs in the library worker and in tests.
 */
import { cleanLabel } from './clean-text';
import type { PreparedText, SourceLine } from './detect';
import { LIMITS, MermaidImportError, skippedLine, type SkippedLine } from './import-report';
import type { MermaidShape } from './shape-map';

export type FlowDirection = 'TB' | 'BT' | 'LR' | 'RL';

export interface ParsedNode {
  /** Mermaid id: used only to join links, never stored. */
  key: string;
  label: string;
  shape: MermaidShape;
  line: number;
}

export interface ParsedLink {
  from: string;
  to: string;
  label?: string;
  arrow: 'normal' | 'none' | 'both';
  dash: 'solid' | 'dashed' | 'dotted';
  width: 'normal' | 'thick';
  line: number;
}

export interface ParsedSubgraph {
  key: string;
  label: string;
  parent?: string;
  /** Node keys that are direct children. */
  members: string[];
}

export interface ParsedFlowchart {
  direction: FlowDirection;
  title?: string;
  nodes: ParsedNode[];
  links: ParsedLink[];
  subgraphs: ParsedSubgraph[];
  /** Node key → innermost subgraph key. */
  groupOf: Record<string, string>;
  skipped: SkippedLine[];
}

const WORD = String.raw`[\wÀ-￿]`;
const ID = new RegExp(`^${WORD}+(?:[-.]${WORD}+)*`);

const SHAPES: { open: string; closers: [string, MermaidShape][] }[] = [
  { open: '(((', closers: [[')))', 'double-circle']] },
  { open: '((', closers: [['))', 'circle']] },
  { open: '([', closers: [['])', 'stadium']] },
  { open: '(', closers: [[')', 'round']] },
  { open: '[[', closers: [[']]', 'subroutine']] },
  { open: '[(', closers: [[')]', 'cylinder']] },
  {
    open: '[/',
    closers: [
      ['/]', 'parallelogram'],
      ['\\]', 'trapezoid'],
    ],
  },
  {
    open: '[\\',
    closers: [
      ['\\]', 'parallelogram'],
      ['/]', 'trapezoid'],
    ],
  },
  { open: '[', closers: [[']', 'rect']] },
  { open: '{{', closers: [['}}', 'hexagon']] },
  { open: '{', closers: [['}', 'rhombus']] },
  { open: '>', closers: [[']', 'asymmetric']] },
];

interface Ref {
  key: string;
  label?: string;
  shape?: MermaidShape;
  appearance: boolean;
  metadata: boolean;
}

interface Shaped {
  shape: MermaidShape;
  label: string;
  end: number;
}

function skipSpaces(s: string, i: number): number {
  let at = i;
  while (at < s.length && /\s/.test(s.charAt(at))) at++;
  return at;
}

function parseShape(s: string, start: number): Shaped | null {
  for (const { open, closers } of SHAPES) {
    if (!s.startsWith(open, start)) continue;
    const from = start + open.length;
    const inner = skipSpaces(s, from);
    let closer: [string, MermaidShape] | undefined;
    if (s.charAt(inner) === '"') {
      const quote = s.indexOf('"', inner + 1);
      if (quote < 0) continue;
      const after = skipSpaces(s, quote + 1);
      closer = closers.find(([text]) => s.startsWith(text, after));
      if (closer === undefined) continue;
      const label = s.slice(inner, quote + 1);
      return { shape: closer[1], label, end: after + closer[0].length };
    }
    let best = Number.POSITIVE_INFINITY;
    for (const candidate of closers) {
      const at = s.indexOf(candidate[0], from);
      if (at >= 0 && at < best) {
        best = at;
        closer = candidate;
      }
    }
    if (closer === undefined) continue;
    return { shape: closer[1], label: s.slice(from, best), end: best + closer[0].length };
  }
  return null;
}

function parseRef(s: string, start: number): { ref: Ref; end: number } | null {
  const match = ID.exec(s.slice(start));
  if (match === null) return null;
  const key = match[0];
  let end = start + key.length;
  const ref: Ref = { key, appearance: false, metadata: false };
  const shaped = parseShape(s, end);
  if (shaped !== null) {
    ref.shape = shaped.shape;
    ref.label = cleanLabel(shaped.label);
    end = shaped.end;
  }
  if (s.startsWith('@{', end)) {
    const close = s.indexOf('}', end);
    if (close < 0) return null;
    ref.metadata = true;
    end = close + 1;
  }
  const classSuffix = /^:::[\w-]+/.exec(s.slice(end));
  if (classSuffix !== null) {
    ref.appearance = true;
    end += classSuffix[0].length;
  }
  return { ref, end };
}

function parseGroup(s: string, start: number): { refs: Ref[]; end: number } | null {
  const refs: Ref[] = [];
  let at = skipSpaces(s, start);
  for (;;) {
    const parsed = parseRef(s, at);
    if (parsed === null) return null;
    refs.push(parsed.ref);
    at = skipSpaces(s, parsed.end);
    if (s.charAt(at) !== '&') return { refs, end: at };
    at = skipSpaces(s, at + 1);
  }
}

interface LinkToken {
  arrow: ParsedLink['arrow'];
  dash: ParsedLink['dash'];
  width: ParsedLink['width'];
  label?: string;
  end: number;
}

/** After a plain token: a `[xo]` head only when it ends the token (so `--oB` stays unread). */
const PLAIN: {
  re: RegExp;
  arrow: LinkToken['arrow'];
  dash: LinkToken['dash'];
  width: LinkToken['width'];
}[] = [
  { re: /^<-{2,}>/, arrow: 'both', dash: 'solid', width: 'normal' },
  { re: /^<={2,}>/, arrow: 'both', dash: 'solid', width: 'thick' },
  { re: /^<-\.+->/, arrow: 'both', dash: 'dotted', width: 'normal' },
  { re: /^-{2,}[xo](?=\s|\||$)/, arrow: 'normal', dash: 'solid', width: 'normal' },
  { re: /^-{2,}>/, arrow: 'normal', dash: 'solid', width: 'normal' },
  { re: /^-{3,}/, arrow: 'none', dash: 'solid', width: 'normal' },
  { re: /^={2,}>/, arrow: 'normal', dash: 'solid', width: 'thick' },
  { re: /^={3,}/, arrow: 'none', dash: 'solid', width: 'thick' },
  { re: /^-\.+->/, arrow: 'normal', dash: 'dotted', width: 'normal' },
  { re: /^-\.+-/, arrow: 'none', dash: 'dotted', width: 'normal' },
];

const EMBEDDED: {
  re: RegExp;
  arrow: LinkToken['arrow'];
  dash: LinkToken['dash'];
  width: LinkToken['width'];
}[] = [
  { re: /^--\s+(.+?)\s+(-{2,}>|--[xo]|-{3,})/, arrow: 'normal', dash: 'solid', width: 'normal' },
  { re: /^==\s+(.+?)\s+(={2,}>|={3,})/, arrow: 'normal', dash: 'solid', width: 'thick' },
  { re: /^-\.\s+(.+?)\s+(\.+->|\.+-)/, arrow: 'normal', dash: 'dotted', width: 'normal' },
];

function parseLink(s: string, start: number): LinkToken | null {
  const rest = s.slice(start);
  for (const { re, arrow, dash, width } of PLAIN) {
    const match = re.exec(rest);
    if (match === null) continue;
    let end = start + match[0].length;
    const open = skipSpaces(s, end);
    let label: string | undefined;
    if (s.charAt(open) === '|') {
      const close = s.indexOf('|', open + 1);
      if (close < 0) return null;
      label = cleanLabel(s.slice(open + 1, close));
      end = close + 1;
    }
    // `---` and `-.-` are open links; the head letters only change the arrow, not its meaning here.
    return label === undefined ? { arrow, dash, width, end } : { arrow, dash, width, label, end };
  }
  for (const { re, arrow, dash, width } of EMBEDDED) {
    const match = re.exec(rest);
    if (match === null) continue;
    const closer = match[2] ?? '';
    // An embedded-label link ending in an open token (`---`, `===`, `.-`) has no arrowhead.
    const open = /^(-{3,}|={3,}|\.+-)$/.test(closer);
    return {
      arrow: open ? 'none' : arrow,
      dash,
      width,
      label: cleanLabel(match[1] ?? ''),
      end: start + match[0].length,
    };
  }
  return null;
}

const APPEARANCE = /^(?:style|classDef|class|linkStyle|accTitle|accDescr)\b/;
const INTERACTION = /^(?:click|callback|link)\s/;

/** Splits a line into statements at `;`, except inside quotes or an entity such as `&amp;`. */
function statements(text: string): string[] {
  const out: string[] = [];
  let quoted = false;
  let from = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charAt(i);
    if (c === '"') quoted = !quoted;
    else if (c === ';' && !quoted && !/&#?\w+$/.test(text.slice(from, i))) {
      out.push(text.slice(from, i));
      from = i + 1;
    }
  }
  out.push(text.slice(from));
  return out.map((part) => part.trim()).filter((part) => part !== '');
}

const DIRECTION = /\b(TB|TD|BT|RL|LR)\b/i;

function directionOf(header: string): FlowDirection {
  const found = DIRECTION.exec(header)?.[1]?.toUpperCase();
  if (found === 'LR' || found === 'RL' || found === 'BT') return found;
  return 'TB';
}

export function parseFlowchart(prepared: PreparedText): ParsedFlowchart {
  const [header, ...body] = prepared.lines;
  const nodes = new Map<string, ParsedNode & { explicit: boolean }>();
  const links: ParsedLink[] = [];
  const subgraphs: ParsedSubgraph[] = [];
  const groupOf: Record<string, string> = {};
  const skipped: SkippedLine[] = [...prepared.extra];
  const stack: ParsedSubgraph[] = [];

  const skip = (entry: SourceLine, reason: SkippedLine['reason']) => {
    skipped.push(skippedLine(entry.line, entry.text, reason));
  };

  const ensureNode = (ref: Ref, line: number) => {
    const known = nodes.get(ref.key);
    const explicit = ref.shape !== undefined;
    if (known === undefined) {
      if (nodes.size >= LIMITS.nodes) {
        throw new MermaidImportError('too-large', `more than ${LIMITS.nodes} components`);
      }
      nodes.set(ref.key, {
        key: ref.key,
        label: ref.label === undefined || ref.label === '' ? ref.key : ref.label,
        shape: ref.shape ?? 'bare',
        line,
        explicit,
      });
      const inner = stack[stack.length - 1];
      if (inner !== undefined) {
        inner.members.push(ref.key);
        groupOf[ref.key] = inner.key;
      }
    } else if (!known.explicit && explicit) {
      // The first mention that carries a label wins; a bare mention before it only joined links.
      known.label = ref.label === undefined || ref.label === '' ? known.label : ref.label;
      known.shape = ref.shape ?? known.shape;
      known.explicit = true;
    }
  };

  const statement = (entry: SourceLine, text: string) => {
    if (text.includes('~~~')) {
      skip(entry, 'unsupported');
      return;
    }
    if (APPEARANCE.test(text)) {
      skip(entry, 'appearance');
      return;
    }
    if (INTERACTION.test(text)) {
      skip(entry, 'interaction');
      return;
    }
    if (/^direction\s/i.test(text)) {
      skip(entry, 'unsupported');
      return;
    }
    if (/^end$/i.test(text)) {
      if (stack.pop() === undefined) skip(entry, 'unreadable');
      return;
    }
    const sub = /^subgraph\s+(.+)$/i.exec(text);
    if (sub !== null) {
      const rest = (sub[1] ?? '').trim();
      const titled = /^([^\s[]+)\s*\[(.*)\]$/.exec(rest);
      const key = titled?.[1] ?? cleanLabel(rest);
      const label = cleanLabel(titled?.[2] ?? rest);
      const group: ParsedSubgraph = { key, label: label === '' ? key : label, members: [] };
      const parent = stack[stack.length - 1];
      if (parent !== undefined) group.parent = parent.key;
      subgraphs.push(group);
      stack.push(group);
      return;
    }

    const refs: { group: Ref[]; link?: LinkToken }[] = [];
    let at = 0;
    for (;;) {
      const group = parseGroup(text, at);
      if (group === null) {
        skip(entry, 'unreadable');
        return;
      }
      const item: { group: Ref[]; link?: LinkToken } = { group: group.refs };
      refs.push(item);
      if (group.end >= text.length) break;
      const link = parseLink(text, group.end);
      if (link === null) {
        skip(entry, 'unreadable');
        return;
      }
      item.link = link;
      at = skipSpaces(text, link.end);
      if (at >= text.length) {
        skip(entry, 'unreadable');
        return;
      }
    }
    let appearance = false;
    let metadata = false;
    for (const { group } of refs) {
      for (const ref of group) {
        ensureNode(ref, entry.line);
        appearance ||= ref.appearance;
        metadata ||= ref.metadata;
      }
    }
    refs.forEach(({ link }, index) => {
      const next = refs[index + 1];
      if (link === undefined || next === undefined) return;
      for (const from of refs[index]?.group ?? []) {
        for (const to of next.group) {
          if (links.length >= LIMITS.links) {
            throw new MermaidImportError('too-large', `more than ${LIMITS.links} connections`);
          }
          const parsed: ParsedLink = {
            from: from.key,
            to: to.key,
            arrow: link.arrow,
            dash: link.dash,
            width: link.width,
            line: entry.line,
          };
          if (link.label !== undefined && link.label !== '') parsed.label = link.label;
          links.push(parsed);
        }
      }
    });
    if (appearance) skip(entry, 'appearance');
    if (metadata) skip(entry, 'unsupported');
  };

  for (const entry of body) {
    for (const text of statements(entry.text.trim())) statement(entry, text);
  }

  // A bare mention of a subgraph id (`A --> Client`) is a link to the group, not a component.
  const subgraphKeys = new Set(subgraphs.map((g) => g.key));
  for (const [key, node] of nodes) {
    if (node.explicit || !subgraphKeys.has(key)) continue;
    nodes.delete(key);
    Reflect.deleteProperty(groupOf, key);
    for (const group of subgraphs) group.members = group.members.filter((m) => m !== key);
  }

  const result: ParsedFlowchart = {
    direction: directionOf(header?.text ?? ''),
    nodes: [...nodes.values()].map(({ explicit: _explicit, ...node }) => node),
    links,
    subgraphs,
    groupOf,
    skipped,
  };
  if (prepared.title !== undefined) result.title = prepared.title;
  return result;
}
