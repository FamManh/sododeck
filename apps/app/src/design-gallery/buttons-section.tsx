import { Button } from '@sododeck/ui/components/button';
import { Download, Plus, Settings, Tag } from 'lucide-react';
import { useState } from 'react';

import { DEMO_FOCUS, DEMO_HOVER } from './demo-states';
import { GallerySection } from './gallery-section';
import { SampleRow } from './sample-row';

const VARIANTS = ['primary', 'secondary', 'ghost'] as const;

export function ButtonsSection() {
  const [labels, setLabels] = useState(true);
  const [focus, setFocus] = useState(false);

  return (
    <GallerySection
      id="buttons"
      title="Buttons"
      description="primary · secondary · ghost · icon · chip · toggle. Reference: 02-editor-node-selected, 14-editor-palette-tab."
    >
      {VARIANTS.map((variant) => (
        <SampleRow key={variant} label={variant}>
          <Button variant={variant}>
            <Download />
            Export
          </Button>
          <Button variant={variant} size="sm">
            Small
          </Button>
          <Button variant={variant} data-demo-state="hover" className={DEMO_HOVER[variant]}>
            Hover
          </Button>
          <Button variant={variant} data-demo-state="focus" className={DEMO_FOCUS}>
            Focus
          </Button>
          <Button variant={variant} disabled>
            Disabled
          </Button>
        </SampleRow>
      ))}
      <SampleRow label="icon">
        <Button size="icon" aria-label="Settings">
          <Settings />
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label="Add node">
          <Plus />
        </Button>
        <Button
          size="icon"
          aria-label="Settings (focus)"
          data-demo-state="focus"
          className={DEMO_FOCUS}
        >
          <Settings />
        </Button>
        <Button size="icon" aria-label="Settings (disabled)" disabled>
          <Settings />
        </Button>
      </SampleRow>
      <SampleRow label="chip">
        <Button variant="chip" size="chip">
          REST
        </Button>
        <Button variant="chip" size="chip">
          <Tag />
          payments
        </Button>
        <Button variant="chip" size="chip" data-demo-state="hover" className={DEMO_HOVER.chip}>
          Hover
        </Button>
        <Button variant="chip" size="chip" data-demo-state="focus" className={DEMO_FOCUS}>
          Focus
        </Button>
        <Button variant="chip" size="chip" disabled>
          Disabled
        </Button>
      </SampleRow>
      <SampleRow label="toggle">
        <Button
          variant="toggle"
          pressed={labels}
          onClick={() => {
            setLabels((value) => !value);
          }}
        >
          Labels
        </Button>
        <Button
          variant="toggle"
          pressed={focus}
          onClick={() => {
            setFocus((value) => !value);
          }}
        >
          Focus
        </Button>
        <Button
          variant="toggle"
          pressed={false}
          data-demo-state="hover"
          className={DEMO_HOVER.toggle}
        >
          Hover
        </Button>
        <Button variant="toggle" pressed data-demo-state="focus" className={DEMO_FOCUS}>
          Focus ring
        </Button>
        <Button variant="toggle" pressed disabled>
          Disabled
        </Button>
      </SampleRow>
    </GallerySection>
  );
}
