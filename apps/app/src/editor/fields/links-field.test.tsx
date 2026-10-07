import { toJSON } from '@sododeck/model';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fieldDeck } from '../../test/field-fixtures';
import { NodeFieldHarness } from '../../test/field-harness';
import { renderWithEditor } from '../../test/render-canvas';
import { EmbedHostContext, type EmbedHostValue } from '../embed-host-context';
import { LinksField } from './links-field';

function setup(host?: EmbedHostValue) {
  const harness = (
    <NodeFieldHarness
      field={(node, _deck, write) => (
        <LinksField
          value={node.links}
          onCommit={(links) => {
            write({ links });
          }}
        />
      )}
    />
  );
  const view = renderWithEditor(
    host === undefined ? harness : <EmbedHostContext value={host}>{harness}</EmbedHostContext>,
    fieldDeck,
  );
  return { ...view, user: userEvent.setup() };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LinksField in a host (067)', () => {
  const add = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(
      screen.getByRole('textbox', { name: 'Add link' }),
      'https://runbooks.example.com/pricing{Enter}',
    );
  };

  it('opens a link through the host and never through the window', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const openLink = vi.fn();
    const { user } = setup({ openLink, saveFile: null });
    await add(user);
    await user.click(screen.getByRole('link', { name: 'runbooks.example.com' }));
    expect(openLink).toHaveBeenCalledWith('https://runbooks.example.com/pricing');
    expect(open).not.toHaveBeenCalled();
  });

  it('shows the text and a copy action, and no open action, when the host cannot open links', async () => {
    const { user } = setup({ openLink: null, saveFile: null });
    await add(user);
    const list = screen.getByRole('list', { name: 'Links' });
    expect(within(list).getByText('runbooks.example.com')).toBeInTheDocument();
    expect(within(list).queryByRole('link')).not.toBeInTheDocument();
    expect(
      within(list).getByRole('button', { name: 'Copy link runbooks.example.com' }),
    ).toBeInTheDocument();
  });
});

describe('LinksField (FR-006)', () => {
  it('adds a pasted link labelled with its domain and opens it in a new tab', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { user, doc } = setup();
    await user.type(
      screen.getByRole('textbox', { name: 'Add link' }),
      'https://runbooks.example.com/pricing{Enter}',
    );
    expect(toJSON(doc).nodes[0]?.links).toEqual([
      { label: 'runbooks.example.com', url: 'https://runbooks.example.com/pricing' },
    ]);
    const list = screen.getByRole('list', { name: 'Links' });
    await user.click(within(list).getByRole('link', { name: 'runbooks.example.com' }));
    expect(open).toHaveBeenCalledWith(
      'https://runbooks.example.com/pricing',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('refuses other schemes with an inline error', async () => {
    const { user, doc } = setup();
    const add = screen.getByRole('textbox', { name: 'Add link' });
    await user.type(add, 'javascript:alert(1){Enter}');
    expect(add).toHaveAttribute('aria-invalid', 'true');
    expect(add).toHaveAccessibleDescription('Only http, https or relative links');
    expect(toJSON(doc).nodes[0]?.links).toBeUndefined();
  });

  it('edits a label and removes a link', async () => {
    const { user, doc } = setup();
    await user.type(screen.getByRole('textbox', { name: 'Add link' }), 'docs/runbook.md{Enter}');
    await user.click(screen.getByRole('button', { name: 'Edit label for runbook.md' }));
    const label = screen.getByRole('textbox', { name: 'Link label' });
    await user.clear(label);
    await user.type(label, 'Runbook{Enter}');
    expect(toJSON(doc).nodes[0]?.links).toEqual([{ label: 'Runbook', url: 'docs/runbook.md' }]);
    await user.click(screen.getByRole('button', { name: 'Remove link Runbook' }));
    expect(toJSON(doc).nodes[0]?.links).toBeUndefined();
  });
});
