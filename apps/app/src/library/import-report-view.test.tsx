import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ImportReport } from '../import-mermaid/import-report';
import { ImportReportView } from './import-report-view';

const base: ImportReport = {
  kind: 'flowchart',
  counts: { components: 12, connections: 14, groups: 2, steps: 0 },
  skipped: [],
  notes: [],
};

describe('ImportReportView', () => {
  it('shows the counts as text', () => {
    render(<ImportReportView report={base} />);
    expect(screen.getByText('12 components, 14 connections, 2 groups')).toBeInTheDocument();
  });

  it('says nothing was skipped when nothing was', () => {
    render(<ImportReportView report={base} />);
    expect(screen.getByText('Nothing was skipped.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: /skipped/i })).not.toBeInTheDocument();
  });

  it('lists every skipped line with its number, text and reason', () => {
    const skipped = Array.from({ length: 30 }, (_, i) => ({
      line: i + 2,
      text: `style N${i} fill:#fff`,
      reason: 'appearance' as const,
    }));
    render(<ImportReportView report={{ ...base, skipped }} />);
    const list = screen.getByRole('list', { name: '30 lines skipped' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(30);
    expect(items[0]).toHaveTextContent('Line 2: style N0 fill:#fff');
    expect(items[0]).toHaveTextContent('Styling is not imported.');
  });

  it('uses the singular for one line', () => {
    render(
      <ImportReportView
        report={{ ...base, skipped: [{ line: 5, text: 'what', reason: 'unreadable' }] }}
      />,
    );
    expect(screen.getByRole('list', { name: '1 line skipped' })).toBeInTheDocument();
    expect(screen.getByText('This line could not be read.')).toBeInTheDocument();
  });

  it('shows notes and the sequence summary', () => {
    render(
      <ImportReportView
        report={{
          ...base,
          kind: 'sequence',
          counts: { components: 4, connections: 6, groups: 0, steps: 10 },
          notes: ['Branching in sequence blocks was flattened'],
        }}
      />,
    );
    expect(
      screen.getByText('4 components, 6 connections, 1 flow with 10 steps'),
    ).toBeInTheDocument();
    expect(screen.getByText('Branching in sequence blocks was flattened')).toBeInTheDocument();
  });

  it('renders diagram text as text, never as markup', () => {
    const { container } = render(
      <ImportReportView
        report={{
          ...base,
          skipped: [{ line: 2, text: '<img src=x onerror=alert(1)>', reason: 'unreadable' }],
        }}
      />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
  });
});
