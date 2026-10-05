/**
 * Plain-text forms of the skill's reports (027 `contracts/scripts-cli.md`), for people reading a
 * terminal. JSON stays the default for agents. Pure.
 */
import type { ProblemEntry, ProblemReport } from '@sododeck/model';

import type { DeckDiff } from './diff';
import type { DeckSummary } from './summary';

const LABEL = { error: 'ERROR', warning: 'WARN ', info: 'INFO ' } as const;

const plural = (n: number, word: string) => `${String(n)} ${word}${n === 1 ? '' : 's'}`;

function where(entry: ProblemEntry): string {
  if (entry.path !== undefined) return entry.path === '' ? '/' : entry.path;
  if (entry.line !== undefined) return `line ${String(entry.line)}:${String(entry.column ?? 1)}`;
  return '/';
}

export function entryText(entry: ProblemEntry): string {
  const subject = entry.subject === undefined ? '' : ` [${entry.subject}]`;
  return `${LABEL[entry.severity]} ${entry.code} ${where(entry)}${subject} ${entry.message}\n  fix: ${entry.fix}`;
}

export function reportText(report: ProblemReport): string {
  const { error, warning, info } = report.counts;
  const total = error + warning + info;
  if (total === 0) {
    return `OK: ${report.source.name} is a valid deck${report.status === 'opened' ? ' with no problems' : ''}.`;
  }
  const parts = [plural(error, 'error'), plural(warning, 'warning')];
  if (info > 0) parts.push(`${String(info)} info`);
  const lines = report.problems.map(entryText);
  if (report.omitted > 0) lines.push(`… and ${String(report.omitted)} more.`);
  const verdict = report.status === 'refused' ? ' The app would refuse this file.' : '';
  lines.push(`${plural(total, 'problem')}: ${parts.join(', ')}.${verdict}`);
  return lines.join('\n');
}

const SIGN = { added: '+', changed: '~', removed: '-' } as const;

export function diffText(diff: DeckDiff): string {
  const lines: string[] = [];
  if (diff.meta.length > 0) lines.push(`~ deck fields: ${diff.meta.join(', ')}`);
  for (const change of diff.changes) {
    const title = change.title === undefined ? '' : ` "${change.title}"`;
    let line = `${SIGN[change.change]} ${change.collection}/${change.id}${title}`;
    if (change.fields !== undefined) line += ` fields: ${change.fields.join(', ')}`;
    lines.push(line);
    for (const step of change.steps ?? []) {
      const fields = step.fields === undefined ? '' : ` fields: ${step.fields.join(', ')}`;
      lines.push(`    ${SIGN[step.change]} step ${step.id}${fields}`);
    }
  }
  const { added, changed, removed } = diff.counts;
  lines.push(
    added + changed + removed + diff.meta.length === 0
      ? 'No changes.'
      : `${String(added)} added, ${String(changed)} changed, ${String(removed)} removed.`,
  );
  return lines.join('\n');
}

export function summaryText(summary: DeckSummary, titles: ReadonlyMap<string, string>): string {
  const name = (id: string) => titles.get(id) ?? id;
  const t = summary.totals;
  const lines = [
    `Deck: ${summary.name}`,
    `${plural(t.cards, 'card')}, ${plural(t.connectors, 'connector')}, ${plural(t.groups, 'group')}, ${plural(t.flows, 'flow')}, ${plural(t.rules, 'rule')}, ${plural(t.views, 'view')}, ${plural(t.notes, 'note')}`,
  ];
  if (summary.levels.length > 1) {
    lines.push(
      `Levels: ${summary.levels
        .map(
          (level) =>
            `${level.parent === null ? 'top' : `under ${level.parent}`} ${String(level.cards)}`,
        )
        .join(' · ')}`,
    );
  }
  if (summary.groups.length > 0) {
    lines.push('', 'Groups:');
    for (const group of summary.groups) {
      const label = group.id === '' ? group.title : `${group.title} [${group.id}]`;
      lines.push(
        `  ${label}: ${group.cards.map((id) => `${name(id)} [${id}]`).join(', ') || '(empty)'}`,
      );
    }
  }
  if (summary.connectors.length > 0) {
    lines.push('', 'Connectors:');
    for (const edge of summary.connectors) {
      const label = edge.label === undefined ? '' : ` "${edge.label}"`;
      lines.push(`  [${edge.id}] ${edge.from} → ${edge.to}${label}`);
    }
  }
  for (const flow of summary.flows) {
    lines.push('', `Flow "${flow.title}" [${flow.id}]:`);
    for (const step of flow.steps) {
      const rules = step.rules === undefined ? '' : ` (rules: ${step.rules.join(', ')})`;
      lines.push(`  ${step.number}. ${step.from} → ${step.to} [${step.id}]${rules}`);
    }
  }
  if (summary.rules.length > 0) {
    lines.push('', 'Rules:');
    for (const rule of summary.rules) {
      const used = rule.usedBy.length === 0 ? 'unused' : `used by ${rule.usedBy.join(', ')}`;
      lines.push(`  "${rule.title}" [${rule.id}], ${used}`);
    }
  }
  const { error, warning } = summary.problems;
  if (error + warning > 0) {
    lines.push(
      '',
      `Problems: ${plural(error, 'error')}, ${plural(warning, 'warning')}; run lint for details.`,
    );
  }
  return lines.join('\n');
}
