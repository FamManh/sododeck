import { Button } from '@sododeck/ui/components/button';
import { useReducedMotion } from '@sododeck/ui/hooks/use-reduced-motion';
import { resolveMotion } from '@sododeck/ui/lib/motion';
import { useState } from 'react';

import { GallerySection } from './gallery-section';
import { SampleRow } from './sample-row';

/** Shows the live motion values and demos that must stop under reduced motion (US5). */
export function MotionSection() {
  const reduced = useReducedMotion();
  const motion = resolveMotion(reduced);
  const [dimmed, setDimmed] = useState(false);

  return (
    <GallerySection
      id="motion"
      title="Motion"
      description="Short and calm, no bounce. Turn on the OS “Reduce motion” setting: values drop to 0 ms and the token stops, without a reload."
    >
      <SampleRow label="preference">
        <p className="text-body" aria-live="polite">
          Reduced motion: <strong>{reduced ? 'on' : 'off'}</strong>
        </p>
      </SampleRow>
      <SampleRow label="values">
        <dl className="grid grid-cols-[repeat(5,auto)] gap-x-6 gap-y-1 font-mono text-code-sm">
          {Object.entries(motion).map(([name, ms]) => (
            <div key={name} className="flex flex-col">
              <dt className="text-ink-muted">{name}</dt>
              <dd>{ms} ms</dd>
            </div>
          ))}
        </dl>
      </SampleRow>
      <SampleRow label="flow token">
        <div className="relative h-6 w-72" aria-hidden>
          <div className="absolute top-1/2 h-0.5 w-full -translate-y-1/2 rounded-full bg-edge" />
          {reduced ? (
            // Static marker at the edge midpoint instead of a moving token.
            <span className="absolute top-1/2 left-1/2 size-3 -translate-1/2 rounded-full bg-primary" />
          ) : (
            <span className="gallery-flow-token absolute top-1/2 size-3 -translate-y-1/2 rounded-full bg-primary" />
          )}
        </div>
      </SampleRow>
      <SampleRow label="dim">
        <div className="flex items-center gap-3">
          {['Order Service', 'Payment Service', 'Orders DB'].map((title, index) => (
            <span
              key={title}
              className="rounded-node border border-border bg-surface px-3 py-2 text-body-sm shadow-rest transition-opacity duration-(--sd-dur-dim)"
              style={{ opacity: dimmed && index !== 0 ? 0.22 : 1 }}
            >
              {title}
            </span>
          ))}
        </div>
        <Button
          variant="toggle"
          pressed={dimmed}
          onClick={() => {
            setDimmed((value) => !value);
          }}
        >
          Focus mode
        </Button>
      </SampleRow>
    </GallerySection>
  );
}
