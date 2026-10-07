import type { SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { applyFile, createEditor, getObject, loadDeck, toJSON, type DeckEditor } from '../src';
import { readExample } from './helpers';

const full = await readExample('full.sododeck.json');
const origin = { test: 'host' };

function open(captureTimeout = 0) {
  const { doc } = loadDeck(full);
  const editor = createEditor(doc, { captureTimeout });
  return { doc, editor };
}

/** The open deck as a file, changed by `edit`: what a host would send after an outside edit. */
function outside(editor: DeckEditor, edit: (file: SododeckFile) => void): SododeckFile {
  const file = toJSON(editor.doc);
  edit(file);
  return file;
}

function setNode(file: SododeckFile, id: string, patch: Partial<SododeckFile['nodes'][number]>) {
  const node = file.nodes.find((n) => n.id === id);
  if (node !== undefined) Object.assign(node, patch);
}

const title = (editor: DeckEditor, id: string) => getObject(editor.doc, 'nodes', id)?.title;

/** Undo until nothing is left; returns the number of steps. */
function undoAll(editor: DeckEditor): number {
  let steps = 0;
  while (editor.canUndo()) {
    editor.undo();
    steps++;
  }
  return steps;
}

describe('applyFile and undo (066 US2)', () => {
  it('undo and redo move only the user’s edit; the applied change stays (AS1)', () => {
    const { doc, editor } = open();
    editor.update('nodes', 'order-svc', { position: { x: 1, y: 2 } });
    applyFile(
      doc,
      outside(editor, (f) => {
        setNode(f, 'api-gateway', { title: 'Edge' });
      }),
      origin,
    );
    editor.undo();
    expect(getObject(doc, 'nodes', 'order-svc')?.position).toEqual(
      full.nodes.find((n) => n.id === 'order-svc')?.position,
    );
    expect(title(editor, 'api-gateway')).toBe('Edge');
    editor.redo();
    expect(getObject(doc, 'nodes', 'order-svc')?.position).toEqual({ x: 1, y: 2 });
    expect(title(editor, 'api-gateway')).toBe('Edge');
  });

  it('adds no undo step on a fresh editor and fires no history change (AS2)', () => {
    const { doc, editor } = open();
    let history = 0;
    editor.onHistoryChange(() => history++);
    applyFile(
      doc,
      outside(editor, (f) => {
        f.name = 'Changed outside';
      }),
      origin,
    );
    expect(editor.canUndo()).toBe(false);
    expect(history).toBe(0);
  });

  it('keeps the file’s title when the user undoes an overwritten title (AS3)', () => {
    const { doc, editor } = open();
    editor.update('nodes', 'order-svc', { title: 'Mine' });
    applyFile(
      doc,
      outside(editor, (f) => {
        setNode(f, 'order-svc', { title: 'Theirs' });
      }),
      origin,
    );
    expect(() => {
      editor.undo();
    }).not.toThrow();
    expect(title(editor, 'order-svc')).toBe('Theirs');
  });

  it('keeps the file’s whole description when the user undoes their typing (FR-018)', () => {
    const { doc, editor } = open();
    editor.update('nodes', 'order-svc', { description: 'hello world!' });
    editor.update('nodes', 'order-svc', { description: 'hello world! x' });
    applyFile(
      doc,
      outside(editor, (f) => {
        setNode(f, 'order-svc', { description: 'hello world! xY' });
      }),
      origin,
    );
    editor.undo();
    expect(getObject(doc, 'nodes', 'order-svc')?.description).toBe('hello world! xY');
    editor.undo();
    expect(getObject(doc, 'nodes', 'order-svc')?.description).toBe('hello world! xY');
  });

  it('keeps a card the file re-adds when the user undoes deleting it', () => {
    const { doc, editor } = open();
    const card = toJSON(doc).nodes.find((n) => n.id === 'turned-note');
    editor.remove('nodes', 'turned-note');
    applyFile(
      doc,
      outside(editor, (f) => {
        if (card !== undefined) f.nodes.push({ ...card, title: 'Back from outside' });
      }),
      origin,
    );
    editor.undo();
    expect(title(editor, 'turned-note')).toBe('Back from outside');
    expect(toJSON(doc).nodes.filter((n) => n.id === 'turned-note')).toHaveLength(1);
  });

  it('does not split a typing burst that an apply lands in (AS4)', () => {
    const { doc, editor } = open(10_000);
    const original = title(editor, 'order-svc');
    editor.update('nodes', 'order-svc', { title: 'Or' });
    applyFile(
      doc,
      outside(editor, (f) => {
        setNode(f, 'api-gateway', { title: 'Elsewhere' });
      }),
      origin,
    );
    editor.update('nodes', 'order-svc', { title: 'Orders' });
    expect(undoAll(editor)).toBe(1);
    expect(title(editor, 'order-svc')).toBe(original);
    expect(title(editor, 'api-gateway')).toBe('Elsewhere');
  });

  it('applies at once during a gesture; the gesture stays one step without it', () => {
    const { doc, editor } = open();
    const start = getObject(doc, 'nodes', 'order-svc')?.position;
    editor.beginGesture();
    editor.update('nodes', 'order-svc', { position: { x: 10, y: 10 } });
    applyFile(
      doc,
      outside(editor, (f) => {
        setNode(f, 'api-gateway', { title: 'Mid-drag' });
      }),
      origin,
    );
    expect(title(editor, 'api-gateway')).toBe('Mid-drag');
    editor.update('nodes', 'order-svc', { position: { x: 20, y: 20 } });
    editor.endGesture();
    expect(undoAll(editor)).toBe(1);
    expect(getObject(doc, 'nodes', 'order-svc')?.position).toEqual(start);
    expect(title(editor, 'api-gateway')).toBe('Mid-drag');
  });

  it('leaves the undo and redo stacks as they were', () => {
    const { doc, editor } = open();
    editor.update('nodes', 'order-svc', { title: 'One' });
    editor.update('nodes', 'api-gateway', { title: 'Two' });
    editor.update('nodes', 'dispatch-svc', { title: 'Three' });
    editor.undo();
    expect([editor.canUndo(), editor.canRedo()]).toEqual([true, true]);
    applyFile(
      doc,
      outside(editor, (f) => {
        f.name = 'Outside';
      }),
      origin,
    );
    expect(editor.canRedo()).toBe(true);
    expect(undoAll(editor)).toBe(2);
    let redone = 0;
    while (editor.canRedo()) {
      editor.redo();
      redone++;
    }
    expect(redone).toBe(3);
    expect(toJSON(doc).name).toBe('Outside');
  });
});
