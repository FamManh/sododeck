import { emptySododeckFile, type IssueCode } from '../src';
import { readExample } from './schema-walk';

/**
 * Invalid fixtures (spec FR-026). Each one breaks exactly one thing in a copy of
 * `examples/full.sododeck.json`; `path` is where the app's validator must report the problem and
 * `code` what it reports.
 */
export interface InvalidFixture {
  name: string;
  input: unknown;
  /** Dot-separated, like `mutate`; the test turns it into a JSON Pointer. */
  path: string;
  /** The code the issue at `path` carries (062). */
  code: IssueCode;
}

const full = readExample('full.sododeck.json');

function isContainer(value: unknown): value is Record<string, unknown> | unknown[] {
  return value !== null && typeof value === 'object';
}

/** Returns a deep copy of the full example with `path` (dot-separated) set to `value`, or removed. */
function mutate(path: string, change: { value: unknown } | 'remove'): unknown {
  const copy = structuredClone(full);
  const keys = path.split('.');
  const last = keys.pop();
  let target: unknown = copy;
  for (const key of keys) {
    if (!isContainer(target)) throw new Error(`No container at ${key} in ${path}`);
    target = (target as Record<string, unknown>)[key];
  }
  if (!isContainer(target) || last === undefined) throw new Error(`Bad fixture path ${path}`);
  const record = target as Record<string, unknown>;
  if (change === 'remove') {
    if (!(last in record)) throw new Error(`Nothing to remove at ${path}`);
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- fixture builder
    delete record[last];
  } else {
    record[last] = change.value;
  }
  return copy;
}

const set = (path: string, value: unknown) => mutate(path, { value });
/** The full example with no images and no assets (a deck that never held a picture). */
function removeBoth(): unknown {
  const copy = structuredClone(full) as Record<string, unknown>;
  delete copy.images;
  delete copy.assets;
  return copy;
}
const remove = (path: string) => mutate(path, 'remove');

/** Renames map key `from` to `to` in the object at `path`. */
function renameKey(path: string, from: string, to: string): unknown {
  const copy = structuredClone(full);
  let target: unknown = copy;
  for (const key of path.split('.')) target = (target as Record<string, unknown>)[key];
  const record = target as Record<string, unknown>;
  record[to] = record[from];
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- fixture builder
  delete record[from];
  return copy;
}

const RULE = 'rules.delivery-tier';
const STEP = 'flows.0.steps.0';
const BRANCH = 'flows.2.branches.1';
const GROUP = 'groups.1';
const FRAMES = 'views.2.groupFrames';
const CUSTOMERS = 'nodes.12';
const ORDERS = 'nodes.13';
const RELATION = 'edges.7';
const TOUCHES = 'flows.2.steps.1.touches';
const IMAGE = 'images.0';
const PNG_ID =
  (full as { images: { asset: string }[] }).images[0]?.asset ?? 'missing-from-the-full-example';
const ASSET_PNG = `assets.${PNG_ID}`;

