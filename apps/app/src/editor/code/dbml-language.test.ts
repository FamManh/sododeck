import { describe, expect, it, vi } from 'vitest';

import { DBML_BLOCK_WORDS, DBML_LANGUAGE_ID, dbmlLanguage, registerDbml } from './dbml-language';

/** A tiny Monarch interpreter: enough to check which class each lexeme gets. */
function tokenize(line: string): [string, string][] {
  const out: [string, string][] = [];
  let state = 'root';
  const stack: string[] = [];
  let rest = line;
  const tokenizer = dbmlLanguage.tokenizer as Record<string, unknown[]>;
  while (rest.length > 0) {
    let matched = false;
    for (const rule of tokenizer[state] ?? []) {
      const [re, action, next] = rule as [RegExp, unknown, string | undefined];
      const m = new RegExp(`^(?:${re.source})`).exec(rest);
      if (m === null || m[0] === '') continue;
      let cls: string;
      if (typeof action === 'string') cls = action;
      else {
        const cases = (action as { cases: Record<string, string> }).cases;
        const list = (
          dbmlLanguage[state === 'settings' ? 'settingWords' : 'blockWords'] as string[]
        ).includes(m[0])
          ? Object.values(cases)[0]
          : Object.values(cases)[1];
        cls = list ?? '';
      }
      out.push([m[0], cls]);
      rest = rest.slice(m[0].length);
      if (next === '@pop') state = stack.pop() ?? 'root';
      else if (next !== undefined) {
        stack.push(state);
        state = next.slice(1);
      }
      matched = true;
      break;
    }
    if (!matched) {
      out.push([rest.slice(0, 1), '']);
      rest = rest.slice(1);
    }
  }
  return out;
}

describe('dbml language', () => {
  it('knows the block words of the writer and the contract', () => {
    for (const word of [
      'Table',
      'Ref',
      'Enum',
      'indexes',
      'checks',
      'Note',
      'Project',
      'TableGroup',
    ])
      expect(DBML_BLOCK_WORDS).toContain(word);
  });

  it('classes block words, settings, strings, comments and expressions', () => {
    expect(tokenize('Table orders {')[0]).toEqual(['Table', 'keyword']);
    const column = tokenize("total int [not null, default: `now()`, note: 'x']");
    expect(column.find(([t]) => t === 'not')?.[1]).toBe('type');
    expect(column.find(([t]) => t === '`now()`')?.[1]).toBe('string');
    expect(column.find(([t]) => t === 'x')?.[1]).toBe('string');
    expect(tokenize('// a note')[0]).toEqual(['// a note', 'comment']);
    expect(tokenize("note: '''multi")).toContainEqual(['multi', 'string']);
  });

  it('registers once', () => {
    const languages = {
      register: vi.fn(),
      setMonarchTokensProvider: vi.fn(),
      getLanguages: vi.fn(() => [] as { id: string }[]),
    };
    registerDbml({ languages });
    expect(languages.register).toHaveBeenCalledWith(
      expect.objectContaining({ id: DBML_LANGUAGE_ID }),
    );
    languages.getLanguages.mockReturnValue([{ id: DBML_LANGUAGE_ID }]);
    registerDbml({ languages });
    expect(languages.register).toHaveBeenCalledTimes(1);
  });
});
