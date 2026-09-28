import { Button } from '@sododeck/ui/components/button';

import type { SododeckFile } from '@sododeck/schema';

import { useUiStore } from '../state/ui-store';
import { currentViewCrumb } from './views/view-title';

export interface DrillDeck {
  groups: { id: string; title: string }[];
  nodes: { id: string; title: string }[];
  /** The deck's views: the first crumb names the current one (011 FR-004). */
  views?: SododeckFile['views'];
}

function frameTitle(deck: DrillDeck, frame: { kind: 'group' | 'node'; id: string }): string {
  if (frame.kind === 'group') {
    return deck.groups.find((group) => group.id === frame.id)?.title ?? frame.id;
  }
  return deck.nodes.find((node) => node.id === frame.id)?.title ?? frame.id;
}

export function DrillCrumbs({ deck }: { deck: DrillDeck }) {
  const drill = useUiStore((state) => state.drill);
  const drillUp = useUiStore((state) => state.drillUp);
  const currentViewId = useUiStore((state) => state.currentViewId);
  const viewCrumb = currentViewCrumb(deck.views, currentViewId);

  return (
    <>
      <span aria-hidden>/</span>
      {drill.length === 0 ? (
        <span aria-current="page" className="text-ink">
          {viewCrumb}
        </span>
      ) : (
        <Button variant="ghost" size="sm" className="px-1.5 font-normal" onClick={() => drillUp(0)}>
          {viewCrumb}
        </Button>
      )}
      {drill.map((frame, index) => {
        const title = frameTitle(deck, frame);
        const current = index === drill.length - 1;
        return (
          <span key={`${frame.kind}:${frame.id}`} className="contents">
            <span aria-hidden>/</span>
            {current ? (
              <span aria-current="page" className="text-ink">
                {title}
              </span>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="px-1.5 font-normal"
                onClick={() => drillUp(index + 1)}
              >
                {title}
              </Button>
            )}
          </span>
        );
      })}
    </>
  );
}
