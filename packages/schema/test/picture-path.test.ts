import { describe, expect, it } from 'vitest';
import { checkPicturePath, PATH_VIOLATION_TEXT, type PathViolation } from '../src';

describe('checkPicturePath', () => {
  it.each(['assets/login.png', 'login.png', '../../Attachments/x.png', 'a b/Ảnh chụp 1.png'])(
    'accepts %s',
    (path) => {
      expect(checkPicturePath(path)).toBeNull();
    },
  );

  const refused: [string, string, PathViolation][] = [
    ['an empty path', '', 'empty'],
    ['1,025 characters', 'a'.repeat(1025), 'too-long'],
    ['a backslash', 'a\\b.png', 'backslash'],
    ['a leading slash', '/x.png', 'absolute'],
    ['a drive letter', 'C:/x.png', 'colon'],
    ['a scheme', 'http://x/y.png', 'colon'],
    ['a data URL', 'data:x', 'colon'],
    ['an empty segment', 'a//b.png', 'empty-segment'],
    ['a trailing slash', 'a/', 'empty-segment'],
    ['a leading dot segment', './x.png', 'dot-segment'],
    ['an inner dot segment', 'a/./b.png', 'dot-segment'],
    ['a parent after a folder', 'a/../x.png', 'inner-parent'],
    ['only a parent', '..', 'no-file-name'],
    ['only parents', '../..', 'no-file-name'],
    ['a control character', 'a\u0001.png', 'control-char'],
  ];
  it.each(refused)('refuses %s', (_label, path, kind) => {
    expect(checkPicturePath(path)).toBe(kind);
  });

  it('has a sentence for every violation', () => {
    for (const kind of refused.map(([, , k]) => k)) {
      expect(PATH_VIOLATION_TEXT[kind].length).toBeGreaterThan(0);
    }
    expect(Object.keys(PATH_VIOLATION_TEXT)).toHaveLength(10);
  });
});
