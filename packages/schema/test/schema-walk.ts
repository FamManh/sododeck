import { readdirSync, readFileSync } from 'node:fs';

import { jsonSchema } from '../src';

/** The subset of JSON Schema that v1.json uses, enough to walk a file alongside it. */
export interface SchemaNode {
  $ref?: string;
  title?: string;
  properties?: Record<string, SchemaNode | boolean>;
  items?: SchemaNode;
  additionalProperties?: SchemaNode | boolean;
  enum?: string[];
  $defs?: Record<string, SchemaNode>;
}

export const root = jsonSchema as unknown as SchemaNode;
export const defs: Record<string, SchemaNode> = root.$defs ?? {};

export interface Visitor {
  /** Called for every JSON object that matches a schema node with `properties`. */
  object?: (type: string, value: Record<string, unknown>, schema: SchemaNode, path: string) => void;
  /** Called for every value whose schema is a named enum `$def`. */
  enumValue?: (type: string, value: unknown) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Walks `value` together with `schema`, following `$ref`, `properties`, `items` and maps. */
export function walk(
  value: unknown,
  visitor: Visitor,
  schema: SchemaNode = root,
  type = 'SododeckFile',
  path = '',
): void {
  if (schema.$ref !== undefined) {
    const name = schema.$ref.slice('#/$defs/'.length);
    const target = defs[name];
    if (target === undefined) throw new Error(`Unresolved ${schema.$ref}`);
    walk(value, visitor, target, name, path);
    return;
  }
  if (schema.enum !== undefined) {
    visitor.enumValue?.(type, value);
    return;
  }
  if (Array.isArray(value)) {
    const { items } = schema;
    if (items !== undefined) {
      value.forEach((item, index) => {
        walk(item, visitor, items, type, `${path}.${String(index)}`);
      });
    }
    return;
  }
  if (!isRecord(value)) return;

  const { properties, additionalProperties } = schema;
  if (properties !== undefined) {
    visitor.object?.(type, value, schema, path);
    for (const [key, child] of Object.entries(value)) {
      const childSchema = properties[key];
      if (childSchema !== undefined && typeof childSchema !== 'boolean') {
        walk(child, visitor, childSchema, `${type}.${key}`, `${path}.${key}`);
      }
    }
    return;
  }
  if (additionalProperties !== undefined && typeof additionalProperties !== 'boolean') {
    for (const [key, child] of Object.entries(value)) {
      walk(child, visitor, additionalProperties, type, `${path}.${key}`);
    }
  }
}

const examplesDir = new URL('../examples/', import.meta.url);

/** Every example file as `[fileName, parsedJson]`. */
export const examples: [string, unknown][] = readdirSync(examplesDir)
  .filter((file) => file.endsWith('.sododeck.json'))
  .sort()
  .map((file) => [file, JSON.parse(readFileSync(new URL(file, examplesDir), 'utf8')) as unknown]);

export function readExample(file: string): unknown {
  return JSON.parse(readFileSync(new URL(file, examplesDir), 'utf8')) as unknown;
}
