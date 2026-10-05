/**
 * SVG import guard (055 R6). An SVG is only ever shown through `<img>` or as a `data:` image in
 * the export SVG, both inert, so this is defence in depth and keeps the "no third-party requests"
 * promise: parse with `DOMParser` (main thread; a worker has no DOM), allow-list elements, refuse
 * scripts, handlers and any reference that leaves the document, then store the re-serialised tree.
 */
export type SvgRefusal =
  | 'unreadable'
  | 'script'
  | 'foreign-object'
  | 'event-handler'
  | 'external-reference'
  | 'entity'
  | 'unsupported-element';

export type SanitizedSvg =
  { ok: true; svg: string; width: number; height: number } | { ok: false; reason: SvgRefusal };

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

/** Static drawing elements only: no scripting, animation, links or embedded documents. */
const ALLOWED = new Set(
  (
    'svg g defs symbol use path rect circle ellipse line polyline polygon text tspan textPath ' +
    'title desc metadata linearGradient radialGradient stop clipPath mask pattern marker style ' +
    'image switch filter feBlend feColorMatrix feComponentTransfer feComposite feConvolveMatrix ' +
    'feDiffuseLighting feDisplacementMap feDistantLight feDropShadow feFlood feFuncA feFuncB ' +
    'feFuncG feFuncR feGaussianBlur feImage feMerge feMergeNode feMorphology feOffset ' +
    'fePointLight feSpecularLighting feSpotLight feTile feTurbulence'
  ).split(' '),
);

const RASTER_DATA_URI = /^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]*$/i;
const URL_CALL = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;

function refusal(reason: SvgRefusal): SanitizedSvg {
  return { ok: false, reason };
}

/** True when text (a style, an attribute value) points outside the document. */
function hasExternalReference(value: string): boolean {
  if (/@import/i.test(value) || /javascript:/i.test(value) || /expression\(/i.test(value)) {
    return true;
  }
  for (const match of value.matchAll(URL_CALL)) {
    const target = (match[2] ?? '').trim();
    if (!target.startsWith('#')) return true;
  }
  return false;
}

function isAllowedHref(element: Element, value: string): boolean {
  const target = value.trim();
  if (target.startsWith('#')) return true;
  return element.localName === 'image' && RASTER_DATA_URI.test(target);
}

type Verdict = SvgRefusal | null;

function cleanAttributes(element: Element): Verdict {
  for (const attr of [...element.attributes]) {
    const name = attr.name.toLowerCase();
    if (name.startsWith('on')) return 'event-handler';
    const isHref =
      attr.localName === 'href' && (attr.namespaceURI === null || attr.namespaceURI === XLINK_NS);
    if (isHref) {
      if (!isAllowedHref(element, attr.value)) return 'external-reference';
      continue;
    }
    if (attr.namespaceURI !== null && attr.namespaceURI !== SVG_NS) {
      const declaresKnown =
        attr.namespaceURI === 'http://www.w3.org/2000/xmlns/' &&
        (attr.value === SVG_NS || attr.value === XLINK_NS);
      const keep = declaresKnown || attr.namespaceURI === 'http://www.w3.org/XML/1998/namespace';
      // Editor leftovers (Inkscape, Sketch) are dropped, not refused.
      if (!keep) element.removeAttributeNode(attr);
      continue;
    }
    if (hasExternalReference(attr.value)) return 'external-reference';
  }
  return null;
}

function cleanElement(element: Element): Verdict {
  const name = element.localName;
  if (name === 'script') return 'script';
  if (name === 'foreignObject') return 'foreign-object';
  if (!ALLOWED.has(name)) return 'unsupported-element';
  const attributes = cleanAttributes(element);
  if (attributes !== null) return attributes;
  if (name === 'style' && hasExternalReference(element.textContent)) return 'external-reference';
  return cleanChildren(element);
}

function cleanChildren(parent: Element): Verdict {
  for (const child of [...parent.children]) {
    if (child.namespaceURI !== SVG_NS) {
      child.remove();
      continue;
    }
    const verdict = cleanElement(child);
    if (verdict !== null) return verdict;
  }
  return null;
}

/** A length in user units; percentages and other units mean "unknown". */
function lengthOf(value: string | null): number | null {
  if (value === null) return null;
  const match = /^\s*([0-9]*\.?[0-9]+)\s*(?:px)?\s*$/.exec(value);
  const parsed = match?.[1] === undefined ? Number.NaN : Number(match[1]);
  return parsed > 0 ? parsed : null;
}

function naturalSize(root: Element): { width: number; height: number } {
  const width = lengthOf(root.getAttribute('width'));
  const height = lengthOf(root.getAttribute('height'));
  const box = (root.getAttribute('viewBox') ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const boxW = box[2];
  const boxH = box[3];
  const hasBox =
    box.length === 4 && boxW !== undefined && boxH !== undefined && boxW > 0 && boxH > 0;
  if (width !== null && height !== null) return { width, height };
  if (hasBox) {
    if (width !== null) return { width, height: (width * boxH) / boxW };
    if (height !== null) return { width: (height * boxW) / boxH, height };
    return { width: boxW, height: boxH };
  }
  // The browser default for an SVG with no size at all.
  return { width: width ?? 300, height: height ?? 150 };
}

export function sanitizeSvg(source: string): SanitizedSvg {
  if (/<!ENTITY/i.test(source)) return refusal('entity');
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
  const root = doc.documentElement;
  if (root.localName === 'parsererror' || doc.getElementsByTagName('parsererror').length > 0) {
    return refusal('unreadable');
  }
  if (root.localName !== 'svg' || root.namespaceURI !== SVG_NS) return refusal('unreadable');
  const verdict = cleanElement(root);
  if (verdict !== null) return refusal(verdict);
  const size = naturalSize(root);
  return { ok: true, svg: new XMLSerializer().serializeToString(root), ...size };
}
