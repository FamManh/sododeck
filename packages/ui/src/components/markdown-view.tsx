import { Fragment, useMemo } from 'react';
import type * as React from 'react';

import { parseMarkdown, type Inline } from '@sododeck/ui/lib/markdown';
import { cn } from '@sododeck/ui/lib/utils';

type MarkdownViewProps = Omit<React.ComponentProps<'div'>, 'children'> & {
  text: string;
};

function InlineContent({ content }: { content: readonly Inline[] }) {
  return content.map((part, i) =>
    part.kind === 'code' ? (
      <code key={i} className="rounded-segment bg-surface-2 px-1 font-mono text-code text-ink">
        {part.text}
      </code>
    ) : part.kind === 'strong' ? (
      <strong key={i}>
        <InlineContent content={part.content} />
      </strong>
    ) : part.kind === 'em' ? (
      <em key={i}>
        <InlineContent content={part.content} />
      </em>
    ) : (
      <Fragment key={i}>{part.text}</Fragment>
    ),
  );
}

/**
 * Read-only preview of a description (008 FR-003): paragraphs, bullets and inline code. Built
 * from React elements only, so HTML or scripts in the text always show as literal text.
 */
function MarkdownView({ text, className, ...props }: MarkdownViewProps) {
  const blocks = useMemo(() => parseMarkdown(text), [text]);
  return (
    <div
      data-slot="markdown-view"
      className={cn('flex flex-col gap-2 text-body-sm text-ink break-words', className)}
      {...props}
    >
      {blocks.length === 0 ? (
        <p className="text-ink-muted italic">Nothing to preview.</p>
      ) : (
        blocks.map((block, i) =>
          block.kind === 'paragraph' ? (
            <p key={i}>
              <InlineContent content={block.content} />
            </p>
          ) : (
            <ul key={i} className="flex list-disc flex-col gap-1 pl-5">
              {block.items.map((item, j) => (
                <li key={j}>
                  <InlineContent content={item} />
                </li>
              ))}
            </ul>
          ),
        )
      )}
    </div>
  );
}

export { MarkdownView };
