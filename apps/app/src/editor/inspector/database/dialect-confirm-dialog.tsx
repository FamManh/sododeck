import { changeGroups } from '../../../db/dialect-change';
import { writtenType } from '../../../db/import/convert-types';
import { useEditor } from '../../../model/use-editor';
import { useUiStore } from '../../../state/ui-store';
import { ConfirmDialog } from '../../fields/confirm-dialog';
import { useUndoToast } from '../../undo-toast';
import { applyDialectChange, DIALECT_NAMES } from './apply-dialect-change';

/** Rows shown before the "+ n more" summary (frame 153). */
const SHOWN = 5;

const plural = (n: number, word: string) => `${String(n)} ${word}${n === 1 ? '' : 's'}`;

/**
 * Confirm before a dialect change that converts column types (052 US3, frame 153): the first
 * rows, the rest grouped by conversion, and the types kept as written. Driven by
 * `ui.dialectConfirm`; Confirm writes one undo step and shows the Undo toast.
 */
export function DialectConfirmDialog() {
  const editor = useEditor();
  const plan = useUiStore((s) => s.dialectConfirm);
  const setPlan = useUiStore((s) => s.setDialectConfirm);
  const announce = useUiStore((s) => s.announce);
  const showToast = useUndoToast();
  if (plan === null) return null;

  const n = plan.changes.length;
  const shown = plan.changes.slice(0, SHOWN);
  const rest = plan.changes.slice(SHOWN);
  const groups = changeGroups({ ...plan, changes: rest }).map(
    (g) => `${g.before} → ${g.after} ${String(g.count)}`,
  );
  return (
    <ConfirmDialog
      open
      title={`Convert ${plural(n, 'column')} from ${DIALECT_NAMES[plan.from]} to ${DIALECT_NAMES[plan.to]}?`}
      body="Every table in the deck uses the deck dialect. Types without an equivalent stay as written."
      confirmLabel={`Convert ${plural(n, 'column')}`}
      onCancel={() => {
        setPlan(null);
      }}
      onConfirm={() => {
        const message = applyDialectChange(editor, plan);
        setPlan(null);
        showToast(message);
        announce(message);
      }}
    >
      <div className="flex max-h-72 flex-col gap-3 overflow-y-auto">
        <table className="w-full border-collapse rounded-card bg-surface-2 text-code-sm">
          <tbody>
            {shown.map((change) => (
              <tr key={`${change.tableId}/${change.columnId}`} className="border-b border-line">
                <td className="px-3 py-1.5 text-ink">{change.label}</td>
                <td className="px-2 py-1.5 text-ink-secondary">
                  {writtenType(change.before.type, change.before.size)}
                </td>
                <td className="px-2 py-1.5 text-ink">
                  → {writtenType(change.after.type, change.after.size)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rest.length > 0 && (
          <p className="text-caption text-ink-secondary">
            + {String(rest.length)} more · {groups.join(', ')}
          </p>
        )}
        {plan.kept.length > 0 && (
          <div>
            <p className="text-caption font-medium text-ink-secondary">Kept as written</p>
            <ul className="text-code-sm text-ink-secondary">
              {plan.kept.map((k) => (
                <li key={`${k.tableId}/${k.columnId}`}>
                  {k.label} · {k.type}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ConfirmDialog>
  );
}
