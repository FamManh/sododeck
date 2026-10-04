import { typeName } from './type-label';

/**
 * The title a new component is stored with ("Untitled <type>", 019 R3): a title is never empty
 * (ADR 0015), so this is the fallback kept when the user names nothing.
 */
export function placeholderTitle(type: string): string {
  return `Untitled ${typeName(type).toLowerCase()}`;
}

/**
 * The title a shape draws: nothing while it still has its placeholder, so an unnamed shape stays
 * blank on the canvas and in the export (founder, 2026-10-04). Outline, search and the drawer
 * keep the stored title. The text shape (geometry `none`) is only its words, so it keeps the
 * placeholder: blank, it would be invisible.
 */
export function shownShapeTitle(node: { type: string; title: string }, geometry: string): string {
  return geometry !== 'none' && node.title === placeholderTitle(node.type) ? '' : node.title;
}
