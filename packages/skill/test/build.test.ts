import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CATALOGUE, isCode } from '@sododeck/model';
import { beforeAll, describe, expect, it } from 'vitest';

import { buildSkill } from '../scripts/build';
import { schemaFingerprint } from '../src/version';

const schemaText = readFileSync(
  fileURLToPath(import.meta.resolve('@sododeck/schema/v1.json')),
  'utf8',
);

let folder = '';

beforeAll(async () => {
  ({ folder } = await buildSkill(mkdtempSync(join(tmpdir(), 'sododeck-skill-build-'))));
});

const read = (path: string) => readFileSync(join(folder, path), 'utf8');

function script(name: string, ...args: string[]) {
  const result = spawnSync(process.execPath, [join(folder, 'scripts', `${name}.mjs`), ...args], {
    encoding: 'utf8',
  });
  return { code: result.status, out: result.stdout, err: result.stderr };
}

describe('built skill (027 FR-004, research R9)', () => {
  it('bundles the schema byte for byte and stamps its fingerprint', () => {
    expect(read('schema/v1.json')).toBe(schemaText);
    const stamp = JSON.parse(read('VERSION.json')) as {
      fingerprint: string;
      skill: string;
      formatVersion: number;
    };
    expect(stamp.fingerprint).toBe(schemaFingerprint(schemaText));
    expect(stamp.formatVersion).toBe(1);
    expect(read('SKILL.md')).toContain(stamp.skill);
  });

  it('leaves no placeholder unfilled', () => {
    for (const file of ['SKILL.md', 'references/modeling.md', 'references/scripts.md']) {
      expect(read(file)).not.toMatch(/\{\{\w+\}\}/);
    }
  });

  it('publishes only catalogue codes with the catalogue fix hints', () => {
    const rows = read('references/scripts.md').matchAll(
      /^\| `([a-z0-9-]+)` \| (\w+) \| [^|]+ \| (.+) \|$/gm,
    );
    let count = 0;
    for (const [, code = '', severity, fix = ''] of rows) {
      expect(isCode(code), code).toBe(true);
      if (!isCode(code)) continue;
      expect(severity).toBe(CATALOGUE[code].severity);
      expect(fix.replaceAll('\\|', '|')).toBe(CATALOGUE[code].fix);
      count += 1;
    }
    expect(count).toBeGreaterThan(20);
  });

  it('keeps SKILL.md short, with a name and description, and every reference it names exists', () => {
    const skill = read('SKILL.md');
    expect(skill.split('\n').length).toBeLessThan(500);
    expect(skill).toMatch(/^---\nname: sododeck-diagram\ndescription: >-\n/);
    const named = new Set([...skill.matchAll(/references\/([a-z-]+\.md)/g)].map((m) => m[1]));
    for (const name of [...skill.matchAll(/`([a-z-]+\.md)`/g)].map((m) => m[1])) named.add(name);
    named.delete('SKILL.md');
    expect(named.size).toBeGreaterThanOrEqual(7);
    for (const name of named)
      expect(existsSync(join(folder, 'references', name ?? '')), name).toBe(true);
  });

  it('ships a bundle with no network access', () => {
    const bundle = read('scripts/sododeck.mjs');
    expect(bundle).not.toMatch(/\bfetch\(/);
    expect(bundle).not.toMatch(/from\s*"(node:)?(http|https|net|tls|dgram|http2|undici)"/);
  });

  it('runs validate on an example (exit 0) and lint on a broken deck (exit 1)', () => {
    const ok = script('validate', join(folder, 'examples', 'checkout.sododeck'));
    expect(ok.code).toBe(0);
    expect(ok.err).toBe('');
    expect(JSON.parse(ok.out)).toMatchObject({
      report: 'sododeck-problems',
      app: expect.stringMatching(/^sododeck-diagram-skill 1\.0\.0\+[0-9a-f]{12}$/) as string,
    });

    const deck = JSON.parse(read('examples/checkout.sododeck')) as {
      flows: { steps: { edge: string }[] }[];
    };
    const step = deck.flows[0]?.steps[1];
    if (step !== undefined) step.edge = 'nope';
    const broken = join(mkdtempSync(join(tmpdir(), 'sododeck-skill-')), 'broken.sododeck');
    writeFileSync(broken, JSON.stringify(deck));
    const bad = script('lint', broken, '--format', 'text');
    expect(bad.code).toBe(1);
    expect(bad.out).toMatch(/^ERROR /m);
  });

  it('builds a byte-identical bundle every time', async () => {
    const again = await buildSkill(mkdtempSync(join(tmpdir(), 'sododeck-skill-build-')));
    const bundle = (dir: string) => readFileSync(join(dir, 'scripts', 'sododeck.mjs'));
    expect(bundle(again.folder).equals(bundle(folder))).toBe(true);
  });
});
