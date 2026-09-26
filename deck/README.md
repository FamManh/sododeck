# Sododeck — Deck

Frontend for Sododeck, built with Next.js (App Router), TypeScript, Tailwind CSS v4, next-intl, Arcjet and LogTape.

Product spec: [`docs/Sododeck — Product Specification.md`](../docs/Sododeck%20—%20Product%20Specification.md).

## Getting started

```bash
cp .env.example .env
npm install
npm run dev
```

Secrets (e.g. `ARCJET_KEY`) go in `.env.local`, which is never committed.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` / `lint:fix` | Lint and format (Ultracite / Oxc) |
| `npm run check:types` | TypeScript type check |
| `npm run check:deps` | Unused files and dependencies (Knip) |
| `npm run check:i18n` | Validate translations |
| `npm test` | Unit and UI tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright) |