export const invalidFixtures: InvalidFixture[] = [
  // Envelope
  { name: 'wrong version', input: set('version', 2), path: 'version', code: 'schema-enum' },
  {
    name: 'wrong $schema',
    input: set('$schema', 'https://sododeck.dev/schema/v1.json'),
    path: '$schema',
    code: 'schema-enum',
  },
  { name: 'missing $schema', input: remove('$schema'), path: '$schema', code: 'schema-required' },
  { name: 'missing nodes', input: remove('nodes'), path: 'nodes', code: 'schema-required' },
  { name: 'rules as array', input: set('rules', []), path: 'rules', code: 'schema-type' },
  {
    name: 'unknown top-level key',
    input: set('extra', true),
    path: 'extra',
    code: 'schema-unknown-field',
  },
  { name: 'empty deck name', input: set('name', ''), path: 'name', code: 'schema-range' },

  // Missing required field, per object type
  {
    name: 'node without type',
    input: remove('nodes.0.type'),
    path: 'nodes.0.type',
    code: 'schema-required',
  },
  {
    name: 'node without title',
    input: remove('nodes.0.title'),
    path: 'nodes.0.title',
    code: 'schema-required',
  },
  {
    name: 'group without title',
    input: remove('groups.0.title'),
    path: 'groups.0.title',
    code: 'schema-required',
  },
  {
    name: 'edge without to',
    input: remove('edges.0.to'),
    path: 'edges.0.to',
    code: 'schema-required',
  },
  {
    name: 'view without type',
    input: remove('views.0.type'),
    path: 'views.0.type',
    code: 'schema-required',
  },
  {
    name: 'feature without title',
    input: remove('features.0.title'),
    path: 'features.0.title',
    code: 'schema-required',
  },
  {
    name: 'flow without steps',
    input: remove('flows.0.steps'),
    path: 'flows.0.steps',
    code: 'schema-required',
  },
  {
    name: 'step without id',
    input: remove(`${STEP}.id`),
    path: `${STEP}.id`,
    code: 'schema-required',
  },
  {
    name: 'step without edge',
    input: remove(`${STEP}.edge`),
    path: `${STEP}.edge`,
    code: 'schema-required',
  },
  {
    name: 'branch without condition',
    input: remove(`${BRANCH}.condition`),
    path: `${BRANCH}.condition`,
    code: 'schema-required',
  },
  {
    name: 'branch without label',
    input: remove(`${BRANCH}.label`),
    path: `${BRANCH}.label`,
    code: 'schema-required',
  },
  {
    name: 'rule without hitPolicy',
    input: remove(`${RULE}.hitPolicy`),
    path: `${RULE}.hitPolicy`,
    code: 'schema-required',
  },
  {
    name: 'rule column without label',
    input: remove(`${RULE}.inputs.0.label`),
    path: `${RULE}.inputs.0.label`,
    code: 'schema-required',
  },
  {
    name: 'rule row without id',
    input: remove(`${RULE}.rows.0.id`),
    path: `${RULE}.rows.0.id`,
    code: 'schema-required',
  },
  {
    name: 'rule row without then',
    input: remove(`${RULE}.rows.0.then`),
    path: `${RULE}.rows.0.then`,
    code: 'schema-required',
  },
  {
    name: 'sticky without text',
    input: remove('stickies.0.text'),
    path: 'stickies.0.text',
    code: 'schema-required',
  },
  {
    name: 'link without url',
    input: remove('nodes.0.links.0.url'),
    path: 'nodes.0.links.0.url',
    code: 'schema-required',
  },
  {
    name: 'position without y',
    input: remove('nodes.0.position.y'),
    path: 'nodes.0.position.y',
    code: 'schema-required',
  },

  // Unknown key, per object type (reported at the key itself)
  {
    name: 'unknown key on node',
    input: set('nodes.0.kind', 'service'),
    path: 'nodes.0.kind',
    code: 'schema-unknown-field',
  },
  {
    name: 'unknown key on group',
    input: set('groups.0.x', 0),
    path: 'groups.0.x',
    code: 'schema-unknown-field',
  },
  {
    name: 'unknown key on edge',
    input: set('edges.0.proto', 'http'),
    path: 'edges.0.proto',
    code: 'schema-unknown-field',
  },
  {
    name: 'unknown key on view',
    input: set('views.0.level', 'system'),
    path: 'views.0.level',
    code: 'schema-unknown-field',
  },
  {
    name: 'unknown key on feature',
    input: set('features.0.flows', []),
    path: 'features.0.flows',
    code: 'schema-unknown-field',
  },
  {
    name: 'unknown key on flow',
    input: set('flows.0.name', 'x'),
    path: 'flows.0.name',
    code: 'schema-unknown-field',
  },
  {
    name: 'unknown key on branch',
    input: set(`${BRANCH}.from`, 's3'),
    path: `${BRANCH}.from`,
    code: 'schema-unknown-field',
  },
  {
    name: 'unknown key on rule',
    input: set(`${RULE}.policy`, 'first'),
    path: `${RULE}.policy`,
    code: 'schema-unknown-field',
  },
  {
    name: 'unknown key on rule column',
    input: set(`${RULE}.inputs.0.type`, 'number'),
    path: `${RULE}.inputs.0.type`,
    code: 'schema-unknown-field',
  },
  {
    name: 'unknown key on rule row',
    input: set(`${RULE}.rows.0.c`, []),
    path: `${RULE}.rows.0.c`,
    code: 'schema-unknown-field',
  },
  {
    name: 'unknown key on sticky',
    input: set('stickies.0.author', 'me'),
    path: 'stickies.0.author',
    code: 'schema-unknown-field',
  },
  {
    name: 'unknown key on link',
    input: set('nodes.0.links.0.href', 'x'),
    path: 'nodes.0.links.0.href',
    code: 'schema-unknown-field',
  },
  {
    name: 'unknown key on position',
    input: set('nodes.0.position.z', 1),
    path: 'nodes.0.position.z',
    code: 'schema-unknown-field',
  },
  {
    name: 'node rotation past half a turn',
    input: set('nodes.0.rotation', 200),
    path: 'nodes.0.rotation',
    code: 'schema-range',
  },
  {
    name: 'node rotation as text',
    input: set('nodes.0.rotation', '15'),
    path: 'nodes.0.rotation',
    code: 'schema-type',
  },

  // Enumerations
  {
    name: 'bad node level',
    input: set('nodes.0.level', 'module'),
    path: 'nodes.0.level',
    code: 'schema-enum',
  },
  {
    name: 'bad edge protocol',
    input: set('edges.0.protocol', 'HTTPS'),
    path: 'edges.0.protocol',
    code: 'schema-enum',
  },
  {
    name: 'bad edge direction',
    input: set('edges.0.direction', 'backward'),
    path: 'edges.0.direction',
    code: 'schema-enum',
  },
  {
    name: 'bad view type',
    input: set('views.0.type', 'dashboard'),
    path: 'views.0.type',
    code: 'schema-enum',
  },
  {
    name: 'bad view subtitleField',
    input: set('views.0.subtitleField', 'title'),
    path: 'views.0.subtitleField',
    code: 'schema-enum',
  },
  {
    name: 'view subtitleField "flow"',
    input: set('views.0.subtitleField', 'flow'),
    path: 'views.0.subtitleField',
    code: 'schema-enum',
  },
  {
    name: 'malformed type id in view excludeKinds',
    input: set('views.4.excludeKinds', ['external', 'Lambda']),
    path: 'views.4.excludeKinds.1',
    code: 'schema-pattern',
  },
  {
    name: 'malformed type id in view dimKinds',
    input: set('views.2.dimKinds', ['web browser']),
    path: 'views.2.dimKinds.0',
    code: 'schema-pattern',
  },
  {
    name: 'duplicate id in view pinned',
    input: set('views.2.pinned', ['orders-db', 'orders-db']),
    path: 'views.2.pinned.1',
    code: 'schema-unique',
  },
  {
    name: 'duplicate tag in view excludeTags',
    input: set('views.4.excludeTags', ['pci', 'pci']),
    path: 'views.4.excludeTags.1',
    code: 'schema-unique',
  },
  {
    name: 'bad id in view collapsed',
    input: set('views.0.collapsed', ['core services']),
    path: 'views.0.collapsed.0',
    code: 'schema-pattern',
  },
  {
    name: 'bad id in view excludeGroups',
    input: set('views.4.excludeGroups', ['']),
    path: 'views.4.excludeGroups.0',
    code: 'schema-pattern',
  },
  {
    name: 'bad rule hitPolicy',
    input: set(`${RULE}.hitPolicy`, 'First match'),
    path: `${RULE}.hitPolicy`,
    code: 'schema-enum',
  },
  {
    name: 'bad sticky color',
    input: set('stickies.0.color', 'yellow'),
    path: 'stickies.0.color',
    code: 'schema-enum',
  },
  {
    name: 'sticky collapsed is a string',
    input: set('stickies.0.collapsed', 'yes'),
    path: 'stickies.0.collapsed',
    code: 'schema-type',
  },
  {
    name: 'sticky showInFlows is a number',
    input: set('stickies.0.showInFlows', 1),
    path: 'stickies.0.showInFlows',
    code: 'schema-type',
  },

  // 053: sticky size, text size, alignment, tags and lock; connector lock.
  {
    name: 'sticky fontSize not in the list',
    input: set('stickies.0.fontSize', 13),
    path: 'stickies.0.fontSize',
    code: 'schema-union',
  },
  {
    name: 'sticky fontSize is a string',
    input: set('stickies.0.fontSize', '16'),
    path: 'stickies.0.fontSize',
    code: 'schema-union',
  },
  {
    name: 'sticky align not allowed',
    input: set('stickies.0.align', 'justify'),
    path: 'stickies.0.align',
    code: 'schema-enum',
  },
  {
    name: 'sticky locked false',
    input: set('stickies.0.locked', false),
    path: 'stickies.0.locked',
    code: 'schema-enum',
  },
  {
    name: 'sticky size with a zero width',
    input: set('stickies.0.size', { width: 0, height: 10 }),
    path: 'stickies.0.size.width',
    code: 'schema-range',
  },
  {
    name: 'sticky tags is a string',
    input: set('stickies.0.tags', 'a'),
    path: 'stickies.0.tags',
    code: 'schema-type',
  },
  {
    name: 'edge locked is a string',
    input: set('edges.0.locked', 'yes'),
    path: 'edges.0.locked',
    code: 'schema-enum',
  },
  {
    name: 'edge locked false',
    input: set('edges.0.locked', false),
    path: 'edges.0.locked',
    code: 'schema-enum',
  },

  // Card style and swatches (020)
  {
    name: 'style fill capitalized name',
    input: set('nodes.0.style.fill', 'Green'),
    path: 'nodes.0.style.fill',
    code: 'schema-pattern',
  },
  {
    name: 'style fill uppercase hex',
    input: set('nodes.0.style.fill', '#7A3CFF'),
    path: 'nodes.0.style.fill',
    code: 'schema-pattern',
  },
  {
    name: 'style fill short hex',
    input: set('nodes.0.style.fill', '#abc'),
    path: 'nodes.0.style.fill',
    code: 'schema-pattern',
  },
  {
    name: 'style fill unknown name',
    input: set('nodes.0.style.fill', 'purple'),
    path: 'nodes.0.style.fill',
    code: 'schema-pattern',
  },
  {
    name: 'empty style',
    input: set('nodes.0.style', {}),
    path: 'nodes.0.style',
    code: 'style-empty',
  },
  {
    name: 'unknown style key',
    input: set('nodes.0.style.opacity', 0.5),
    path: 'nodes.0.style.opacity',
    code: 'schema-unknown-field',
  },
  {
    name: 'group style stroke with trailing space',
    input: set('groups.1.style.stroke', 'red '),
    path: 'groups.1.style.stroke',
    code: 'schema-pattern',
  },
  {
    name: 'duplicate deck swatch',
    input: set('swatches', ['#7a3cff', '#7a3cff']),
    path: 'swatches.1',
    code: 'schema-unique',
  },
  {
    name: 'deck swatch missing #',
    input: set('swatches', ['7a3cff']),
    path: 'swatches.0',
    code: 'schema-pattern',
  },

  // Tag colours (033)
  {
    name: 'tag colour key is empty',
    input: set('tagColors', { '': 'red' }),
    path: 'tagColors.',
    code: 'tag-color-key',
  },
  {
    name: 'tag colour key is only spaces',
    input: set('tagColors', { '   ': 'red' }),
    path: 'tagColors.   ',
    code: 'tag-color-key',
  },
  {
    name: 'two tag colour keys equal ignoring case',
    input: set('tagColors', { PCI: 'violet', pci: 'red' }),
    path: 'tagColors.pci',
    code: 'tag-color-key',
  },
  {
    name: 'two tag colour keys equal after trimming and collapsing spaces',
    input: set('tagColors', { 'Pci dss': 'violet', ' pci   DSS ': 'red' }),
    path: 'tagColors. pci   DSS ',
    code: 'tag-color-key',
  },
  {
    name: 'tag colour is an unknown name',
    input: set('tagColors', { PCI: 'purple' }),
    path: 'tagColors.PCI',
    code: 'schema-pattern',
  },
  {
    name: 'tag colour is an uppercase hex',
    input: set('tagColors', { PCI: '#7A3CFF' }),
    path: 'tagColors.PCI',
    code: 'schema-pattern',
  },
  {
    name: 'tag colour is a number',
    input: set('tagColors', { PCI: 3 }),
    path: 'tagColors.PCI',
    code: 'schema-union',
  },
  {
    name: 'node type is uppercase',
    input: set('nodes.0.type', 'Service'),
    path: 'nodes.0.type',
    code: 'schema-pattern',
  },
  {
    name: 'node type is empty',
    input: set('nodes.0.type', ''),
    path: 'nodes.0.type',
    code: 'schema-pattern',
  },
  {
    name: 'node type has a space',
    input: set('nodes.0.type', 'a b'),
    path: 'nodes.0.type',
    code: 'schema-pattern',
  },
  {
    name: 'node type is 49 characters',
    input: set('nodes.0.type', `a${'b'.repeat(48)}`),
    path: 'nodes.0.type',
    code: 'schema-pattern',
  },
  {
    name: 'node display is icon',
    input: set('nodes.0.display', 'icon'),
    path: 'nodes.0.display',
    code: 'schema-enum',
  },
  {
    name: 'node display is a number',
    input: set('nodes.0.display', 1),
    path: 'nodes.0.display',
    code: 'schema-enum',
  },
  { name: 'packs is empty', input: set('packs', []), path: 'packs', code: 'schema-range' },
  {
    name: 'duplicate pack ids',
    input: set('packs', ['architecture', 'architecture']),
    path: 'packs.1',
    code: 'schema-unique',
  },
  {
    name: 'pack id is uppercase',
    input: set('packs', ['Process']),
    path: 'packs.0',
    code: 'schema-pattern',
  },
  {
    name: 'tagColors is an array',
    input: set('tagColors', ['violet']),
    path: 'tagColors',
    code: 'schema-type',
  },

  // Typed fields (032): S12 / S13 and shapes
  {
    name: 'duplicate field ids',
    input: set('fields.1.id', 'warehouse.capacity'),
    path: 'fields.1.id',
    code: 'field-definition',
  },
  {
    name: 'built-in owner with kind text',
    input: set('fields.9.kind', 'text'),
    path: 'fields.9.kind',
    code: 'field-definition',
  },
  {
    name: 'unit on a select field',
    input: set('fields.2.unit', 'h'),
    path: 'fields.2.unit',
    code: 'field-definition',
  },
  {
    name: 'options on a number field',
    input: set('fields.1.options', [{ id: 'o_a', label: 'A' }]),
    path: 'fields.1.options',
    code: 'field-definition',
  },
  {
    name: 'duplicate option ids in a field',
    input: set('fields.2.options.1.id', 'o_south'),
    path: 'fields.2.options.1.id',
    code: 'field-definition',
  },
  {
    name: 'icon on a select option',
    input: set('fields.2.options.0.icon', 'circle'),
    path: 'fields.2.options.0.icon',
    code: 'field-definition',
  },
  {
    name: 'built-in tech in values',
    input: set('nodes.9.values.tech', 'Go'),
    path: 'nodes.9.values.tech',
    code: 'card-value-key',
  },
  {
    name: 'empty field name',
    input: set('fields.0.name', ''),
    path: 'fields.0.name',
    code: 'schema-range',
  },
  {
    name: 'unknown field kind',
    input: set('fields.0.kind', 'formula'),
    path: 'fields.0.kind',
    code: 'schema-enum',
  },
  {
    name: 'unknown status icon',
    input: set('fields.3.options.0.icon', 'star'),
    path: 'fields.3.options.0.icon',
    code: 'schema-enum',
  },
  {
    name: 'empty option label',
    input: set('fields.2.options.0.label', ''),
    path: 'fields.2.options.0.label',
    code: 'schema-range',
  },
  {
    name: 'unit longer than 12',
    input: set('fields.1.unit', 'h'.repeat(13)),
    path: 'fields.1.unit',
    code: 'schema-range',
  },
  {
    name: 'unknown key on a field',
    input: set('fields.0.hidden', true),
    path: 'fields.0.hidden',
    code: 'schema-unknown-field',
  },
  {
    name: 'duplicate types in a field',
    input: set('fields.0.types', ['warehouse', 'warehouse']),
    path: 'fields.0.types.1',
    code: 'schema-unique',
  },
  {
    name: 'duplicate fieldDefaults',
    input: set('fieldDefaults', ['warehouse', 'warehouse']),
    path: 'fieldDefaults.1',
    code: 'schema-unique',
  },
  {
    name: 'fieldDefaults id is uppercase',
    input: set('fieldDefaults', ['Task']),
    path: 'fieldDefaults.0',
    code: 'schema-pattern',
  },
  {
    name: 'value is a boolean',
    input: set('nodes.9.values.f_notes', true),
    path: 'nodes.9.values.f_notes',
    code: 'schema-union',
  },
  {
    name: 'date range value with an unknown key',
    input: set('nodes.9.values.f_audit', { from: '2026-10-06', until: '2026-10-17' }),
    path: 'nodes.9.values.f_audit',
    code: 'schema-union',
  },
  {
    name: 'link value without url',
    input: set('nodes.9.values.f_runbook', { label: 'Runbook' }),
    path: 'nodes.9.values.f_runbook.url',
    code: 'schema-required',
  },
  {
    name: 'values key is not an id',
    input: set('nodes.9.values.bad key', 'x'),
    path: 'nodes.9.values.bad key',
    code: 'map-key-id',
  },

  // Ids
  {
    name: 'id with a space',
    input: set('nodes.0.id', 'order svc'),
    path: 'nodes.0.id',
    code: 'schema-pattern',
  },
  {
    name: 'id longer than 64 characters',
    input: set('nodes.0.id', 'a'.repeat(65)),
    path: 'nodes.0.id',
    code: 'schema-pattern',
  },
  { name: 'empty id', input: set('nodes.0.id', ''), path: 'nodes.0.id', code: 'schema-pattern' },
  {
    name: 'reference that is not an id',
    input: set('edges.0.from', 'customer app'),
    path: 'edges.0.from',
    code: 'schema-pattern',
  },

  // Wrong value types
  {
    name: 'title is a number',
    input: set('nodes.0.title', 42),
    path: 'nodes.0.title',
    code: 'schema-type',
  },
  {
    name: 'empty title',
    input: set('nodes.0.title', ''),
    path: 'nodes.0.title',
    code: 'schema-range',
  },
  {
    name: 'position x is a string',
    input: set('nodes.0.position.x', '10'),
    path: 'nodes.0.position.x',
    code: 'schema-type',
  },
  {
    name: 'tags is a string',
    input: set('nodes.0.tags', 'pci'),
    path: 'nodes.0.tags',
    code: 'schema-type',
  },
  {
    name: 'errorPath is a string',
    input: set(`${BRANCH}.errorPath`, 'yes'),
    path: `${BRANCH}.errorPath`,
    code: 'schema-type',
  },
  {
    name: 'step branch that is not an id',
    input: set(`${STEP}.branch`, 'payment failed'),
    path: `${STEP}.branch`,
    code: 'schema-pattern',
  },
  {
    name: 'step branch that is an object',
    input: set(`${STEP}.branch`, { kind: 'error' }),
    path: `${STEP}.branch`,
    code: 'schema-type',
  },

  // Semantic rules
  {
    name: 'rule row with too few when cells',
    input: set(`${RULE}.rows.1.when`, ['≤ 5', '≤ 10']),
    path: `${RULE}.rows.1.when`,
    code: 'rule-row-cells',
  },
  {
    name: 'rule row with too many then cells',
    input: set(`${RULE}.rows.1.then`, ['Bike', '2 h', '€0.00', 'extra']),
    path: `${RULE}.rows.1.then`,
    code: 'rule-row-cells',
  },
  {
    name: 'sticky without a position',
    input: remove('stickies.0.position'),
    path: 'stickies.0',
    code: 'sticky-placement',
  },
  {
    name: 'rules key that is not an id',
    input: renameKey('rules', 'notify-channels', 'notify channels'),
    path: 'rules.notify channels',
    code: 'map-key-id',
  },
  {
    name: 'view position key that is not an id',
    input: renameKey('views.2.positions', 'orders-db', 'orders db'),
    path: 'views.2.positions.orders db',
    code: 'map-key-id',
  },
  {
    name: 'ruleInputs rule key that is not an id',
    input: renameKey(`${STEP}.ruleInputs`, 'notify-channels', 'notify channels'),
    path: `${STEP}.ruleInputs.notify channels`,
    code: 'map-key-id',
  },
  {
    name: 'ruleInputs column key that is not an id',
    input: renameKey(`${STEP}.ruleInputs.delivery-tier`, 'distance', 'distance km'),
    path: `${STEP}.ruleInputs.delivery-tier.distance km`,
    code: 'map-key-id',
  },

  // Group frames (016)
  {
    name: 'group with position but no size',
    input: remove(`${GROUP}.size`),
    path: GROUP,
    code: 'group-frame-pair',
  },
  {
    name: 'group size with zero width',
    input: set(`${GROUP}.size.width`, 0),
    path: `${GROUP}.size.width`,
    code: 'schema-range',
  },
  {
    name: 'group size with an unknown key',
    input: set(`${GROUP}.size.depth`, 3),
    path: `${GROUP}.size.depth`,
    code: 'schema-unknown-field',
  },
  {
    name: 'view groupFrames key that is not a group',
    input: renameKey(FRAMES, 'data', 'orders-db'),
    path: `${FRAMES}.orders-db`,
    code: 'view-frame-group',
  },
  {
    name: 'view groupFrames value without size',
    input: remove(`${FRAMES}.data.size`),
    path: `${FRAMES}.data.size`,
    code: 'schema-required',
  },

  // Connector line type (029)
  {
    name: 'edge style shape is not a shape',
    input: set('edges.0.style.shape', 'zigzag'),
    path: 'edges.0.style.shape',
    code: 'schema-enum',
  },
  {
    name: 'empty edge style',
    input: set('edges.0.style', {}),
    path: 'edges.0.style',
    code: 'edge-style-empty',
  },
  {
    name: 'edge style with an unknown key',
    input: set('edges.0.style.fill', 'red'),
    path: 'edges.0.style.fill',
    code: 'schema-unknown-field',
  },

  // Connector style, anchors, bends and label position (022)
  {
    name: 'edge style dash is not a dash',
    input: set('edges.0.style.dash', 'wavy'),
    path: 'edges.0.style.dash',
    code: 'schema-enum',
  },
  {
    name: 'edge style width is not a step',
    input: set('edges.0.style.width', 2.5),
    path: 'edges.0.style.width',
    code: 'schema-union',
  },
  {
    name: 'edge style width is zero',
    input: set('edges.0.style.width', 0),
    path: 'edges.0.style.width',
    code: 'schema-union',
  },
  {
    name: 'edge style animated is a string',
    input: set('edges.0.style.animated', 'yes'),
    path: 'edges.0.style.animated',
    code: 'schema-type',
  },
  {
    name: 'edge style colour is not a colour',
    input: set('edges.0.style.color', 'teal-ish'),
    path: 'edges.0.style.color',
    code: 'schema-pattern',
  },
  {
    name: 'edge route fromAt above 1',
    input: set('edges.1.route.fromAt', 1.2),
    path: 'edges.1.route.fromAt',
    code: 'schema-range',
  },
  {
    name: 'edge route toAt below 0',
    input: set('edges.1.route.toAt', -0.1),
    path: 'edges.1.route.toAt',
    code: 'schema-range',
  },
  {
    name: 'edge route fromAt without fromSide (S9)',
    input: set('edges.1.route', { toSide: 'top', fromAt: 0.5 }),
    path: 'edges.1.route.fromAt',
    code: 'route-anchor-side',
  },
  {
    name: 'edge route toAt without toSide (S9)',
    input: set('edges.1.route', { fromSide: 'bottom', toAt: 0.5 }),
    path: 'edges.1.route.toAt',
    code: 'route-anchor-side',
  },
  {
    name: 'edge route with offset and waypoints (S10)',
    input: set('edges.1.route.offset', 12),
    path: 'edges.1.route',
    code: 'route-offset-and-waypoints',
  },
  {
    name: 'edge route with no waypoints in the list',
    input: set('edges.1.route.waypoints', []),
    path: 'edges.1.route.waypoints',
    code: 'route-waypoint',
  },
  {
    name: 'waypoint with x and dx (S11)',
    input: set('edges.1.route.waypoints.0.dx', 4),
    path: 'edges.1.route.waypoints.0',
    code: 'route-waypoint',
  },
  {
    name: 'waypoint with no y or dy (S11)',
    input: set('edges.1.route.waypoints', [{ x: 0.5 }]),
    path: 'edges.1.route.waypoints.0',
    code: 'route-waypoint',
  },
  {
    name: 'waypoint with an unknown key',
    input: set('edges.1.route.waypoints.0.z', 1),
    path: 'edges.1.route.waypoints.0.z',
    code: 'schema-unknown-field',
  },
  {
    name: 'waypoint x is a string',
    input: set('edges.1.route.waypoints.0.x', '0.5'),
    path: 'edges.1.route.waypoints.0.x',
    code: 'schema-type',
  },
  {
    name: 'edge labelAt below 0',
    input: set('edges.0.labelAt', -0.1),
    path: 'edges.0.labelAt',
    code: 'schema-range',
  },
  {
    name: 'edge labelAt above 1',
    input: set('edges.0.labelAt', 1.5),
    path: 'edges.0.labelAt',
    code: 'schema-range',
  },

  // Card size and connector route (017)
  {
    name: 'node size with zero width',
    input: set('nodes.0.size.width', 0),
    path: 'nodes.0.size.width',
    code: 'schema-range',
  },
  {
    name: 'edge route fromSide is not a side',
    input: set('edges.0.route.fromSide', 'middle'),
    path: 'edges.0.route.fromSide',
    code: 'schema-enum',
  },
  {
    name: 'edge route with an unknown key',
    input: set('edges.0.route.points', []),
    path: 'edges.0.route.points',
    code: 'schema-unknown-field',
  },
  {
    name: 'edge route offset is a string',
    input: set('edges.0.route.offset', '10'),
    path: 'edges.0.route.offset',
    code: 'schema-type',
  },

  // Database schema (040): nodes 12–15 are tables, edges 7–11 relationships.
  {
    name: 'column without a type',
    input: remove(`${CUSTOMERS}.columns.0.type`),
    path: `${CUSTOMERS}.columns.0.type`,
    code: 'schema-required',
  },
  {
    name: 'column flag with a typo (notnull)',
    input: set(`${CUSTOMERS}.columns.0.notnull`, true),
    path: `${CUSTOMERS}.columns.0.notnull`,
    code: 'schema-unknown-field',
  },
  {
    name: 'column size with a dot (10.2)',
    input: set(`${ORDERS}.columns.2.size`, '10.2'),
    path: `${ORDERS}.columns.2.size`,
    code: 'schema-pattern',
  },
  {
    name: 'column with both default and defaultExpr (S14)',
    input: set(`${CUSTOMERS}.columns.3.default`, 'today'),
    path: `${CUSTOMERS}.columns.3.defaultExpr`,
    code: 'column-default',
  },
  {
    name: 'index without columns',
    input: set(`${CUSTOMERS}.indexes.0.columns`, []),
    path: `${CUSTOMERS}.indexes.0.columns`,
    code: 'schema-range',
  },
  {
    name: 'index part with an empty expression',
    input: set(`${CUSTOMERS}.indexes.0.columns.0.expr`, ''),
    path: `${CUSTOMERS}.indexes.0.columns.0.expr`,
    code: 'schema-range',
  },
  {
    name: 'index part that is neither an id nor { expr }',
    input: set(`${ORDERS}.indexes.0.columns.0`, { column: 'x' }),
    path: `${ORDERS}.indexes.0.columns.0`,
    code: 'schema-union',
  },
  {
    name: 'index method in upper case',
    input: set(`${CUSTOMERS}.indexes.0.method`, 'BTREE'),
    path: `${CUSTOMERS}.indexes.0.method`,
    code: 'schema-pattern',
  },
  {
    name: 'table detail is not a level',
    input: set(`${CUSTOMERS}.detail`, 'full'),
    path: `${CUSTOMERS}.detail`,
    code: 'schema-enum',
  },
  {
    name: 'unknown cardinality',
    input: set(`${RELATION}.cardinality`, 'many'),
    path: `${RELATION}.cardinality`,
    code: 'schema-enum',
  },
  {
    name: 'unknown referential action',
    input: set(`${RELATION}.onDelete`, 'set null'),
    path: `${RELATION}.onDelete`,
    code: 'schema-enum',
  },
  {
    name: 'empty fromColumns',
    input: set(`${RELATION}.fromColumns`, []),
    path: `${RELATION}.fromColumns`,
    code: 'schema-range',
  },
  {
    name: 'a column twice in toColumns',
    input: set(`${RELATION}.toColumns`, ['cust-id', 'cust-id']),
    path: `${RELATION}.toColumns.1`,
    code: 'schema-unique',
  },
  {
    name: 'unknown dialect',
    input: set('dialect', 'oracle'),
    path: 'dialect',
    code: 'schema-enum',
  },
  {
    name: 'blockSqlExport false',
    input: set('blockSqlExport', false),
    path: 'blockSqlExport',
    code: 'schema-enum',
  },
  {
    name: 'blockSqlExport as text',
    input: set('blockSqlExport', 'yes'),
    path: 'blockSqlExport',
    code: 'schema-enum',
  },
  {
    name: 'enum without values',
    input: remove('enums.0.values'),
    path: 'enums.0.values',
    code: 'schema-required',
  },
  // 041: table display and enum colour.
  {
    name: 'table detail "auto" (Auto is the absent key)',
    input: set('tableDisplay.detail', 'auto'),
    path: 'tableDisplay.detail',
    code: 'schema-enum',
  },
  {
    name: 'unknown table display key',
    input: set('tableDisplay.showTypes', true),
    path: 'tableDisplay.showTypes',
    code: 'schema-unknown-field',
  },
  {
    name: 'table display flag is not a boolean',
    input: set('tableDisplay.hideNotes', 'yes'),
    path: 'tableDisplay.hideNotes',
    code: 'schema-type',
  },
  {
    name: 'enum colour is not a palette name or hex',
    input: set('enums.0.color', 'purple-ish'),
    path: 'enums.0.color',
    code: 'schema-pattern',
  },
  // 042: relationship display.
  {
    name: 'relationship labels "sometimes"',
    input: set('relationshipDisplay.labels', 'sometimes'),
    path: 'relationshipDisplay.labels',
    code: 'schema-enum',
  },
  {
    name: 'relationship notation "crow" (crow\'s foot is the absent key)',
    input: set('relationshipDisplay.notation', 'crow'),
    path: 'relationshipDisplay.notation',
    code: 'schema-enum',
  },
  {
    name: 'relationship hideEnds is not a boolean',
    input: set('relationshipDisplay.hideEnds', 'yes'),
    path: 'relationshipDisplay.hideEnds',
    code: 'schema-type',
  },
  {
    name: 'unknown relationship display key',
    input: set('relationshipDisplay.showLabels', true),
    path: 'relationshipDisplay.showLabels',
    code: 'schema-unknown-field',
  },
  // 048: grouping mode, view schemas and view detail.
  {
    name: 'grouping mode "group" (By group is the absent key)',
    input: set('groupingMode', 'group'),
    path: 'groupingMode',
    code: 'schema-enum',
  },
  {
    name: 'grouping mode is not a string',
    input: set('groupingMode', true),
    path: 'groupingMode',
    code: 'schema-enum',
  },
  {
    name: 'view schemas is empty',
    input: set('views.4.schemas', []),
    path: 'views.4.schemas',
    code: 'schema-range',
  },
  {
    name: 'view schema name is empty',
    input: set('views.4.schemas', ['']),
    path: 'views.4.schemas.0',
    code: 'schema-range',
  },
  {
    name: 'view schemas is not a list',
    input: set('views.4.schemas', 'sales'),
    path: 'views.4.schemas',
    code: 'schema-type',
  },
  {
    name: 'view detail "auto" (absent means the deck or table setting)',
    input: set('views.4.detail', 'auto'),
    path: 'views.4.detail',
    code: 'schema-enum',
  },
  {
    name: 'view detail is not a string',
    input: set('views.4.detail', 3),
    path: 'views.4.detail',
    code: 'schema-enum',
  },
  // 043: node lock. Only `true` is valid; unlocking removes the key.
  {
    name: 'locked false (unlocked is the absent key)',
    input: set('nodes.2.locked', false),
    path: 'nodes.2.locked',
    code: 'schema-enum',
  },
  {
    name: 'locked is not a boolean',
    input: set('nodes.2.locked', 'yes'),
    path: 'nodes.2.locked',
    code: 'schema-enum',
  },
  // 049: step touches.
  {
    name: 'touch without a table',
    input: remove(`${TOUCHES}.0.table`),
    path: `${TOUCHES}.0.table`,
    code: 'schema-required',
  },
  {
    name: 'touch access "update"',
    input: set(`${TOUCHES}.0.access`, 'update'),
    path: `${TOUCHES}.0.access`,
    code: 'schema-enum',
  },
  {
    name: 'touch with an unknown key',
    input: set(`${TOUCHES}.0.columns`, ['order-id']),
    path: `${TOUCHES}.0.columns`,
    code: 'schema-unknown-field',
  },
  {
    name: 'two touches of one step on the same table and column (S15)',
    input: set(`${TOUCHES}.2`, { table: 'orders', access: 'read' }),
    path: `${TOUCHES}.2`,
    code: 'step-touch-repeat',
  },
  // 055: images and assets.
  {
    name: 'image without an asset',
    input: remove(`${IMAGE}.asset`),
    path: `${IMAGE}.asset`,
    code: 'schema-required',
  },
  {
    name: 'image asset is not 64 hex',
    input: set(`${IMAGE}.asset`, 'abc123'),
    path: `${IMAGE}.asset`,
    code: 'schema-pattern',
  },
  {
    name: 'image asset not in assets (I1)',
    input: set(`${IMAGE}.asset`, 'f'.repeat(64)),
    path: `${IMAGE}.asset`,
    code: 'image-asset-missing',
  },
  {
    name: 'image smaller than 32 px (I6)',
    input: set(`${IMAGE}.size`, { width: 8, height: 100 }),
    path: `${IMAGE}.size.width`,
    code: 'image-too-small',
  },
  {
    name: 'image z is a string',
    input: set(`${IMAGE}.z`, '1'),
    path: `${IMAGE}.z`,
    code: 'schema-type',
  },
  {
    name: 'node z is a string',
    input: set('nodes.2.z', '1'),
    path: 'nodes.2.z',
    code: 'schema-type',
  },
  {
    name: 'image locked false',
    input: set(`${IMAGE}.locked`, false),
    path: `${IMAGE}.locked`,
    code: 'schema-enum',
  },
  {
    name: 'image alt is a number',
    input: set(`${IMAGE}.alt`, 3),
    path: `${IMAGE}.alt`,
    code: 'schema-type',
  },
  {
    name: 'unknown key on image',
    input: set(`${IMAGE}.rotate`, 90),
    path: `${IMAGE}.rotate`,
    code: 'schema-unknown-field',
  },
  // 057: crop and flip.
  ...(
    [
      ['crop x of 1', { x: 1, y: 0, width: 0.5, height: 0.5 }, 'crop.x', 'schema-range'],
      ['crop x below 0', { x: -0.1, y: 0, width: 0.5, height: 0.5 }, 'crop.x', 'schema-range'],
      ['crop width of 0', { x: 0, y: 0, width: 0, height: 0.5 }, 'crop.width', 'schema-range'],
      [
        'crop height over 1',
        { x: 0, y: 0, width: 0.5, height: 1.5 },
        'crop.height',
        'schema-range',
      ],
      ['crop x as a string', { x: '0.2', y: 0, width: 0.5, height: 0.5 }, 'crop.x', 'schema-type'],
      ['crop without height', { x: 0, y: 0, width: 0.5 }, 'crop.height', 'schema-required'],
      [
        'crop with an extra key',
        { x: 0, y: 0, width: 0.5, height: 0.5, r: 1 },
        'crop.r',
        'schema-unknown-field',
      ],
    ] as const
  ).map(([name, crop, path, code]) => ({
    name,
    input: set(`${IMAGE}.crop`, crop),
    path: `${IMAGE}.${path}`,
    code,
  })),
  {
    name: 'image flipX false',
    input: set(`${IMAGE}.flipX`, false),
    path: `${IMAGE}.flipX`,
    code: 'schema-enum',
  },
  {
    name: 'image flipY "yes"',
    input: set(`${IMAGE}.flipY`, 'yes'),
    path: `${IMAGE}.flipY`,
    code: 'schema-enum',
  },
  {
    name: 'image group names no group (I3)',
    input: set(`${IMAGE}.group`, 'nowhere'),
    path: `${IMAGE}.group`,
    code: 'image-group-missing',
  },
  {
    name: 'image id equals a card id (I5)',
    input: set(`${IMAGE}.id`, 'order-svc'),
    path: `${IMAGE}.id`,
    code: 'image-id-clash',
  },
  {
    name: 'image id equals a group id (I5)',
    input: set(`${IMAGE}.id`, 'core'),
    path: `${IMAGE}.id`,
    code: 'image-id-clash',
  },
  {
    name: 'image id equals a sticky id (I5)',
    input: set(`${IMAGE}.id`, 'note-1'),
    path: `${IMAGE}.id`,
    code: 'image-id-clash',
  },
  {
    name: 'asset with an unlisted type',
    input: set(`${ASSET_PNG}.type`, 'image/bmp'),
    path: `${ASSET_PNG}.type`,
    code: 'schema-enum',
  },
  {
    name: 'asset bytes above 5 MiB',
    input: set(`${ASSET_PNG}.bytes`, 5_242_881),
    path: `${ASSET_PNG}.bytes`,
    code: 'schema-range',
  },
  {
    name: 'asset bytes differ from the decoded data (I4)',
    input: set(`${ASSET_PNG}.bytes`, 7),
    path: `${ASSET_PNG}.data`,
    code: 'asset-data',
  },
  {
    name: 'asset data is not base64',
    input: set(`${ASSET_PNG}.data`, 'not base64!'),
    path: `${ASSET_PNG}.data`,
    code: 'schema-pattern',
  },
  {
    name: 'asset width 0',
    input: set(`${ASSET_PNG}.width`, 0),
    path: `${ASSET_PNG}.width`,
    code: 'schema-range',
  },
  {
    name: 'asset without data',
    input: remove(`${ASSET_PNG}.data`),
    path: `${ASSET_PNG}.data`,
    code: 'schema-required',
  },
  {
    name: 'unknown key on asset',
    input: set(`${ASSET_PNG}.alt`, 'x'),
    path: `${ASSET_PNG}.alt`,
    code: 'schema-unknown-field',
  },
  {
    name: 'assets key is not a picture id (I4)',
    input: renameKey('assets', PNG_ID, 'checkout'),
    path: 'assets.checkout',
    code: 'asset-id',
  },
  { name: 'assets as array', input: set('assets', []), path: 'assets', code: 'schema-type' },
  { name: 'images as object', input: set('images', {}), path: 'images', code: 'schema-type' },
];

