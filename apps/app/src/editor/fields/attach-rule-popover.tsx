import type { RuleHost } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { Popover, PopoverContent, PopoverTrigger } from '@sododeck/ui/components/popover';
import { SearchField } from '@sododeck/ui/components/search-field';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { Check, Plus, Table2 } from 'lucide-react';
import { useId, useState } from 'react';

import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { useRuleNav } from '../rules/rule-nav';
import { oneStep } from './one-step';

const NEW = '__new__';

/**
 * "+ Attach" (FR-029): the deck's rules, filterable by name, with those already attached marked
 * and not selectable, then "New rule" (creates, attaches and opens it in the rule editor).
 * ↑/↓ move, Enter attaches, Esc closes.
 */
export function AttachRulePopover({
  deck,
  host,
  attached,
}: {
  deck: SododeckFile;
  host: RuleHost;
  attached: readonly string[];
}) {
  const editor = useEditor();
  const nav = useRuleNav();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [active, setActive] = useState(0);

  const q = filter.trim().toLowerCase();
  const options = [
    ...Object.entries(deck.rules)
      .filter(([, rule]) => q === '' || rule.title.toLowerCase().includes(q))
      .map(([id, rule]) => ({
        id,
        label: `${rule.title} · ${String(rule.rows.length)} ${rule.rows.length === 1 ? 'row' : 'rows'}`,
        disabled: attached.includes(id),
      })),
    { id: NEW, label: 'New rule', disabled: false },
  ];
  const clamped = Math.min(active, options.length - 1);
  // Already attached options are skipped (the last one, "New rule", is always enabled).
  const current =
    options[clamped]?.disabled === true ? options.findIndex((o) => !o.disabled) : clamped;

  const choose = (id: string) => {
    const option = options.find((o) => o.id === id);
    if (option === undefined || option.disabled) return;
    setOpen(false);
    const ui = useUiStore.getState();
    if (id === NEW) {
      let ruleId = '';
      oneStep(editor, () => {
        ruleId = editor.addRule({ title: 'Untitled rule', hitPolicy: 'first' });
        editor.attachRule(host, ruleId);
      });
      ui.announce('Rule attached');
      nav?.openRules(ruleId, { newRule: true });
      return;
    }
    editor.attachRule(host, id);
    ui.announce('Rule attached');
  };

  const move = (step: number) => {
    let next = current;
    for (let i = 0; i < options.length; i++) {
      next = (next + step + options.length) % options.length;
      if (options[next]?.disabled !== true) break;
    }
    setActive(next);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setFilter('');
        setActive(0);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Attach rule">
          <Plus />
          Attach
        </Button>
      </PopoverTrigger>
      <PopoverContent aria-label="Attach rule" align="end" className="w-72 gap-2 p-2">
        <SearchField
          label="Filter rules"
          placeholder="Filter rules"
          value={filter}
          aria-controls={listId}
          aria-activedescendant={`${listId}-${String(current)}`}
          onChange={(event) => {
            setFilter(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              move(event.key === 'ArrowDown' ? 1 : -1);
            } else if (event.key === 'Enter') {
              event.preventDefault();
              const option = options[current];
              if (option !== undefined) choose(option.id);
            }
          }}
        />
        <ul
          id={listId}
          role="listbox"
          aria-label="Rules"
          className="flex max-h-64 flex-col overflow-y-auto"
        >
          {options.map((option, i) => (
            <li
              key={option.id}
              id={`${listId}-${String(i)}`}
              role="option"
              aria-selected={i === current}
              aria-disabled={option.disabled || undefined}
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onClick={() => {
                choose(option.id);
              }}
              className={cn(
                'flex h-8 cursor-pointer items-center gap-2 rounded-row px-2 text-body-sm',
                i === current && 'bg-surface-2',
                option.disabled && 'cursor-default text-ink-secondary',
                option.id === NEW && 'border-t border-hairline text-primary-ink',
              )}
            >
              {option.id === NEW ? (
                <Plus aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4 shrink-0" />
              ) : (
                <Table2 aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4 shrink-0" />
              )}
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {option.disabled && (
                <span className="flex items-center gap-1 text-caption">
                  <Check aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3.5" />
                  Attached
                </span>
              )}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
