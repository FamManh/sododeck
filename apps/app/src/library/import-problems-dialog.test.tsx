import type { ProblemEntry, ProblemReport } from '@sododeck/model';
import { stringifyReport } from '@sododeck/model/report-json';
import { ToastProvider, Toaster } from '@sododeck/ui/components/toast';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ImportProblemsDialog, type ImportProblemsRequest } from './import-problems-dialog';

function stubClipboard(writeText: ((text: string) => Promise<void>) | undefined) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: writeText ? { writeText } : undefined,
  });
}

afterEach(() => {
  stubClipboard(undefined);
});

const titleEntry: ProblemEntry = {
  code: 'schema-required',
  severity: 'error',
  path: '/nodes/2/title',
  subject: 'payments',
  message: '"title" is missing.',
  fix: 'Add "title" (a string) to node "payments".',
};
const duplicateEntry: ProblemEntry = {
  code: 'duplicate-id',
  severity: 'error',
  path: '/nodes/3/id',
  subject: 'api',
  message: 'Id "api" is used more than once (/nodes/1/id, /nodes/3/id).',
  evidence: '"api"',
  fix: 'Give one of these objects a new, unique id and update references to it.',
};
const notJson: ProblemEntry = {
  code: 'invalid-json',
  severity: 'error',
  line: 14,
  column: 5,
  message: 'The file is not valid JSON: unexpected token.',
  fix: 'Fix the JSON syntax at line 14, column 5.',
};

function report(
  problems: ProblemEntry[],
  status: ProblemReport['status'] = 'refused',
  total = problems.length,
): ProblemReport {
  const errors = problems.filter((p) => p.severity === 'error').length;
  return {
    report: 'sododeck-problems',
    reportVersion: 1,
    source: { kind: 'file', name: 'checkout.sododeck' },
    status,
    schema: 'https://sododeck.com/schema/v1.json',
    formatVersion: 1,
    app: '0.0.0',
    counts: {
      error: errors + (total - problems.length),
      warning: problems.length - errors,
      info: 0,
    },
    problems,
    omitted: total - problems.length,
  };
}

function setup(request: ImportProblemsRequest | null, onOpenDeck = vi.fn()) {
  const onClose = vi.fn();
  render(
    <ToastProvider>
      <ImportProblemsDialog request={request} onClose={onClose} onOpenDeck={onOpenDeck} />
      <Toaster />
    </ToastProvider>,
  );
  return { onClose, onOpenDeck, user: userEvent.setup() };
}

describe('ImportProblemsDialog: refused file (062 US1)', () => {
  const refused: ImportProblemsRequest = {
    mode: 'refused',
    name: 'checkout.sododeck',
    report: report([titleEntry, duplicateEntry]),
  };

  it('names the file, counts the problems and says nothing was added', () => {
    setup(refused);
    const dialog = screen.getByRole('dialog', { name: 'Couldn\'t open "checkout.sododeck"' });
    expect(within(dialog).getByText('2 problems. Nothing was added.')).toBeInTheDocument();
  });

  it('lists each problem with its severity, message, location and fix', () => {
    setup(refused);
    const items = within(screen.getByRole('list', { name: 'Problems' })).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    const [first] = items;
    if (first === undefined) throw new Error('no item');
    expect(within(first).getByRole('img', { name: 'Error' })).toBeInTheDocument();
    expect(within(first).getByText('"title" is missing.')).toBeInTheDocument();
    expect(within(first).getByText('/nodes/2/title')).toBeInTheDocument();
    expect(
      within(first).getByText('Add "title" (a string) to node "payments".'),
    ).toBeInTheDocument();
  });

  it('shows line and column for a file that is not JSON', () => {
    setup({ ...refused, report: report([notJson]) });
    expect(screen.getByText('1 problem. Nothing was added.')).toBeInTheDocument();
    expect(screen.getByText('line 14, column 5')).toBeInTheDocument();
  });

  it('starts on Copy problems and copies the report as JSON', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const { user } = setup(refused);
    stubClipboard(writeText);
    const copy = screen.getByRole('button', { name: 'Copy problems' });
    expect(copy).toHaveFocus();
    await user.click(copy);
    expect(writeText).toHaveBeenCalledWith(stringifyReport(refused.report));
    expect(await screen.findByText('Copied problems')).toBeInTheDocument();
  });

  it('shows the JSON in a focused, selected text area when copying fails', async () => {
    const { user } = setup(refused);
    stubClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    await user.click(screen.getByRole('button', { name: 'Copy problems' }));
    const area = await screen.findByRole('textbox', { name: 'Problems as JSON' });
    expect(area).toHaveValue(stringifyReport(refused.report));
    expect(area).toHaveFocus();
    expect(area).toHaveAttribute('readonly');
    const textarea = area as HTMLTextAreaElement;
    expect(textarea.selectionStart).toBe(0);
    expect(textarea.selectionEnd).toBe(textarea.value.length);
  });

  it('shows at most 500 rows and counts the rest', () => {
    const many = Array.from({ length: 5000 }, (_, i) => ({
      ...duplicateEntry,
      path: `/nodes/${String(i)}/id`,
    }));
    setup({ ...refused, report: report(many, 'refused', 10_000) });
    const list = screen.getByRole('list', { name: 'Problems' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(500);
    expect(screen.getByText('and 9,500 more')).toBeInTheDocument();
    expect(screen.getByText('10,000 problems. Nothing was added.')).toBeInTheDocument();
  });

  it('closes on Esc', async () => {
    const { user, onClose } = setup(refused);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing without a request', () => {
    setup(null);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('ImportProblemsDialog: opened deck (062 US2)', () => {
  const picture: ProblemEntry = {
    code: 'picture-damaged',
    severity: 'warning',
    path: `/assets/${'a'.repeat(64)}`,
    subject: 'a'.repeat(64),
    message: 'Picture "logo.png" is damaged: its data does not match its size.',
    evidence: 'size-mismatch',
    fix: 'Export the picture again.',
  };
  const opened: ImportProblemsRequest = {
    mode: 'opened',
    name: 'Checkout',
    deckId: 'd1',
    report: report([titleEntry, picture], 'opened'),
  };

  it('says the deck opened unchanged and lists warnings with their own glyph', () => {
    setup(opened);
    const dialog = screen.getByRole('dialog', { name: '"Checkout" opened with problems' });
    expect(within(dialog).getByText('2 problems. The deck opened unchanged.')).toBeInTheDocument();
    expect(within(dialog).getByRole('img', { name: 'Warning' })).toBeInTheDocument();
  });

  it('starts on Open deck, which opens the deck', async () => {
    const { user, onOpenDeck } = setup(opened);
    const open = screen.getByRole('button', { name: 'Open deck' });
    expect(open).toHaveFocus();
    await user.click(open);
    expect(onOpenDeck).toHaveBeenCalledWith('d1');
  });

  it('copies the opened report', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const { user } = setup(opened);
    stubClipboard(writeText);
    await user.click(screen.getByRole('button', { name: 'Copy problems' }));
    expect(writeText).toHaveBeenCalledWith(stringifyReport(opened.report));
  });
});
