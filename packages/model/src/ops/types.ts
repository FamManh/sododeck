import type { Id, Rule, RuleColumn, RuleRow, Step } from '@sododeck/schema';

import type { Collection, ObjectOf } from '../layout';

type OptionalKeys<T> = {
  [K in keyof T]-?: Partial<Pick<T, K>> extends Pick<T, K> ? K : never;
}[keyof T];

/** Fields a patch may touch: never the id, never owned children (edited with their own ops). */
type Patchable<T> = Omit<T, 'id' | 'steps'>;

/**
 * A partial update. Required fields take a value; optional fields take a value or `null`, which
 * clears the field. Absent (or `undefined`) fields are left unchanged.
 */
export type Patch<T> = {
  [K in keyof Patchable<T> as K extends OptionalKeys<Patchable<T>> ? never : K]?: Patchable<T>[K];
} & {
  [K in keyof Patchable<T> as K extends OptionalKeys<Patchable<T>> ? K : never]?:
    Patchable<T>[K] | null;
};

/**
 * A new object: its fields without `id`. An explicit `id` is accepted (paste, import) and must
 * not exist anywhere in the deck. Flows may bring their steps; they default to none.
 */
export type NewObject<C extends Collection> = Omit<ObjectOf<C>, 'id' | 'steps'> & {
  id?: Id;
} & (C extends 'flows' ? { steps?: Step[] } : unknown);

export type NewStep = Omit<Step, 'id'> & { id?: Id };

/** A new rule. `hitPolicy` defaults to `first`; columns and rows default to none. */
export type NewRule = Pick<Rule, 'title'> &
  Partial<Omit<Rule, 'title'>> & {
    id?: Id;
  };

export type { RuleColumn, RuleRow };
