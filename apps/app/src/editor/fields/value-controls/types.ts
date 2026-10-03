import type { ResolvedField } from '@sododeck/model';

/** What every value control gets (032, contracts/fields-ui.md "Value controls"). */
export interface ValueControlProps {
  field: ResolvedField;
  /** Id of the visible field name, which labels the control. */
  labelId: string;
  /** The stored value; undefined when the card holds none. */
  value: unknown;
  /** Several cards with different values (bulk): shows "Mixed" and changes nothing until edited. */
  mixed?: boolean;
  /** Writes a validated value, or clears it with `null`. One undo step per call. */
  onCommit: (value: unknown) => void;
  /** Id of a description of the value ("Mixed values", "Same on all 3"), for bulk editing. */
  descriptionId?: string;
  /** Person suggestions: names already used in the deck. */
  people?: readonly string[];
}
