# From a codebase

Read this when the user points you at a repository and wants its architecture as a deck. The goal
is a deck a reader can trust: every card and connector traceable to code.

## 1. Scan, in this order

1. **Deployables**: services, apps, workers, functions. Look at build and deploy files (container
   files, compose files, infrastructure code, package manifests, `main` entry points). One
   deployable is one card (`service`, `client`, `component` for an internal library).
2. **Data stores and brokers**: connection strings, client libraries, migrations, topic and queue
   names. One per real store or topic family (`database`, `queue`).
3. **Calls**: HTTP clients and routes, RPC stubs, producers and consumers, SQL access. A call
   becomes a connector only when you found **both** the caller's code and what it calls (a route,
   a topic name, a table).
4. **External systems**: third-party SDKs and URLs (`external`).

Stop at the detail dial's budget; group by repository folder, team or bounded context; push
internals of a big service one level down (`parent`).

## 2. Source links

Every card and connector built from code carries a link to where you saw it, at a fixed commit, so
a reader can check it:

```json
"links": [{ "label": "source", "url": "https://<host>/<repo>/blob/<commit>/src/orders/charge.ts#L40-L58" }]
```

Without a remote, use a repository-relative path: `src/orders/charge.ts#L40-L58` (with the commit
in the deck `description`). Run lint with `--mode codebase`: it reports `connector-without-source`
for anything without a link.

## 3. Only what you traced

Don't add a connector because names suggest it ("there is a `PaymentClient`, so orders must call
payments") unless you found the call. Put likely-but-untraced calls in the fidelity report under
"could not map", where the user can confirm them.

Real payloads or short code excerpts (a request body, an event schema) go in a step's `payload`
or a card's `description` when they explain it better than prose.

## 4. Fidelity report

End the handover with what did not come across one-to-one:

- **merged**: several things drawn as one card (e.g. "3 lambdas in `jobs/` → one Jobs card").
- **collapsed**: detail pushed down or left implicit (e.g. "internal modules of Orders").
- **left out**: found but not drawn, and why (budget, tooling, tests, scripts).
- **could not map**: things you saw but could not trace (a client without a visible target, a
  config value pointing to an unknown host).

Never drop something silently: if it is not in the deck, it is in this list.
