/** One SVG shape of an icon: `[tag, attributes]`, drawn in a 24 × 24 viewBox. */
export type IconNode = readonly (readonly [
  tag: 'path' | 'circle' | 'rect' | 'line' | 'polyline' | 'polygon' | 'ellipse',
  attrs: Readonly<Record<string, string | number>>,
])[];

/** `line`: stroke `currentColor`, no fill. `solid`: fill `currentColor`, no stroke. */
export type IconStyle = 'line' | 'solid';

export interface IconCategory {
  id: string;
  label: string;
}

export interface IconEntry {
  /** Stable key, `[a-z0-9-]+`, unique in its set: the `name` part of a reference. */
  name: string;
  /** Tooltip, accessible name and footer text ("Search"). */
  label: string;
  /** One of the set's category ids. */
  category: string;
  /** Lowercase search words. */
  keywords: readonly string[];
  node: IconNode;
}

export interface IconSet {
  /** `[a-z0-9-]+`: the `set` part of a reference. */
  id: string;
  /** Shown in the picker's set filter (only with 2+ sets). */
  name: string;
  licence: { spdx: string; notice: string };
  style: IconStyle;
  /** Catalog order = picker order within a category. */
  icons: readonly IconEntry[];
  /** Old name → current name. */
  aliases: Readonly<Record<string, string>>;
  categories: readonly IconCategory[];
}

export interface ResolvedIcon {
  set: string;
  name: string;
  label: string;
  node: IconNode;
  style: IconStyle;
}

export interface NodeIconResult {
  icon: ResolvedIcon;
  source: 'custom' | 'type' | 'fallback';
  /** `node.icon` is set but did not resolve. */
  unavailable: boolean;
}
