import { KIND_FALLBACK, KIND_STYLE, toComponentKind } from '@sododeck/ui/lib/icons';

/** Human kind name ("Service"); unknown kinds read as "Component". */
export function kindLabel(kind: string): string {
  const resolved = toComponentKind(kind);
  return resolved ? KIND_STYLE[resolved].label : KIND_FALLBACK.label;
}
