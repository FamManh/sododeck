/**
 * Fills the `{{placeholders}}` of the skill's Markdown sources with facts from the packages
 * (027 research R7): card types, problem codes and the version stamp. Prose stays hand-written;
 * the facts that would rot in a hand-kept copy are generated. Pure.
 */
import { CARD_TYPES, CATALOGUE, PACKS, type Code, type CodeFamily } from '@sododeck/model';

import type { VersionStamp } from './version';

const cell = (text: string) => text.replaceAll('|', '\\|');

export function cardTypesTable(): string {
  const lines = ['| Type id | Name | Pack | Kind |', '| --- | --- | --- | --- |'];
  for (const type of CARD_TYPES) {
    const pack = PACKS.find((p) => p.id === type.pack)?.name ?? type.pack;
    const kind = type.family === 'shape' ? 'shape (plain outline)' : 'card';
    lines.push(
      `| \`${type.id}\` | ${cell(type.name)} | ${cell(pack)} (\`${type.pack}\`) | ${kind} |`,
    );
  }
  return lines.join('\n');
}

export function codesTable(family: CodeFamily): string {
  const lines = ['| Code | Severity | Title | Fix |', '| --- | --- | --- | --- |'];
  for (const code of Object.keys(CATALOGUE) as Code[]) {
    const entry = CATALOGUE[code];
    if (entry.family !== family || entry.retired === true) continue;
    lines.push(`| \`${code}\` | ${entry.severity} | ${cell(entry.title)} | ${cell(entry.fix)} |`);
  }
  return lines.join('\n');
}

export function placeholders(stamp: VersionStamp): Readonly<Record<string, string>> {
  return {
    skillVersion: stamp.skill,
    formatVersion: String(stamp.formatVersion),
    fingerprint: stamp.fingerprint,
    cardTypes: cardTypesTable(),
    deckCodes: codesTable('deck'),
    authoringCodes: codesTable('authoring'),
  };
}

/** Replaces every `{{name}}`; an unknown name throws, so a typo never ships as literal text. */
export function fill(
  source: string,
  values: Readonly<Record<string, string>>,
  file = 'source',
): string {
  return source.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => {
    const value = values[name];
    if (value === undefined) throw new Error(`${file}: unknown placeholder {{${name}}}`);
    return value;
  });
}
