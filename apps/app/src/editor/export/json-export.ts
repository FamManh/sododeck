import { serializeDeck } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';

/** Removes optional knowledge fields while retaining every structural reference. */
export function withoutKnowledge(file: SododeckFile): SododeckFile {
  const { description: _description, ...deck } = file;
  return {
    ...deck,
    nodes: file.nodes.map(({ description: _d, links: _l, rules: _r, ...node }) => node),
    groups: file.groups.map(({ description: _d, ...group }) => group),
    edges: file.edges.map(({ description: _d, links: _l, ...edge }) => edge),
    features: file.features.map(({ description: _d, ...feature }) => feature),
    flows: file.flows.map(({ description: _d, links: _l, ...flow }) => ({
      ...flow,
      branches: flow.branches?.map(({ description: _bd, ...branch }) => branch),
      steps: flow.steps.map(
        ({ description: _sd, links: _sl, rules: _sr, ruleInputs: _si, ...step }) => step,
      ),
    })),
    rules: {},
  };
}

/**
 * The `.sododeck.json` text. `pictures` are the bytes of the pictures the images use (055): the
 * file embeds them, "without notes" included, and a picture without bytes is written as missing.
 */
export function jsonExport(
  file: SododeckFile,
  options: { includeKnowledge: boolean; pretty: boolean },
  pictures: ReadonlyMap<string, Uint8Array> = new Map(),
): { text: string; bytes: number } {
  const canonical = serializeDeck(
    options.includeKnowledge ? file : withoutKnowledge(file),
    pictures,
  );
  const text = options.pretty ? canonical : JSON.stringify(JSON.parse(canonical));
  return { text, bytes: new TextEncoder().encode(text).byteLength };
}
