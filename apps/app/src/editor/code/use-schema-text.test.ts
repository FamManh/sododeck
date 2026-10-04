import { renderHook, act } from '@testing-library/react';
import { emptySododeckFile, type Node, type SododeckFile } from '@sododeck/schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSchemaText, type SchemaTextRequest } from './use-schema-text';

const table = (id: string, title: string, x = 0): Node => ({
  id,
  type: 'db-table',
  title,
  position: { x, y: 0 },
  columns: [{ id: `${id}-id`, name: 'id', type: 'integer', pk: true }],
});

const base: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    table('a', 'orders'),
    table('b', 'customers'),
    { id: 'c', type: 'service', title: 'API', position: { x: 0, y: 0 } },
  ],
};

const req = (patch: Partial<SchemaTextRequest> = {}): SchemaTextRequest => ({
  format: 'dbml',
  scope: 'schema',
  dialect: null,
  selection: [],
  ...patch,
});

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useSchemaText', () => {
  it('writes the whole schema with its table ids', () => {
    const { result } = renderHook(() => useSchemaText(base, req(), true));
    expect(result.current.text).toContain('Table orders');
    expect(result.current.text).toContain('Table customers');
    expect(result.current.tableIds).toEqual(['a', 'b']);
    expect(result.current.tableCount).toBe(2);
  });

  it('writes only the selected tables, ignoring other cards', () => {
    const { result } = renderHook(() =>
      useSchemaText(base, req({ scope: 'selection', selection: ['b', 'c'] }), true),
    );
    expect(result.current.text).toContain('Table customers');
    expect(result.current.text).not.toContain('orders');
    expect(result.current.tableIds).toEqual(['b']);
  });

  it('does nothing while disabled', () => {
    const { result } = renderHook(() => useSchemaText(base, req(), false));
    expect(result.current.text).toBe('');
  });

  it('keeps the Selection text when only an unrelated card moves', () => {
    const request = req({ scope: 'selection', selection: ['b'] });
    const { result, rerender } = renderHook(({ deck }) => useSchemaText(deck, request, true), {
      initialProps: { deck: base },
    });
    const first = result.current;
    rerender({
      deck: {
        ...base,
        nodes: base.nodes.map((n) => (n.id === 'a' ? { ...n, position: { x: 9, y: 9 } } : n)),
      },
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe(first);
  });

  it('throttles deck changes and lands the last one', () => {
    const { result, rerender } = renderHook(({ deck }) => useSchemaText(deck, req(), true), {
      initialProps: { deck: base },
    });
    const renamed = (title: string): SododeckFile => ({
      ...base,
      nodes: base.nodes.map((n) => (n.id === 'a' ? { ...n, title } : n)),
    });
    rerender({ deck: renamed('orders2') });
    expect(result.current.text).toContain('Table orders');
    expect(result.current.text).not.toContain('orders2');
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.text).toContain('Table orders2');
  });

  it('switches format at once', () => {
    const { result, rerender } = renderHook(({ r }) => useSchemaText(base, r, true), {
      initialProps: { r: req() },
    });
    rerender({ r: req({ format: 'sql', dialect: 'postgres' }) });
    expect(result.current.text).toContain('CREATE TABLE');
  });
});
