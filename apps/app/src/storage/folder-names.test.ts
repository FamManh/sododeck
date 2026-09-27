import { describe, expect, it } from 'vitest';

import { folderNameKey, folderNameMessage, validateFolderName } from './folder-names';

describe('folder names', () => {
  it('compares names trimmed and ignoring case', () => {
    expect(folderNameKey('  Payments ')).toBe('payments');
  });

  it('refuses empty, duplicate and too-long names', () => {
    const keys = ['payments', 'logistics'];
    expect(validateFolderName('   ', keys)).toBe('empty');
    expect(validateFolderName(' payments ', keys)).toBe('duplicate');
    expect(validateFolderName('PAYMENTS', keys)).toBe('duplicate');
    expect(validateFolderName('x'.repeat(61), keys)).toBe('too-long');
    expect(validateFolderName('x'.repeat(60), keys)).toBeNull();
    expect(validateFolderName('Platform', keys)).toBeNull();
  });

  it('has the contract messages', () => {
    expect(folderNameMessage('empty', '')).toBe('Enter a folder name.');
    expect(folderNameMessage('duplicate', ' payments ')).toBe(
      'A folder named "payments" already exists.',
    );
  });
});
