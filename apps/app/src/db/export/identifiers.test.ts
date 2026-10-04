import { describe, expect, it } from 'vitest';

import {
  dbmlIdent,
  dbmlString,
  mermaidName,
  mermaidText,
  mermaidType,
  qualified,
  sqlIdent,
  sqlString,
} from './identifiers';

describe('sqlIdent', () => {
  it('leaves plain lower-case names bare', () => {
    expect(sqlIdent('order_items', 'postgres')).toBe('order_items');
    expect(sqlIdent('_x1', 'mysql')).toBe('_x1');
  });

  it('quotes reserved, mixed-case and spaced names per dialect', () => {
    expect(sqlIdent('order', 'postgres')).toBe('"order"');
    expect(sqlIdent('order', 'sqlite')).toBe('"order"');
    expect(sqlIdent('order', 'mysql')).toBe('`order`');
    expect(sqlIdent('UserId', 'postgres')).toBe('"UserId"');
    expect(sqlIdent('order items', 'mysql')).toBe('`order items`');
    expect(sqlIdent('1st', 'postgres')).toBe('"1st"');
  });

  it('doubles the quote character inside', () => {
    expect(sqlIdent('a"b', 'postgres')).toBe('"a""b"');
    expect(sqlIdent('a`b', 'mysql')).toBe('`a``b`');
  });
});

describe('qualified', () => {
  it('qualifies only when there is a schema', () => {
    expect(qualified(null, 'orders', 'postgres')).toBe('orders');
    expect(qualified('billing', 'order', 'postgres')).toBe('billing."order"');
    expect(qualified('Billing', 'x', 'mysql')).toBe('`Billing`.x');
  });
});

describe('sqlString', () => {
  it('doubles quotes, and backslashes on MySQL', () => {
    expect(sqlString("it's", 'postgres')).toBe("'it''s'");
    expect(sqlString('a\\b', 'postgres')).toBe("'a\\b'");
    expect(sqlString('a\\b', 'mysql')).toBe("'a\\\\b'");
  });
});

describe('DBML', () => {
  it('quotes names that are not identifiers', () => {
    expect(dbmlIdent('UserId')).toBe('UserId');
    expect(dbmlIdent('order items')).toBe('"order items"');
  });

  it('escapes strings and uses triple quotes across lines', () => {
    expect(dbmlString("it's")).toBe("'it\\'s'");
    expect(dbmlString('a\nb')).toBe("'''a\nb'''");
  });
});

describe('Mermaid', () => {
  it('makes names safe and says so', () => {
    expect(mermaidName('orders')).toEqual({ safe: 'orders', changed: false });
    expect(mermaidName('order items')).toEqual({ safe: 'order_items', changed: true });
    expect(mermaidName('billing.ledgers')).toEqual({ safe: 'billing_ledgers', changed: true });
    expect(mermaidName('1st')).toEqual({ safe: 'n_1st', changed: true });
  });

  it('makes types safe', () => {
    expect(mermaidType('decimal(10,2)')).toEqual({ safe: 'decimal(10-2)', changed: true });
    expect(mermaidType('double precision')).toEqual({ safe: 'double_precision', changed: true });
    expect(mermaidType('varchar(255)')).toEqual({ safe: 'varchar(255)', changed: false });
  });

  it('keeps quoted text on one line without double quotes', () => {
    expect(mermaidText('say "hi"\nnow')).toBe("say 'hi' now");
  });
});
