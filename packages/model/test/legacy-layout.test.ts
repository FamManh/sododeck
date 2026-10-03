import { describe, expect, it } from 'vitest';

import { createDeck, createEditor, fromJSON, isLegacyLayout } from '../src';
import { legacyDoc, readExample, reload, type LegacySign } from './helpers';

const full = await readExample('full.sododeck.json');
const signs: LegacySign[] = ['collection', 'rule', 'description'];

describe('isLegacyLayout (036 R10, FR-027)', () => {
  it.each(signs)('recognises the old layout by its %s', (sign) => {
    const doc = legacyDoc(sign);
    expect(isLegacyLayout(doc)).toBe(true);
    expect(isLegacyLayout(reload(doc))).toBe(true);
  });

  it('does not flag a deck in the current layout', () => {
    expect(isLegacyLayout(fromJSON(full))).toBe(false);
    expect(isLegacyLayout(createDeck())).toBe(false);
    expect(isLegacyLayout(reload(fromJSON(full)))).toBe(false);
    expect(isLegacyLayout(reload(createDeck()))).toBe(false);
  });

  it('does not flag a deck after edits, deletes and moves', () => {
    const doc = fromJSON(full);
    const editor = createEditor(doc);
    const id = editor.add('nodes', { type: 'service', title: 'New', description: 'Text' });
    editor.reorder('nodes', id, 0);
    editor.remove('nodes', id);
    editor.updateMeta({ description: 'Changed' });
    expect(isLegacyLayout(reload(doc))).toBe(false);
  });
});
