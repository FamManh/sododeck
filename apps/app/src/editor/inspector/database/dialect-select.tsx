import { DIALECT_HINTS } from '@sododeck/model';
import type { Dialect, SododeckFile } from '@sododeck/schema';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sododeck/ui/components/select';
import { useId } from 'react';

import { planDialectChange } from '../../../db/dialect-change';
import { useEditor } from '../../../model/use-editor';
import { useUiStore } from '../../../state/ui-store';
import { useUndoToast } from '../../undo-toast';
import { applyDialectChange, DIALECT_NAMES } from './apply-dialect-change';

const DIALECTS: readonly Dialect[] = ['generic', 'postgres', 'mysql', 'sqlite'];

const isDialect = (value: string): value is Dialect => DIALECTS.some((d) => d === value);

/**
 * The deck dialect (052 US3, frame 152): plans the conversion first; a plan with changes opens
 * the confirm, an empty one applies at once with the Undo toast.
 */
export function DialectSelect({ deck }: { deck: SododeckFile }) {
  const editor = useEditor();
  const id = useId();
  const showToast = useUndoToast();
  const announce = useUiStore((s) => s.announce);
  const current: Dialect = deck.dialect ?? 'generic';
  return (
    <Select
      value={current}
      onValueChange={(value) => {
        if (!isDialect(value) || value === current) return;
        const plan = planDialectChange(deck, value);
        if (plan.changes.length > 0) {
          useUiStore.getState().setDialectConfirm(plan);
          return;
        }
        const message = applyDialectChange(editor, plan);
        showToast(message);
        announce(message);
      }}
    >
      <SelectTrigger aria-label="Dialect" id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {DIALECTS.map((dialect) => (
          <SelectItem key={dialect} value={dialect}>
            <span className="flex flex-col">
              <span>{DIALECT_NAMES[dialect]}</span>
              <span className="text-caption text-ink-secondary">{DIALECT_HINTS[dialect]}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
