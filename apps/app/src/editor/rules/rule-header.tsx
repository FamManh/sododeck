import type { Rule } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect } from 'react';

import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { FieldEdit } from '../field-edit';
import { MarkdownField } from '../fields/markdown-field';
import { oneStep } from '../fields/one-step';
import { PickField } from '../fields/pick-field';
import { HIT_POLICIES } from './rule-text';

const POLICY_OPTIONS = HIT_POLICIES.map(({ value, label }) => ({ value, label }));

/**
 * The open rule's header (FR-020, design 04): name (required), markdown description, hit policy,
 * "+ Condition", "+ Action" and "Delete rule…".
 */
export function RuleHeader({
  ruleId,
  rule,
  autoFocusName = false,
  onAddColumn,
}: {
  ruleId: string;
  rule: Rule;
  autoFocusName?: boolean;
  onAddColumn: (side: 'inputs' | 'outputs') => void;
}) {
  const editor = useEditor();
  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-60 flex-1">
          <RuleName ruleId={ruleId} title={rule.title} autoFocus={autoFocusName} />
        </div>
        <div className="w-40">
          <PickField
            label="Hit policy"
            listLabel="Hit policies"
            value={rule.hitPolicy}
            options={POLICY_OPTIONS}
            onPick={(hitPolicy) => {
              oneStep(editor, () => {
                editor.updateRule(ruleId, { hitPolicy: hitPolicy as Rule['hitPolicy'] });
              });
            }}
          />
        </div>
        <Button
          aria-label="Add condition"
          onClick={() => {
            onAddColumn('inputs');
          }}
        >
          <Plus />
          Condition
        </Button>
        <Button
          aria-label="Add action"
          onClick={() => {
            onAddColumn('outputs');
          }}
        >
          <Plus />
          Action
        </Button>
        <Button
          variant="ghost"
          className="text-clay-ink"
          onClick={() => {
            useUiStore.getState().requestRemoval([{ scope: 'rules', id: ruleId }]);
          }}
        >
          <Trash2 />
          Delete rule…
        </Button>
      </div>
      <MarkdownField
        key={ruleId}
        modeKey={`rules:${ruleId}`}
        value={rule.description ?? ''}
        placeholder="What does this rule decide? Markdown supported."
        onCommit={(description) => {
          editor.updateRule(ruleId, { description: description === '' ? null : description });
        }}
      />
    </header>
  );
}

function RuleName({
  ruleId,
  title,
  autoFocus,
}: {
  ruleId: string;
  title: string;
  autoFocus: boolean;
}) {
  const editor = useEditor();
  const id = `rule-name-${ruleId}`;
  // A new rule opens with its name selected, ready to type (FR-020).
  useEffect(() => {
    if (!autoFocus) return;
    const input = document.getElementById(id);
    if (input instanceof HTMLInputElement) {
      input.focus();
      input.select();
    }
  }, [autoFocus, id]);
  return (
    <div>
      <FieldEdit
        key={ruleId}
        id={id}
        label="Rule name"
        value={title}
        onCommit={(value) => {
          editor.updateRule(ruleId, { title: value });
        }}
      />
    </div>
  );
}
