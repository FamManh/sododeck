import { describe, expect, it } from 'vitest';

import {
  checkSemanticRules,
  emptySododeckFile,
  jsonSchema,
  type Rule,
  type SododeckFile,
} from '../src';
import { ID_PATTERN } from '../src/semantic-rules';
import { readExample } from './schema-walk';

const full = readExample('full.sododeck.json') as SododeckFile;

function deckWithRule(rule: Rule): SododeckFile {
  return { ...emptySododeckFile(), rules: { 'R-1': rule } };
}

const tier: Rule = {
  title: 'Tier',
  hitPolicy: 'first',
  inputs: [
    { id: 'distance', label: 'Distance' },
    { id: 'weight', label: 'Weight' },
  ],
  outputs: [{ id: 'vehicle', label: 'Vehicle' }],
  rows: [
    { id: 'r1', when: ['≤ 5', '≤ 10'], then: ['Bike'] },
    { id: 'r2', when: ['> 5', ''], then: ['Van'] },
  ],
};

describe('checkSemanticRules', () => {
  it('uses the same id pattern as the published schema', () => {
    expect(ID_PATTERN.source).toBe(jsonSchema.$defs.Id.pattern);
  });

  it('accepts the full example and an empty file', () => {
    expect(checkSemanticRules(full)).toEqual([]);
    expect(checkSemanticRules(emptySododeckFile())).toEqual([]);
  });

  describe('S1: decision-table rows have one cell per column', () => {
    it('accepts matching rows, and tables with no rows or no columns', () => {
      expect(checkSemanticRules(deckWithRule(tier))).toEqual([]);
      expect(checkSemanticRules(deckWithRule({ ...tier, rows: [] }))).toEqual([]);
      expect(
        checkSemanticRules(
          deckWithRule({
            ...tier,
            inputs: [],
            outputs: [],
            rows: [{ id: 'r1', when: [], then: [] }],
          }),
        ),
      ).toEqual([]);
    });

    it('reports a row with too few when cells, naming the rule and the row', () => {
      const rows = [tier.rows[0], { id: 'r2', when: ['> 5'], then: ['Van'] }].filter(
        (row) => row !== undefined,
      );
      expect(checkSemanticRules(deckWithRule({ ...tier, rows }))).toEqual([
        {
          path: 'rules.R-1.rows.1.when',
          message: 'Rule "R-1" row "r2" has 1 "when" cell but 2 input columns.',
        },
      ]);
    });

    it('reports a row with too many then cells', () => {
      const rows = [{ id: 'r1', when: ['≤ 5', '≤ 10'], then: ['Bike', '45 min'] }];
      expect(checkSemanticRules(deckWithRule({ ...tier, rows }))).toEqual([
        {
          path: 'rules.R-1.rows.0.then',
          message: 'Rule "R-1" row "r1" has 2 "then" cells but 1 output column.',
        },
      ]);
    });
  });

  describe('S2: a sticky has an anchor or a position', () => {
    it('accepts free, anchored and anchored-with-offset stickies', () => {
      const file: SododeckFile = {
        ...emptySododeckFile(),
        stickies: [
          { id: 'a', text: 'free', position: { x: 0, y: 0 } },
          { id: 'b', text: 'anchored', anchor: 'n1' },
          { id: 'c', text: 'offset', anchor: 'n1', position: { x: 4, y: -4 } },
        ],
      };
      expect(checkSemanticRules(file)).toEqual([]);
    });

    it('reports a sticky with neither', () => {
      const file: SododeckFile = { ...emptySododeckFile(), stickies: [{ id: 'a', text: 'lost' }] };
      expect(checkSemanticRules(file)).toEqual([
        { path: 'stickies.0', message: 'Sticky "a" needs an anchor, a position, or both.' },
      ]);
    });
  });

  describe('S3: map keys are valid ids', () => {
    const badKey = 'not an id';

    it('reports a bad key in rules', () => {
      const file: SododeckFile = { ...emptySododeckFile(), rules: { [badKey]: tier } };
      expect(checkSemanticRules(file).map((issue) => issue.path)).toEqual([`rules.${badKey}`]);
    });

    it('reports a bad key in view positions', () => {
      const file: SododeckFile = {
        ...emptySododeckFile(),
        views: [{ id: 'v', type: 'custom', title: 'V', positions: { [badKey]: { x: 0, y: 0 } } }],
      };
      expect(checkSemanticRules(file).map((issue) => issue.path)).toEqual([
        `views.0.positions.${badKey}`,
      ]);
    });

    it('reports bad keys at both levels of step ruleInputs', () => {
      const file: SododeckFile = {
        ...emptySododeckFile(),
        flows: [
          {
            id: 'f',
            title: 'F',
            steps: [{ id: 's', edge: 'e', ruleInputs: { [badKey]: {}, 'R-1': { [badKey]: 'x' } } }],
          },
        ],
      };
      expect(checkSemanticRules(file).map((issue) => issue.path)).toEqual([
        `flows.0.steps.0.ruleInputs.${badKey}`,
        `flows.0.steps.0.ruleInputs.R-1.${badKey}`,
      ]);
    });

    it('explains what a valid id is', () => {
      const file: SododeckFile = { ...emptySododeckFile(), rules: { [badKey]: tier } };
      expect(checkSemanticRules(file)[0]?.message).toBe(
        `Key "${badKey}" is not a valid id (1–64 letters, digits, "-", "_", "." or ":").`,
      );
    });
  });
});
