import { describe, expect, it } from 'vitest';

import {
  ICON_SETS,
  iconRef,
  lucide,
  nodeIcon,
  parseIconRef,
  resolveIcon,
} from '../../src/icon-sets';
import { TYPE_STYLE } from '../../src/lib/icons';
import { solidTestSet } from '../fixtures/solid-test-set';

const BOTH = [lucide, solidTestSet];

describe('parseIconRef', () => {
  it.each([
    ['server', { set: 'lucide', name: 'server' }],
    ['lucide:server', { set: 'lucide', name: 'server' }],
    ['Lucide:Server', { set: 'lucide', name: 'server' }],
    ['Server', { set: 'lucide', name: 'server' }],
    ['simple:kafka', { set: 'simple', name: 'kafka' }],
    ['a b', null],
    ['a:b:c', null],
    [':x', null],
    ['x:', null],
    ['mdi_db', null],
    ['', null],
  ])('%j', (value, expected) => {
    expect(parseIconRef(value)).toEqual(expected);
  });
});

describe('resolveIcon', () => {
  it('resolves a known icon, with or without the set', () => {
    expect(resolveIcon('lucide:server')?.name).toBe('server');
    expect(resolveIcon('Server')?.name).toBe('server');
    expect(resolveIcon('server')?.set).toBe('lucide');
  });

  it('returns null for unknown set, unknown name and unreadable text', () => {
    expect(resolveIcon('simple:kafka')).toBeNull();
    expect(resolveIcon('lucide:no-such-icon')).toBeNull();
    expect(resolveIcon('a b')).toBeNull();
    expect(resolveIcon('mdi:database')).toBeNull();
  });

  it('resolves an alias to the current icon', () => {
    expect(resolveIcon('solid-test:blob', BOTH)?.name).toBe('square');
    const aliased = lucide.icons.find((i) => Object.values(lucide.aliases).includes(i.name));
    if (aliased) {
      const alias = Object.entries(lucide.aliases).find(([, to]) => to === aliased.name)?.[0];
      expect(resolveIcon(`lucide:${alias}`)?.name).toBe(aliased.name);
    }
  });

  it('returns the same object for the same string', () => {
    expect(resolveIcon('lucide:server')).toBe(resolveIcon('lucide:server'));
    expect(resolveIcon('lucide:server')).toBe(resolveIcon('server'));
  });

  it('knows a second set', () => {
    expect(resolveIcon('lucide:server', BOTH)?.style).toBe('line');
    expect(resolveIcon('solid-test:dot', BOTH)).toMatchObject({
      set: 'solid-test',
      style: 'solid',
    });
    expect(resolveIcon('solid-test:dot')).toBeNull();
  });
});

describe('iconRef', () => {
  it('writes set:name', () => {
    const icon = resolveIcon('Server');
    expect(icon && iconRef(icon)).toBe('lucide:server');
  });
});

describe('nodeIcon', () => {
  it('prefers a custom icon that resolves', () => {
    const result = nodeIcon({ icon: 'lucide:search', type: 'service' });
    expect(result).toMatchObject({ source: 'custom', unavailable: false });
    expect(result.icon.name).toBe('search');
  });

  it('falls back to the type icon', () => {
    for (const [id, style] of Object.entries(TYPE_STYLE)) {
      const result = nodeIcon({ type: id });
      expect(result.icon.name, id).toBe(style.iconName);
      expect(result).toMatchObject({ source: 'type', unavailable: false });
    }
    expect(nodeIcon({ type: 'Service' }).icon.name).toBe('box');
  });

  it('uses the fallback icon for an unknown type', () => {
    expect(nodeIcon({ type: 'mystery' })).toMatchObject({
      source: 'fallback',
      unavailable: false,
    });
    expect(nodeIcon({ type: 'mystery' }).icon.name).toBe('shapes');
  });

  it('marks a stored reference that does not resolve', () => {
    const result = nodeIcon({ icon: 'simple:kafka', type: 'database' });
    expect(result).toMatchObject({ source: 'type', unavailable: true });
    expect(result.icon.name).toBe('database');
    expect(nodeIcon({ icon: 'a b', type: 'nope' })).toMatchObject({
      source: 'fallback',
      unavailable: true,
    });
  });

  it('treats an absent or empty icon as not set', () => {
    expect(nodeIcon({ icon: undefined, type: 'service' }).unavailable).toBe(false);
    expect(nodeIcon({ icon: '', type: 'service' }).unavailable).toBe(false);
  });

  it('works with another set', () => {
    const result = nodeIcon({ icon: 'solid-test:dot', type: 'service' }, BOTH);
    expect(result).toMatchObject({ source: 'custom' });
    expect(result.icon.style).toBe('solid');
    expect(nodeIcon({ type: 'service' }, [solidTestSet]).icon.name).toBe('box');
  });

  it('only ships lucide today', () => {
    expect(ICON_SETS.map((s) => s.id)).toEqual(['lucide']);
  });
});
