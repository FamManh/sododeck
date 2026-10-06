import { analyzeFlow } from '../flow-paths';
import { endpointTitle } from '../endpoint';
import { stickyLabel } from '../geometry';
import type { Id, SododeckFile } from '@sododeck/schema';

import { normalizeText } from './normalize';
import { isDbTable, typeName } from '../card-types';
import { validateValue } from '../field-values';
import { fieldsOfNode, valueOf, type ResolvedField } from '../fields';
import type { SearchField, SearchIndex, SearchEntry, SearchFieldValue, SearchKind } from './search';

const nodeCache = new WeakMap<SododeckFile['nodes'][number], SearchEntry>();
const columnCache = new WeakMap<object, SearchEntry>();
const edgeCache = new WeakMap<SododeckFile['edges'][number], SearchEntry>();
const flowCache = new WeakMap<SododeckFile['flows'][number], SearchEntry>();
const stepCache = new WeakMap<SododeckFile['flows'][number]['steps'][number], SearchEntry>();
const stickyCache = new WeakMap<SododeckFile['stickies'][number], SearchEntry>();
const imageCache = new WeakMap<NonNullable<SododeckFile['images']>[number], SearchEntry>();
const ruleCache = new WeakMap<SododeckFile['rules'][string], SearchEntry>();

function field(field: SearchField, raw: string | undefined): SearchFieldValue | null {
  if (raw === undefined || raw === '') return null;
  return { field, raw, norm: normalizeText(raw) };
}

/** A connector end's title: a node or a group (050), else the id itself. */
function titleOfEnd(deck: SododeckFile, id: Id): string {
  return endpointTitle(deck, id);
}

function kindLabel(kind: SearchKind): string {
  switch (kind) {
    case 'node':
      return 'Node';
    case 'table':
      return 'Table';
    case 'column':
      return 'Column';
    case 'edge':
      return 'Connection';
    case 'flow':
      return 'Flow';
    case 'step':
      return 'Step';
    case 'rule':
      return 'Rule';
    case 'sticky':
      return 'Note';
    case 'image':
      return 'Image';
  }
}

function entryOf(
  cache: WeakMap<object, SearchEntry>,
  source: object,
  data: Omit<SearchEntry, 'fields'> & { fields: readonly (SearchFieldValue | null)[] },
): SearchEntry {
  const fields = data.fields.filter((value): value is SearchFieldValue => value !== null);
  const cached = cache.get(source);
  if (
    cached !== undefined &&
    cached.kind === data.kind &&
    cached.id === data.id &&
    cached.flowId === data.flowId &&
    cached.tableId === data.tableId &&
    cached.title === data.title &&
    cached.context === data.context &&
    cached.fields.length === fields.length &&
    cached.fields.every((value, index) => {
      const candidate = fields[index];
      return (
        candidate !== undefined &&
        value.field === candidate.field &&
        value.raw === candidate.raw &&
        value.norm === candidate.norm
      );
    })
  ) {
    return cached;
  }
  const entry: SearchEntry = {
    kind: data.kind,
    id: data.id,
    ...(data.flowId === undefined ? {} : { flowId: data.flowId }),
    ...(data.tableId === undefined ? {} : { tableId: data.tableId }),
    title: data.title,
    context: data.context,
    fields,
  };
  cache.set(source, entry);
  return entry;
}

/**
 * A card's value as searchable text (032 FR-020): text, person, number (as typed, with its unit),
 * option labels and link labels (else the address). Dates are not searched; dangling values (no
 * field, no option, wrong shape) are left out, as on the card.
 */
function valueSearchText(field: ResolvedField, value: unknown): string | undefined {
  if (value === undefined || value === '' || validateValue(field, value) !== null) return undefined;
  switch (field.kind) {
    case 'text':
    case 'person':
      return typeof value === 'string' ? value : undefined;
    case 'number':
      return typeof value === 'number'
        ? `${String(value)}${field.unit === undefined ? '' : ` ${field.unit}`}`
        : undefined;
    case 'progress':
      return typeof value === 'number' ? `${String(value)} %` : undefined;
    case 'select':
    case 'status':
      return field.options?.find((option) => option.id === value)?.label;
    case 'link': {
      const link = value as { url: string; label?: string };
      return link.label ?? link.url;
    }
    case 'date':
    case 'dateRange':
      return undefined;
  }
}

