/**
 * The DBML edit session (046 research R1, R2, R8): a small state machine between the text in the
 * editor and the deck. It is plain TypeScript (no React, no Monaco) so the timing rules are tested
 * with fake timers; `use-dbml-session.ts` and `dbml-tab.tsx` wire it to the editor.
 *
 *   synced  --type-->            dirty
 *   dirty   --pause, errors-->   invalid
 *   dirty   --pause, clean-->    applied (focus) | synced (no focus)
 *   dirty   --pause, removes all tables--> confirm
 *   invalid --type-->            dirty
 *   confirm --Apply-->           applied ; --type--> dirty
 *   applied --type-->            dirty ; --blur--> synced (text rewritten)
 *   dirty | invalid | confirm --blur / switch / close--> synced (text discarded)
 *
 * Writes go through `applySchemaPlan` in one merged batch keyed `dbml:<session>:<burst>`; the burst
 * number moves on after 2 s without typing, on blur, on undo / redo and on any other local write.
 */
import { baseViewId, resolveViews, type DeckEditor, type Point } from '@sododeck/model';
import type { Id, SododeckFile } from '@sododeck/schema';

import { applySchemaPlan } from '../../db/sync/apply-schema-plan';
import { planSchemaSync } from '../../db/sync/plan-schema-sync';
import { rememberTables } from '../../db/sync/session-memory';
import type {
  Rect,
  SchemaPlan,
  SessionMemory,
  SyncContext,
  TextProblem,
} from '../../db/sync/types';
import type { ReadDbmlResult } from '../../db/import/import-client';
import type { SchemaScope } from '../../state/json-panel-prefs';

/** Typing pause before the text is read and applied. */
export const DBML_APPLY_PAUSE_MS = 500;
/** Typing idle time that ends an undo burst. */
export const DBML_BURST_IDLE_MS = 2000;

export type SessionState = 'synced' | 'dirty' | 'invalid' | 'applied' | 'confirm';

/** What the footer and the markers show (data-model "DBML edit session"). */
export interface SessionView {
  state: SessionState;
  problems: readonly TextProblem[];
  /** Tables the pending "remove everything" apply would remove. */
  confirmCount: number;
}

export interface SessionDeps {
  editor: DeckEditor;
  getDeck: () => SododeckFile;
  readDbml: (text: string) => Promise<ReadDbmlResult>;
  /** Reads and writes the editor's text; `setText` is a programmatic edit (not typing). */
  io: { getText: () => string; setText: (text: string) => void };
  newId: (prefix: string) => Id;
  viewport: () => Rect;
  sizeOf?: SyncContext['sizeOf'];
  memory: SessionMemory;
  /** Tables an apply removed ("Removed shipments · Undo"). */
  onRemoved?: (removed: { id: Id; name: string }[]) => void;
  /** Tables an apply added (Selection: they join the selection). */
  onAdded?: (ids: Id[]) => void;
  /**
   * Lays out tables an apply added together (two or more: a paste), with their relationships.
   * Off the main thread; the positions join the apply's undo step. Absent: they keep the plan's.
   */
  arrange?: (deck: SododeckFile, ids: readonly Id[]) => Promise<ReadonlyMap<Id, Point>>;
  /** Called on every state or problem change. */
  onChange?: (view: SessionView) => void;
  sessionId?: string;
}

/** What the session needs to know about the writer's text for the current scope. */
export interface WriterText {
  text: string;
  tableIds: readonly Id[];
}

const hasErrors = (problems: readonly TextProblem[]) =>
  problems.some((p) => p.severity === 'error');

export class DbmlSession {
  private state: SessionState = 'synced';
  private problems: readonly TextProblem[] = [];
  private confirmCount = 0;
  private burst = 0;
  private readSeq = 0;
  private focused = false;
  private applying = false;
  private writer: WriterText = { text: '', tableIds: [] };
  private baseline: Id[] = [];
  private scope: SchemaScope = 'schema';
  private pending: SchemaPlan | null = null;
  private pauseTimer: ReturnType<typeof setTimeout> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private readonly id: string;

