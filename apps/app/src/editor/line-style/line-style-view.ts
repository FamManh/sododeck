/**
 * What a selection of connectors shares per style key (022, pattern of `inspector/derive.ts`
 * `styleView`): the one value they all have, or Mixed plus the set of values in use. Effective
 * values count, so a connector with no `dash` is `solid`.
 */
import { edgeLineStyle, type Dash, type ShapedEdge, type Width } from '@sododeck/model';
import type { ColorRef, EdgeShape } from '@sododeck/schema';

import type { Shared } from '../inspector/derive';

export interface KeyView<T> {
  shared: Shared<T>;
  /** Every value some selected connector has, first-seen order. */
  used: readonly T[];
}

export interface LineStyleView {
  shape: KeyView<EdgeShape>;
  dash: KeyView<Dash>;
  width: KeyView<Width>;
  /** `null` is "No colour". */
  color: KeyView<ColorRef | null>;
  animated: KeyView<boolean>;
}

function keyView<T>(values: readonly T[]): KeyView<T> {
  const used = [...new Set(values)];
  const [only] = used;
  return {
    shared:
      used.length === 1 && only !== undefined ? { mixed: false, value: only } : { mixed: true },
    used,
  };
}

export function lineStyleView(edges: readonly ShapedEdge[]): LineStyleView {
  const styles = edges.map(edgeLineStyle);
  return {
    shape: keyView(styles.map((s) => s.shape)),
    dash: keyView(styles.map((s) => s.dash)),
    width: keyView(styles.map((s) => s.width)),
    color: keyView(styles.map((s) => s.color)),
    animated: keyView(styles.map((s) => s.animated)),
  };
}
