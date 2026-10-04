# Contract: file format additions (schema v1, additive)

```jsonc
{
  "groupingMode": "schema", // deck, optional; absent = by group
  "nodes": [{ "id": "n_events", "type": "db.table", "expanded": true }], // existing field
  "views": [
    {
      "id": "v_billing",
      "type": "custom",
      "title": "Billing",
      "schemas": ["billing"], // optional, non-empty
      "includes": ["n_customers"], // existing; tables shown in addition
      "detail": "keys", // optional
      "collapsed": ["schema:billing"], // existing list; virtual ids allowed
    },
  ],
}
```

Rules

- All keys optional; absent means the default; writers remove a key at its default.
- `collapsed` may hold ids of stored groups and ids starting with `schema:`; readers ignore
  unknown ids.
- Ajv and Zod stay in parity (`packages/schema` test); `pnpm schema:generate` regenerates types.
- Export / import (JSON, `.sododeck.json`) round-trips every key; SQL and DBML exports ignore all
  of them and always include every table (FR-015).
- Files from before 048 load unchanged; files with these keys opened by an older build are
  rejected or ignored according to the existing unknown-key policy of schema v1 (documented in ADR 0034).
