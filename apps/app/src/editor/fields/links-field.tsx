import type { Link } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { Input } from '@sododeck/ui/components/input';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { Copy, ExternalLink, Link2, Pencil, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';

import { copyText } from '../../lib/clipboard';
import { parseLinkInput } from '../../lib/links';
import { useUiStore } from '../../state/ui-store';
import { useOpenLink } from '../embed-host-context';
import { FieldError } from '../field-edit';
import { FieldLabel } from './field-label';

const labelOf = (link: Link) =>
  link.label === undefined || link.label === '' ? link.url : link.label;

/**
 * LINKS (FR-006, FR-038, research R6): rows that open in a new tab on activation, with an
 * editable label and a remove action, and an add field that accepts only http, https and
 * relative links. `onCommit(null)` clears the field.
 */
export function LinksField({
  value,
  onCommit,
}: {
  value: readonly Link[] | undefined;
  onCommit: (links: Link[] | null) => void;
}) {
  const id = useId();
  const openLink = useOpenLink();
  const links = value ?? [];
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);

  const write = (next: Link[]) => {
    onCommit(next.length === 0 ? null : next);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={id}>Links</FieldLabel>
      {links.length > 0 && (
        <ul aria-label="Links" className="flex flex-col gap-1">
          {links.map((link, i) => {
            const label = labelOf(link);
            const safe = parseLinkInput(link.url).ok;
            return (
              <li
                // Links have no ids; the index is stable while the list is shown.
                key={i}
                className="group flex min-w-0 items-center gap-1 rounded-row bg-surface-2 py-1 pr-1 pl-2"
              >
                <Link2
                  aria-hidden
                  strokeWidth={ICON_STROKE_WIDTH}
                  className="size-3.5 shrink-0 text-ink-secondary"
                />
                {editing === i ? (
                  <LabelEditor
                    initial={label}
                    onDone={(next) => {
                      setEditing(null);
                      if (next !== null && next !== label) {
                        write(
                          links.map((l, j) =>
                            j !== i ? l : next === '' ? { url: l.url } : { ...l, label: next },
                          ),
                        );
                      }
                    }}
                  />
                ) : safe && openLink !== null ? (
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={link.url}
                    onClick={(event) => {
                      event.preventDefault();
                      openLink(link.url);
                    }}
                    className={cn(
                      'flex min-w-0 flex-1 items-center gap-1 truncate rounded-segment text-body-sm text-ink hover:underline',
                      focusRing,
                    )}
                  >
                    <span className="truncate">{label}</span>
                    <ExternalLink
                      aria-hidden
                      strokeWidth={ICON_STROKE_WIDTH}
                      className="size-3 shrink-0 text-ink-secondary"
                    />
                  </a>
                ) : (
                  // An imported link with another scheme is shown, never opened; so is any link
                  // when the host cannot open links (067), with a copy action instead.
                  <span
                    title={link.url}
                    className="min-w-0 flex-1 truncate text-body-sm text-ink-secondary"
                  >
                    {label}
                  </span>
                )}
                {openLink === null && editing !== i && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Copy link ${label}`}
                    onClick={() => {
                      void copyText(link.url);
                    }}
                  >
                    <Copy />
                  </Button>
                )}
                {editing !== i && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit label for ${label}`}
                    onClick={() => {
                      setEditing(i);
                    }}
                  >
                    <Pencil />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove link ${label}`}
                  onClick={() => {
                    write(links.filter((_, j) => j !== i));
                  }}
                >
                  <X />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <Input
        id={id}
        aria-label="Add link"
        placeholder="+ Paste a link and press Enter"
        value={draft}
        aria-invalid={error !== null || undefined}
        aria-describedby={error === null ? undefined : `${id}-error`}
        className={cn(error !== null && 'border-clay-ink focus:border-clay-ink')}
        onChange={(event) => {
          setDraft(event.target.value);
          setError(null);
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          const result = parseLinkInput(draft);
          if (result.ok) {
            write([...links, result.link]);
            setDraft('');
          } else if (result.error !== null) {
            setError(result.error);
            useUiStore.getState().announce(result.error);
          }
        }}
      />
      {error !== null && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  );
}

/** Inline label editor: Enter or blur saves (an empty label falls back to the URL), Esc cancels. */
function LabelEditor({
  initial,
  onDone,
}: {
  initial: string;
  onDone: (label: string | null) => void;
}) {
  const [text, setText] = useState(initial);
  // Enter unmounts the editor, which can also blur it: report once.
  const done = useRef(false);
  const finish = (label: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(label);
  };
  return (
    <Input
      aria-label="Link label"
      autoFocus
      value={text}
      className="h-7 flex-1"
      onChange={(event) => {
        setText(event.target.value);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          finish(text.trim());
        } else if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          finish(null);
        }
      }}
      onBlur={() => {
        finish(text.trim());
      }}
    />
  );
}
