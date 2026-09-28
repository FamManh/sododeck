import type { ObjectChange } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import { describeUndo, undoMessage } from './undo-context';

const viewChange = (id: string, keys: string[]): ObjectChange => ({
  scope: 'views',
  id,
  kind: 'updated',
  keys,
});

describe('describeUndo (FR-045)', () => {
  it.each([
    [['positions'], 'move'],
    [['pinned'], 'pin'],
    [['title'], 'rename'],
    [['excludeGroups'], 'view settings'],
    [['subtitleField', 'dimKinds'], 'view settings'],
    [['feature'], 'view settings'],
    [['includes'], 'change'],
  ] as const)('names %j as "%s"', (keys, action) => {
    expect(describeUndo([viewChange('infra', [...keys])], 'system')).toEqual({
      viewId: 'infra',
      action,
    });
  });

  it('says nothing for the current view, shared data, several views or added views', () => {
    expect(describeUndo([viewChange('system', ['positions'])], 'system')).toBeNull();
    expect(
      describeUndo(
        [
          viewChange('infra', ['positions']),
          { scope: 'nodes', id: 'a', kind: 'updated', keys: ['position'] },
        ],
        'system',
      ),
    ).toBeNull();
    expect(
      describeUndo([viewChange('infra', ['pinned']), viewChange('feature', ['pinned'])], 'system'),
    ).toBeNull();
    expect(
      describeUndo([{ scope: 'views', id: 'infra', kind: 'added', keys: [] }], 'system'),
    ).toBeNull();
    expect(describeUndo([], 'system')).toBeNull();
  });

  it('words the toast for undo and redo', () => {
    expect(undoMessage('undo', 'move', 'Infra')).toBe('Undid move in Infra');
    expect(undoMessage('redo', 'pin', 'Infra')).toBe('Redid pin in Infra');
  });
});
