# @sododeck/config

**Responsibility:** shared tooling configuration. No runtime code.

- `tsconfig/base.json`: strict TS for everything. `library.json` for Node-side packages, `react.json` for React/DOM.
- `eslint/index.js`: flat-config factories `base(dir)`, `react(dir)`, `astroConfig(dir)`. Each workspace calls one of them in its own `eslint.config.js` with `import.meta.dirname` (typed linting needs the workspace's tsconfig).
- `prettier/index.js`: the root `.prettierrc.js` re-exports it.

The Tailwind "preset" lives in `@sododeck/ui` (`src/styles/theme.css`) because it is generated from the design tokens there. Tailwind v4 is CSS-first, so there is no JS preset.

## Rules

- Changing a rule here changes every package. Run `pnpm lint && pnpm typecheck` at the root after any edit.
- TypeScript is pinned to 6.0.x: typescript-eslint and `@astrojs/check` don't support TS 7 (native) yet. Revisit when they do.
