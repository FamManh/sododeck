import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { analyzeFlow } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import { lintText, validateText } from '../src/lint';

const dir = fileURLToPath(new URL('../examples/', import.meta.url));
const examples = readdirSync(dir).filter((name) => name.endsWith('.sododeck'));

describe('example decks (027 FR-003, FR-025)', () => {
  it('ships at least three examples', () => {
    expect(examples.length).toBeGreaterThanOrEqual(3);
  });

  for (const name of examples) {
    const text = readFileSync(`${dir}${name}`, 'utf8');

    it(`${name} passes validate and lint with no entries`, () => {
      expect(validateText(text, name, 'test').report.problems).toEqual([]);
      expect(lintText(text, name, 'test').report.problems).toEqual([]);
    });

    it(`${name} plays every flow from first to last step`, () => {
      const { file } = lintText(text, name, 'test');
      expect(file).toBeDefined();
      for (const flow of file?.flows ?? []) {
        const analysis = analyzeFlow(flow, file?.edges ?? []);
        expect(analysis.canFinish, flow.id).toBe(true);
        expect(analysis.problems, flow.id).toEqual([]);
      }
    });

    it(`${name} places every card and note by hand`, () => {
      const { file } = lintText(text, name, 'test');
      expect(file?.nodes.every((node) => node.position !== undefined)).toBe(true);
      expect(file?.stickies.every((sticky) => sticky.position !== undefined)).toBe(true);
    });
  }
});
