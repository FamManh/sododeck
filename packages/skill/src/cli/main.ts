/**
 * The skill's command line (027 `contracts/scripts-cli.md`): validate, lint, summary, diff and
 * deliver. Bundled into `scripts/sododeck.mjs`; the entry files call `main` with their command.
 * Reads and writes only the files named on the command line and never touches the network.
 * Exit codes: 0 no error entries, 1 at least one error (or a file that cannot be loaded), 2 usage
 * or file-system error.
 */
import { randomBytes } from 'node:crypto';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

import { stringifyReport, type ProblemReport } from '@sododeck/model';

import { DETAILS, MODES, type AuthoringOptions, type Detail, type Mode } from '../authoring';
import { diffDecks } from '../diff';
import { outlineExcalidraw, outlineText } from '../excalidraw';
import { hasErrors, lintText, validateText } from '../lint';
import { summarizeDeck } from '../summary';
import { diffText, reportText, summaryText } from '../text';

export const COMMANDS = ['validate', 'lint', 'summary', 'diff', 'deliver', 'outline'] as const;
export type Command = (typeof COMMANDS)[number];

/** Set by the build (esbuild `define`); `dev` when the sources run directly (tests). */
declare const __SKILL_VERSION__: string | undefined;
const SKILL_VERSION = typeof __SKILL_VERSION__ === 'string' ? __SKILL_VERSION__ : 'dev';
export const APP_LABEL = `sododeck-deck-skill ${SKILL_VERSION}`;

export interface Io {
  out: (text: string) => void;
  err: (text: string) => void;
}

class UsageError extends Error {}

const USAGE: Record<Command, string> = {
  validate: 'validate <deck.sododeck> [--format json|text]',
  lint: 'lint <deck.sododeck> [--detail faithful|balanced|simplified] [--mode new|update|codebase|text] [--format json|text]',
  summary: 'summary <deck.sododeck> [--format text|json]',
  diff: 'diff <old.sododeck> <new.sododeck> [--format json|text]',
  deliver: 'deliver <draft.sododeck> <target.sododeck> [--detail …] [--mode …]',
  outline: 'outline <board.excalidraw> [--board "title"] [--min-text 13] [--format text|json]',
};

interface Parsed {
  files: string[];
  format: 'json' | 'text';
  options: AuthoringOptions;
  board?: string;
  minText?: number;
  help: boolean;
}

function parseArgs(command: Command, argv: readonly string[]): Parsed {
  const files: string[] = [];
  let format: 'json' | 'text' = command === 'summary' || command === 'outline' ? 'text' : 'json';
  const options: AuthoringOptions = {};
  let board: string | undefined;
  let minText: number | undefined;
  let help = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    const value = () => {
      const next = argv[i + 1];
      if (next === undefined) throw new UsageError(`${arg} needs a value.`);
      i += 1;
      return next;
    };
    if (arg === '--help' || arg === '-h') help = true;
    else if (arg === '--format') {
      const v = value();
      if (v !== 'json' && v !== 'text')
        throw new UsageError(`--format must be json or text, not "${v}".`);
      format = v;
    } else if (arg === '--detail') {
      const v = value();
      if (!DETAILS.includes(v as Detail))
        throw new UsageError(`--detail must be one of ${DETAILS.join(', ')}.`);
      options.detail = v as Detail;
    } else if (arg === '--mode') {
      const v = value();
      if (!MODES.includes(v as Mode))
        throw new UsageError(`--mode must be one of ${MODES.join(', ')}.`);
      options.mode = v as Mode;
    } else if (arg === '--board') board = value();
    else if (arg === '--min-text') {
      const v = Number(value());
      if (!Number.isFinite(v) || v <= 0)
        throw new UsageError('--min-text must be a positive number.');
      minText = v;
    } else if (arg.startsWith('-')) throw new UsageError(`Unknown option ${arg}.`);
    else files.push(arg);
  }
  const wanted = command === 'diff' || command === 'deliver' ? 2 : 1;
  if (!help && files.length !== wanted) {
    throw new UsageError(`Expected ${String(wanted)} file${wanted === 1 ? '' : 's'}.`);
  }
  return {
    files,
    format,
    options,
    ...(board === undefined ? {} : { board }),
    ...(minText === undefined ? {} : { minText }),
    help,
  };
}

async function read(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new UsageError(`Cannot read ${path}: ${reason}`);
  }
}

