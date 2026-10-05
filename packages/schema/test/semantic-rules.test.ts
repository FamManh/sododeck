import { describe, expect, it } from 'vitest';

import {
  checkSemanticRules,
  emptySododeckFile,
  FORMAT_RULE_CODES,
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
      expect(checkSemanticRules(deckWithRule({ ...tier, rows }))).toMatchObject([
        {
          path: '/rules/R-1/rows/1/when',
          message: 'Rule "R-1" row "r2" has 1 "when" cell but 2 input columns.',
        },
      ]);
    });

    it('reports a row with too many then cells', () => {
      const rows = [{ id: 'r1', when: ['≤ 5', '≤ 10'], then: ['Bike', '45 min'] }];
      expect(checkSemanticRules(deckWithRule({ ...tier, rows }))).toMatchObject([
        {
          path: '/rules/R-1/rows/0/then',
          message: 'Rule "R-1" row "r1" has 2 "then" cells but 1 output column.',
        },
      ]);
    });
  });

  describe('S2: a sticky has a position (or a legacy anchor)', () => {
    it('accepts free stickies and, for older files, anchored ones (ADR 0041)', () => {
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
        {
          code: 'sticky-placement',
          path: '/stickies/0',
          message: 'Sticky "a" needs a position.',
          subject: 'a',
        },
      ]);
    });
  });

  it('gives every issue a format-rule code (062)', () => {
    const file: SododeckFile = {
      ...emptySododeckFile(),
      rules: { 'not an id': tier },
      stickies: [{ id: 'a', text: 'lost' }],
      tagColors: { '': 'red' },
    };
    expect(checkSemanticRules(file).map((issue) => issue.code)).toEqual([
      'map-key-id',
      'tag-color-key',
      'sticky-placement',
    ]);
    for (const issue of checkSemanticRules(file)) {
      expect(FORMAT_RULE_CODES).toContain(issue.code);
    }
  });

  describe('S3: map keys are valid ids', () => {
    const badKey = 'not an id';

    it('reports a bad key in rules', () => {
      const file: SododeckFile = { ...emptySododeckFile(), rules: { [badKey]: tier } };
      expect(checkSemanticRules(file).map((issue) => issue.path)).toEqual([`/rules/${badKey}`]);
    });

    it('reports a bad key in view positions', () => {
      const file: SododeckFile = {
        ...emptySododeckFile(),
        views: [{ id: 'v', type: 'custom', title: 'V', positions: { [badKey]: { x: 0, y: 0 } } }],
      };
      expect(checkSemanticRules(file).map((issue) => issue.path)).toEqual([
        `/views/0/positions/${badKey}`,
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
        `/flows/0/steps/0/ruleInputs/${badKey}`,
        `/flows/0/steps/0/ruleInputs/R-1/${badKey}`,
      ]);
    });

    it('explains what a valid id is', () => {
      const file: SododeckFile = { ...emptySododeckFile(), rules: { [badKey]: tier } };
      expect(checkSemanticRules(file)[0]?.message).toBe(
        `Key "${badKey}" is not a valid id (1–64 letters, digits, "-", "_", "." or ":").`,
      );
    });
  });

  describe('S8: tagColors keys are non-empty and unique ignoring case (033)', () => {
    const withColors = (tagColors: Record<string, string>): SododeckFile => ({
      ...emptySododeckFile(),
      tagColors,
    });

    it('accepts distinct keys, case-only variants kept apart by other letters, and no map', () => {
      expect(checkSemanticRules(withColors({ PCI: 'violet', 'pci-dss': 'red' }))).toEqual([]);
      expect(checkSemanticRules(emptySododeckFile())).toEqual([]);
    });

    it('reports an empty key and a key of spaces', () => {
      expect(checkSemanticRules(withColors({ '': 'red' }))).toMatchObject([
        { path: '/tagColors/', message: 'Tag colour key "" is empty.' },
      ]);
      expect(checkSemanticRules(withColors({ '  ': 'red' }))).toMatchObject([
        { path: '/tagColors/  ', message: 'Tag colour key "  " is empty.' },
      ]);
    });

    it('reports the second of two keys equal ignoring case, spacing and edges', () => {
      expect(checkSemanticRules(withColors({ PCI: 'violet', pci: 'red' }))).toMatchObject([
        {
          path: '/tagColors/pci',
          message: 'Tag colour key "pci" is the same tag as "PCI" (case and spacing are ignored).',
        },
      ]);
      expect(
        checkSemanticRules(withColors({ 'Pci dss': 'violet', ' pci   DSS ': 'red' })).map(
          (issue) => issue.path,
        ),
      ).toEqual(['/tagColors/ pci   DSS ']);
    });
  });

  describe('S9–S11: connector anchors and bends (022)', () => {
    const withRoute = (
      route: NonNullable<SododeckFile['edges'][number]['route']>,
    ): SododeckFile => {
      const edge = full.edges[1];
      if (edge === undefined) throw new Error('full example has no second edge');
      return { ...full, edges: [{ ...edge, route }] };
    };

    it('accepts anchors with their sides, free bends, and either alone', () => {
      expect(
        checkSemanticRules(
          withRoute({
            fromSide: 'right',
            fromAt: 0,
            toSide: 'left',
            toAt: 1,
            waypoints: [
              { x: 0.5, y: 0.5 },
              { dx: 3, dy: -3 },
            ],
          }),
        ),
      ).toEqual([]);
      expect(checkSemanticRules(withRoute({ offset: 10 }))).toEqual([]);
    });

    it('S9 reports an anchor without its side', () => {
      expect(
        checkSemanticRules(withRoute({ fromAt: 0.2, toSide: 'top', toAt: 0.2 })),
      ).toMatchObject([
        {
          path: '/edges/0/route/fromAt',
          message: 'Connector "e2" has a "fromAt" position but no "fromSide".',
        },
      ]);
      expect(checkSemanticRules(withRoute({ toAt: 0.2 }))[0]?.path).toBe('/edges/0/route/toAt');
    });

    it('S10 reports offset together with waypoints', () => {
      expect(
        checkSemanticRules(withRoute({ offset: 4, waypoints: [{ x: 0.5, y: 0.5 }] })),
      ).toMatchObject([
        {
          path: '/edges/0/route',
          message: 'Connector "e2" route has both "offset" and "waypoints"; use one.',
        },
      ]);
    });

    it('S11 reports a waypoint with two keys or none on an axis', () => {
      expect(
        checkSemanticRules(withRoute({ waypoints: [{ x: 0.5, dx: 1, y: 0.5 }, { y: 0.5 }] })).map(
          (issue) => issue.path,
        ),
      ).toEqual(['/edges/0/route/waypoints/0', '/edges/0/route/waypoints/1']);
      expect(
        checkSemanticRules(withRoute({ waypoints: [{ x: 0.5, y: 1, dy: 2 }] }))[0],
      ).toMatchObject({
        path: '/edges/0/route/waypoints/0',
        message: 'Bend 1 of "e2" needs exactly one of "y" and "dy".',
      });
    });
  });

  describe('S12 / S13: typed fields (032)', () => {
    const withFields = (fields: unknown[], values?: Record<string, unknown>): SododeckFile =>
      ({
        ...emptySododeckFile(),
        fields,
        nodes: values === undefined ? [] : [{ id: 'n1', type: 'task', title: 'A', values }],
      }) as SododeckFile;

    it('accepts fields of every kind with their own keys, and built-ins with their kinds', () => {
      expect(
        checkSemanticRules(
          withFields([
            { id: 'n', name: 'N', kind: 'number', unit: 'h' },
            {
              id: 's',
              name: 'S',
              kind: 'status',
              options: [
                { id: 'a', label: 'A', icon: 'circle' },
                { id: 'b', label: 'B', icon: 'circle-check' },
              ],
            },
            { id: 'sel', name: 'Sel', kind: 'select', options: [{ id: 'a', label: 'A' }] },
            { id: 'tech', name: 'Tech', kind: 'text' },
            { id: 'host', name: 'Host', kind: 'text' },
            { id: 'owner', name: 'Owner', kind: 'person' },
          ]),
        ),
      ).toEqual([]);
    });

    it('S12 reports a field id used twice', () => {
      expect(
        checkSemanticRules(
          withFields([
            { id: 'f', name: 'A', kind: 'text' },
            { id: 'f', name: 'B', kind: 'text' },
          ]),
        ),
      ).toMatchObject([
        { path: '/fields/1/id', message: 'Field id "f" is used by more than one field.' },
      ]);
    });

    it('S12 reports a built-in field with another kind', () => {
      expect(
        checkSemanticRules(withFields([{ id: 'owner', name: 'Owner', kind: 'text' }])),
      ).toMatchObject([
        { path: '/fields/0/kind', message: 'Built-in field "owner" must have kind "person".' },
      ]);
      expect(
        checkSemanticRules(withFields([{ id: 'tech', name: 'Tech', kind: 'select' }]))[0]?.path,
      ).toBe('/fields/0/kind');
    });

    it('S12 reports a unit outside number fields and options outside select / status', () => {
      expect(
        checkSemanticRules(
          withFields([
            { id: 'a', name: 'A', kind: 'progress', unit: '%' },
            { id: 'b', name: 'B', kind: 'text', options: [] },
          ]),
        ),
      ).toMatchObject([
        {
          path: '/fields/0/unit',
          message: 'Field "a" has a unit, but only number fields have one.',
        },
        {
          path: '/fields/1/options',
          message: 'Field "b" has options, but only select and status fields have them.',
        },
      ]);
    });

    it('S12 reports duplicate option ids and icons on select options', () => {
      expect(
        checkSemanticRules(
          withFields([
            {
              id: 'f',
              name: 'F',
              kind: 'select',
              options: [
                { id: 'a', label: 'A', icon: 'eye' },
                { id: 'a', label: 'B' },
              ],
            },
          ]),
        ),
      ).toMatchObject([
        {
          path: '/fields/0/options/0/icon',
          message: 'Option "a" of field "f" has an icon, but only status options have one.',
        },
        {
          path: '/fields/0/options/1/id',
          message: 'Option id "a" is used twice in field "f".',
        },
      ]);
    });

    it('S13 reports built-in ids in values and keys that are not ids', () => {
      expect(checkSemanticRules(withFields([], { tech: 'Go', 'a b': 'x', ok: 1 }))).toMatchObject([
        {
          path: '/nodes/0/values/a b',
          message: 'Key "a b" is not a valid id (1–64 letters, digits, "-", "_", "." or ":").',
        },
        {
          path: '/nodes/0/values/tech',
          message: 'Card "n1" stores built-in field "tech" in values; use its own key.',
        },
      ]);
    });

    it('keeps dangling values valid (missing field, missing option, wrong shape)', () => {
      expect(
        checkSemanticRules(
          withFields([{ id: 'p', name: 'P', kind: 'progress' }], { p: 140, gone: 'x' }),
        ),
      ).toEqual([]);
    });
  });

  describe('S14: a column has at most one default (040)', () => {
    const table = (columns: unknown[]) =>
      ({
        ...emptySododeckFile(),
        nodes: [{ id: 't', type: 'db-table', title: 't', columns }],
      }) as SododeckFile;

    it('accepts a value default, an expression default or none', () => {
      expect(
        checkSemanticRules(
          table([
            { id: 'a', name: 'a', type: 'int', default: 0 },
            { id: 'b', name: 'b', type: 'timestamptz', defaultExpr: 'now()' },
            { id: 'c', name: 'c', type: 'text' },
          ]),
        ),
      ).toEqual([]);
    });

    it('reports a column with both default and defaultExpr', () => {
      expect(
        checkSemanticRules(
          table([
            { id: 'a', name: 'a', type: 'int' },
            { id: 'b', name: 'b', type: 'int', default: false, defaultExpr: 'now()' },
          ]),
        ),
      ).toMatchObject([
        {
          path: '/nodes/0/columns/1/defaultExpr',
          message: 'Column "b" has both a default value and a default expression; keep one.',
        },
      ]);
    });
  });
  describe('S15: a step touches a table or column once (049)', () => {
    const deck = (touches: unknown[]) =>
      ({
        ...emptySododeckFile(),
        flows: [{ id: 'f', title: 'f', steps: [{ id: 's', edge: 'e', touches }] }],
      }) as SododeckFile;

    it('accepts a table touch next to touches of its columns', () => {
      expect(
        checkSemanticRules(
          deck([
            { table: 't', access: 'write' },
            { table: 't', column: 'c', access: 'read' },
            { table: 't', column: 'd', access: 'write' },
          ]),
        ),
      ).toEqual([]);
    });

    it('reports a second touch of the same table or column', () => {
      expect(
        checkSemanticRules(
          deck([
            { table: 't', access: 'write' },
            { table: 't', column: 'c', access: 'read' },
            { table: 't', access: 'read' },
            { table: 't', column: 'c', access: 'write' },
          ]),
        ),
      ).toMatchObject([
        {
          path: '/flows/0/steps/0/touches/2',
          message: 'Step "s" touches table "t" twice; keep one entry.',
        },
        {
          path: '/flows/0/steps/0/touches/3',
          message: 'Step "s" touches column "c" of table "t" twice; keep one entry.',
        },
      ]);
    });
  });

  describe('images (055, I1 to I6)', () => {
    const ID = 'a'.repeat(64);
    const asset = (bytes: number, data: string) => ({
      type: 'image/png' as const,
      bytes,
      width: 1,
      height: 1,
      name: 'a.png',
      data,
    });
    function deckWith(images: SododeckFile['images'], assets: SododeckFile['assets']) {
      return {
        ...emptySododeckFile(),
        nodes: [{ id: 'n1', type: 'service', title: 'A' }],
        groups: [{ id: 'g1', title: 'G' }],
        stickies: [{ id: 's1', text: 'x', position: { x: 0, y: 0 } }],
        images,
        assets,
      };
    }
    const image = (over: object = {}) => ({
      id: 'i1',
      asset: ID,
      position: { x: 0, y: 0 },
      size: { width: 40, height: 40 },
      ...over,
    });

    it('accepts an image, its asset, a group and an unused asset', () => {
      expect(
        checkSemanticRules(deckWith([image({ group: 'g1' })], { [ID]: asset(3, 'AAAA') })),
      ).toEqual([]);
      expect(checkSemanticRules(deckWith(undefined, { [ID]: asset(3, 'AAAA') }))).toEqual([]);
    });

    it('reports an asset that is missing (I1)', () => {
      expect(checkSemanticRules(deckWith([image()], {}))[0]?.path).toBe('/images/0/asset');
    });

    it('reports a group that is missing (I3) and an id that clashes (I5)', () => {
      const assets = { [ID]: asset(3, 'AAAA') };
      expect(checkSemanticRules(deckWith([image({ group: 'x' })], assets))[0]?.path).toBe(
        '/images/0/group',
      );
      for (const id of ['n1', 'g1', 's1']) {
        expect(checkSemanticRules(deckWith([image({ id })], assets))[0]?.path).toBe('/images/0/id');
      }
      expect(
        checkSemanticRules(deckWith([image(), image()], assets)).map((issue) => issue.path),
      ).toEqual(['/images/1/id']);
    });

    it('reports a size below 32 px on each side (I6)', () => {
      const assets = { [ID]: asset(3, 'AAAA') };
      const paths = checkSemanticRules(
        deckWith([image({ size: { width: 31, height: 10 } })], assets),
      ).map((issue) => issue.path);
      expect(paths).toEqual(['/images/0/size/width', '/images/0/size/height']);
    });

    it('reports data that does not decode to the stated bytes, or is not padded (I4)', () => {
      expect(checkSemanticRules(deckWith([], { [ID]: asset(4, 'AAAA') }))[0]?.path).toBe(
        `/assets/${ID}/data`,
      );
      expect(checkSemanticRules(deckWith([], { [ID]: asset(2, 'AAA') }))[0]?.path).toBe(
        `/assets/${ID}/data`,
      );
      expect(checkSemanticRules(deckWith([], { [ID]: asset(1, 'AA==') }))).toEqual([]);
      expect(checkSemanticRules(deckWith([], { [ID]: asset(2, 'AAA=') }))).toEqual([]);
    });

    it('reports an assets key that is not a picture id', () => {
      expect(checkSemanticRules(deckWith([], { Big: asset(3, 'AAAA') }))[0]?.path).toBe(
        '/assets/Big',
      );
    });
  });
});
