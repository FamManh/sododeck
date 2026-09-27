import type { SododeckFile } from '@sododeck/schema';
import { useMemo } from 'react';

import { ownerSuggestions } from '../inspector/derive';
import { ComboField } from './combo-field';

/** OWNER: any text, with suggestions from owners already in the deck (FR-004, §g-10, §g-26). */
export function OwnerField({
  deck,
  value,
  onCommit,
  mixed,
  hint,
}: {
  deck: SododeckFile;
  value: string;
  onCommit: (value: string) => void;
  mixed?: boolean;
  hint?: string;
}) {
  const options = useMemo(() => ownerSuggestions(deck), [deck]);
  return (
    <ComboField
      label="Owner"
      listLabel="Owner suggestions"
      placeholder="Add owner"
      value={value}
      options={options}
      onCommit={onCommit}
      mixed={mixed}
      hint={hint}
    />
  );
}
