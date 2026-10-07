/**
 * Result types of applying a deck file to an open deck (066, contract `model-api.md`), and the
 * small counter that builds the change summary while the diff runs (research R9).
 */
import type { AssetId, AssetProblem } from './assets';
import type { Scope } from './layout';
import type { TrimmedCrop } from './load-checks';
import type { ProblemEntry } from './report-json';

/** Top-level objects of one scope that were added, changed or removed. */
export interface ApplyCounts {
  added: number;
  changed: number;
  removed: number;
}

/** Counts per scope; only scopes with a non-zero count are present. */
export type ApplySummary = Partial<Record<Scope, ApplyCounts>>;

export type ApplyResult =
  /** The file is not a valid deck: the document was not touched. Sorted, never empty. */
  | { status: 'refused'; entries: ProblemEntry[] }
  | {
      status: 'applied';
      /** False when the file equals the open deck: nothing was written, no event. */
      changed: boolean;
      summary: ApplySummary;
      /** Decoded bytes of sound pictures, for the caller's blob store. */
      bytes: Map<AssetId, Uint8Array>;
      /** Damaged pictures, applied as missing (never a refusal). */
      problems: AssetProblem[];
      trimmedCrops: TrimmedCrop[];
    };

/** Counts objects per scope; a child edit counts its owner as changed (R9). */
export class SummaryBuilder {
  private readonly counts = new Map<Scope, ApplyCounts>();

  private bump(scope: Scope, key: keyof ApplyCounts): void {
    let counts = this.counts.get(scope);
    if (counts === undefined) {
      counts = { added: 0, changed: 0, removed: 0 };
      this.counts.set(scope, counts);
    }
    counts[key] += 1;
  }

  added(scope: Scope): void {
    this.bump(scope, 'added');
  }

  changed(scope: Scope): void {
    this.bump(scope, 'changed');
  }

  removed(scope: Scope): void {
    this.bump(scope, 'removed');
  }

  build(): ApplySummary {
    const out: ApplySummary = {};
    for (const [scope, counts] of this.counts) out[scope] = { ...counts };
    return out;
  }
}
