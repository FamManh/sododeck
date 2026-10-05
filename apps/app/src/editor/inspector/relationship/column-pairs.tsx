import { deckDialect } from '@sododeck/model';
import type { DbColumn, Edge, Id, Node, SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { Combobox } from '@sododeck/ui/components/combobox';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { ArrowDown, ArrowUp, CircleAlert, Plus, X } from 'lucide-react';
import { useState } from 'react';

import { useUiStore } from '../../../state/ui-store';
import { ConfirmDialog } from '../../fields/confirm-dialog';
import { FieldLabel } from '../../fields/field-label';
import { typeMismatch } from '../../relationships/type-mismatch';

type Pairs = { fromColumns: Id[]; toColumns: Id[] };

const plural = (n: number) => `${String(n)} column${n === 1 ? '' : 's'}`;

/** `list` with the item at `from` moved to `to`; unchanged when either place is outside it. */
function moved(list: readonly Id[], from: number, to: number): Id[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item === undefined || to < 0 || to > next.length) return [...list];
  next.splice(to, 0, item);
  return next;
}

const without = (list: readonly Id[], index: number): Id[] => list.filter((_, i) => i !== index);

/** The first column of `table` that `used` does not name yet, else its first column. */
function nextColumn(table: Node | undefined, used: readonly Id[]): Id | undefined {
  const columns = table?.columns ?? [];
  return (columns.find((c) => !used.includes(c.id)) ?? columns[0])?.id;
}

/**
 * The column pairs of a relationship (052 US2, frame 164): one row per position of the two
 * lists, a From and a To select, move and remove buttons, a (!) where the two types differ and
 * a warning when the lists differ in length. Every change writes both lists in one `onWrite`.
 * Removing the last pair asks, then deletes the relationship.
 */
export function ColumnPairs({
  deck,
  edge,
  onWrite,
}: {
  deck: SododeckFile;
  edge: Edge;
  onWrite: (pairs: Pairs) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const fromTable = deck.nodes.find((n) => n.id === edge.from);
  const toTable = deck.nodes.find((n) => n.id === edge.to);
  const from = edge.fromColumns ?? [];
  const to = edge.toColumns ?? [];
  const count = Math.max(from.length, to.length);
  const dialect = deckDialect(deck);
  const columnOf = (table: Node | undefined, id: Id | undefined): DbColumn | undefined =>
    id === undefined ? undefined : table?.columns?.find((c) => c.id === id);
  const options = (table: Node | undefined) =>
    (table?.columns ?? []).map((c) => ({ value: c.id, label: c.name }));

  const setAt = (side: 'from' | 'to', index: number, id: Id) => {
    const list = [...(side === 'from' ? from : to)];
    if (index > list.length) return;
    list[index] = id;
    onWrite(
      side === 'from'
        ? { fromColumns: list, toColumns: [...to] }
        : { fromColumns: [...from], toColumns: list },
    );
  };

  const add = () => {
    const f = nextColumn(fromTable, from);
    const t = nextColumn(toTable, to);
    if (f === undefined || t === undefined) return;
    onWrite({ fromColumns: [...from, f], toColumns: [...to, t] });
  };

  const remove = (index: number) => {
    if (count <= 1) {
      setConfirming(true);
      return;
    }
    onWrite({ fromColumns: without(from, index), toColumns: without(to, index) });
  };

  const move = (index: number, by: -1 | 1) => {
    onWrite({
      fromColumns: moved(from, index, index + by),
      toColumns: moved(to, index, index + by),
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[1fr_1fr_auto] gap-x-2 gap-y-2">
        <FieldLabel>{`From · ${fromTable?.title ?? edge.from}`}</FieldLabel>
        <FieldLabel>{`To · ${toTable?.title ?? edge.to}`}</FieldLabel>
        <span aria-hidden />
        {Array.from({ length: count }, (_, i) => {
          const source = columnOf(fromTable, from[i]);
          const target = columnOf(toTable, to[i]);
          const mismatch =
            source !== undefined && target !== undefined
              ? typeMismatch(source, target, dialect)
              : undefined;
          return (
            <PairRow
              key={i}
              index={i}
              last={i === count - 1}
              fromValue={from[i] ?? ''}
              toValue={to[i] ?? ''}
              fromOptions={options(fromTable)}
              toOptions={options(toTable)}
              mismatch={mismatch}
              onPick={setAt}
              onMove={move}
              onRemove={remove}
            />
          );
        })}
      </div>
      {from.length !== to.length && (
        <p role="alert" className="flex items-center gap-1 text-caption text-clay-ink">
          <CircleAlert aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3.5 shrink-0" />
          {`From has ${plural(from.length)}, To has ${String(to.length)}`}
        </p>
      )}
      <Button size="sm" className="self-start" onClick={add} aria-label="Add column pair">
        <Plus aria-hidden strokeWidth={ICON_STROKE_WIDTH} />
        Pair
      </Button>
      <ConfirmDialog
        open={confirming}
        title="Remove the relationship?"
        body="It has no other column pair."
        confirmLabel="Remove relationship"
        onCancel={() => {
          setConfirming(false);
        }}
        onConfirm={() => {
          setConfirming(false);
          useUiStore.getState().requestDelete({ nodes: [], edges: [edge.id] });
        }}
      />
    </div>
  );
}

function PairRow({
  index,
  last,
  fromValue,
  toValue,
  fromOptions,
  toOptions,
  mismatch,
  onPick,
  onMove,
  onRemove,
}: {
  index: number;
  last: boolean;
  fromValue: Id;
  toValue: Id;
  fromOptions: { value: string; label: string }[];
  toOptions: { value: string; label: string }[];
  mismatch: string | undefined;
  onPick: (side: 'from' | 'to', index: number, id: Id) => void;
  onMove: (index: number, by: -1 | 1) => void;
  onRemove: (index: number) => void;
}) {
  const n = String(index + 1);
  return (
    <>
      <Combobox
        mode="pick"
        label={`From column ${n}`}
        listLabel={`From columns ${n}`}
        value={fromValue}
        options={fromOptions}
        maxOptions={50}
        onValueChange={(id) => {
          onPick('from', index, id);
        }}
      />
      <div className="flex min-w-0 items-center gap-1">
        <Combobox
          mode="pick"
          label={`To column ${n}`}
          listLabel={`To columns ${n}`}
          value={toValue}
          options={toOptions}
          maxOptions={50}
          onValueChange={(id) => {
            onPick('to', index, id);
          }}
        />
        {mismatch !== undefined && (
          <span
            role="img"
            aria-label={`Types differ: ${mismatch}`}
            title={`Types differ: ${mismatch}`}
          >
            <CircleAlert
              aria-hidden
              strokeWidth={ICON_STROKE_WIDTH}
              className="size-4 text-clay-ink"
            />
          </span>
        )}
      </div>
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Move pair ${n} up`}
          disabled={index === 0}
          onClick={() => {
            onMove(index, -1);
          }}
        >
          <ArrowUp />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Move pair ${n} down`}
          disabled={last}
          onClick={() => {
            onMove(index, 1);
          }}
        >
          <ArrowDown />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Remove pair ${n}`}
          onClick={() => {
            onRemove(index);
          }}
        >
          <X />
        </Button>
      </div>
    </>
  );
}
