import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { main, type Command } from '../src/cli/main';
import { example, exampleText, text } from './fixtures';

async function run(command: Command, ...args: string[]) {
  let out = '';
  let err = '';
  const code = await main(command, args, {
    out: (t) => (out += `${t}\n`),
    err: (t) => (err += `${t}\n`),
  });
  return { code, out, err };
}

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'sododeck-skill-'));
}

function broken(): string {
  const file = example('checkout.sododeck');
  const step = file.flows[0]?.steps[1];
  if (step !== undefined) step.edge = 'nope';
  return text(file);
}

describe('skill command line (027 contracts/scripts-cli.md)', () => {
  it('validate prints a JSON report and exits 0 for a clean deck', async () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'ok.sododeck'), exampleText('checkout.sododeck'));
    const { code, out } = await run('validate', join(dir, 'ok.sododeck'));
    expect(code).toBe(0);
    expect(JSON.parse(out)).toMatchObject({
      report: 'sododeck-problems',
      source: { name: 'ok.sododeck' },
    });
  });

  it('lint exits 1 on errors and prints readable text on request', async () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'bad.sododeck'), broken());
    const json = await run('lint', join(dir, 'bad.sododeck'));
    expect(json.code).toBe(1);
    expect((JSON.parse(json.out) as { counts: { error: number } }).counts.error).toBeGreaterThan(0);
    const plain = await run('lint', join(dir, 'bad.sododeck'), '--format', 'text');
    expect(plain.out).toMatch(/^ERROR \S+ \/flows\/0\/steps\/1/m);
    expect(plain.out).toMatch(/^ {2}fix: /m);
  });

  it('exits 2 with usage for bad arguments or missing files', async () => {
    expect((await run('lint')).code).toBe(2);
    expect((await run('lint', 'a', '--detail', 'huge')).err).toMatch(/--detail must be one of/);
    const missing = await run('validate', '/nope/deck.sododeck');
    expect(missing.code).toBe(2);
    expect(missing.err).toMatch(/Cannot read/);
    expect(missing.out).toBe('');
  });

  it('prints help', async () => {
    const help = await run('diff', '--help');
    expect(help.code).toBe(0);
    expect(help.out).toMatch(/Usage: node diff\.mjs <old\.sododeck> <new\.sododeck>/);
  });

  it('summary prints an outline by default', async () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'p.sododeck'), exampleText('platform.sododeck'));
    const { code, out } = await run('summary', join(dir, 'p.sododeck'));
    expect(code).toBe(0);
    expect(out).toContain('Deck: Delivery platform');
  });

  it('diff compares two files', async () => {
    const dir = tempDir();
    const after = example('checkout.sododeck');
    after.nodes.push({ id: 'refunds', type: 'service', title: 'Refunds' });
    writeFileSync(join(dir, 'a.sododeck'), exampleText('checkout.sododeck'));
    writeFileSync(join(dir, 'b.sododeck'), text(after));
    const { code, out } = await run(
      'diff',
      join(dir, 'a.sododeck'),
      join(dir, 'b.sododeck'),
      '--format',
      'text',
    );
    expect(code).toBe(0);
    expect(out).toBe('+ nodes/refunds "Refunds"\n1 added, 0 changed, 0 removed.\n');
  });

  it('deliver leaves the target untouched when the draft has errors', async () => {
    const dir = tempDir();
    const target = join(dir, 'deck.sododeck');
    const draft = join(dir, 'draft.sododeck');
    writeFileSync(target, 'GOOD');
    writeFileSync(draft, broken());
    const { code, err } = await run('deliver', draft, target);
    expect(code).toBe(1);
    expect(err).toMatch(/Not delivered/);
    expect(readFileSync(target, 'utf8')).toBe('GOOD');
    expect(existsSync(draft)).toBe(true);
  });

  it('deliver replaces the target with a clean draft and removes the draft', async () => {
    const dir = tempDir();
    const target = join(dir, 'deck.sododeck');
    const draft = join(dir, 'draft.sododeck');
    writeFileSync(target, 'OLD');
    writeFileSync(draft, exampleText('platform.sododeck'));
    const { code, out, err } = await run('deliver', draft, target);
    expect(code).toBe(0);
    expect(out).toBe('');
    expect(err).toMatch(/Delivered/);
    expect(readFileSync(target, 'utf8')).toBe(exampleText('platform.sododeck'));
    expect(existsSync(draft)).toBe(false);
  });
});