/**
 * Valid decks beyond the examples. 050 lets a connector end name a group: card → group,
 * group → card and group → group, each with a route and a style, read against the group frame.
 */
export const validFixtures: { name: string; input: unknown }[] = [
  // ADR 0041: the deprecated sticky `anchor` still validates, so older files open.
  {
    name: 'sticky with a legacy anchor only',
    input: set('stickies.0', { id: 'old', text: 'Pinned', anchor: 'order-svc' }),
  },
  {
    name: 'sticky with a legacy anchor and an offset',
    input: set('stickies.0.anchor', 'order-svc'),
  },
  // 055: images. An unused asset is allowed (I2), a z on a card, an image with every field,
  // a connector that ends on an image.
  { name: 'an unused asset (I2)', input: remove('images') },
  { name: 'a deck with no images and no assets', input: removeBoth() },
  { name: 'node z', input: set('nodes.2.z', 3) },
  { name: 'fractional z', input: set(`${IMAGE}.z`, 2.5) },
  { name: 'image without z', input: remove(`${IMAGE}.z`) },
  { name: 'connector ends on an image', input: set('edges.0.to', 'img-wireframe') },
  { name: 'image of 32 px', input: set(`${IMAGE}.size`, { width: 32, height: 32 }) },
  // 057: an image with crop and both flips (the full example's second image has them too).
  {
    name: 'image with crop, flipX and flipY',
    input: set(IMAGE, {
      ...(full as { images: Record<string, unknown>[] }).images[0],
      crop: { x: 0.25, y: 0.1, width: 0.5, height: 0.5 },
      flipX: true,
      flipY: true,
    }),
  },
  { name: 'whole-picture crop', input: set(`${IMAGE}.crop`, { x: 0, y: 0, width: 1, height: 1 }) },
  // 053: a sticky with every new field, a locked connector, and a connector that ends on a sticky.
  {
    name: 'sticky with size, fontSize, align, tags and locked',
    input: {
      ...emptySododeckFile(),
      name: 'Sticky fields',
      nodes: [{ id: 'n1', type: 'service', title: 'Orders' }],
      stickies: [
        {
          id: 'st1',
          text: 'Why two queues?',
          color: 'blue',
          position: { x: 40, y: -120 },
          size: { width: 220, height: 160 },
          fontSize: 16,
          align: 'left',
          tags: ['Question'],
          locked: true,
        },
      ],
      edges: [
        { id: 'e1', from: 'st1', to: 'n1', locked: true },
        { id: 'e2', from: 'n1', to: 'st1' },
      ],
    },
  },
  { name: 'sticky fontSize 12', input: set('stickies.0.fontSize', 12) },
  { name: 'sticky fontSize 32', input: set('stickies.0.fontSize', 32) },
  { name: 'sticky align right', input: set('stickies.0.align', 'right') },
  { name: 'locked connector', input: set('edges.0.locked', true) },
  // 052: block SQL export.
  { name: 'block SQL export on', input: set('blockSqlExport', true) },
  // 043: `locked` on any node type.
  { name: 'locked card', input: set('nodes.2.locked', true) },
  { name: 'locked shape', input: set('nodes.8.locked', true) },
  { name: 'locked table', input: set(`${CUSTOMERS}.locked`, true) },
  // 049: a table touch and touches of its own columns coexist; an empty list is valid.
  { name: 'empty touches', input: set(TOUCHES, []) },
  {
    name: 'a table touch next to its column touch',
    input: set(`${TOUCHES}.3`, { table: 'customers', access: 'write' }),
  },
  // 048: the only grouping mode that is stored, and a view with one schema and every detail level.
  { name: 'grouping mode schema', input: set('groupingMode', 'schema') },
  { name: 'view detail names', input: set('views.4.detail', 'names') },
  { name: 'view detail keys', input: set('views.4.detail', 'keys') },
  { name: 'view with several schemas', input: set('views.4.schemas', ['sales', 'billing']) },
  // 042: relationship display, empty and with every key.
  { name: 'empty relationship display', input: set('relationshipDisplay', {}) },
  {
    name: 'relationship display with every key',
    input: set('relationshipDisplay', { hideEnds: true, labels: 'off', notation: 'numeric' }),
  },
  {
    name: 'connectors with group ends (050)',
    input: {
      ...emptySododeckFile(),
      name: 'Group ends',
      nodes: [{ id: 'web', type: 'client', title: 'Web', group: 'edge' }],
      groups: [
        { id: 'edge', title: 'Edge', position: { x: 0, y: 0 }, size: { width: 240, height: 160 } },
        { id: 'core', title: 'Core' },
      ],
      edges: [
        {
          id: 'card-to-group',
          from: 'web',
          to: 'core',
          route: { fromSide: 'right', toSide: 'left', toAt: 0.25 },
          style: { shape: 'elbow' },
        },
        {
          id: 'group-to-card',
          from: 'core',
          to: 'web',
          route: { waypoints: [{ x: 0.5, y: 0.5 }] },
          style: { dash: 'dashed' },
        },
        { id: 'group-to-group', from: 'edge', to: 'core', style: { width: 3 } },
      ],
    },
  },
];
