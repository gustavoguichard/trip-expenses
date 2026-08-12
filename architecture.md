# Trip Expenses — Architecture (as built)

## Runtime shape

One Remix 3 app (`apps/web`) with a Node HTTP entry (`server.ts`) and a Vercel function adapter (`api/index.mjs`), both delegating to `app/router.ts` → `router.fetch(request)`. Middleware stack: `staticFiles('./public')` → `render()` (request-scoped `renderToStream` with client-entry resolution through the asset server). No session middleware — there is nothing to be signed in to.

All routes are GET shells (`app/routes.ts`): home `/`, `/join`, `/trips/new`, and per-trip pages `/trips/:tripId` (expenses), `/expenses/new`, `/expenses/:expenseId`, `/balances`, `/charts`, `/members`, `/invite`. Controllers (`app/actions/controller.tsx`, `app/actions/trips/controller.tsx`) render `<AppShell>` + one `clientEntry` screen, passing route params as props.

## Data

The entire user state is one Zod-validated document in localStorage under `trip-expenses:document`:

```
{ version: 1, trips: [ { id, name, emoji, currency, updatedAt, deletedAt,
    members: [ { id, name, emoji, deviceIds[], updatedAt, deletedAt } ],
    expenses: [ { id, description, categoryId, amountCents, date, paidBy,
                  shares: [{ memberId, amountCents }], kind: expense|settlement,
                  updatedAt, deletedAt } ] } ] }
```

`trip-expenses:device` holds this device's uuid. A member whose `deviceIds` contains it is "me" on that trip (`myMember`).

- Schema + helpers: `app/business/store.common.ts` (`documentSchema`, `findTrip`, `activeTrips/Members/Expenses`, `replaceTrip`, `now`).
- Mutations: `app/business/trips.common.ts` (create/update/delete trip, add/update/remove/claim member) and `app/business/expenses.common.ts` (add/update/delete expense, `addSettlement`, `equalShares`, `parseAmount`) — all `applySchema(input, documentContextSchema)` composables returning the next document. Removal of a member is blocked while they appear in any active expense.
- Derived data: `app/business/balances.common.ts` — `memberBalances` (paid − shares), `simplifyDebts` (greedy largest-debtor→largest-creditor matching), `tripTotal`, `totalsByCategory/Day/Member` (settlements excluded from spending totals).
- Categories: `app/business/categories.common.ts` (7 spending categories + reserved `settlement`).

## Client layer

`app/assets/store.ts` glues screens to storage: `documentStore` (built on `framework/local-store.ts`), `deviceId()`, `bindDocument(handle)` (returns `ready()/document()/mount`, where `mount` is a `ref` mixin that loads after hydration — SSR and first client render always show the skeleton, keeping hydration deterministic), and `mutateDocument(fn, input)` (runs a composable against the current document, persists on success, returns first error message on failure).

Screens (`app/assets/*-screen.tsx`, all `clientEntry`): trips list, trip-new, expenses, expense-form (add/edit, equal or custom split, delete), balances (bars + settle-up suggestions with one-tap "mark paid"), charts, members (add/remove/claim/invite/delete trip), invite (QR), join (scanner). Shared chrome: `trip-chrome.tsx` (trip header + tab bar + missing/loading states), `widgets.tsx` (Avatar, EmojiPicker, button/input class constants), `money.ts` (`formatCents`, `formatDay`, `today`). Text inputs are uncontrolled (`defaultValue` + `on('input')`).

## Sync over QR

- `app/framework/sync-codec.ts`: `compress`/`decompress` (deflate + base64url via CompressionStream) and the chunk codec `toChunks(prefix, payload, 400)` ↔ `makeChunkCollector(prefix)` with `PREFIX:i/n:data` frames.
- `app/business/sync.common.ts`: `makeInvitePayload(trip, inviteMemberId|null)` / `parseInvitePayload`, `mergeTrip` (newer `updatedAt` wins per entity; members union `deviceIds`; expenses union by id), `importTrip` (add or merge into the document).
- Invite screen: payload → compress → chunks → `uqr` `renderSVG`, cycling frames every 400ms when chunked; member picker decides who the scanner becomes (self = second own device; none = data-only share).
- Join screen: `getUserMedia` → canvas → `qr/decode.js` (`decodeQR`) per frame → collector → decompress → preview card → import + claim (claims only when the device has no member on that trip yet). Camera-denied state degrades to instructions.
- Both QR libraries are pure ESM — a hard requirement, since the Remix asset server refuses CommonJS modules.

## Styling

Tailwind CSS v4, dark-only. Source `app/ui/styles.css` (`@theme` tokens + `@font-face` + `mono-label`/`mono-caption`/`tabular` utilities) compiled by `@tailwindcss/cli` to `public/styles.css` (`css:watch` in dev via turbo, `css:build` in `build`). Document shell `app/ui/document.tsx` links the stylesheet and the browser entry; `app/ui/app-shell.tsx` is the top chrome (wordmark + Scan); `app/ui/brand.tsx` the route-line wordmark. Chart series colors (`--color-chart-paid` #C6821F, `--color-chart-share` #4C92E6) are CVD-validated against the panel surface.

## Tests & gates

35 Vitest unit tests colocated in `app/business/` and `app/framework/` (no global setup, no browser emulation — the domain is pure). Gates: Biome (warnings fail), `tsc --noEmit`, Vitest — wired into `.githooks/pre-push` and `.github/workflows/ci.yml`.

## Deployment

Deployed on Vercel (project `trip-expenses`, root directory `apps/web`, production at trip-expenses-lyart.vercel.app). `vercel.json` rewrites everything to `api/index.mjs`; static files in `public/` are served by the CDN first, and `buildCommand` runs `css:build`. The function entry is plain ESM on purpose: it registers the `remix/node-tsx` loader and dynamically imports `app/router.ts`, so the server runs TypeScript at runtime exactly like dev (Vercel's builder cannot compile our TypeScript 7 toolchain itself — `VERCEL_CLI_VERSION` is pinned in the project env for the same reason). Its block of bare package imports is deliberate: Vercel's file tracer only ships what it can see, and the runtime asset compiler resolves those same packages from disk. `includeFiles` in `vercel.json` ships the untraceable rest — `app/**` sources, `tsconfig.json`, and the pnpm store subtrees the asset compiler reads (remix, oxc/lightningcss native bindings, browser deps); the lambda filesystem mirrors the repo root, so `assets.ts`'s `rootDir` and the fileMap work unchanged. `export const config = { useWebApi: true }` is what makes Vercel invoke the handler with a web-standard `Request`. Any Node ≥ 24.3 host also works: `pnpm run build && pnpm run start`. Smoke-check after deploy-affecting changes: `/`, `/styles.css`, `/join`, `/trips/new`, and `/assets/app/assets/entry.ts` + `trips-screen.tsx` (the runtime asset compiler) must all 200.

The app is installable as a PWA: `public/manifest.webmanifest` (standalone display, #0B0A08 theme) plus PNG icons rendered from the favicon mark (`apple-touch-icon.png` 180, `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`). `public/service-worker.js` (version constant at the top — bump it on breaking changes) precaches the shell (`/`, styles, fonts, favicon, manifest) and serves navigations network-first with cache fallback and `/assets/*`, `/fonts/*`, `/styles.css` cache-first, so visited pages keep working offline. An inline script in `app/ui/document.tsx` registers it — skipped on `localhost`/`127.0.0.1` so dev is never affected by SW caching.
