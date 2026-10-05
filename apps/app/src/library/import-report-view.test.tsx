import { stringifyReport } from '@sododeck/model/report-json';
import { ToastProvider, Toaster } from '@sododeck/ui/components/toast';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { toFidelityReport } from '../import-mermaid/fidelity';
import type { ImportReport } from '../import-mermaid/import-report';
import { ImportReportView } from './import-report-view';

const base: ImportReport = {
  kind: 'flowchart',
  counts: { components: 12, connections: 14, groups: 2, steps: 0 },
  skipped: [],
  notes: [],
};

const show = (ui: ReactElement) =>
  render(
    <ToastProvider>
      {ui}
      <Toaster />
    </ToastProvider>,
  );

describe('ImportReportView', () => {
  it('shows the counts as text', () => {
    show(<ImportReportView report={base} />);
    expect(screen.getByText('12 components, 14 connections, 2 groups')).toBeInTheDocument();
  });

  it('says everything was imported when nothing was lost (062 FR-015)', () => {
    show(<ImportReportView report={base} />);
    expect(screen.getByText('Everything was imported.')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('lists every skipped line under its group with its number, text and reason', () => {
    const skipped = Array.from({ length: 30 }, (_, i) => ({
      line: i + 2,
      text: `style N${String(i)} fill:#fff`,
      reason: 'appearance' as const,
    }));
    show(<ImportReportView report={{ ...base, skipped }} />);
    const group = screen.getByRole('region', { name: 'Left out (30)' });
    const items = within(group).getAllByRole('listitem');
    expect(items).toHaveLength(30);
    expect(items[0]).toHaveTextContent('Line 2: style N0 fill:#fff');
    expect(items[0]).toHaveTextContent('Styling is not imported.');
  });

  it('shows a fix hint for an unreadable line, under Not supported', () => {
    show(
      <ImportReportView
        report={{ ...base, skipped: [{ line: 5, text: 'what', reason: 'unreadable' }] }}
      />,
    );
    const group = screen.getByRole('region', { name: 'Not supported (1)' });
    expect(within(group).getByText('This line could not be read.')).toBeInTheDocument();
    expect(within(group).getByText('Check the syntax on this line.')).toBeInTheDocument();
  });

  it('shows a declaration met twice under Merged with both lines', () => {
    show(
      <ImportReportView
        report={{
          ...base,
          skipped: [{ line: 9, text: 'api(v2)', reason: 'merged', key: 'api', lines: [3, 9] }],
        }}
      />,
    );
    const group = screen.getByRole('region', { name: 'Merged (1)' });
    expect(within(group).getByRole('listitem')).toHaveTextContent('Lines 3 and 9: api(v2)');
  });

  it('shows notes under Collapsed and the sequence summary', () => {
    show(
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
    const group = screen.getByRole('region', { name: 'Collapsed (1)' });
    expect(
      within(group).getByText('Branching in sequence blocks was flattened.'),
    ).toBeInTheDocument();
  });

  it('copies the fidelity report as JSON (062 FR-016)', async () => {
    const user = userEvent.setup();
    const report = {
      ...base,
      skipped: [{ line: 2, text: 'click A cb', reason: 'interaction' as const }],
    };
    show(<ImportReportView report={report} name="a.mmd" />);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    await user.click(screen.getByRole('button', { name: 'Copy report' }));
    expect(writeText).toHaveBeenCalledWith(stringifyReport(toFidelityReport(report, 'a.mmd')));
    expect(await screen.findByText('Copied report')).toBeInTheDocument();
  });

  it('renders diagram text as text, never as markup', () => {
    const { container } = show(
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
