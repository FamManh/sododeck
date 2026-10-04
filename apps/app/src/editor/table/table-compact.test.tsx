import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { fixedWidthMeasurer } from '../export/text-measure';
import type { TableContext } from '../table-keys';
import { tableLayout, type TableNode } from '../table-layout';
import { TableCompact } from './table-compact';

const context: TableContext = {
  fk: new Map([['wide', new Set(['c2'])]]),
  showSchema: false,
  enums: new Map(),
  display: {
    detail: 'all',
    hideTypes: false,
    hideNullable: false,
    hideNotes: false,
    hideIndexes: false,
  },
};

const wide: TableNode = {
  id: 'wide',
  title: 'wide',
  columns: Array.from({ length: 60 }, (_, i) => ({
    id: `c${String(i + 1)}`,
    name: `c${String(i + 1)}`,
    type: 'int',
    pk: i === 0,
  })),
};

describe('TableCompact on a limited table (048)', () => {
  it('counts every column and never draws the Show all button', () => {
    const layout = tableLayout(wide, context, undefined, fixedWidthMeasurer(0.6));
    // The box keeps the limited table's height, so System and Landscape draw inside it.
    expect(layout.button).toBeDefined();
    render(<TableCompact layout={layout} textClass={null} />);
    expect(screen.getByTestId('table-compact')).toHaveAccessibleName(
      '1 primary key, 1 foreign key, 60 columns',
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});
