import type { FidelityGroup } from '@sododeck/model';
import { useId, type ReactNode } from 'react';

const GROUPS: readonly { group: FidelityGroup; label: string; meaning: string }[] = [
  {
    group: 'merged',
    label: 'Merged',
    meaning: 'Met another declaration, or deck content, of the same name; combined or renamed.',
  },
  { group: 'collapsed', label: 'Collapsed', meaning: 'Came across in a simpler form.' },
  { group: 'left-out', label: 'Left out', meaning: 'Understood, but not imported.' },
  {
    group: 'not-supported',
    label: 'Not supported',
    meaning: 'Could not be read, or is outside what the import reads.',
  },
];

function Group({
  label,
  meaning,
  children,
}: {
  label: string;
  meaning: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-1.5">
      <h3 id={id} className="text-body-sm font-medium text-ink">
        {label}
      </h3>
      <p className="text-body-sm text-ink-secondary">{meaning}</p>
      {children}
    </section>
  );
}

/**
 * What an import from another format did not bring across one-to-one (062 FR-013): its entries
 * under Merged, Collapsed, Left out and Not supported, in that order, each with its count; empty
 * groups are hidden and "Everything was imported." stands in for none (FR-015). Each view renders
 * its own rows, so it keeps its own row look and collapse rules.
 */
export function FidelityGroups<T>({
  entries,
  renderGroup,
}: {
  entries: readonly { group: FidelityGroup; entry: T }[];
  renderGroup: (entries: T[], group: FidelityGroup) => ReactNode;
}) {
  if (entries.length === 0) {
    return <p className="text-body-sm text-ink-secondary">Everything was imported.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      {GROUPS.map(({ group, label, meaning }) => {
        const inGroup = entries.filter((e) => e.group === group).map((e) => e.entry);
        if (inGroup.length === 0) return null;
        return (
          <Group key={group} label={`${label} (${String(inGroup.length)})`} meaning={meaning}>
            {renderGroup(inGroup, group)}
          </Group>
        );
      })}
    </div>
  );
}
