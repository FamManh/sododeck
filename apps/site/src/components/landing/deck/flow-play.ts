import type { FlowHop } from '../../../lib/landing/checkout-deck';

export interface FlowPlay {
  /** The first step's card. */
  start: { node: string; n: number };
  hops: readonly FlowHop[];
  /** When the first hop starts and how long each takes, in seconds. */
  t0: number;
  step: number;
  /** Connectors of steps played before this visual begins, drawn as played. */
  played?: readonly string[];
}

/** The connectors of a scene by id. */
export type EdgeIndex = ReadonlyMap<string, { d: string }>;

/** When hop `i` starts and ends, in seconds. */
export const flowSlot = (flow: FlowPlay, i: number): readonly [number, number] => [
  flow.t0 + i * flow.step,
  flow.t0 + (i + 1) * flow.step,
];
