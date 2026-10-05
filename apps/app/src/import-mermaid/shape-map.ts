/**
 * Mermaid node shapes → shape type ids (contracts/mermaid-mapping.md). Sizes come from the
 * card-type registry in `@sododeck/model`, never copied here.
 */
import { cardType } from '@sododeck/model';
import type { Size, TypeId } from '@sododeck/schema';

export type MermaidShape =
  | 'bare' // `id`
  | 'rect' // `id[text]`
  | 'round' // `id(text)`
  | 'stadium' // `id([text])`
  | 'subroutine' // `id[[text]]`
  | 'cylinder' // `id[(text)]`
  | 'circle' // `id((text))`
  | 'double-circle' // `id(((text)))`
  | 'asymmetric' // `id>text]`
  | 'rhombus' // `id{text}`
  | 'hexagon' // `id{{text}}`
  | 'parallelogram' // `id[/text/]`, `id[\text\]`
  | 'trapezoid'; // `id[/text\]`, `id[\text/]`

export const SHAPE_TYPE: Record<MermaidShape, TypeId> = {
  bare: 'rectangle',
  rect: 'rectangle',
  round: 'rounded-rectangle',
  stadium: 'pill',
  subroutine: 'rectangle',
  cylinder: 'cylinder',
  circle: 'ellipse',
  'double-circle': 'ellipse',
  asymmetric: 'document-shape',
  rhombus: 'diamond',
  hexagon: 'hexagon',
  parallelogram: 'parallelogram',
  trapezoid: 'rectangle',
};

const FALLBACK_SIZE: Size = { width: 160, height: 72 };

/** The type's own default size (every type this importer produces has one). */
export function defaultSize(typeId: TypeId): Size {
  return cardType(typeId)?.defaultSize ?? FALLBACK_SIZE;
}
