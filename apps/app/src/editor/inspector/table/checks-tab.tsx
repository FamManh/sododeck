import type { Node, SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { PanelSection } from '@sododeck/ui/components/panel';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { Plus } from 'lucide-react';

import { useEditor } from '../../../model/use-editor';
import { useUiStore } from '../../../state/ui-store';
import { oneStep } from '../../fields/one-step';
import { LiveTextField } from './live-text-field';
import { PartMenu } from './part-menu';

/** A new check starts with an always-true expression the user then edits (the schema needs one). */
const NEW_CHECK_EXPR = 'true';

/** The table drawer's Checks tab (052, frame 164): table-level check constraints. */
export function ChecksTab({ node }: { deck: SododeckFile; node: Node }) {
  const editor = useEditor();
  const checks = node.checks ?? [];
  return (
    <PanelSection>
      <div className="flex items-center justify-between gap-3">
        <span className="text-body-sm text-ink-secondary">
          {checks.length === 0 ? 'No checks yet.' : `${String(checks.length)} checks`}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            oneStep(editor, () => {
              editor.addCheck(node.id, { expr: NEW_CHECK_EXPR });
            });
            useUiStore.getState().announce('Check added');
          }}
        >
          <Plus aria-hidden strokeWidth={ICON_STROKE_WIDTH} />+ Check
        </Button>
      </div>
      <ul aria-label="Checks" className="mt-3 flex flex-col gap-3">
        {checks.map((check) => (
          <li
            key={check.id}
            aria-label={`Check ${check.name ?? check.expr}`}
            className="flex flex-col gap-2 rounded-card border border-border bg-surface p-3"
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <LiveTextField
                  label="Check name"
                  hideLabel
                  placeholder="Name (optional)"
                  value={check.name ?? ''}
                  onWrite={(name) => {
                    editor.updateCheck(node.id, check.id, { name: name === '' ? null : name });
                  }}
                />
              </div>
              <PartMenu
                label="Check options"
                deleteLabel="Delete check"
                onDelete={() => {
                  oneStep(editor, () => {
                    editor.removeCheck(node.id, check.id);
                  });
                  useUiStore.getState().announce('Check deleted');
                }}
              />
            </div>
            <LiveTextField
              label="Check expression"
              hideLabel
              required
              mono
              placeholder="total > 0"
              value={check.expr}
              onWrite={(expr) => {
                editor.updateCheck(node.id, check.id, { expr });
              }}
            />
          </li>
        ))}
      </ul>
    </PanelSection>
  );
}
