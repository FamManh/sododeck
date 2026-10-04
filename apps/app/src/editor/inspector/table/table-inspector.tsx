import { isLocked } from '@sododeck/model';
import type { Node, SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { Lock, Table2 } from 'lucide-react';

import { useEditor } from '../../../model/use-editor';
import { useUiStore } from '../../../state/ui-store';
import { toggleLock } from '../../actions/table-actions';
import { InspectorFrame } from '../inspector-frame';
import { ChecksTab } from './checks-tab';
import { ColumnsTab } from './columns-tab';
import { DrawerTabs } from './drawer-tabs';
import { GeneralTab } from './general-tab';
import { IndexesTab } from './indexes-tab';

const plural = (n: number, one: string) => `${String(n)} ${one}${n === 1 ? '' : 's'}`;

/**
 * The table drawer (052): a header and four tabs (General, Columns, Indexes, Checks). A locked
 * table (043) keeps its tabs but every control is disabled, with a note and an Unlock button.
 */
export function TableInspector({ deck, node }: { deck: SododeckFile; node: Node }) {
  const editor = useEditor();
  const locked = isLocked(node);
  const tab = useUiStore((s) => s.tableDrawer.tab);
  const setTab = useUiStore((s) => s.setTableDrawerTab);
  const subtitle = `Table · ${plural(node.columns?.length ?? 0, 'column')} · ${plural(node.indexes?.length ?? 0, 'index')}`;
  return (
    <InspectorFrame
      icon={<Table2 aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-5" />}
      heading={node.title}
      subtitle={subtitle}
    >
      {locked && (
        <div className="flex items-center gap-2 border-b border-hairline px-4 py-2 text-body-sm text-ink-secondary">
          <Lock aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4 shrink-0" />
          <span className="flex-1">Locked · unlock to edit</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              toggleLock(editor, deck, [node.id]);
            }}
          >
            Unlock
          </Button>
        </div>
      )}
      <DrawerTabs tab={tab} onChange={setTab}>
        {/* A disabled fieldset disables every native control inside it, whichever tab owns it. */}
        <fieldset disabled={locked} className="m-0 min-w-0 border-0 p-0">
          {tab === 'general' && <GeneralTab deck={deck} node={node} />}
          {tab === 'columns' && <ColumnsTab deck={deck} node={node} />}
          {tab === 'indexes' && <IndexesTab deck={deck} node={node} />}
          {tab === 'checks' && <ChecksTab deck={deck} node={node} />}
        </fieldset>
      </DrawerTabs>
    </InspectorFrame>
  );
}
