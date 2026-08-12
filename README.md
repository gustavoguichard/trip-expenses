# Trip Expenses

Split trip costs with friends — free, forever, no accounts.

Everything lives on your own phone: create a trip, add the people (everyone gets an emoji avatar), log who paid for what and how it splits, and watch balances settle themselves. To bring a friend in, they open the app and scan a QR code from your screen — the whole trip moves to their device and they log their own expenses from there. Scan each other again anytime to sync up. Pick yourself when generating the code to sync your own second device.

- **Expenses** — categories, who paid, split equally, among a few, custom amounts, or pure loans.
- **Balances** — who's up, who's down, and the fewest payments that settle everything, with one-tap "mark paid".
- **Charts** — totals, spending by category, by day, and paid-vs-share per person.
- **Sync** — QR codes between devices. No server ever sees your data.

## Develop

Requires Node ≥ 24.3 and pnpm 10.

```bash
pnpm install
pnpm run dev        # http://localhost:3000
pnpm run test:unit
pnpm run lint
pnpm run tsc
```

Built on Remix 3 (beta), Tailwind CSS v4, composable-functions + Zod, Vitest, and Biome, in a pnpm + Turborepo monorepo. See `architecture.md` for the full map and `CLAUDE.md` for working conventions.

## Deploy

The app is stateless by design — any Node host works:

```bash
pnpm run build && pnpm run start
```

For Vercel: create a project with the root directory set to `apps/web`; `vercel.json` routes every request to the bundled `api/index.ts` function and serves `public/` from the CDN. Smoke-test the first deploy — Remix 3 is a beta and compiles browser assets at runtime.