  constructor(private readonly deps: SessionDeps) {
    this.id = deps.sessionId ?? Math.random().toString(36).slice(2, 8);
  }

  view(): SessionView {
    return { state: this.state, problems: this.problems, confirmCount: this.confirmCount };
  }

  /** The key the next apply merges under. */
  mergeKey(): string {
    return `dbml:${this.id}:${String(this.burst)}`;
  }

  /** The scope the text is for (Selection bounds removals by the baseline). */
  setScope(scope: SchemaScope): void {
    this.scope = scope;
  }

  /**
   * The writer's text for the scope changed (the deck changed, or the scope or selection did). It
   * replaces the editor text only when nothing of the user's is pending (FR-017, FR-018, FR-019).
   */
  writerChanged(writer: WriterText): void {
    this.writer = writer;
    if (this.state === 'synced' || (this.state === 'applied' && !this.focused)) {
      this.showWriterText();
    }
  }

  /** The user typed (not a programmatic edit). */
  typed(): void {
    if (this.disposed) return;
    this.clearPause();
    this.pending = null;
    this.set('dirty');
    this.pauseTimer = setTimeout(() => {
      this.pauseTimer = null;
      void this.flush();
    }, DBML_APPLY_PAUSE_MS);
    if (this.idleTimer !== null) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      this.burst++;
    }, DBML_BURST_IDLE_MS);
  }

  setFocused(focused: boolean): void {
    if (this.focused === focused) return;
    this.focused = focused;
    if (!focused) this.blurred();
  }

  /** Blur, tab switch or close: what was not applied is discarded, an applied text is rewritten. */
  private blurred(): void {
    this.burst++;
    this.clearPause();
    this.readSeq++;
    this.pending = null;
    this.problems = [];
    this.confirmCount = 0;
    this.set('synced');
    this.showWriterText();
  }

  /** A change to the deck, from `observeDeck`: ours (applying), another local write, undo or remote. */
  deckChanged(origin: 'local' | 'undo' | 'redo' | 'remote'): void {
    if (this.applying || this.disposed) return;
    if (origin === 'local' || origin === 'undo' || origin === 'redo') {
      // The editor's own typing no longer owns the step: whatever comes next starts a new one.
      this.burst++;
    }
    if (origin === 'undo' || origin === 'redo') {
      // The text must show what the undo did, whatever the user had pending.
      this.clearPause();
      this.readSeq++;
      this.pending = null;
      this.problems = [];
      this.confirmCount = 0;
      this.set('synced');
      this.showWriterText();
    }
  }

  /** "Apply" on the remove-everything confirmation. */
  applyConfirmed(): void {
    const plan = this.pending;
    if (this.state !== 'confirm' || plan === null) return;
    this.pending = null;
    this.confirmCount = 0;
    this.write(plan);
    this.set(this.focused ? 'applied' : 'synced');
  }

  dispose(): void {
    this.disposed = true;
    this.clearPause();
    if (this.idleTimer !== null) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    this.readSeq++;
  }

  // ---------------------------------------------------------------------------------------------

  private isDisposed(): boolean {
    return this.disposed;
  }

  private showWriterText(): void {
    this.baseline = [...this.writer.tableIds];
    if (this.deps.io.getText() !== this.writer.text) this.deps.io.setText(this.writer.text);
  }

  private clearPause(): void {
    if (this.pauseTimer !== null) clearTimeout(this.pauseTimer);
    this.pauseTimer = null;
  }

  private set(state: SessionState): void {
    this.state = state;
    this.deps.onChange?.(this.view());
  }

  private fail(problems: readonly TextProblem[]): void {
    this.problems = problems;
    this.confirmCount = 0;
    this.pending = null;
    this.set(hasErrors(problems) ? 'invalid' : this.focused ? 'applied' : 'synced');
  }

  /** Reads the text in the worker, plans against the deck as it is now, and applies. */
  async flush(): Promise<void> {
    if (this.disposed) return;
    const seq = ++this.readSeq;
    const text = this.deps.io.getText();
    let read: ReadDbmlResult;
    try {
      read = await this.deps.readDbml(text);
    } catch {
      // A newer read replaced this one, or the worker went away: nothing to apply from it.
      return;
    }
    if (seq !== this.readSeq || this.isDisposed()) return;
    if (hasErrors(read.problems)) {
      this.fail(read.problems);
      return;
    }
    // Plan and apply in one synchronous step, so the plan is never older than the deck it writes.
    const deck = this.deps.getDeck();
    const ctx: SyncContext = {
      scope:
        this.scope === 'schema'
          ? { kind: 'schema' }
          : { kind: 'selection', baseline: this.baseline },
      memory: this.deps.memory,
      newId: this.deps.newId,
      viewport: this.deps.viewport(),
      ...(this.deps.sizeOf === undefined ? {} : { sizeOf: this.deps.sizeOf }),
    };
    const { plan, problems } = planSchemaSync(deck, read.schema, ctx);
    const all = [...read.problems, ...problems];
    if (hasErrors(all)) {
      this.fail(all);
      return;
    }
    this.problems = all;
    if (plan.removesAll) {
      this.pending = plan;
      this.confirmCount = plan.removeTables.length;
      this.set('confirm');
      return;
    }
    this.confirmCount = 0;
    if (!plan.isEmpty) this.write(plan, deck);
    this.set(this.focused ? 'applied' : 'synced');
  }

  private write(plan: SchemaPlan, deck: SododeckFile = this.deps.getDeck()): void {
    if (plan.removeTables.length > 0) {
      rememberTables(
        this.deps.memory,
        deck,
        plan.removeTables.map((t) => t.id),
      );
    }
    this.applying = true;
    let result: ReturnType<typeof applySchemaPlan>;
    try {
      result = applySchemaPlan(this.deps.editor, plan, { merge: this.mergeKey() });
    } finally {
      this.applying = false;
    }
    if (this.scope === 'selection') {
      const removed = new Set(result.removedTables.map((t) => t.id));
      this.baseline = [...this.baseline.filter((id) => !removed.has(id)), ...result.addedTableIds];
    }
    if (result.addedTableIds.length > 0) this.deps.onAdded?.(result.addedTableIds);
    if (result.removedTables.length > 0) this.deps.onRemoved?.(result.removedTables);
    if (result.addedTableIds.length > 1) void this.arrangeAdded(result.addedTableIds);
  }

  /**
   * Moves tables just added to where the layout puts them, in the apply's undo step. A table that
   * is gone or was moved meanwhile keeps its place.
   */
  private async arrangeAdded(ids: readonly Id[]): Promise<void> {
    const arrange = this.deps.arrange;
    if (arrange === undefined) return;
    const merge = this.mergeKey();
    const placed = this.deps.getDeck();
    const wanted = new Set(ids);
    const placedAt = new Map(
      placed.nodes.filter((n) => wanted.has(n.id)).map((n) => [n.id, n.position]),
    );
    let positions: ReadonlyMap<Id, Point>;
    try {
      positions = await arrange(placed, ids);
    } catch {
      return;
    }
    if (this.disposed) return;
    const now = this.deps.getDeck();
    const moves: Record<Id, Point> = {};
    for (const node of now.nodes) {
      const to = positions.get(node.id);
      const was = placedAt.get(node.id);
      if (to === undefined || was === undefined) continue;
      if (node.position?.x === was.x && node.position.y === was.y) moves[node.id] = to;
    }
    if (Object.keys(moves).length === 0) return;
    const { editor } = this.deps;
    this.applying = true;
    try {
      editor.batch(
        () => {
          editor.moveInView(baseViewId(resolveViews(now)), moves);
        },
        { merge },
      );
    } finally {
      this.applying = false;
    }
  }
}
