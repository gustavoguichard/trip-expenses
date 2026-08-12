# Trip Expenses

Trip Expenses is a free, no-account trip expense splitter. The frontend is built on Remix 3 (`remix@3.0.0-beta.x`, the post-React reboot of Remix) — no React, no bundler: the server runs TypeScript directly through `node --import remix/node-tsx`, and browser assets are compiled on demand by the Remix asset server. There is **no database, no auth, no worker, and no env vars**: every user's data lives on their own device as a single versioned JSON document in localStorage, and trips sync device-to-device through QR codes.

The repository is a pnpm-workspaces + Turborepo monorepo. The web app lives in `apps/web` (package `@trip-expenses/web`); shared packages will live under `packages/*`. All commands run from the repo root.

## Essential Development Commands

```bash
pnpm install                    # Install dependencies
pnpm run dev                    # Run the app + Tailwind watcher (http://localhost:3000)
pnpm run build                  # Build CSS + type-check (no artifact step in Remix 3 beta)
pnpm run tsc                    # Type-check
pnpm run lint                   # Check code style with Biome
pnpm run lint-fix               # Auto-fix linting and formatting issues
pnpm run test:unit              # Run all unit tests (Vitest)
pnpm run start                  # Run the app in production mode
```

There is no local setup beyond `pnpm install` — no databases to create, no `.env` files to write. The app is fully usable the moment the dev server boots.

## Stack

