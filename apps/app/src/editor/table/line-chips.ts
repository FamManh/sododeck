/** The chips under the column line editor (043 FR-001, FR-004): what the parser read. */
import type { DbEnum } from '@sododeck/schema';

import type { ParsedColumnLine } from '../../db/column-line';
import { typeText } from '../table-layout';

/** One chip under the line: what the parser read (FR-001), or a word it dropped (FR-004). */
export interface LineChip {
  label: string;
  tone: 'part' | 'enum' | 'ignored';
}

/** The chips for a parsed line, in reading order: name, type, flags, default, ignored words. */
export function lineChips(parsed: ParsedColumnLine, enums: readonly DbEnum[]): LineChip[] {
  const chips: LineChip[] = [];
  if (parsed.name.trim() !== '') chips.push({ label: `name · ${parsed.name}`, tone: 'part' });
  if (parsed.type !== undefined) {
    const linked = enums.find((item) => item.id === parsed.enumRef);
    chips.push(
      linked === undefined
        ? { label: `type · ${typeText({ type: parsed.type, size: parsed.size })}`, tone: 'part' }
        : { label: `enum · ${linked.name}`, tone: 'enum' },
    );
  }
  if (parsed.pk === true) chips.push({ label: 'primary key', tone: 'part' });
  if (parsed.notNull === true) chips.push({ label: 'not null', tone: 'part' });
  if (parsed.unique === true) chips.push({ label: 'unique', tone: 'part' });
  if (parsed.increment === true) chips.push({ label: 'increment', tone: 'part' });
  const value = parsed.tokens.find((token) => token.kind === 'default');
  if (value !== undefined) {
    // The token spans the keyword and its value; the chip names the value only.
    const shown = value.text.replace(/^default\s+/i, '');
    chips.push({ label: `default · ${shown}`, tone: 'part' });
  }
  for (const word of parsed.ignored) chips.push({ label: `ignored · ${word}`, tone: 'ignored' });
  return chips;
}
