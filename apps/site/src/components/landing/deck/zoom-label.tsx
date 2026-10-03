import type { CSSProperties } from 'react';

import { C, FONT_MONO } from '../../../lib/landing/tokens';
import { CanvasPill } from './canvas-pill';

interface ZoomLabelProps {
  text: string;
  detail?: string;
  style?: CSSProperties;
}

/** The bottom-left caption of an Explore crop, e.g. "System 30%". */
export function ZoomLabel({ text, detail, style }: ZoomLabelProps) {
  return (
    <CanvasPill style={{ left: 12, bottom: 12, fontWeight: 600, ...style }}>
      {text}
      {detail !== undefined && (
        <span style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 500, color: C.muted }}>
          {detail}
        </span>
      )}
    </CanvasPill>
  );
}