- **Monorepo:** pnpm workspaces + Turborepo.
- **Frontend:** Remix 3 in `apps/web`. It is a beta that changes weekly — when in doubt about its API, read the `remix` skill under `.agents/skills/remix/` and the source in `node_modules/remix`, never guess from React-era Remix knowledge.
- **Styling:** Tailwind CSS v4 via `@tailwindcss/cli`. Tokens live in `apps/web/app/ui/styles.css` (`@theme` block); the build writes `apps/web/public/styles.css` (gitignored). `pnpm run dev` runs the watcher through the `css:watch` turbo task; `css:build` runs in `build`. Load the `design-system` skill for any UI work.
- **Data:** a single Zod-validated JSON document per device in localStorage (`app/business/store.common.ts`). No server state, ever. Load the `local-data` skill before touching the document schema or mutations.
- **Sync:** QR-code device-to-device sync — compress, chunk, animate, scan, merge (entity-level last-write-wins with tombstones). Load the `qr-sync` skill. Browser dependencies must be pure ESM — the Remix asset server refuses CommonJS modules.
- **Business logic:** `composable-functions` + Zod schemas, all in `.common.ts` files (isomorphic — they run in the browser). Context is always `{ document }`; mutations return the next document. See Business Logic Organization below.
- **Package manager:** `pnpm` (version 10.x). `pnpm install` may rewrite `package.json` formatting in a way Biome rejects — if it ran after your last lint, run `pnpm run lint` (or `lint-fix`) again before reporting gates green.
- **Node version:** `>=24.3.0` (required by Remix 3).
- **Linting & formatting:** [Biome](https://biomejs.dev). Non-null assertions (`!`) are warnings and warnings fail the gate — write the guard instead.
- **Tests:** Vitest, colocated as `apps/web/app/**/*.test.ts`. No global setup — business tests build state through the business functions themselves (see `app/business/fixtures.common.ts`).

## Structure

```
apps/web/
  server.ts                  # Node HTTP server, entry point
  api/index.mjs              # Vercel function entry (router.fetch adapter)
  vitest.config.ts
  app/
    routes.ts                # Route contract (route/get builders) — GET-only shells
    router.ts                # Wires routes, middleware, and controllers
    actions/controller.tsx   # Top-level route actions (assets, home, join)
    actions/trips/controller.tsx # Trip pages
    middleware/render.tsx    # Request-scoped renderer middleware
    assets.ts                # Server-side asset pipeline (allows assets/, business/, framework/, routes.ts)
    assets/                  # Client code: entry.ts, store.ts, money.ts, *-screen.tsx clientEntry components
    ui/                      # Document shell, AppShell, brand, styles.css (Tailwind source)
    framework/               # Self-contained reusable abstractions (see below)
    business/                # Domain logic (see below)
  public/                    # Static files (fonts, favicon, built styles.css)
```

The server renders page shells only; every screen is a `clientEntry` component in `app/assets/` that reads the local document through `bindDocument(handle)` and writes through `mutateDocument(fn, input)` (both in `app/assets/store.ts`). The first render is a skeleton on both server and client; real data appears after mount — never read localStorage in a component body.

### Framework folder

Reusable abstractions live in `apps/web/app/framework/`: `local-store.ts` (generic typed localStorage document store — load/save/update/subscribe) and `sync-codec.ts` (deflate+base64url compression and the chunked QR payload codec). It contains zero app-specific logic and never imports from `app/business/` or other app-level files. Load the `framework-folder` and `business-folder` skills for deciding where a new abstraction belongs.

Universal files have no `.server` suffix — almost everything here is isomorphic. Imports use explicit `.ts`/`.tsx` extensions and relative paths — there is no `~` path alias.

## Business Logic Organization

- `apps/web/app/business/` contains the domain in `.common.ts` files: `store.common.ts` (document schema + entity helpers), `categories.common.ts`, `trips.common.ts`, `expenses.common.ts`, `balances.common.ts`, `sync.common.ts`, with colocated `.test.ts` files and the `fixtures.common.ts` test helper.
- Mutations use `applySchema(inputSchema, documentContextSchema)` from `composable-functions` — input validation at every boundary, `{ document }` as context, returning `{ document: nextDocument, ...ids }`. Derived data (balances, totals) are plain pure functions.
- Every entity carries `id` (uuid), `updatedAt` (ISO), `deletedAt` (ISO or null). Deletion is always a tombstone; `updatedAt` is bumped on every mutation — both are what makes QR sync merges correct. Load the `local-data` skill.
- **No cross-imports** between business files to prevent circular dependencies (the one sanctioned exception: `expenses.common.ts` composes `addSettlement` on top of its own `addExpense`; `fixtures.common.ts` is test support and may import freely).
- Splitwise-style semantics live entirely in data: an expense has `paidBy` + `shares`; a payer excluded from the shares is lending; a settlement is an expense of kind `settlement` whose single share is the receiver.

## Coding style

- NEVER add backwards compatibility unless explicitly required — with one standing exception: the stored document. Schema changes must keep old stored documents parseable (prefer additive optional fields; a parse failure silently resets the user's data to empty).
- Do not add comments to the code unless it's an incredibly complex operation.
- ALWAYS use `routes.<name>.href(...)` from `app/routes.ts` for internal URLs. NEVER use string interpolation for paths.
- Text inputs are uncontrolled: `defaultValue` + `on('input')`, never a controlled `value` prop. Give uncontrolled inputs stable `key`s when their list can reorder, and change the `key` to programmatically reset one.
- Formatting is handled by Biome: 2-space indent, single quotes, trailing commas where valid, semicolons only when required.
- Avoid abbreviations when naming things.
- Avoid Hasty Abstractions: it is OK to repeat things here and there until the right abstraction emerges. Only extract components/files when something is actually shared.
- Run `pnpm run lint-fix` before committing.

## Quality bar

We care a lot about beautifully simple UI/UX. Always ensure our UX/UI is outstanding. We care even more about code quality. Please ensure our code is a work of art, always as simple as it can be, with the right domain language and prose. NEVER compromise on this quality bar to save time or tokens.

## Working agreements

- Commit directly on `main`, in small frequent increments — one commit per coherent step, and push to `origin` after each commit. Feature branches only when parallel work would collide.
- The product decision record lives in `product-plan.md`; the as-built map in `architecture.md`. Keep both current as things change.
- Dev servers started for verification (by agents or tooling) always use a non-default port via `PORT=<n> pnpm --filter @trip-expenses/web run dev` — port 3000 belongs to the human.
- Never kill processes you did not start this session, and never anything attached to a TTY.
- Every push runs the quality gates first: the committed `.githooks/pre-push` hook runs `pnpm run lint`, `pnpm run tsc` and `pnpm run test:unit` and aborts the push on the first failure. The root `prepare` script points `core.hooksPath` at `.githooks`, so `pnpm install` activates it. GitHub Actions runs the same three gates on every push and PR.

## Skills

`.claude/skills/` holds the project skills. The infrastructure skills describe what actually exists here: `local-data`, `qr-sync`, `composable-functions`, `business-folder`, `framework-folder`, `formatting-datetimes`, `testing`, `type-safety`. `design-system` is the Trip Expenses canon — load it for any UI work; tokens live in `apps/web/app/ui/styles.css`. The generic craft skills (`grill-me`, `subagents`, `orchestration`, `skill-manager`, `self-improvement`, `quick`, `architecture-md`, `agent-browser`) apply as-is. For Remix 3 API questions, use the `remix` skill in `.agents/skills/remix/`.
