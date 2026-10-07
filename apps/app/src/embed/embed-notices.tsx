import { Banner } from '@sododeck/ui/components/banner';
import { LoaderCircle } from 'lucide-react';

import { ProblemRow } from '../library/import-problems-dialog';
import { useEmbedStore, type FatalSide } from './embed-store';

const FATAL_TEXT: Record<FatalSide, { title: string; detail: string }> = {
  editor: {
    title: 'This editor needs an update',
    detail: 'The program that opened this deck is newer than this editor.',
  },
  host: {
    title: 'Update the extension or plug-in that opened this deck',
    detail: 'It is older than this editor and cannot talk to it.',
  },
};

/** A message in the middle of the frame, for the states with no deck to show. */
function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh items-center justify-center bg-app p-6 text-ink">
      <div className="flex max-w-xl flex-col items-center gap-3 text-center">{children}</div>
    </div>
  );
}

function ProblemsNotice({ floating }: { floating: boolean }) {
  const problems = useEmbedStore((s) => s.problems);
  const shown = problems.slice(0, 200);
  return (
    <div
      className={
        floating
          ? 'fixed inset-x-0 top-0 z-50 mx-auto flex max-w-2xl flex-col gap-2 p-3'
          : 'flex w-full max-w-2xl flex-col gap-2 text-left'
      }
    >
      <Banner tone="error">
        <p className="font-medium">
          This deck file has problems, so it is shown as it was. Fix the file to keep editing here.
        </p>
      </Banner>
      <ul
        aria-label="Problems in the deck file"
        className="max-h-64 overflow-y-auto rounded-input border border-border bg-surface"
      >
        {shown.map((entry, index) => (
          <ProblemRow key={`${entry.code}:${entry.path ?? ''}:${String(index)}`} entry={entry} />
        ))}
      </ul>
      {problems.length > shown.length && (
        <p className="text-body-sm text-ink-secondary">
          and {(problems.length - shown.length).toLocaleString('en-US')} more
        </p>
      )}
    </div>
  );
}

/**
 * What the embed says outside the editor itself (067 R12, R6, R11): waiting for the host, a
 * version mismatch, the problems of a refused file, and a host that did not take a change.
 * Every notice is text (never colour alone) in a `status` or `alert` region.
 */
export function EmbedNotices({ hasDeck }: { hasDeck: boolean }) {
  const phase = useEmbedStore((s) => s.phase);
  const fatal = useEmbedStore((s) => s.fatal);
  const hostError = useEmbedStore((s) => s.hostError);

  if (phase === 'waiting') {
    return (
      <Centered>
        <p role="status" className="flex items-center gap-2 text-body">
          <LoaderCircle aria-hidden className="size-4 motion-safe:animate-spin" />
          Opening deck…
        </p>
      </Centered>
    );
  }
  if (phase === 'slow') {
    return (
      <Centered>
        <p role="status" className="text-body">
          The program hosting this editor did not send a deck
        </p>
        <p className="text-body-sm text-ink-secondary">Still waiting for it.</p>
      </Centered>
    );
  }
  if (phase === 'fatal' && fatal !== null) {
    const text = FATAL_TEXT[fatal.side];
    return (
      <Centered>
        <div role="alert" className="flex flex-col gap-1">
          <p className="text-title-sm">{text.title}</p>
          <p className="text-body text-ink-secondary">{text.detail}</p>
        </div>
      </Centered>
    );
  }
  return (
    <>
      {phase === 'blocked' &&
        (hasDeck ? (
          <ProblemsNotice floating />
        ) : (
          <Centered>
            <ProblemsNotice floating={false} />
          </Centered>
        ))}
      {hostError !== null && (
        <div className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-xl p-3">
          <Banner tone="error" className="w-full">
            <p className="font-medium">Your last change did not reach the file</p>
            <p>{hostError}</p>
          </Banner>
        </div>
      )}
    </>
  );
}
