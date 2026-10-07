import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const read = (name: string): unknown =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../${name}`, import.meta.url)), 'utf8'));

interface Manifest {
  id: string;
  name: string;
  version: string;
  minAppVersion: string;
  description: string;
  isDesktopOnly: boolean;
}

const manifest = read('manifest.json') as Manifest;
const versions = read('versions.json') as Record<string, string>;
const pkg = read('package.json') as { version: string };

describe('release files (US7, FR-039)', () => {
  it('versions.json maps the manifest version to its minimum app version', () => {
    expect(versions[manifest.version]).toBe(manifest.minAppVersion);
    for (const [version, min] of Object.entries(versions)) {
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(min).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it('the package version follows the manifest', () => {
    expect(pkg.version).toBe(manifest.version);
  });

  it('the id has no forbidden word and the description follows the list rules', () => {
    expect(manifest.id).toBe('sododeck');
    expect(manifest.id.toLowerCase()).not.toContain('obsidian');
    expect(manifest.name.toLowerCase()).not.toContain('obsidian');
    expect(manifest.description).not.toMatch(/^this is a plugin/i);
    expect(manifest.description.length).toBeLessThanOrEqual(250);
    expect(manifest.description.endsWith('.')).toBe(true);
  });

  it('works on mobile, as the plan decided (nothing desktop-only is used)', () => {
    expect(manifest.isDesktopOnly).toBe(false);
  });

  it('claims no more than the API used needs (getAvailablePathForAttachment is 1.5.7)', () => {
    expect(manifest.minAppVersion).toBe('1.5.7');
  });
});
