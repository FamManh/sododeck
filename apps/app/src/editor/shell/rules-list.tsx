import type { SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { ArrowUpRight } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';

import { useEditor } from '../../model/use-editor';
import { RuleList } from '../rules/rule-list';
import { rulesPath } from '../rules/rules-path';

/**
 * The Rules flyout (018): the rule editor's list of decision tables, unchanged (008). A row or
 * New goes to the rule editor screen, which keeps its own layout.
 */
export function RulesList({ deck }: { deck: SododeckFile }) {
  const editor = useEditor();
  const navigate = useNavigate();
  const { deckId } = useParams();
  return (
    <div className="flex flex-col">
      <RuleList
        deck={deck}
        deckId={deckId}
        ruleId={undefined}
        onNew={() => {
          const id = editor.addRule({ title: 'Untitled rule', hitPolicy: 'first' });
          void navigate(rulesPath(deckId, id), { state: { newRule: true } });
        }}
      />
      <div className="px-3 pt-1 pb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void navigate(rulesPath(deckId));
          }}
        >
          <ArrowUpRight />
          Open rule editor
        </Button>
      </div>
    </div>
  );
}
