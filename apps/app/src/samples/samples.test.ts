import {
  checkDeck,
  checkIntegrity,
  fromJSON,
  isDbTable,
  serializeDeck,
  toJSON,
} from '@sododeck/model';
import { jsonSchema, parseSododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

/**
 * The bundled sample decks (049 US5). Every `*.sododeck.json` in this folder is checked the way
 * an imported file is: format, references, problems and a lossless round trip.
 */
const files = import.meta.glob<string>('./*.sododeck.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const samples = Object.entries(files).map(([path, text]) => {
  const name = path.replace('./', '').replace('.sododeck.json', '');
  return { name, text, deck: JSON.parse(text) as SododeckFile };
});

const byName = (name: string) => {
  const sample = samples.find((s) => s.name === name);
  if (sample === undefined) throw new Error(`Sample ${name} is missing`);
  return sample.deck;
};

const databaseCards = (deck: SododeckFile) => deck.nodes.filter((n) => n.type === 'database');
const ownedTables = (deck: SododeckFile, cardId: string) =>
  deck.nodes.filter((n) => isDbTable(n) && n.parent === cardId);
const touchingSteps = (deck: SododeckFile) =>
  deck.flows.flatMap((flow) => flow.steps).filter((step) => (step.touches?.length ?? 0) > 0);

/** Every free-text value of a deck: titles, names, descriptions, labels, notes. */
function texts(value: unknown, key = ''): string[] {
  if (typeof value === 'string') return key === 'dialect' || key === '$schema' ? [] : [value];
  if (Array.isArray(value)) return value.flatMap((item) => texts(item, key));
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => texts(v, k));
  }
  return [];
}

describe('sample decks (049 US5)', () => {
  it('ships Shop, SaaS auth and Blog', () => {
    expect(samples.map((s) => s.name).sort()).toEqual(['blog', 'saas-auth', 'shop']);
  });

  it.each(samples.map((s) => [s.name, s] as const))(
    '%s passes import validation and round-trips losslessly',
    (_name, { text, deck }) => {
      const parsed = parseSododeckFile(deck);
      expect(parsed.success ? [] : parsed.issues).toEqual([]);
      expect(checkIntegrity(deck)).toEqual([]);
      expect(checkDeck(deck).list).toEqual([]);
      expect(serializeDeck(toJSON(fromJSON(deck)))).toBe(text);
    },
  );

  it.each(samples.map((s) => [s.name, s.deck] as const))(
    '%s has database cards that own tables and a flow that touches them',
    (_name, deck) => {
      const cards = databaseCards(deck);
      expect(cards.length).toBeGreaterThan(0);
      for (const card of cards) expect(ownedTables(deck, card.id).length).toBeGreaterThan(0);
      expect(touchingSteps(deck).length).toBeGreaterThan(0);
    },
  );

  it('Shop has two database cards, a cross-database foreign key and a Checkout flow', () => {
    const shop = byName('shop');
    expect(databaseCards(shop).map((c) => c.title)).toEqual(['Orders DB', 'Customers DB']);
    const parentOf = new Map(shop.nodes.map((n) => [n.id, n.parent]));
    const crossing = shop.edges.filter(
      (e) =>
        (e.fromColumns?.length ?? 0) > 0 &&
        parentOf.get(e.from) !== undefined &&
        parentOf.get(e.to) !== undefined &&
        parentOf.get(e.from) !== parentOf.get(e.to),
    );
    expect(crossing.length).toBeGreaterThan(0);
    const checkout = shop.flows.find((f) => f.title === 'Checkout');
    expect(checkout?.steps.find((s) => s.title === 'Create order')?.touches).toEqual([
      { table: 'orders', access: 'write' },
      { table: 'order_items', access: 'write' },
      { table: 'customers', column: 'customers.email', access: 'read' },
    ]);
  });

  it('SaaS auth has a sign-up flow touching its tables', () => {
    const auth = byName('saas-auth');
    expect(auth.flows.map((f) => f.title)).toContain('Sign up');
    expect(touchingSteps(auth).length).toBeGreaterThan(1);
  });

  it('names no database product in its text (the dialect key aside)', () => {
    const products = (jsonSchema.$defs.Dialect.enum as readonly string[]).filter(
      (dialect) => dialect !== 'generic',
    );
    for (const { name, deck } of samples) {
      const found = texts(deck).filter((text) =>
        products.some((product) => text.toLowerCase().includes(product)),
      );
      expect(found, name).toEqual([]);
    }
  });
});
