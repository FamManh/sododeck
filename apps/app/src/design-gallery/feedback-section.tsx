import { Banner } from '@sododeck/ui/components/banner';
import { Button } from '@sododeck/ui/components/button';
import { HintBar } from '@sododeck/ui/components/hint-bar';
import { TagChip } from '@sododeck/ui/components/tag-chip';
import { TagInput } from '@sododeck/ui/components/tag-input';
import { useToast } from '@sododeck/ui/components/toast';
import { useState } from 'react';

import { GallerySection } from './gallery-section';
import { SampleRow } from './sample-row';

type Tone = 'warning' | 'success' | 'error';

const BANNERS: [Tone, string][] = [
  ['warning', 'Decks live only in this browser. Export a backup to keep them safe.'],
  ['success', 'Rule matched: "Delivery tier" → Express.'],
  ['error', 'Invalid JSON on line 12: expected "," or "}".'],
];

export function FeedbackSection() {
  const [tags, setTags] = useState<readonly string[]>(['critical', 'pii']);
  const [dismissed, setDismissed] = useState<readonly Tone[]>([]);
  const { toast } = useToast();

  return (
    <GallerySection
      id="feedback"
      title="Tags, banners, toasts and hints"
      description="Reference: 02-editor-node-selected (tags), 01-library (banner), 22-editor-custom-view-toast (toast), 108–111 (hint bar, 016)."
    >
      <SampleRow label="tag input">
        <TagInput
          label="Add tag"
          value={tags}
          onValueChange={setTags}
          suggestions={['pci', 'pricing', 'public', 'critical']}
        />
        <span className="text-caption text-ink-muted">
          Try: PII, Enter, Enter → one “pii”; type “p” for suggestions; Backspace removes the last
        </span>
      </SampleRow>
      <SampleRow label="tag chip">
        <TagChip label="read-only" />
        <TagChip
          label="a-very-long-tag-name-that-truncates-with-a-title"
          onRemove={() => undefined}
        />
        <TagChip
          label="critical"
          partial
          count="2/3"
          onActivate={() => undefined}
          activateLabel="Add critical to all"
          onRemove={() => undefined}
          removeLabel="Remove critical from all"
        />
      </SampleRow>
      <SampleRow label="banner">
        <div className="flex w-full max-w-2xl flex-col gap-2">
          {BANNERS.filter(([tone]) => !dismissed.includes(tone)).map(([tone, text]) => (
            <Banner
              key={tone}
              tone={tone}
              action={
                tone === 'warning' ? (
                  <Button size="sm" variant="secondary">
                    Export backup
                  </Button>
                ) : undefined
              }
              onDismiss={() => {
                setDismissed((current) => [...current, tone]);
              }}
            >
              {text}
            </Banner>
          ))}
          {dismissed.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="self-start"
              onClick={() => {
                setDismissed([]);
              }}
            >
              Reset banners
            </Button>
          )}
        </div>
      </SampleRow>
      <SampleRow label="toast">
        <Button
          onClick={() => {
            toast({ message: 'View “Checkout path” saved' });
          }}
        >
          Show toast
        </Button>
        <Button
          onClick={() => {
            toast({
              message: 'Node deleted',
              action: {
                label: 'Undo',
                onAction: () => {
                  toast({ message: 'Restored' });
                },
              },
            });
          }}
        >
          Toast with Undo
        </Button>
        <Button
          onClick={() => {
            toast({ message: 'First' });
            toast({ message: 'Second' });
            toast({ message: 'Third' });
          }}
        >
          Burst of 3
        </Button>
      </SampleRow>
      <SampleRow label="hint bar">
        <div className="flex flex-col items-start gap-2">
          <HintBar
            items={[
              { keys: '⇧', label: 'Add' },
              { keys: '⌥', label: 'Touch' },
              { keys: 'Esc', label: 'Cancel' },
            ]}
          />
          <HintBar
            items={[
              { keys: '⌥', label: 'Duplicate / No group' },
              { keys: '⇧', label: 'Lock axis' },
              { keys: '⌘', label: 'No snap' },
              { keys: 'Esc', label: 'Cancel' },
            ]}
          />
        </div>
      </SampleRow>
    </GallerySection>
  );
}
