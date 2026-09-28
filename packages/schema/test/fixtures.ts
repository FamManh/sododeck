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
  { name: 'bad node type', input: set('nodes.0.type', 'db'), path: 'nodes.0.type' },
  { name: 'prototype node kind name', input: set('nodes.0.type', 'data'), path: 'nodes.0.type' },
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
];
