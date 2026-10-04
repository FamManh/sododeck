/** A deck built from DBML text through the import pipeline (046 tests). Test-only. */
import { createDeck, createEditor, toJSON } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';

import { applyImport } from '../../import/apply-import';
import { createParsers } from '../../import/load-parsers';
import { runImport } from '../../import/pipeline';
import { readDbml } from '../../import/read-dbml';
import type { ImportTarget, RawSchema } from '../../import/types';

const EMPTY: ImportTarget = {
  kind: 'deck',
  deckDialect: 'generic',
  deckHasTables: false,
  deckHasDescription: false,
  tableNames: [],
  enumNames: [],
};

const parsers = createParsers();

/** Imports `text` into an empty deck (positions: none). */
export async function deckFromDbml(text: string, name = 'Test'): Promise<SododeckFile> {
  const { plan, preview } = await runImport(
    { text, format: 'dbml', dialect: 'auto', detectFk: false },
    EMPTY,
    parsers,
  );
  if (preview.error !== undefined) throw new Error(preview.error.message);
  const doc = createDeck();
  const editor = createEditor(doc);
  editor.updateMeta({ name });
  applyImport(editor, plan, {
    positions: {},
    frames: {},
    stickies: plan.stickies.map((_, i) => ({ x: i * 224, y: -200 })),
  });
  const file = toJSON(doc);
  editor.destroy();
  // The import places nothing without a layout; give every table a position so placement tests work.
  return {
    ...file,
    nodes: file.nodes.map((n, i) => ({
      ...n,
      position: n.position ?? { x: (i % 5) * 300, y: Math.floor(i / 5) * 400 },
    })),
  };
}

/** Parses DBML text to the raw schema the planner takes. */
export async function readRaw(text: string): Promise<RawSchema> {
  return readDbml(text, await parsers.dbml()).raw;
}
