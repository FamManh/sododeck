import type { IconSet } from '../../src/icon-sets/types';

/**
 * A test-only filled set: proves the reference format, the resolver, the glyph, the picker and the
 * export accept another set without any change outside this fixture (038 FR-013).
 */
export const solidTestSet: IconSet = {
  id: 'solid-test',
  name: 'Solid test',
  licence: { spdx: 'MIT', notice: 'Test fixture.' },
  style: 'solid',
  categories: [{ id: 'shapes', label: 'Shapes' }],
  aliases: { blob: 'square' },
  icons: [
    {
      name: 'square',
      label: 'Square',
      category: 'shapes',
      keywords: ['box'],
      node: [['path', { d: 'M4 4h16v16H4z' }]],
    },
    {
      name: 'dot',
      label: 'Dot',
      category: 'shapes',
      keywords: ['point'],
      node: [['circle', { cx: 12, cy: 12, r: 6 }]],
    },
    {
      name: 'triangle',
      label: 'Triangle',
      category: 'shapes',
      keywords: [],
      node: [['path', { d: 'M12 3l9 18H3z' }]],
    },
  ],
};
