import { observeDeck } from '@sododeck/model';
import type { Id } from '@sododeck/schema';
import { useToast } from '@sododeck/ui/components/toast';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createSessionMemory } from '../../db/sync/session-memory';
import { useDeckSnapshot, readDeck } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import type { SchemaScope } from '../../state/json-panel-prefs';
import { useUiStore } from '../../state/ui-store';
import { cardSize } from '../canvas-geometry';
import { tableContextOf } from '../table-keys';
import { getImportClient } from '../import/import-session';
import { showUndoToast } from '../undo-toast';
import type { DbmlEditorHandle } from './dbml-editor';
import { DbmlSession, type SessionView } from './dbml-session';
import { useSchemaText } from './use-schema-text';

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/** Ids for new tables, columns and relationships (the model's own generator is not exported). */
function newDeckId(prefix: string): Id {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(10));
  let random = '';
  for (const byte of bytes) random += ALPHABET.charAt(byte % ALPHABET.length);
  return `${prefix}-${random}`;
}

const INITIAL: SessionView = { state: 'synced', problems: [], confirmCount: 0 };

/** Wording of a removal toast (contract: "Removed shipments" / "Removed n tables"). */
export function removalMessage(removed: readonly { name: string }[]): string {
  const [only] = removed;
  return removed.length === 1 && only !== undefined
    ? `Removed ${only.name}`
    : `Removed ${String(removed.length)} tables`;
}

export interface DbmlSessionBindings {
  /** The writer's text for the scope, to seed the editor. */
  initialText: string;
  tableCount: number;
  view: SessionView;
  /** Props for the editor: wire each straight through. */
  editorProps: {
    onReady: (handle: DbmlEditorHandle) => void;
    onUserChange: () => void;
    onFocus: () => void;
    onBlur: () => void;
    onUndo: () => void;
    onRedo: () => void;
  };
  applyConfirmed: () => void;
  /** The editor's current text (Copy). */
  getText: () => string;
}

/**
 * Wires a `DbmlSession` to the deck, the selection and the writer's text (046 R8): applies on a
 * pause, follows deck changes made elsewhere, and discards unapplied text when the tab goes away.
 */
export function useDbmlSession(scope: SchemaScope): DbmlSessionBindings {
  const editor = useEditor();
  const deck = useDeckSnapshot(editor.doc);
  const selection = useUiStore((s) => s.selection.nodes);
  const api = useToast();
  const writer = useSchemaText(deck, { format: 'dbml', scope, dialect: null, selection }, true);

  const handle = useRef<DbmlEditorHandle | null>(null);
  const latest = useRef({ deck, api });
  useEffect(() => {
    latest.current = { deck, api };
  });
  const memory = useMemo(() => createSessionMemory(), []);
  const [view, setView] = useState<SessionView>(INITIAL);
  const [session, setSession] = useState<DbmlSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const created = new DbmlSession({
      editor,
      getDeck: () => readDeck(editor.doc),
      readDbml: (text) => getImportClient().readDbml(text),
      io: {
        getText: () => handle.current?.getText() ?? '',
        setText: (text) => {
          handle.current?.setText(text);
        },
      },
      newId: newDeckId,
      viewport: () => {
        const vp = useUiStore.getState().canvasViewport;
        if (vp === null) return { x: 0, y: 0, width: 1000, height: 600 };
        const zoom = vp.zoom > 0 ? vp.zoom : 1;
        return {
          x: -vp.x / zoom,
          y: -vp.y / zoom,
          width: window.innerWidth / zoom,
          height: window.innerHeight / zoom,
        };
      },
      sizeOf: (node) => {
        const table = tableContextOf(latest.current.deck);
        return cardSize(node, undefined, { table });
      },
      memory,
      onRemoved: (removed) => {
        showUndoToast(latest.current.api, editor, removalMessage(removed));
      },
      onAdded: (ids) => {
        const state = useUiStore.getState();
        if (scope === 'selection') state.select({ nodes: [...state.selection.nodes, ...ids] });
      },
      onChange: setView,
    });
    setSession(created);
    const off = observeDeck(editor.doc, (change) => {
      created.deckChanged(change.origin);
    });
    return () => {
      off();
      created.dispose();
      setSession(null);
    };
  }, [editor, memory, scope]);

  useEffect(() => {
    session?.setScope(scope);
  }, [session, scope]);

  // The writer's text reaches the editor (or waits, when the user has typing pending).
  useEffect(() => {
    if (session === null || !ready) return;
    session.writerChanged({ text: writer.text, tableIds: writer.tableIds });
  }, [session, ready, writer.text, writer.tableIds]);

  const onReady = useCallback((created: DbmlEditorHandle) => {
    handle.current = created;
    setReady(true);
  }, []);

  const editorProps = useMemo(
    () => ({
      onReady,
      onUserChange: () => {
        session?.typed();
      },
      onFocus: () => {
        session?.setFocused(true);
      },
      onBlur: () => {
        session?.setFocused(false);
      },
      onUndo: () => {
        editor.undo();
      },
      onRedo: () => {
        editor.redo();
      },
    }),
    [onReady, session, editor],
  );

  return {
    initialText: writer.text,
    tableCount: writer.tableCount,
    view,
    editorProps,
    applyConfirmed: () => {
      session?.applyConfirmed();
    },
    getText: () => handle.current?.getText() ?? '',
  };
}
