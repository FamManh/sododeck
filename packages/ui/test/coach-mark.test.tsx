import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Button } from '../src/components/button';
import { CoachMark, CoachMarkAnchor } from '../src/components/coach-mark';

interface Handlers {
  onNext?: () => void;
  onBack?: () => void;
  onFinish?: () => void;
  onSkip?: () => void;
}

function Tour({
  step,
  anchored = true,
  ...handlers
}: Handlers & { step: number; anchored?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
        }}
      >
        Start tour
      </Button>
      <CoachMark
        open={open}
        step={step}
        total={3}
        title="Add your first component"
        onNext={handlers.onNext ?? (() => undefined)}
        onBack={handlers.onBack ?? (() => undefined)}
        onFinish={handlers.onFinish ?? (() => undefined)}
        onSkip={() => {
          handlers.onSkip?.();
          setOpen(false);
        }}
        anchor={
          anchored ? (
            <CoachMarkAnchor asChild>
              <Button>Palette</Button>
            </CoachMarkAnchor>
          ) : undefined
        }
      >
        Drag a kind onto the canvas.
      </CoachMark>
    </>
  );
}

async function start(ui: React.ReactElement) {
  const user = userEvent.setup();
  render(ui);
  const trigger = screen.getByRole('button', { name: 'Start tour' });
  await user.click(trigger);
  return {
    user,
    trigger,
    card: await screen.findByRole('dialog', { name: 'Add your first component' }),
  };
}

describe('CoachMark', () => {
  it('shows "1 of 3" with Back disabled and Next calling onNext', async () => {
    const onNext = vi.fn();
    const { user, card } = await start(<Tour step={1} onNext={onNext} />);
    expect(card).toHaveTextContent('1 of 3');
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('shows Done on the last step and calls onFinish', async () => {
    const onFinish = vi.fn();
    const onBack = vi.fn();
    const { user } = await start(<Tour step={3} onFinish={onFinish} onBack={onBack} />);
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it('moves focus into the card when it opens', async () => {
    const { card } = await start(<Tour step={1} />);
    expect(card).toContainElement(document.activeElement as HTMLElement);
  });

  it('skips with Skip', async () => {
    const onSkip = vi.fn();
    const { user } = await start(<Tour step={2} onSkip={onSkip} />);
    await user.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('skips with Escape and returns focus to where it was', async () => {
    const onSkip = vi.fn();
    const { user, trigger } = await start(<Tour step={2} onSkip={onSkip} />);
    await user.keyboard('{Escape}');
    expect(onSkip).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('still renders without an anchor', async () => {
    const { card } = await start(<Tour step={1} anchored={false} />);
    expect(card).toBeVisible();
  });
});
