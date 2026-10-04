import { emptySododeckFile } from '../src';
import { readExample } from './schema-walk';

/**
 * Invalid fixtures (spec FR-026). Each one breaks exactly one thing in a copy of
 * `examples/full.sododeck.json`; `path` is where the app's validator must report the problem.
 */
export interface InvalidFixture {
  name: string;
  input: unknown;
  path: string;
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

export const invalidFixtures: InvalidFixture[] = [
  // Envelope
  { name: 'wrong version', input: set('version', 2), path: 'version' },
  {
    name: 'wrong $schema',
    input: set('$schema', 'https://sododeck.dev/schema/v1.json'),
    path: '$schema',
  },
  { name: 'missing $schema', input: remove('$schema'), path: '$schema' },
  { name: 'missing nodes', input: remove('nodes'), path: 'nodes' },
  { name: 'rules as array', input: set('rules', []), path: 'rules' },
  { name: 'unknown top-level key', input: set('extra', true), path: '' },
  { name: 'empty deck name', input: set('name', ''), path: 'name' },

  // Missing required field, per object type
  { name: 'node without type', input: remove('nodes.0.type'), path: 'nodes.0.type' },
  { name: 'node without title', input: remove('nodes.0.title'), path: 'nodes.0.title' },
  { name: 'group without title', input: remove('groups.0.title'), path: 'groups.0.title' },
  { name: 'edge without to', input: remove('edges.0.to'), path: 'edges.0.to' },
  { name: 'view without type', input: remove('views.0.type'), path: 'views.0.type' },
  { name: 'feature without title', input: remove('features.0.title'), path: 'features.0.title' },
  { name: 'flow without steps', input: remove('flows.0.steps'), path: 'flows.0.steps' },
  { name: 'step without id', input: remove(`${STEP}.id`), path: `${STEP}.id` },
  { name: 'step without edge', input: remove(`${STEP}.edge`), path: `${STEP}.edge` },
  {
    name: 'branch without condition',
    input: remove(`${BRANCH}.condition`),
    path: `${BRANCH}.condition`,
  },
  { name: 'branch without label', input: remove(`${BRANCH}.label`), path: `${BRANCH}.label` },
  { name: 'rule without hitPolicy', input: remove(`${RULE}.hitPolicy`), path: `${RULE}.hitPolicy` },
  {
    name: 'rule column without label',
    input: remove(`${RULE}.inputs.0.label`),
    path: `${RULE}.inputs.0.label`,
  },
  { name: 'rule row without id', input: remove(`${RULE}.rows.0.id`), path: `${RULE}.rows.0.id` },
  {
    name: 'rule row without then',
    input: remove(`${RULE}.rows.0.then`),
    path: `${RULE}.rows.0.then`,
  },
  { name: 'sticky without text', input: remove('stickies.0.text'), path: 'stickies.0.text' },
  { name: 'link without url', input: remove('nodes.0.links.0.url'), path: 'nodes.0.links.0.url' },
  { name: 'position without y', input: remove('nodes.0.position.y'), path: 'nodes.0.position.y' },

  // Unknown key, per object type (reported on the object; the message names the key)
  { name: 'unknown key on node', input: set('nodes.0.kind', 'service'), path: 'nodes.0' },
  { name: 'unknown key on group', input: set('groups.0.x', 0), path: 'groups.0' },
  { name: 'unknown key on edge', input: set('edges.0.proto', 'http'), path: 'edges.0' },
  { name: 'unknown key on view', input: set('views.0.level', 'system'), path: 'views.0' },
  { name: 'unknown key on feature', input: set('features.0.flows', []), path: 'features.0' },
  { name: 'unknown key on flow', input: set('flows.0.name', 'x'), path: 'flows.0' },
  { name: 'unknown key on branch', input: set(`${BRANCH}.from`, 's3'), path: BRANCH },
  { name: 'unknown key on rule', input: set(`${RULE}.policy`, 'first'), path: RULE },
  {
    name: 'unknown key on rule column',
    input: set(`${RULE}.inputs.0.type`, 'number'),
    path: `${RULE}.inputs.0`,
  },
  { name: 'unknown key on rule row', input: set(`${RULE}.rows.0.c`, []), path: `${RULE}.rows.0` },
  { name: 'unknown key on sticky', input: set('stickies.0.author', 'me'), path: 'stickies.0' },
  { name: 'unknown key on link', input: set('nodes.0.links.0.href', 'x'), path: 'nodes.0.links.0' },
  {
    name: 'unknown key on position',
    input: set('nodes.0.position.z', 1),
    path: 'nodes.0.position',
  },

  // Enumerations
  { name: 'bad node level', input: set('nodes.0.level', 'module'), path: 'nodes.0.level' },
  { name: 'bad edge protocol', input: set('edges.0.protocol', 'HTTPS'), path: 'edges.0.protocol' },
  {
    name: 'bad edge direction',
    input: set('edges.0.direction', 'backward'),
    path: 'edges.0.direction',
  },
  { name: 'bad view type', input: set('views.0.type', 'dashboard'), path: 'views.0.type' },
  {
    name: 'bad view subtitleField',
    input: set('views.0.subtitleField', 'title'),
    path: 'views.0.subtitleField',
  },
  {
    name: 'view subtitleField "flow"',
    input: set('views.0.subtitleField', 'flow'),
    path: 'views.0.subtitleField',
  },
  {
    name: 'malformed type id in view excludeKinds',
    input: set('views.4.excludeKinds', ['external', 'Lambda']),
    path: 'views.4.excludeKinds.1',
  },
  {
    name: 'malformed type id in view dimKinds',
    input: set('views.2.dimKinds', ['web browser']),
    path: 'views.2.dimKinds.0',
  },
  {
    name: 'duplicate id in view pinned',
    input: set('views.2.pinned', ['orders-db', 'orders-db']),
    path: 'views.2.pinned',
  },
  {
    name: 'duplicate tag in view excludeTags',
    input: set('views.4.excludeTags', ['pci', 'pci']),
    path: 'views.4.excludeTags',
  },
  {
    name: 'bad id in view collapsed',
    input: set('views.0.collapsed', ['core services']),
    path: 'views.0.collapsed.0',
  },
  {
    name: 'bad id in view excludeGroups',
    input: set('views.4.excludeGroups', ['']),
    path: 'views.4.excludeGroups.0',
  },
  {
    name: 'bad rule hitPolicy',
    input: set(`${RULE}.hitPolicy`, 'First match'),
    path: `${RULE}.hitPolicy`,
  },
  { name: 'bad sticky color', input: set('stickies.0.color', 'yellow'), path: 'stickies.0.color' },
  {
    name: 'sticky collapsed is a string',
    input: set('stickies.0.collapsed', 'yes'),
    path: 'stickies.0.collapsed',
  },
  {
    name: 'sticky showInFlows is a number',
    input: set('stickies.0.showInFlows', 1),
    path: 'stickies.0.showInFlows',
  },

  // Card style and swatches (020)
  {
    name: 'style fill capitalized name',
    input: set('nodes.0.style.fill', 'Green'),
    path: 'nodes.0.style.fill',
  },
  {
    name: 'style fill uppercase hex',
    input: set('nodes.0.style.fill', '#7A3CFF'),
    path: 'nodes.0.style.fill',
  },
  {
    name: 'style fill short hex',
    input: set('nodes.0.style.fill', '#abc'),
    path: 'nodes.0.style.fill',
  },
  {
    name: 'style fill unknown name',
    input: set('nodes.0.style.fill', 'purple'),
    path: 'nodes.0.style.fill',
  },
  {
    name: 'empty style',
    input: set('nodes.0.style', {}),
    path: 'nodes.0.style',
  },
  {
    name: 'unknown style key',
    input: set('nodes.0.style.opacity', 0.5),
    path: 'nodes.0.style',
  },
  {
    name: 'group style stroke with trailing space',
    input: set('groups.1.style.stroke', 'red '),
    path: 'groups.1.style.stroke',
  },
  {
    name: 'duplicate deck swatch',
    input: set('swatches', ['#7a3cff', '#7a3cff']),
    path: 'swatches',
  },
  {
    name: 'deck swatch missing #',
    input: set('swatches', ['7a3cff']),
    path: 'swatches.0',
  },

  // Tag colours (033)
  {
    name: 'tag colour key is empty',
    input: set('tagColors', { '': 'red' }),
    path: 'tagColors.',
  },
  {
    name: 'tag colour key is only spaces',
    input: set('tagColors', { '   ': 'red' }),
    path: 'tagColors.   ',
  },
  {
    name: 'two tag colour keys equal ignoring case',
    input: set('tagColors', { PCI: 'violet', pci: 'red' }),
    path: 'tagColors.pci',
  },
  {
    name: 'two tag colour keys equal after trimming and collapsing spaces',
    input: set('tagColors', { 'Pci dss': 'violet', ' pci   DSS ': 'red' }),
    path: 'tagColors. pci   DSS ',
  },
  {
    name: 'tag colour is an unknown name',
    input: set('tagColors', { PCI: 'purple' }),
    path: 'tagColors.PCI',
  },
  {
    name: 'tag colour is an uppercase hex',
    input: set('tagColors', { PCI: '#7A3CFF' }),
    path: 'tagColors.PCI',
  },
  { name: 'tag colour is a number', input: set('tagColors', { PCI: 3 }), path: 'tagColors.PCI' },
  { name: 'node type is uppercase', input: set('nodes.0.type', 'Service'), path: 'nodes.0.type' },
  { name: 'node type is empty', input: set('nodes.0.type', ''), path: 'nodes.0.type' },
  { name: 'node type has a space', input: set('nodes.0.type', 'a b'), path: 'nodes.0.type' },
  {
    name: 'node type is 49 characters',
    input: set('nodes.0.type', `a${'b'.repeat(48)}`),
    path: 'nodes.0.type',
  },
  { name: 'node display is icon', input: set('nodes.0.display', 'icon'), path: 'nodes.0.display' },
  { name: 'node display is a number', input: set('nodes.0.display', 1), path: 'nodes.0.display' },
  { name: 'packs is empty', input: set('packs', []), path: 'packs' },
  {
    name: 'duplicate pack ids',
    input: set('packs', ['architecture', 'architecture']),
    path: 'packs',
  },
  { name: 'pack id is uppercase', input: set('packs', ['Process']), path: 'packs.0' },
  { name: 'tagColors is an array', input: set('tagColors', ['violet']), path: 'tagColors' },

  // Typed fields (032): S12 / S13 and shapes
  {
    name: 'duplicate field ids',
    input: set('fields.1.id', 'warehouse.capacity'),
    path: 'fields.1.id',
  },
  {
    name: 'built-in owner with kind text',
    input: set('fields.9.kind', 'text'),
    path: 'fields.9.kind',
  },
  { name: 'unit on a select field', input: set('fields.2.unit', 'h'), path: 'fields.2.unit' },
  {
    name: 'options on a number field',
    input: set('fields.1.options', [{ id: 'o_a', label: 'A' }]),
    path: 'fields.1.options',
  },
  {
    name: 'duplicate option ids in a field',
    input: set('fields.2.options.1.id', 'o_south'),
    path: 'fields.2.options.1.id',
  },
  {
    name: 'icon on a select option',
    input: set('fields.2.options.0.icon', 'circle'),
    path: 'fields.2.options.0.icon',
  },
  {
    name: 'built-in tech in values',
    input: set('nodes.9.values.tech', 'Go'),
    path: 'nodes.9.values.tech',
  },
  { name: 'empty field name', input: set('fields.0.name', ''), path: 'fields.0.name' },
  { name: 'unknown field kind', input: set('fields.0.kind', 'formula'), path: 'fields.0.kind' },
  {
    name: 'unknown status icon',
    input: set('fields.3.options.0.icon', 'star'),
    path: 'fields.3.options.0.icon',
  },
  {
    name: 'empty option label',
    input: set('fields.2.options.0.label', ''),
    path: 'fields.2.options.0.label',
  },
  {
    name: 'unit longer than 12',
    input: set('fields.1.unit', 'h'.repeat(13)),
    path: 'fields.1.unit',
  },
  { name: 'unknown key on a field', input: set('fields.0.hidden', true), path: 'fields.0' },
  {
    name: 'duplicate types in a field',
    input: set('fields.0.types', ['warehouse', 'warehouse']),
    path: 'fields.0.types',
  },
  {
    name: 'duplicate fieldDefaults',
    input: set('fieldDefaults', ['warehouse', 'warehouse']),
    path: 'fieldDefaults',
  },
  {
    name: 'fieldDefaults id is uppercase',
    input: set('fieldDefaults', ['Task']),
    path: 'fieldDefaults.0',
  },
  {
    name: 'value is a boolean',
    input: set('nodes.9.values.f_notes', true),
    path: 'nodes.9.values.f_notes',
  },
  {
    name: 'date range value with an unknown key',
    input: set('nodes.9.values.f_audit', { from: '2026-10-06', until: '2026-10-17' }),
    path: 'nodes.9.values.f_audit',
  },
  {
    name: 'link value without url',
    input: set('nodes.9.values.f_runbook', { label: 'Runbook' }),
    path: 'nodes.9.values.f_runbook',
  },
  {
    name: 'values key is not an id',
    input: set('nodes.9.values.bad key', 'x'),
    path: 'nodes.9.values.bad key',
  },

  // Ids
  { name: 'id with a space', input: set('nodes.0.id', 'order svc'), path: 'nodes.0.id' },
  {
    name: 'id longer than 64 characters',
    input: set('nodes.0.id', 'a'.repeat(65)),
    path: 'nodes.0.id',
  },
  { name: 'empty id', input: set('nodes.0.id', ''), path: 'nodes.0.id' },
  {
    name: 'reference that is not an id',
    input: set('edges.0.from', 'customer app'),
    path: 'edges.0.from',
  },

  // Wrong value types
  { name: 'title is a number', input: set('nodes.0.title', 42), path: 'nodes.0.title' },
  { name: 'empty title', input: set('nodes.0.title', ''), path: 'nodes.0.title' },
  {
    name: 'position x is a string',
    input: set('nodes.0.position.x', '10'),
    path: 'nodes.0.position.x',
  },
  { name: 'tags is a string', input: set('nodes.0.tags', 'pci'), path: 'nodes.0.tags' },
  {
    name: 'errorPath is a string',
    input: set(`${BRANCH}.errorPath`, 'yes'),
    path: `${BRANCH}.errorPath`,
  },
  {
    name: 'step branch that is not an id',
    input: set(`${STEP}.branch`, 'payment failed'),
    path: `${STEP}.branch`,
  },
  {
    name: 'step branch that is an object',
    input: set(`${STEP}.branch`, { kind: 'error' }),
    path: `${STEP}.branch`,
  },

  // Semantic rules
  {
    name: 'rule row with too few when cells',
    input: set(`${RULE}.rows.1.when`, ['≤ 5', '≤ 10']),
    path: `${RULE}.rows.1.when`,
  },
  {
    name: 'rule row with too many then cells',
    input: set(`${RULE}.rows.1.then`, ['Bike', '2 h', '€0.00', 'extra']),
    path: `${RULE}.rows.1.then`,
  },
  {
    name: 'sticky with neither anchor nor position',
    input: remove('stickies.0.position'),
    path: 'stickies.0',
  },
  {
    name: 'rules key that is not an id',
    input: renameKey('rules', 'notify-channels', 'notify channels'),
    path: 'rules.notify channels',
  },
  {
    name: 'view position key that is not an id',
    input: renameKey('views.2.positions', 'orders-db', 'orders db'),
    path: 'views.2.positions.orders db',
  },
  {
    name: 'ruleInputs rule key that is not an id',
    input: renameKey(`${STEP}.ruleInputs`, 'notify-channels', 'notify channels'),
    path: `${STEP}.ruleInputs.notify channels`,
  },
  {
    name: 'ruleInputs column key that is not an id',
    input: renameKey(`${STEP}.ruleInputs.delivery-tier`, 'distance', 'distance km'),
    path: `${STEP}.ruleInputs.delivery-tier.distance km`,
  },

  // Group frames (016)
  { name: 'group with position but no size', input: remove(`${GROUP}.size`), path: GROUP },
  {
    name: 'group size with zero width',
    input: set(`${GROUP}.size.width`, 0),
    path: `${GROUP}.size.width`,
  },
  {
    name: 'group size with an unknown key',
    input: set(`${GROUP}.size.depth`, 3),
    path: `${GROUP}.size`,
  },
  {
    name: 'view groupFrames key that is not a group',
    input: renameKey(FRAMES, 'data', 'orders-db'),
    path: `${FRAMES}.orders-db`,
  },
  {
    name: 'view groupFrames value without size',
    input: remove(`${FRAMES}.data.size`),
    path: `${FRAMES}.data.size`,
  },

  // Connector line type (029)
  {
    name: 'edge style shape is not a shape',
    input: set('edges.0.style.shape', 'zigzag'),
    path: 'edges.0.style.shape',
  },
  {
    name: 'empty edge style',
    input: set('edges.0.style', {}),
    path: 'edges.0.style',
  },
  {
    name: 'edge style with an unknown key',
    input: set('edges.0.style.fill', 'red'),
    path: 'edges.0.style',
  },

  // Connector style, anchors, bends and label position (022)
  {
    name: 'edge style dash is not a dash',
    input: set('edges.0.style.dash', 'wavy'),
    path: 'edges.0.style.dash',
  },
  {
    name: 'edge style width is not a step',
    input: set('edges.0.style.width', 2.5),
    path: 'edges.0.style.width',
  },
  {
    name: 'edge style width is zero',
    input: set('edges.0.style.width', 0),
    path: 'edges.0.style.width',
  },
  {
    name: 'edge style animated is a string',
    input: set('edges.0.style.animated', 'yes'),
    path: 'edges.0.style.animated',
  },
  {
    name: 'edge style colour is not a colour',
    input: set('edges.0.style.color', 'teal-ish'),
    path: 'edges.0.style.color',
  },
  {
    name: 'edge route fromAt above 1',
    input: set('edges.1.route.fromAt', 1.2),
    path: 'edges.1.route.fromAt',
  },
  {
    name: 'edge route toAt below 0',
    input: set('edges.1.route.toAt', -0.1),
    path: 'edges.1.route.toAt',
  },
  {
    name: 'edge route fromAt without fromSide (S9)',
    input: set('edges.1.route', { toSide: 'top', fromAt: 0.5 }),
    path: 'edges.1.route.fromAt',
  },
  {
    name: 'edge route toAt without toSide (S9)',
    input: set('edges.1.route', { fromSide: 'bottom', toAt: 0.5 }),
    path: 'edges.1.route.toAt',
  },
  {
    name: 'edge route with offset and waypoints (S10)',
    input: set('edges.1.route.offset', 12),
    path: 'edges.1.route',
  },
  {
    name: 'edge route with no waypoints in the list',
    input: set('edges.1.route.waypoints', []),
    path: 'edges.1.route.waypoints',
  },
  {
    name: 'waypoint with x and dx (S11)',
    input: set('edges.1.route.waypoints.0.dx', 4),
    path: 'edges.1.route.waypoints.0',
  },
  {
    name: 'waypoint with no y or dy (S11)',
    input: set('edges.1.route.waypoints', [{ x: 0.5 }]),
    path: 'edges.1.route.waypoints.0',
  },
  {
    name: 'waypoint with an unknown key',
    input: set('edges.1.route.waypoints.0.z', 1),
    path: 'edges.1.route.waypoints.0',
  },
  {
    name: 'waypoint x is a string',
    input: set('edges.1.route.waypoints.0.x', '0.5'),
    path: 'edges.1.route.waypoints.0.x',
  },
  {
    name: 'edge labelAt below 0',
    input: set('edges.0.labelAt', -0.1),
    path: 'edges.0.labelAt',
  },
  {
    name: 'edge labelAt above 1',
    input: set('edges.0.labelAt', 1.5),
    path: 'edges.0.labelAt',
  },

  // Card size and connector route (017)
  {
    name: 'node size with zero width',
    input: set('nodes.0.size.width', 0),
    path: 'nodes.0.size.width',
  },
  {
    name: 'edge route fromSide is not a side',
    input: set('edges.0.route.fromSide', 'middle'),
    path: 'edges.0.route.fromSide',
  },
  {
    name: 'edge route with an unknown key',
    input: set('edges.0.route.points', []),
    path: 'edges.0.route',
  },
  {
    name: 'edge route offset is a string',
    input: set('edges.0.route.offset', '10'),
    path: 'edges.0.route.offset',
  },

  // Database schema (040): nodes 12–15 are tables, edges 7–11 relationships.
  {
    name: 'column without a type',
    input: remove(`${CUSTOMERS}.columns.0.type`),
    path: `${CUSTOMERS}.columns.0.type`,
  },
  {
    name: 'column flag with a typo (notnull)',
    input: set(`${CUSTOMERS}.columns.0.notnull`, true),
    path: `${CUSTOMERS}.columns.0`,
  },
  {
    name: 'column size with a dot (10.2)',
    input: set(`${ORDERS}.columns.2.size`, '10.2'),
    path: `${ORDERS}.columns.2.size`,
  },
  {
    name: 'column with both default and defaultExpr (S14)',
    input: set(`${CUSTOMERS}.columns.3.default`, 'today'),
    path: `${CUSTOMERS}.columns.3.defaultExpr`,
  },
  {
    name: 'index without columns',
    input: set(`${CUSTOMERS}.indexes.0.columns`, []),
    path: `${CUSTOMERS}.indexes.0.columns`,
  },
  {
    name: 'index part with an empty expression',
    input: set(`${CUSTOMERS}.indexes.0.columns.0.expr`, ''),
    path: `${CUSTOMERS}.indexes.0.columns.0.expr`,
  },
  {
    name: 'index part that is neither an id nor { expr }',
    input: set(`${ORDERS}.indexes.0.columns.0`, { column: 'x' }),
    path: `${ORDERS}.indexes.0.columns.0`,
  },
  {
    name: 'index method in upper case',
    input: set(`${CUSTOMERS}.indexes.0.method`, 'BTREE'),
    path: `${CUSTOMERS}.indexes.0.method`,
  },
  {
    name: 'table detail is not a level',
    input: set(`${CUSTOMERS}.detail`, 'full'),
    path: `${CUSTOMERS}.detail`,
  },
  {
    name: 'unknown cardinality',
    input: set(`${RELATION}.cardinality`, 'many'),
    path: `${RELATION}.cardinality`,
  },
  {
    name: 'unknown referential action',
    input: set(`${RELATION}.onDelete`, 'set null'),
    path: `${RELATION}.onDelete`,
  },
  {
    name: 'empty fromColumns',
    input: set(`${RELATION}.fromColumns`, []),
    path: `${RELATION}.fromColumns`,
  },
  {
    name: 'a column twice in toColumns',
    input: set(`${RELATION}.toColumns`, ['cust-id', 'cust-id']),
    path: `${RELATION}.toColumns`,
  },
  {
    name: 'unknown dialect',
    input: set('dialect', 'oracle'),
    path: 'dialect',
  },
  {
    name: 'enum without values',
    input: remove('enums.0.values'),
    path: 'enums.0.values',
  },
  // 041: table display and enum colour.
  {
    name: 'table detail "auto" (Auto is the absent key)',
    input: set('tableDisplay.detail', 'auto'),
    path: 'tableDisplay.detail',
  },
  {
    name: 'unknown table display key',
    input: set('tableDisplay.showTypes', true),
    path: 'tableDisplay',
  },
  {
    name: 'table display flag is not a boolean',
    input: set('tableDisplay.hideNotes', 'yes'),
    path: 'tableDisplay.hideNotes',
  },
  {
    name: 'enum colour is not a palette name or hex',
    input: set('enums.0.color', 'purple-ish'),
    path: 'enums.0.color',
  },
  // 042: relationship display.
  {
    name: 'relationship labels "sometimes"',
    input: set('relationshipDisplay.labels', 'sometimes'),
    path: 'relationshipDisplay.labels',
  },
  {
    name: 'relationship notation "crow" (crow\'s foot is the absent key)',
    input: set('relationshipDisplay.notation', 'crow'),
    path: 'relationshipDisplay.notation',
  },
  {
    name: 'relationship hideEnds is not a boolean',
    input: set('relationshipDisplay.hideEnds', 'yes'),
    path: 'relationshipDisplay.hideEnds',
  },
  {
    name: 'unknown relationship display key',
    input: set('relationshipDisplay.showLabels', true),
    path: 'relationshipDisplay',
  },
  // 043: node lock. Only `true` is valid; unlocking removes the key.
  {
    name: 'locked false (unlocked is the absent key)',
    input: set('nodes.2.locked', false),
    path: 'nodes.2.locked',
  },
  { name: 'locked is not a boolean', input: set('nodes.2.locked', 'yes'), path: 'nodes.2.locked' },
  // 049: step touches.
  {
    name: 'touch without a table',
    input: remove(`${TOUCHES}.0.table`),
    path: `${TOUCHES}.0.table`,
  },
  {
    name: 'touch access "update"',
    input: set(`${TOUCHES}.0.access`, 'update'),
    path: `${TOUCHES}.0.access`,
  },
  {
    name: 'touch with an unknown key',
    input: set(`${TOUCHES}.0.columns`, ['order-id']),
    path: `${TOUCHES}.0`,
  },
  {
    name: 'two touches of one step on the same table and column (S15)',
    input: set(`${TOUCHES}.2`, { table: 'orders', access: 'read' }),
    path: `${TOUCHES}.2`,
  },
];

/**
 * Valid decks beyond the examples. 050 lets a connector end name a group: card → group,
 * group → card and group → group, each with a route and a style, read against the group frame.
 */
export const validFixtures: { name: string; input: unknown }[] = [
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
