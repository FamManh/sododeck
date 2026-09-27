import { useEffect } from 'react';
import { useNavigate } from 'react-router';

import { useUiStore } from '../../state/ui-store';
import { rulesPath } from './rules-path';

/**
 * When the open rule no longer exists — deleted here, undone, or removed in another tab — the
 * editor falls back to the rule list and forgets its test values (spec edge case).
 */
export function useRuleSync(
  deckId: string | undefined,
  ruleId: string | undefined,
  exists: boolean,
) {
  const navigate = useNavigate();
  useEffect(() => {
    if (ruleId === undefined || exists) return;
    const ui = useUiStore.getState();
    if (ui.ruleTest?.ruleId === ruleId) ui.setRuleTest(null);
    void navigate(rulesPath(deckId), { replace: true });
  }, [deckId, ruleId, exists, navigate]);
}
