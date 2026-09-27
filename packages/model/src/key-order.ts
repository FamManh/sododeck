/**
 * Canonical key order on write-out (research R2, ADR 0004 §10): every object is rebuilt in the
 * order its `properties` are declared in the v1 JSON Schema, so files are byte-stable and git
 * diffs show only real edits. Map-like objects (`rules`, `positions`, `ruleInputs`) keep their
 * own key order. The order is derived from the schema, never from hand-kept tables.
 */
import { jsonSchema } from '@sododeck/schema';

import { isRecord } from './convert';

type Shape =
  | { kind: 'object'; properties: [string, Shape][] }
  | { kind: 'map'; value: Shape }
  | { kind: 'array'; items: Shape }
  | { kind: 'leaf' };

const LEAF: Shape = { kind: 'leaf' };

function resolve(node: unknown, defs: Record<string, unknown>): unknown {
  if (isRecord(node) && typeof node.$ref === 'string') {
    const name = node.$ref.replace('#/$defs/', '');
    return resolve(defs[name], defs);
  }
  return node;
}

function shapeOf(node: unknown, defs: Record<string, unknown>): Shape {
  const schema = resolve(node, defs);
  if (!isRecord(schema)) return LEAF;
  if (isRecord(schema.properties)) {
    return {
      kind: 'object',
      properties: Object.entries(schema.properties).map(([key, child]) => [
        key,
        shapeOf(child, defs),
      ]),
    };
  }
  if (isRecord(schema.additionalProperties))
    return { kind: 'map', value: shapeOf(schema.additionalProperties, defs) };
  if (schema.items !== undefined) return { kind: 'array', items: shapeOf(schema.items, defs) };
  return LEAF;
}

let fileShape: Shape | undefined;

function rootShape(): Shape {
  if (fileShape === undefined) {
    const root: unknown = jsonSchema;
    const defs = isRecord(root) && isRecord(root.$defs) ? root.$defs : {};
    fileShape = shapeOf(root, defs);
  }
  return fileShape;
}

function reorder(value: unknown, shape: Shape): unknown {
  switch (shape.kind) {
    case 'array':
      return Array.isArray(value) ? value.map((item) => reorder(item, shape.items)) : value;
    case 'map':
      return isRecord(value)
        ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, reorder(v, shape.value)]))
        : value;
    case 'object': {
      if (!isRecord(value)) return value;
      const out: Record<string, unknown> = {};
      for (const [key, child] of shape.properties) {
        if (Object.hasOwn(value, key)) out[key] = reorder(value[key], child);
      }
      // Keys the schema does not know cannot be in a valid file; keep them anyway, never drop data.
      for (const [key, child] of Object.entries(value)) {
        if (!Object.hasOwn(out, key)) out[key] = child;
      }
      return out;
    }
    case 'leaf':
      return value;
  }
}

/** Returns a copy of a `.sododeck.json` value with every object in canonical key order. */
export function canonicalize<T>(file: T): T {
  return reorder(file, rootShape()) as T;
}

/** Top-level keys of a `.sododeck.json` file, in canonical order. */
export function fileKeyOrder(): string[] {
  const shape = rootShape();
  return shape.kind === 'object' ? shape.properties.map(([key]) => key) : [];
}

function propertyShape(shape: Shape | undefined, key: string): Shape | undefined {
  return shape?.kind === 'object' ? shape.properties.find(([k]) => k === key)?.[1] : undefined;
}

/** `flows[].steps`, so a single step can be ordered like inside its flow (007). */
function stepShape(): Shape | undefined {
  const flows = propertyShape(rootShape(), 'flows');
  return propertyShape(flows?.kind === 'array' ? flows.items : undefined, 'steps');
}

/**
 * Canonical key order for one entry of a top-level field: an item of a collection array, or a
 * value of the `rules` map, or one flow step (`steps`). Lets incremental readers rebuild one object like `canonicalize` would.
 */
export function canonicalizeEntry<T>(field: string, value: T): T {
  const fieldShape = field === 'steps' ? stepShape() : propertyShape(rootShape(), field);
  if (fieldShape?.kind === 'array') return reorder(value, fieldShape.items) as T;
  if (fieldShape?.kind === 'map') return reorder(value, fieldShape.value) as T;
  return value;
}
