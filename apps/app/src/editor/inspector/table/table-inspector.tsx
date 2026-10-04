import type { Node, SododeckFile } from '@sododeck/schema';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { Table2 } from 'lucide-react';

import { useUiStore } from '../../../state/ui-store';
import { InspectorFrame } from '../inspector-frame';
import { ChecksTab } from './checks-tab';
import { ColumnsTab } from './columns-tab';
import { DrawerTabs } from './drawer-tabs';
import { GeneralTab } from './general-tab';
import { IndexesTab } from './indexes-tab';

const plural = (n: number, one: string) => `${String(n)} ${one}${n === 1 ? '' : 's'}`;

/**
 * The table drawer (052): a header and four tabs (General, Columns, Indexes, Checks). The
 * panels are filled by the stories that own them.
 */
export function TableInspector({ deck, node }: { deck: SododeckFile; node: Node }) {
  const tab = useUiStore((s) => s.tableDrawer.tab);
  const setTab = useUiStore((s) => s.setTableDrawerTab);
  const subtitle = `Table · ${plural(node.columns?.length ?? 0, 'column')} · ${plural(node.indexes?.length ?? 0, 'index')}`;
  return (
    <InspectorFrame
      icon={<Table2 aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-5" />}
      heading={node.title}
      subtitle={subtitle}
    >
      <DrawerTabs tab={tab} onChange={setTab}>
        {tab === 'general' && <GeneralTab deck={deck} node={node} />}
        {tab === 'columns' && <ColumnsTab deck={deck} node={node} />}
        {tab === 'indexes' && <IndexesTab deck={deck} node={node} />}
        {tab === 'checks' && <ChecksTab deck={deck} node={node} />}
      </DrawerTabs>
    </InspectorFrame>
  );
}
