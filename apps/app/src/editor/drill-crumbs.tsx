import { Button } from '@sododeck/ui/components/button';

import { useUiStore } from '../state/ui-store';

export interface DrillDeck {
  groups: { id: string; title: string }[];
  nodes: { id: string; title: string }[];
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

  return (
    <>
      <span aria-hidden>/</span>
      {drill.length === 0 ? (
        <span aria-current="page" className="text-ink">
          System view
        </span>
      ) : (
        <Button variant="ghost" size="sm" className="px-1.5 font-normal" onClick={() => drillUp(0)}>
          System view
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