function printReport(io: Io, report: ProblemReport, format: 'json' | 'text'): void {
  io.out(format === 'json' ? stringifyReport(report) : reportText(report));
}

/** Writes `text` next to `target` and renames it over `target`, so `target` is never half written. */
async function replaceAtomically(target: string, text: string): Promise<void> {
  const temp = join(dirname(target), `.${basename(target)}.${randomBytes(4).toString('hex')}.tmp`);
  try {
    await writeFile(temp, text, 'utf8');
    await rename(temp, target);
  } catch (error) {
    await rm(temp, { force: true });
    const reason = error instanceof Error ? error.message : String(error);
    throw new UsageError(`Cannot write ${target}: ${reason}`);
  }
}

async function run(command: Command, parsed: Parsed, io: Io): Promise<number> {
  const [first = '', second = ''] = parsed.files;
  switch (command) {
    case 'validate': {
      const { report } = validateText(await read(first), basename(first), APP_LABEL);
      printReport(io, report, parsed.format);
      return hasErrors(report) ? 1 : 0;
    }
    case 'lint': {
      const { report } = lintText(await read(first), basename(first), APP_LABEL, parsed.options);
      printReport(io, report, parsed.format);
      return hasErrors(report) ? 1 : 0;
    }
    case 'summary': {
      const { report, file } = lintText(await read(first), basename(first), APP_LABEL);
      if (file === undefined) {
        printReport(io, report, parsed.format);
        return 1;
      }
      const summary = summarizeDeck(file, report);
      const titles = new Map(file.nodes.map((node) => [node.id, node.title]));
      io.out(
        parsed.format === 'json' ? JSON.stringify(summary, null, 2) : summaryText(summary, titles),
      );
      return 0;
    }
    case 'diff': {
      const before = validateText(await read(first), basename(first), APP_LABEL);
      const after = validateText(await read(second), basename(second), APP_LABEL);
      if (before.file === undefined || after.file === undefined) {
        for (const side of [before, after]) {
          if (side.file === undefined) printReport(io, side.report, parsed.format);
        }
        return 1;
      }
      const diff = diffDecks(before.file, after.file, basename(first), basename(second));
      io.out(parsed.format === 'json' ? JSON.stringify(diff, null, 2) : diffText(diff));
      return 0;
    }
    case 'outline': {
      let input: unknown;
      try {
        input = JSON.parse(await read(first));
      } catch (error) {
        if (error instanceof UsageError) throw error;
        throw new UsageError(`${first} is not a JSON whiteboard file.`);
      }
      const outline = outlineExcalidraw(input, {
        ...(parsed.board === undefined ? {} : { board: parsed.board }),
        ...(parsed.minText === undefined ? {} : { minTextSize: parsed.minText }),
      });
      io.out(parsed.format === 'json' ? JSON.stringify(outline, null, 2) : outlineText(outline));
      return 0;
    }
    case 'deliver': {
      const text = await read(first);
      const { report } = lintText(text, basename(first), APP_LABEL, parsed.options);
      // A clean delivery prints nothing but the stderr line: the agent already linted the draft.
      if (report.problems.length > 0) printReport(io, report, parsed.format);
      if (hasErrors(report)) {
        io.err(`Not delivered: fix the errors above; ${second} is unchanged.`);
        return 1;
      }
      await replaceAtomically(second, text);
      await rm(first, { force: true });
      io.err(`Delivered ${second}.`);
      return 0;
    }
  }
}

/** Runs one command; resolves to the exit code. Never throws for user input. */
export async function main(command: Command, argv: readonly string[], io: Io): Promise<number> {
  try {
    const parsed = parseArgs(command, argv);
    if (parsed.help) {
      io.out(`Usage: node ${command}.mjs ${USAGE[command].replace(/^\S+ /, '')}`);
      return 0;
    }
    return await run(command, parsed, io);
  } catch (error) {
    if (error instanceof UsageError) {
      io.err(`${error.message}\nUsage: node ${command}.mjs ${USAGE[command].replace(/^\S+ /, '')}`);
      return 2;
    }
    throw error;
  }
}

/** Entry point for the bundled scripts. */
export function runCli(command: Command): void {
  const io: Io = {
    out: (text) => process.stdout.write(`${text}\n`),
    err: (text) => process.stderr.write(`${text}\n`),
  };
  main(command, process.argv.slice(2), io).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      process.stderr.write(
        `Unexpected error: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
      );
      process.exitCode = 2;
    },
  );
}