const BUILT_IN_SEARCH = [
  ['tech', 'Tech'],
  ['host', 'Host'],
  ['owner', 'Owner'],
] as const;

function valueFields(deck: SododeckFile, node: SododeckFile['nodes'][number]) {
  // Most cards hold no typed values: read the built-ins directly, without merging field lists.
  if (node.values === undefined) {
    return BUILT_IN_SEARCH.map(([key, name]) => {
      const text = node[key];
      return text === undefined || text === '' ? null : field('field', `${name}: ${text}`);
    });
  }
  return fieldsOfNode(deck, node).map((def) => {
    const text = valueSearchText(def, valueOf(node, def.id));
    return text === undefined ? null : field('field', `${def.name}: ${text}`);
  });
}

/** The column ids a relationship marks as foreign keys: its referencing end (the `n` side). */
function foreignKeyColumns(deck: SododeckFile): Set<Id> {
  const ids = new Set<Id>();
  for (const edge of deck.edges) {
    const columns = edge.cardinality === '1-n' ? edge.toColumns : edge.fromColumns;
    for (const id of columns ?? []) ids.add(id);
  }
  return ids;
}

const tableEntryCache = new WeakMap<
  SododeckFile['nodes'],
  WeakMap<SododeckFile['edges'], SearchEntry[]>
>();

/**
 * Table and column entries (048). Cached by the identity of `nodes` and `edges`, so typing in the
 * palette (the same deck) never rebuilds them, and per object, so one edit rebuilds one entry.
 */
function tableEntries(deck: SododeckFile): SearchEntry[] {
  const byEdges = tableEntryCache.get(deck.nodes);
  const known = byEdges?.get(deck.edges);
  if (known !== undefined) return known;
  const entries: SearchEntry[] = [];
  let foreign: Set<Id> | undefined;
  for (const node of deck.nodes) {
    if (!isDbTable(node)) continue;
    const columns = node.columns ?? [];
    const schema = node.schema === undefined || node.schema === '' ? undefined : node.schema;
    entries.push(
      entryOf(nodeCache, node, {
        kind: 'table',
        id: node.id,
        title: node.title,
        context: [
          'Table',
          ...(schema === undefined ? [] : [schema]),
          `${String(columns.length)} ${columns.length === 1 ? 'column' : 'columns'}`,
        ].join(' · '),
        fields: [
          field('title', node.title),
          field('description', node.description),
          field('type', schema === undefined ? 'Table' : `Table ${schema}`),
        ],
      }),
    );
    foreign ??= foreignKeyColumns(deck);
    for (const column of columns) {
      const marker =
        column.pk === true
          ? 'primary key'
          : foreign.has(column.id)
            ? 'foreign key'
            : column.unique === true
              ? 'unique'
              : undefined;
      const type = column.size === undefined ? column.type : `${column.type}(${column.size})`;
      const title = `${node.title}.${column.name}`;
      entries.push(
        entryOf(columnCache, column, {
          kind: 'column',
          id: column.id,
          tableId: node.id,
          title,
          context: ['Column', type, ...(marker === undefined ? [] : [marker])].join(' · '),
          fields: [
            field('title', title),
            field('type', column.type),
            field('description', column.note),
          ],
        }),
      );
    }
  }
  const next = byEdges ?? new WeakMap();
  next.set(deck.edges, entries);
  tableEntryCache.set(deck.nodes, next);
  return entries;
}

function nodeEntries(deck: SododeckFile): SearchEntry[] {
  const groups = new Map(deck.groups.map((group) => [group.id, group.title]));
  return deck.nodes
    .filter((node) => !isDbTable(node))
    .map((node) =>
      entryOf(nodeCache, node, {
        kind: 'node',
        id: node.id,
        title: node.title,
        context: `${kindLabel('node')} · ${groups.get(node.group ?? '') ?? 'No group'}`,
        // The type's name is searchable too (030): "truck route" finds every truck route card.
        fields: [
          field('title', node.title),
          field('description', node.description),
          field('type', typeName(node.type)),
          ...valueFields(deck, node),
        ],
      }),
    );
}

