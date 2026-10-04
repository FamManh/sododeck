import { describe, expect, it } from 'vitest';

import { isTextTarget } from './is-text-target';

describe('isTextTarget', () => {
  it('counts inputs, textareas and contenteditable elements', () => {
    expect(isTextTarget(document.createElement('input'))).toBe(true);
    expect(isTextTarget(document.createElement('textarea'))).toBe(true);
    expect(isTextTarget(document.createElement('button'))).toBe(false);
    expect(isTextTarget(null)).toBe(false);
  });

  it('counts the edit-context element inside a Monaco editor', () => {
    const editor = document.createElement('div');
    editor.className = 'monaco-editor';
    const inner = document.createElement('div');
    inner.className = 'native-edit-context';
    editor.append(inner);
    expect(isTextTarget(inner)).toBe(true);
  });
});
