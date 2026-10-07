import { describe, expect, it } from 'vitest';

import { DEBOUNCE_MS, DiskSync, REPLACED_NOTICE } from '../src/disk-sync';
import { openDocument, revertDocument, saveDocument } from '../src/document-ops';
import { HostSession } from '../src/host-session';
import { emptyDeckText } from './deck-fixtures';
import { FakeEditor, settle } from './fake-editor';
import { makeFakes } from './fakes';

const DECK = 'file:///ws/docs/arch.sododeck';

/** Small seeded generator so a failing sequence can be replayed from its seed. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

type Op = 'edit' | 'save' | 'outside' | 'revert' | 'touch';

async function run(seed: number): Promise<void> {
  const random = rng(seed);
  const fakes = makeFakes();
  fakes.files.set(DECK, emptyDeckText());
  const editor = new FakeEditor();
  const doc = await openDocument(fakes.files, DECK);
  const session = new HostSession({
    doc,
    transport: editor.host,
    ports: fakes,
    onContentChange: () => {},
  });
  const sync = new DiskSync({
    doc,
    ports: fakes,
    session: () => session,
    onContentChange: () => {},
    clearMark: () => Promise.resolve(),
  });
  sync.watch();
  editor.ready();
  await settle();

  const sentByCanvas = new Set<string>();
  let counter = 0;
  let expectedNotices = 0;

  for (let step = 0; step < 30; step++) {
    const op: Op = (['edit', 'save', 'outside', 'revert', 'touch'] as const)[
      Math.floor(random() * 5)
    ] as Op;
    const label = `seed ${String(seed)} step ${String(step)} ${op}`;
    switch (op) {
      case 'edit': {
        const text = `EDIT-${String(counter++)}`;
        sentByCanvas.add(text);
        editor.sendChange(text);
        await settle();
        break;
      }
      case 'save': {
        const before = editor.canvasText;
        await saveDocument(fakes.files, doc, session);
        if (doc.text === before && sentByCanvas.has(before)) {
          expect(fakes.files.get(DECK), label).toBe(before); // no edit lost across save
        }
        break;
      }
      case 'outside': {
        const wasDirty = doc.dirty;
        const text = `OUTSIDE-${String(counter++)}`;
        fakes.files.set(DECK, text);
        fakes.control.fireFile(DECK);
        fakes.clock.advance(DEBOUNCE_MS);
        await settle();
        expect(editor.canvasText, label).toBe(text); // the canvas equals the file
        if (wasDirty) expectedNotices++;
        break;
      }
      case 'revert': {
        await revertDocument(fakes.files, doc, session);
        await settle();
        expect(editor.canvasText, label).toBe(fakes.files.get(DECK));
        break;
      }
      case 'touch': {
        const before = editor.recorded().length;
        fakes.control.fireFile(DECK);
        fakes.clock.advance(DEBOUNCE_MS);
        await settle();
        const sent = editor
          .recorded()
          .slice(before)
          .filter((m) => m.type === 'external-change');
        if (!doc.dirty) expect(sent, label).toEqual([]);
        break;
      }
    }
  }

  // Nothing but the canvas's own valid texts is ever written.
  for (const write of fakes.files.writes) {
    expect(
      sentByCanvas.has(write.text) || write.text === emptyDeckText(),
      `seed ${String(seed)}`,
    ).toBe(true);
  }
  expect(fakes.ui.notices.filter((n) => n === REPLACED_NOTICE)).toHaveLength(expectedNotices);
}

describe('disk sync properties (SC-002, SC-005)', () => {
  it('holds over 100 random sequences of edit, save, outside change, revert and touch', async () => {
    for (let seed = 1; seed <= 100; seed++) await run(seed);
  });
});