function edgeEntries(deck: SododeckFile): SearchEntry[] {
  return deck.edges.map((edge) => {
    const from = titleOfEnd(deck, edge.from);
    const to = titleOfEnd(deck, edge.to);
    const title = edge.label ?? `${from} → ${to}`;
    return entryOf(edgeCache, edge, {
      kind: 'edge',
      id: edge.id,
      title,
      context: `Connection · ${from} → ${to}`,
      fields: [
        field('title', title),
        field('description', edge.description),
        edge.label === undefined ? field('description', `${from} → ${to}`) : null,
      ],
    });
  });
}

function flowEntries(deck: SododeckFile): SearchEntry[] {
  return deck.flows.flatMap((flow) => {
    const analysis = analyzeFlow(flow, deck.edges);
    const entries: SearchEntry[] = [
      entryOf(flowCache, flow, {
        kind: 'flow',
        id: flow.id,
        title: flow.title,
        context: `Flow · ${String(flow.steps.length)} steps`,
        fields: [field('title', flow.title), field('description', flow.description)],
      }),
    ];
    for (const path of [analysis.main, ...analysis.branches.map((branch) => branch.steps)]) {
      for (const pathStep of path) {
        const step = pathStep.step;
        const from = pathStep.from === null ? '?' : titleOfEnd(deck, pathStep.from);
        const to = pathStep.to === null ? '?' : titleOfEnd(deck, pathStep.to);
        entries.push(
          entryOf(stepCache, step, {
            kind: 'step',
            id: step.id,
            flowId: flow.id,
            title: step.title ?? `${from} → ${to}`,
            context: `Step ${pathStep.number} · ${flow.title}`,
            fields: [
              field('title', step.title ?? `${from} → ${to}`),
              field('description', step.description),
              field('condition', step.condition),
              field('notes', step.notes),
            ],
          }),
        );
      }
    }
    return entries;
  });
}

function ruleEntries(deck: SododeckFile): SearchEntry[] {
  return Object.entries(deck.rules).map(([id, rule]) =>
    entryOf(ruleCache, rule, {
      kind: 'rule',
      id,
      title: rule.title,
      context: `Rule · ${rule.hitPolicy}`,
      fields: [
        field('title', rule.title),
        field('description', rule.description),
        ...rule.inputs.map((column) => field('column', column.label)),
        ...rule.outputs.map((column) => field('column', column.label)),
        ...rule.rows.flatMap((row) => [
          ...row.when.map((cell) => field('cell', cell)),
          ...row.then.map((cell) => field('cell', cell)),
        ]),
      ],
    }),
  );
}

function stickyEntries(deck: SododeckFile): SearchEntry[] {
  return deck.stickies.map((sticky) =>
    entryOf(stickyCache, sticky, {
      kind: 'sticky',
      id: sticky.id,
      title: stickyLabel(sticky.text) ?? 'Empty note',
      context: 'Note',
      fields: [
        field('title', stickyLabel(sticky.text) ?? 'Empty note'),
        field('text', sticky.text),
        ...(sticky.tags ?? []).map((tag) => field('tag', tag)),
      ],
    }),
  );
}

function imageEntries(deck: SododeckFile): SearchEntry[] {
  return (deck.images ?? []).map((image) => {
    const file = deck.assets?.[image.asset]?.name;
    const alt = image.alt?.trim();
    const caption = image.caption?.trim();
    const named = alt !== undefined && alt !== '' ? alt : caption;
    const title =
      named !== undefined && named !== ''
        ? named
        : file !== undefined && file !== ''
          ? file
          : 'Image';
    return entryOf(imageCache, image, {
      kind: 'image',
      id: image.id,
      title,
      context: file === undefined || file === '' ? 'Image' : `Image · ${file}`,
      fields: [
        field('title', title),
        field('alt', image.alt),
        field('caption', image.caption),
        field('file', file),
      ],
    });
  });
}

export function buildSearchIndex(file: SododeckFile): SearchIndex {
  return {
    entries: [
      ...nodeEntries(file),
      ...tableEntries(file),
      ...edgeEntries(file),
      ...flowEntries(file),
      ...ruleEntries(file),
      ...stickyEntries(file),
      ...imageEntries(file),
    ],
  };
}
