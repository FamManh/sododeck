import { createEditor, fromJSON, type DeckEditor } from '@sododeck/model';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { readDeck } from '../../model/use-deck-snapshot';
import { useUiStore } from '../../state/ui-store';
import { playbackDeck } from '../../test/flow-fixtures';
import {
  advancePlayback,
  currentPlayback,
  exitFlow,
  goToStep,
  nextStep,
  openFlow,
  play,
  previousStep,
  switchAlternative,
} from './flow-mode';

const initial = useUiStore.getState();
const ui = () => useUiStore.getState();
let editor: DeckEditor;

beforeEach(() => {
  useUiStore.setState(initial, true);
  editor = createEditor(fromJSON(playbackDeck), { captureTimeout: 0 });
});

function announcements(run: () => void): string[] {
  const texts: string[] = [];
  const stop = useUiStore.subscribe((s, prev) => {
    if (s.announcement.seq !== prev.announcement.seq) texts.push(s.announcement.text);
  });
  run();
  stop();
  return texts;
}

describe('openFlow / exitFlow', () => {
  it('opens on step 1 of the played path, paused, announcing it once', () => {
    expect(
      announcements(() => {
        openFlow(editor, 'order');
      }),
    ).toEqual(['Step 1 of 8: Customer App → API Gateway']);
    expect(ui().activeFlow).toMatchObject({ flowId: 'order', stepId: 'o1', playing: false });
    expect(currentPlayback(readDeck(editor.doc))?.view?.label).toBe('Step 1 of 8');
  });

  it('opens on a given step, choosing its alternative', () => {
    openFlow(editor, 'fork', 'f4b');
    expect(ui().activeFlow).toMatchObject({ stepId: 'f4b', alternativeId: 'failed' });
  });

  it('can open silently, and ignores unknown flows', () => {
    expect(
      announcements(() => {
        openFlow(editor, 'order', null, { announce: false });
      }),
    ).toEqual([]);
    openFlow(editor, 'nope');
    expect(ui().activeFlow?.flowId).toBe('order');
  });

  it('opens an empty flow with no current step and no announcement', () => {
    expect(
      announcements(() => {
        openFlow(editor, 'empty');
      }),
    ).toEqual([]);
    expect(ui().activeFlow).toMatchObject({ flowId: 'empty', stepId: null });
    expect(currentPlayback(readDeck(editor.doc))?.view).toBeNull();
  });

  it('exits, marking the flow last played', () => {
    openFlow(editor, 'order');
    exitFlow();
    expect(ui().activeFlow).toBeNull();
    expect(ui().lastPlayedFlowId).toBe('order');
    expect(currentPlayback(readDeck(editor.doc))).toBeNull();
  });
});

describe('stepping', () => {
  beforeEach(() => {
    openFlow(editor, 'order');
  });

  it('goes to next / previous, pausing and announcing once, no-op at the ends', () => {
    ui().setPlaying(true);
    expect(
      announcements(() => {
        nextStep(editor);
      }),
    ).toEqual(['Step 2 of 8: API Gateway → Order Service']);
    expect(ui().activeFlow).toMatchObject({ stepId: 'o2', playing: false });
    previousStep(editor);
    expect(
      announcements(() => {
        previousStep(editor);
      }),
    ).toEqual([]);
    expect(ui().activeFlow?.stepId).toBe('o1');
    goToStep(editor, 'o8');
    expect(
      announcements(() => {
        nextStep(editor);
      }),
    ).toEqual([]);
    expect(ui().activeFlow?.stepId).toBe('o8');
  });

  it('announces step 5 of the spec and ignores unknown steps', () => {
    expect(
      announcements(() => {
        goToStep(editor, 'o5');
      }),
    ).toEqual(['Step 5 of 8: Order Service → Payment Service']);
    goToStep(editor, 'gone');
    expect(ui().activeFlow?.stepId).toBe('o5');
  });

  it('autoplays to the last step and stops there; play on the last step restarts', () => {
    play(editor);
    expect(ui().activeFlow?.playing).toBe(true);
    for (let i = 0; i < 6; i++) advancePlayback(editor);
    expect(ui().activeFlow).toMatchObject({ stepId: 'o7', playing: true });
    expect(
      announcements(() => {
        advancePlayback(editor);
      }),
    ).toEqual(['Step 8 of 8: Event Bus → Notification Service']);
    expect(ui().activeFlow).toMatchObject({ stepId: 'o8', playing: false });
    play(editor);
    expect(ui().activeFlow).toMatchObject({ stepId: 'o1', playing: true });
  });

  it('does nothing outside flow mode', () => {
    exitFlow();
    const spy = vi.spyOn(ui(), 'announce');
    nextStep(editor);
    goToStep(editor, 'o2');
    play(editor);
    expect(ui().activeFlow).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('alternatives', () => {
  beforeEach(() => {
    openFlow(editor, 'fork');
  });

  it('switches only while the picker shows, re-homing the current step', () => {
    switchAlternative(editor, 1);
    expect(ui().activeFlow?.alternativeId).toBeNull();
    goToStep(editor, 'f4a');
    expect(
      announcements(() => {
        switchAlternative(editor, 1);
      }),
    ).toEqual(['Step 4b of 5: Payment Service → Notification Service, branch payment failed']);
    expect(ui().activeFlow).toMatchObject({ alternativeId: 'failed', stepId: 'f4b' });
    switchAlternative(editor, 1);
    expect(ui().activeFlow).toMatchObject({ alternativeId: 'ok', stepId: 'f4a' });
    switchAlternative(editor, -1);
    expect(ui().activeFlow?.alternativeId).toBe('failed');
    switchAlternative(editor, 'ok');
    expect(ui().activeFlow?.alternativeId).toBe('ok');
  });

  it('keeps a fork step current when switching, and a step of another alternative switches', () => {
    goToStep(editor, 'f3');
    switchAlternative(editor, 'failed');
    expect(ui().activeFlow).toMatchObject({ alternativeId: 'failed', stepId: 'f3' });
    goToStep(editor, 'f5a');
    expect(ui().activeFlow).toMatchObject({ alternativeId: 'ok', stepId: 'f5a' });
  });
});
