import { tagKey, type ViewSettingsPatch } from '@sododeck/model';
import type { NodeKind, SododeckFile, SubtitleField, View } from '@sododeck/schema';
import { Checkbox } from '@sododeck/ui/components/checkbox';
import { PopoverContent } from '@sododeck/ui/components/popover';
import { RadioGroup, RadioGroupItem } from '@sododeck/ui/components/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sododeck/ui/components/select';
import { useId, type ReactNode } from 'react';

import { useEditor } from '../../model/use-editor';
import { oneStep } from '../fields/one-step';
import { kindLabel } from '../kind-label';

const SUBTITLES: { value: SubtitleField; label: string }[] = [
  { value: 'tech', label: 'Technology' },
  { value: 'host', label: 'Hosting' },
  { value: 'flows', label: 'Flows · owner' },
  { value: 'owner', label: 'Owner' },
  { value: 'none', label: 'None' },
];

const ALL_FEATURES = '__all__';
/** Nesting of "Hide groups" rows, by depth. */
const INDENT = ['', 'ps-4', 'ps-8', 'ps-12'] as const;

/** Kinds used by the deck's components, plus any already chosen (FR-043: domain-neutral). */
function kindsOf(deck: SododeckFile, chosen: readonly NodeKind[]): NodeKind[] {
  return [...new Set([...deck.nodes.map((n) => n.type), ...chosen])];
}

/** One entry per tag key, in the spelling the cards use (a chosen tag no card has keeps its own). */
function tagsOf(deck: SododeckFile, chosen: readonly string[]): string[] {
  const byKey = new Map<string, string>();
  for (const tag of [...deck.nodes.flatMap((n) => n.tags ?? []), ...chosen]) {
    if (!byKey.has(tagKey(tag))) byKey.set(tagKey(tag), tag);
  }
  return [...byKey.values()].sort();
}

/** Groups in tree order with their depth, cycle-safe. */
function groupRows(deck: SododeckFile): { id: string; title: string; depth: number }[] {
  const ids = new Set(deck.groups.map((g) => g.id));
  const rows: { id: string; title: string; depth: number }[] = [];
  const seen = new Set<string>();
  const visit = (parent: string | undefined, depth: number) => {
    for (const group of deck.groups) {
      const effective =
        group.parent !== undefined && ids.has(group.parent) ? group.parent : undefined;
      if (effective !== parent || seen.has(group.id)) continue;
      seen.add(group.id);
      rows.push({ id: group.id, title: group.title, depth });
      visit(group.id, depth + 1);
    }
  };
  visit(undefined, 0);
  // Groups caught in a parent cycle are listed last, at the top level.
  for (const group of deck.groups) {
    if (!seen.has(group.id)) rows.push({ id: group.id, title: group.title, depth: 0 });
  }
  return rows;
}

function toggled<T>(list: readonly T[] | undefined, value: T, on: boolean): T[] {
  const current = list ?? [];
  return on ? [...current.filter((v) => v !== value), value] : current.filter((v) => v !== value);
}

function Fieldset({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="flex flex-col gap-1.5">
      <span id={id} className="text-micro font-medium tracking-wide text-ink-secondary uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}

/**
 * "View settings…" (011 FR-043, clarification Q3, undesigned: DESIGN.md defaults): subtitle,
 * groups / kinds / tags to hide, kinds to dim and the feature to limit to. Kinds and tags come
 * from the deck itself. Every change applies at once as one undo step. Render inside a `Popover`
 * anchored to the view's tab; Esc or an outside click closes it and focus returns to the tab.
 */
export function ViewSettingsPopover({
  deck,
  view,
  onCloseFocus,
}: {
  deck: SododeckFile;
  view: View;
  onCloseFocus: () => void;
}) {
  const editor = useEditor();
  const update = (patch: ViewSettingsPatch) => {
    oneStep(editor, () => {
      editor.updateView(view.id, patch);
    });
  };
  const subtitleId = useId();
  const featureId = useId();
  const groups = groupRows(deck);
  const kinds = kindsOf(deck, [...(view.excludeKinds ?? []), ...(view.dimKinds ?? [])]);
  const tags = tagsOf(deck, view.excludeTags ?? []);
  const featureGone =
    view.feature !== undefined && !deck.features.some((f) => f.id === view.feature);

  return (
    <PopoverContent
      aria-label={`View settings: ${view.title}`}
      align="center"
      className="flex max-h-[70vh] w-80 flex-col gap-4 overflow-y-auto"
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        onCloseFocus();
      }}
    >
      <div className="flex flex-col gap-1.5">
        <span
          id={subtitleId}
          className="text-micro font-medium tracking-wide text-ink-secondary uppercase"
        >
          Subtitle
        </span>
        <RadioGroup
          aria-labelledby={subtitleId}
          value={view.subtitleField ?? 'tech'}
          onValueChange={(value) => {
            const next = SUBTITLES.find((s) => s.value === value)?.value;
            if (next !== undefined) update({ subtitleField: next });
          }}
        >
          {SUBTITLES.map((s) => (
            <RadioGroupItem key={s.value} value={s.value} label={s.label} />
          ))}
        </RadioGroup>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={featureId}
          className="text-micro font-medium tracking-wide text-ink-secondary uppercase"
        >
          Feature
        </label>
        <Select
          value={view.feature ?? ALL_FEATURES}
          onValueChange={(value) => {
            update({ feature: value === ALL_FEATURES ? undefined : value });
          }}
        >
          <SelectTrigger id={featureId} aria-label="Feature">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FEATURES}>All features</SelectItem>
            {deck.features.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.title}
              </SelectItem>
            ))}
            {featureGone && view.feature !== undefined && (
              <SelectItem value={view.feature}>{`${view.feature} (deleted)`}</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {groups.length > 0 && (
        <Fieldset label="Hide groups">
          {groups.map((g) => (
            <Checkbox
              key={g.id}
              label={g.title}
              className={INDENT[Math.min(g.depth, INDENT.length - 1)]}
              checked={view.excludeGroups?.includes(g.id) === true}
              onCheckedChange={(on) => {
                update({ excludeGroups: toggled(view.excludeGroups, g.id, on === true) });
              }}
            />
          ))}
        </Fieldset>
      )}
      <Fieldset label="Hide kinds">
        {kinds.map((kind) => (
          <Checkbox
            key={kind}
            label={kindLabel(kind)}
            checked={view.excludeKinds?.includes(kind) === true}
            onCheckedChange={(on) => {
              update({ excludeKinds: toggled(view.excludeKinds, kind, on === true) });
            }}
          />
        ))}
      </Fieldset>
      {tags.length > 0 && (
        <Fieldset label="Hide tags">
          {tags.map((tag) => (
            <Checkbox
              key={tag}
              label={tag}
              checked={view.excludeTags?.some((t) => tagKey(t) === tagKey(tag)) === true}
              onCheckedChange={(on) => {
                const others = (view.excludeTags ?? []).filter((t) => tagKey(t) !== tagKey(tag));
                update({ excludeTags: on === true ? [...others, tag] : others });
              }}
            />
          ))}
        </Fieldset>
      )}
      <Fieldset label="Dim kinds">
        {kinds.map((kind) => (
          <Checkbox
            key={kind}
            label={kindLabel(kind)}
            checked={view.dimKinds?.includes(kind) === true}
            onCheckedChange={(on) => {
              update({ dimKinds: toggled(view.dimKinds, kind, on === true) });
            }}
          />
        ))}
      </Fieldset>
    </PopoverContent>
  );
}
