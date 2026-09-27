# 0002. JSON (not YAML) as the `.sododeck.json` file format, defined by JSON Schema

- **Status:** Accepted
- **Date:** 2026-09-27

## Context

A deck must be exportable, importable, diffable in git, and readable and writable by the app, a future CLI/MCP server, and AI agents. The spec (§6) settles on JSON; this ADR records the decision and how it is implemented in the codebase.

## Decision

1. **Format:** strict JSON, extension `.sododeck.json`. Every file carries `"$schema": "https://sododeck.com/schema/v1.json"` and `"version": 1`.
2. **Source of truth:** a **JSON Schema (draft 2020-12)** at `packages/schema/schema/v1.json`. TypeScript types (`json-schema-to-typescript`) and Zod validators (`json-schema-to-zod`) are **generated** from it and committed. A test fails when they are stale, and an Ajv-vs-Zod parity test keeps the two validators in agreement.
3. **Top-level shape (v1):** arrays for `nodes`, `groups`, `edges`, `views`, `features`, `flows`, `stickies`; an object keyed by id for `rules`. Every object has a stable `id` that never changes on rename.
4. **Conversion boundary:** only `packages/model` converts between the in-memory Yjs document and this JSON, with a tested lossless round-trip. The app never serializes the document itself.
5. **Output conventions:** canonical top-level key order and 2-space pretty-printing today. Per-object fixed key order (for minimal git diffs) arrives with the full schema.
6. **Versioning:** breaking changes bump `version` and the schema URL (`v2.json`), with a migration in `packages/model`. Additive optional fields do not.

## Why JSON over YAML

The file is mostly machine-written and machine-read. JSON is native to the whole stack (browser, Monaco, Yjs, Node), validates with JSON Schema, has one unambiguous parse, and avoids YAML pitfalls (indentation errors, `no` → `false`, `010` → octal). YAML may be accepted on **import** later (V2); storage stays JSON.

## Why JSON Schema as the source (not Zod-first)

The schema is a **public contract** that will be published at the `$schema` URL and consumed outside TypeScript (Monaco autocomplete, CLI, other languages, AI agents). Keeping JSON Schema as the source guarantees the published contract is exactly what the app enforces. The cost is a generation step and a limitation: the Zod generator needs local, non-recursive `$ref`s (we inline them).

## Consequences

- Monaco gets schema validation and autocomplete from the same file (`enableSchemaRequest: false`; the schema is bundled, never fetched).
- Schema edits require `pnpm schema:generate`; CI catches forgetting it.
- The v1 schema is currently a **skeleton** (every object is `{ id, ...anything }`). The full schema is a separate task.
- `https://sododeck.com/schema/v1.json` must be published by the site before launch.
