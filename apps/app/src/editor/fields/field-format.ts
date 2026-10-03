/**
 * How typed field values read as text (032, research R5): short English dates without time zone,
 * person initials, link labels, numbers with units. Pure; shared by the card, the drawer, search
 * snippets and export.
 */
import type { FieldDef, FieldOption } from '@sododeck/schema';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface DateParts {
  year: number;
  month: number;
  day: number;
}

function parts(date: string): DateParts | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (match === null) return undefined;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

const monthName = (month: number) => MONTHS[month - 1] ?? '';

/** "14 Oct", or "14 Oct 2025" when not in `currentYear`. A malformed date is shown as stored. */
export function formatDate(date: string, currentYear = new Date().getFullYear()): string {
  const p = parts(date);
  if (p === undefined) return date;
  const base = `${String(p.day)} ${monthName(p.month)}`;
  return p.year === currentYear ? base : `${base} ${String(p.year)}`;
}

/**
 * "6–17 Oct" in one month, "28 Sep – 3 Oct" across months, one date when both ends are equal, the
 * year added when it is not `currentYear` (both years when they differ).
 */
export function formatDateRange(
  from: string,
  to: string,
  currentYear = new Date().getFullYear(),
): string {
  if (from === to) return formatDate(from, currentYear);
  const a = parts(from);
  const b = parts(to);
  if (a === undefined || b === undefined) return `${from} – ${to}`;
  const sameYear = a.year === b.year;
  const yearSuffix = sameYear && a.year === currentYear ? '' : ` ${String(b.year)}`;
  if (sameYear && a.month === b.month) {
    return `${String(a.day)}–${String(b.day)} ${monthName(b.month)}${yearSuffix}`;
  }
  const start = sameYear
    ? `${String(a.day)} ${monthName(a.month)}`
    : formatDate(from, b.year === currentYear && a.year === currentYear ? currentYear : -1);
  return `${start} – ${String(b.day)} ${monthName(b.month)}${yearSuffix}`;
}

/** Initials of a person: first letters of the first two words (one for one word), upper-case. */
export function personInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word !== '');
  return words
    .slice(0, 2)
    .map((word) => String.fromCodePoint(word.codePointAt(0) ?? 32).trim())
    .join('')
    .toUpperCase();
}

/** A link shown without its scheme ("runbook.sodo.dev/orders", "a@x.io"). */
export function linkText(link: { url: string; label?: string }): string {
  if (link.label !== undefined && link.label.trim() !== '') return link.label;
  return link.url.replace(/^(https?:\/\/|mailto:)/i, '').replace(/\/$/, '');
}

/** A number with its unit, e.g. "24 h", "5 pts". */
export function formatNumber(value: number, unit: string | undefined): string {
  const text = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
  return unit === undefined || unit === '' ? text : `${text} ${unit}`;
}

export function optionOf(field: Pick<FieldDef, 'options'>, id: unknown): FieldOption | undefined {
  return field.options?.find((option) => option.id === id);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * A value as plain text for names, hints and snippets ("In progress", "14 Oct", "24 h"), or
 * undefined when the value does not fit its field (it is then not drawn).
 */
export function valueText(
  field: Pick<FieldDef, 'kind' | 'options' | 'unit'>,
  value: unknown,
  currentYear?: number,
): string | undefined {
  switch (field.kind) {
    case 'text':
    case 'person':
      return typeof value === 'string' && value.trim() !== '' ? value : undefined;
    case 'number':
      return typeof value === 'number' ? formatNumber(value, field.unit) : undefined;
    case 'progress':
      return typeof value === 'number'
        ? `${String(Math.round(Math.min(100, Math.max(0, value))))} %`
        : undefined;
    case 'select':
    case 'status':
      return optionOf(field, value)?.label;
    case 'date':
      return typeof value === 'string' && parts(value) !== undefined
        ? formatDate(value, currentYear)
        : undefined;
    case 'dateRange':
      return isRecord(value) && typeof value.from === 'string' && typeof value.to === 'string'
        ? formatDateRange(value.from, value.to, currentYear)
        : undefined;
    case 'link':
      return isRecord(value) && typeof value.url === 'string'
        ? linkText({
            url: value.url,
            label: typeof value.label === 'string' ? value.label : undefined,
          })
        : undefined;
  }
}
