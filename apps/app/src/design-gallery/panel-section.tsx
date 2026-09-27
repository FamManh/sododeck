import { Button } from '@sododeck/ui/components/button';
import { KindTile } from '@sododeck/ui/components/kind-tile';
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSection,
  PanelTitle,
} from '@sododeck/ui/components/panel';
import { Tooltip, TooltipContent, TooltipTrigger } from '@sododeck/ui/components/tooltip';
import { Maximize } from 'lucide-react';

import { GallerySection } from './gallery-section';
import { SampleRow } from './sample-row';

export function PanelGallerySection() {
  return (
    <GallerySection
      id="panel"
      title="Panel and tooltip"
      description="Existing blocks, kept as they were. Reference: 02-editor-node-selected (inspector)."
    >
      <SampleRow label="panel">
        <Panel
          aria-label="Inspector sample"
          className="h-64 w-84 rounded-card border border-hairline"
        >
          <PanelHeader>
            <KindTile kind="service" size={28} decorative />
            <PanelTitle>Order Service</PanelTitle>
          </PanelHeader>
          <PanelContent>
            <PanelSection label="Title">Order Service</PanelSection>
            <PanelSection label="Owner">Orders</PanelSection>
          </PanelContent>
        </Panel>
      </SampleRow>
      <SampleRow label="tooltip">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" aria-label="Fit view">
              <Maximize />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom to fit</TooltipContent>
        </Tooltip>
        <span className="text-caption text-ink-muted">Hover or focus the button</span>
      </SampleRow>
    </GallerySection>
  );
}
