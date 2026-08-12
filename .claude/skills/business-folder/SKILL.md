---
name: business-folder
description: Organize business logic in app/business/ by domain cohesion and framework independence. Use when creating files in app/business/, adding functions to business files, naming business modules, deciding where to place business logic, or choosing what to import in business code.
---

# Business Folder

The `apps/web/app/business/` folder holds the most valuable code in the application — the domain logic that defines what the product does. Frameworks, routers, and UI libraries come and go, but business logic outlives them all.

The guiding question: **If the framework were replaced tomorrow, could the business folder come along unchanged?**

Every file must be named after the **business domain** it serves, every function must belong to that domain, and the code must stay independent from framework-specific concerns.

## Framework Independence

Business functions must not import from `remix/*` or anything DOM- or storage-shaped. These dependencies tie domain logic to the current framework and make it impossible to extract — and they would break the isomorphic contract: every business file runs in the browser and under Vitest with no environment setup.

### What belongs in business files

- **Third-party domain libraries** — `composable-functions`, `zod`
- **Framework-folder primitives** — pure helpers from `app/framework/` (e.g. `sync-codec.ts` codecs), which carry no app knowledge
- **Other business files** — `./store.common.ts` and friends (respecting the no-cross-imports rule)

### What belongs elsewhere instead

- Anything imported from `remix/*` (`clientEntry`, `ref`, `on`, `navigate`) — that is screen code in `app/assets/`
- `localStorage` access — only `app/assets/store.ts` (via `framework/local-store.ts`) touches storage; business functions receive the document as context and return the next one
- Rendering, controllers, HTTP — `app/actions/` and `app/ui/`

### The document-context pattern

`store.common.ts` owns the document schema (`documentSchema`) and the context schema every mutation uses: `documentContextSchema`, which is `z.object({ document: documentSchema })`. Mutations are built with `applySchema(inputSchema, documentContextSchema)`, take `{ document }` as context, and return `{ document: nextDocument, ...ids }` — pure and immutable, never touching storage. The client glue (`mutateDocument` in `app/assets/store.ts`) is what loads the current document, runs the mutation, and persists the result.

## Naming Rule

Name files after the business domain, not the implementation detail.

```
✅ trips.common.ts         — domain: trips and their members
✅ expenses.common.ts      — domain: expenses and settlements
✅ balances.common.ts      — domain: who owes whom
✅ sync.common.ts          — domain: trip sync payloads and merging

❌ localstorage.common.ts  — named after the storage mechanism, not a domain
❌ zod-helpers.common.ts   — named after a library, not a domain
```

### Infrastructure Exception

Files providing **generic infrastructure primitives** don't belong in `app/business/` at all — they go in `app/framework/` (see the `framework-folder` skill). If a file has no trip, member, or expense in it, that is where it lives.

## File Suffixes

- **`.common.ts`** — The only business suffix here. All business logic is isomorphic: it runs in the browser, on the server render, and under Vitest. There are no `.server.ts` business files because there is no server state.
- **`.test.ts`** / **`.common.test.ts`** — Unit tests, placed alongside the implementation file.

`fixtures.common.ts` is the test-support module: helpers like `seedTrip()` (builds a document through the real `createTrip` mutation) and `tripOf()` used across the business tests. It may import from any business file — test support is exempt from the layering rules below.

## Cohesion Rule

Every function in a file must belong to that file's business domain. If a function serves a different domain, move it to the appropriate file.

Signs of poor cohesion:
- A balance computation living in `trips.common.ts`
- Functions in a file that are only consumed by a single other domain
- A file whose functions don't relate to each other except by implementation detail

## No Cross-Imports

Business files must not create circular dependencies:

```
✅ trips.common.ts     → imports from → store.common.ts
✅ expenses.common.ts  → imports from → categories.common.ts
❌ store.common.ts     → imports from → trips.common.ts
```

`store.common.ts` is the shared root — every other business file may import its schemas and helpers, and it imports from no sibling. The one sanctioned composition on top of that: `addSettlement` in `expenses.common.ts` calls its own file's `addExpense`.

If two files need to share a utility, options in order of preference:
1. **Merge the files** if they serve the same domain
2. **Keep a private copy** in each file if the utility is small and trivial
3. **Move it to `store.common.ts`** if it is entity-shaped and shared by several domains (that is how `isActive`, `findTrip`, and `replaceTrip` earned their place)

## When to Merge vs Split

**Merge** when files serve the same business domain. The library or technique used is an implementation detail, not a reason to separate files.

**Split** when a file grows to cover distinct business domains. The right boundary is the domain, not the file size.

## Litmus Test

Before creating or modifying a business file, ask:

1. **Could this file survive a framework migration?** If Remix were replaced, would this file need any changes at all?
2. Does the name describe the **business domain** (what it does) rather than the **implementation** (how it does it)?
3. Do all functions in this file belong to the same business domain?
4. Would someone unfamiliar with the codebase find this function in this file based on the filename?
5. Does this file import from `remix/*` or touch `localStorage`? If so, it needs restructuring — screens own rendering, `app/assets/store.ts` owns storage.

If the answer to any question is wrong, the file needs changes.
