import { assetId, toJSON } from '@sododeck/model';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { PNG_1X1 } from '../../images/test-pictures';
import { useUiStore } from '../../state/ui-store';
import { InspectorView } from '../../test/inspector-view';
import { deckOf, renderWithEditor } from '../../test/render-canvas';

const ASSET = assetId(PNG_1X1);
const deck = deckOf({
  images: [
    {
      id: 'i1',
      asset: ASSET,
      position: { x: 0, y: 0 },
      size: { width: 120, height: 80 },
      alt: 'Logo',
    },
    {
      id: 'i2',
      asset: ASSET,
      position: { x: 300, y: 0 },
      size: { width: 120, height: 80 },
      locked: true,
    },
  ],
  assets: {
    [ASSET]: {
      type: 'image/png',
      bytes: 2048,
      width: 640,
      height: 480,
      name: 'logo.png',
      data: '',
    },
  },
});

function setup(imageId: string, file = deck) {
  const user = userEvent.setup();
  const view = renderWithEditor(<InspectorView />, file);
  act(() => {
    useUiStore.getState().select({ images: [imageId] });
  });
  return { ...view, user };
}

describe('ImageInspector (055)', () => {
  it('shows alt text, caption and what the file is, with no Replace picture', () => {
    setup('i1');
    expect(screen.getByRole('heading', { name: 'Logo' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Alt text' })).toHaveValue('Logo');
    expect(screen.getByRole('textbox', { name: 'Caption' })).toHaveValue('');
    expect(screen.getByText('logo.png', { selector: 'span.text-body-sm' })).toBeInTheDocument();
    expect(screen.getByText('PNG')).toBeInTheDocument();
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
    expect(screen.getByText('640 × 480')).toBeInTheDocument();
    expect(screen.queryByText(/replace/i)).not.toBeInTheDocument();
  });

  it('writes alt text and caption, one undo step per edit, clearing with empty text', async () => {
    const { user, editor, doc } = setup('i1');
    const alt = screen.getByRole('textbox', { name: 'Alt text' });
    await user.clear(alt);
    await user.type(alt, 'Company logo');
    await user.tab();
    expect(toJSON(doc).images?.[0]?.alt).toBe('Company logo');
    const caption = screen.getByRole('textbox', { name: 'Caption' });
    await user.type(caption, 'Fig. 1');
    await user.tab();
    expect(toJSON(doc).images?.[0]?.caption).toBe('Fig. 1');
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).images?.[0]?.caption).toBeUndefined();
    expect(toJSON(doc).images?.[0]?.alt).toBe('Company logo');
  });

  it('keeps texts editable but refuses delete on a locked image', async () => {
    const { user, doc } = setup('i2');
    expect(screen.getByRole('button', { name: 'Delete image' })).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Alt text' }), 'Locked one');
    await user.tab();
    expect(toJSON(doc).images?.[1]?.alt).toBe('Locked one');
  });

  it('asks for confirmation through the shared delete request', async () => {
    const { user } = setup('i1');
    await user.click(screen.getByRole('button', { name: 'Delete image' }));
    expect(useUiStore.getState().pendingDelete).not.toBeNull();
  });

  it('shows the path of a picture saved as a file, read-only, with help (068)', () => {
    const pointed = deckOf({
      images: [
        { id: 'p', asset: ASSET, position: { x: 0, y: 0 }, size: { width: 120, height: 80 } },
      ],
      assets: {
        [ASSET]: {
          type: 'image/png',
          bytes: 2048,
          width: 640,
          height: 480,
          name: 'login.png',
          path: 'assets/login.png',
        },
      },
    });
    setup('p', pointed);
    expect(screen.getByText('Picture file')).toBeInTheDocument();
    expect(screen.getByText('assets/login.png')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Picture file' })).not.toBeInTheDocument();
    expect(
      screen.getByText(/This app can.t read files next to the deck\. Open the deck in an editor/),
    ).toBeInTheDocument();
  });

  it('shows no Picture file row for an embedded picture', () => {
    setup('i1');
    expect(screen.queryByText('Picture file')).not.toBeInTheDocument();
  });
});
