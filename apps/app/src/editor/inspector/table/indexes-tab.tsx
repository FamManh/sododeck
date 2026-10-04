import type { DbIndex, Node, SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import type { ComboboxOption } from '@sododeck/ui/components/combobox';
import { PanelSection } from '@sododeck/ui/components/panel';
import { Switch } from '@sododeck/ui/components/switch';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { Plus } from 'lucide-react';
import { useId } from 'react';

import { useEditor } from '../../../model/use-editor';
import { useUiStore } from '../../../state/ui-store';
import { INDEX_METHODS } from '../../../db/dialect-types';
import { oneStep } from '../../fields/one-step';
import { PickField } from '../../fields/pick-field';
import { IndexParts } from './index-parts';
import { LiveTextField } from './live-text-field';
import { PartMenu } from './part-menu';
import { partLabel } from './part-label';

const DEFAULT_METHOD = '';

/** Methods the dialect lists, "Default" first, plus a stored method the list does not know. */
function methodOptions(methods: readonly string[], stored: string | undefined) {
  const options: ComboboxOption[] = [{ value: DEFAULT_METHOD, label: 'Default' }];
  for (const method of methods) options.push({ value: method, label: method });
  if (stored !== undefined && !methods.includes(stored))
    options.push({ value: stored, label: stored });
  return options;
}

function IndexCard({ node, index, deck }: { node: Node; index: DbIndex; deck: SododeckFile }) {
  const editor = useEditor();
  const switchId = useId();
  const columns = node.columns ?? [];
  const methods = INDEX_METHODS[deck.dialect ?? 'generic'];
  // SQLite lists none, but a method read from a file stays visible and editable.
  const showMethod = methods.length > 0 || index.method !== undefined;
  const title = index.name ?? index.columns.map((part) => partLabel(part, columns)).join(', ');
  return (
    <li
      aria-label={`Index ${title}`}
      className="flex flex-col gap-3 rounded-card border border-border bg-surface p-3"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <LiveTextField
            label="Index name"
            hideLabel
            placeholder="Name (optional)"
            value={index.name ?? ''}
            onWrite={(name) => {
              editor.updateIndex(node.id, index.id, { name: name === '' ? null : name });
            }}
          />
        </div>
        <PartMenu
          label="Index options"
          deleteLabel="Delete index"
          onDelete={() => {
            oneStep(editor, () => {
              editor.removeIndex(node.id, index.id);
            });
            useUiStore.getState().announce('Index deleted');
          }}
        />
      </div>
      <IndexParts
        parts={index.columns}
        columns={columns}
        onChange={(parts) => {
          oneStep(editor, () => {
            editor.updateIndex(node.id, index.id, { columns: parts });
          });
        }}
      />
      <div className="flex items-center justify-between gap-3 text-body">
        <label htmlFor={switchId} className="text-ink-secondary">
          Unique
        </label>
        <Switch
          id={switchId}
          checked={index.unique === true}
          onCheckedChange={(unique) => {
            oneStep(editor, () => {
              editor.updateIndex(node.id, index.id, { unique: unique ? true : false });
            });
          }}
        />
      </div>
      {showMethod && (
        <PickField
          label="Method"
          listLabel="Index methods"
          value={index.method ?? DEFAULT_METHOD}
          options={methodOptions(methods, index.method)}
          onPick={(method) => {
            oneStep(editor, () => {
              editor.updateIndex(node.id, index.id, {
                method: method === DEFAULT_METHOD ? null : method,
              });
            });
          }}
        />
      )}
      <LiveTextField
        label="Index note"
        hideLabel
        placeholder="Note"
        value={index.note ?? ''}
        onWrite={(note) => {
          editor.updateIndex(node.id, index.id, { note: note === '' ? null : note });
        }}
      />
    </li>
  );
}

/** The table drawer's Indexes tab (052, frame 164): name, parts, unique, method and note. */
export function IndexesTab({ deck, node }: { deck: SododeckFile; node: Node }) {
  const editor = useEditor();
  const indexes = node.indexes ?? [];
  const first = node.columns?.[0];
  return (
    <PanelSection>
      <div className="flex items-center justify-between gap-3">
        <span className="text-body-sm text-ink-secondary">
          {indexes.length === 0 ? 'No indexes yet.' : `${String(indexes.length)} indexes`}
        </span>
        <Button
          variant="ghost"
          size="sm"
          // An index needs a part; a table without columns has nothing to index.
          disabled={first === undefined}
          onClick={() => {
            if (first === undefined) return;
            oneStep(editor, () => {
              editor.addIndex(node.id, { columns: [first.id] });
            });
            useUiStore.getState().announce('Index added');
          }}
        >
          <Plus aria-hidden strokeWidth={ICON_STROKE_WIDTH} />+ Index
        </Button>
      </div>
      <ul aria-label="Indexes" className="mt-3 flex flex-col gap-3">
        {indexes.map((index) => (
          <IndexCard key={index.id} node={node} index={index} deck={deck} />
        ))}
      </ul>
    </PanelSection>
  );
}
