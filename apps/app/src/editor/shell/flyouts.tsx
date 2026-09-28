import type { SododeckFile } from '@sododeck/schema';
import { PanelSection } from '@sododeck/ui/components/panel';
import { useEffect } from 'react';

import { useUiStore } from '../../state/ui-store';
import { FlowList } from '../flows/flow-list';
import { FlowPanel } from '../flows/flow-panel';
import { NotesOutline } from '../notes-outline';
import { OutlineTree } from '../outline-tree';
import { Palette } from '../palette';
import { ProblemsPanel } from '../problems/problems-panel';
import { useGoToProblem } from '../problems/use-go-to-problem';
import { useRuleNav } from '../rules/rule-nav';
import { Flyout } from './flyout';
import { RulesList } from './rules-list';
import type { FlyoutId } from './shell-prefs';

/**
 * A recording session (006) needs its step list on screen while edges are clicked: it shows and
 * pins the Flows flyout, and the previous pin comes back when it ends (018 R4).
 */
function useSessionFlyout(): void {
  const inSession = useUiStore((s) => s.flowSession !== null);
  useEffect(() => {
    const ui = useUiStore.getState();
    if (inSession) ui.pinForSession();
    else ui.restoreAfterSession();
  }, [inSession]);
}

const noop = () => undefined;

/** The problems list (015) with its rows going to the problem, as in the deck inspector. */
function ProblemsFlyout() {
  const ruleNav = useRuleNav();
  const goTo = useGoToProblem({
    screen: 'canvas',
    openRules: (ruleId) => {
      ruleNav?.openRules(ruleId);
    },
    navigateToCanvas: noop,
  });
  return <ProblemsPanel onActivate={goTo} />;
}

const FLYOUT_TITLES: Readonly<Record<FlyoutId, string>> = {
  palette: 'Components',
  outline: 'Outline',
  flows: 'Flows & features',
  rules: 'Rules',
  problems: 'Problems',
};

/**
 * The flyout shown beside the rail (018 FR-017): the existing panels, moved from the left column
 * and the deck inspector without changing them. Flows shows the flow's steps in flow mode and
 * during a recording, as the left column did (006, 007).
 */
export function Flyouts({ deck }: { deck: SododeckFile }) {
  const flyout = useUiStore((s) => s.flyout);
  const inFlow = useUiStore((s) => s.flowSession !== null || s.activeFlow !== null);
  useSessionFlyout();
  if (flyout === null) return null;
  return (
    <Flyout key={flyout} id={flyout} title={FLYOUT_TITLES[flyout]}>
      {flyout === 'palette' && (
        <PanelSection>
          <Palette />
        </PanelSection>
      )}
      {flyout === 'outline' && (
        <>
          <PanelSection label={`Components · ${String(deck.nodes.length)}`}>
            <OutlineTree deck={deck} />
          </PanelSection>
          <NotesOutline deck={deck} />
        </>
      )}
      {flyout === 'flows' &&
        (inFlow ? (
          <FlowPanel deck={deck} />
        ) : (
          <PanelSection aria-label="Features">
            <FlowList deck={deck} />
          </PanelSection>
        ))}
      {flyout === 'rules' && <RulesList deck={deck} />}
      {flyout === 'problems' && <ProblemsFlyout />}
    </Flyout>
  );
}
