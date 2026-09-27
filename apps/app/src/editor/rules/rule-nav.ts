import { createContext, useContext } from 'react';

/** How the canvas screen opens the rule editor (a route change), for inspectors deep inside it. */
export interface RuleNav {
  /** The rule list, or one rule; `newRule` selects its name for typing. */
  openRules: (ruleId?: string, options?: { newRule?: boolean }) => void;
}

/** Provided by the canvas screen; absent (e.g. in component tests) the links do nothing. */
export const RuleNavContext = createContext<RuleNav | null>(null);

export function useRuleNav(): RuleNav | null {
  return useContext(RuleNavContext);
}
