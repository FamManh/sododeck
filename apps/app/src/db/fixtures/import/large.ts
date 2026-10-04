/**
 * A large schema for the import performance test (044 T005, SC-006): `tables` tables of
 * `columns` columns, each table after the first with a foreign key to an earlier one.
 */
const name = (i: number) => `table_${String(i).padStart(3, '0')}`;

export function largeSql(tables = 300, columns = 12): string {
  const out: string[] = [];
  for (let t = 0; t < tables; t++) {
    const lines = ['  id bigint PRIMARY KEY'];
    if (t > 0) lines.push(`  parent_id bigint NOT NULL REFERENCES ${name(Math.floor(t / 2))} (id)`);
    for (let c = lines.length; c < columns; c++) {
      lines.push(`  col_${String(c)} varchar(80)${c % 3 === 0 ? ' NOT NULL' : ''}`);
    }
    out.push(`CREATE TABLE ${name(t)} (\n${lines.join(',\n')}\n);`);
  }
  return `${out.join('\n\n')}\n`;
}

export function largeDbml(tables = 300, columns = 12): string {
  const out: string[] = [];
  for (let t = 0; t < tables; t++) {
    const lines = ['  id bigint [pk]'];
    if (t > 0) lines.push(`  parent_id bigint [not null, ref: > ${name(Math.floor(t / 2))}.id]`);
    for (let c = lines.length; c < columns; c++) {
      lines.push(`  col_${String(c)} varchar(80)${c % 3 === 0 ? ' [not null]' : ''}`);
    }
    out.push(`Table ${name(t)} {\n${lines.join('\n')}\n}`);
  }
  return `${out.join('\n\n')}\n`;
}
