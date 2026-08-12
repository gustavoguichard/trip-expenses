# Trip Expenses — Product Plan

## What it is

A free trip expense splitter anyone can use, forever, without accounts, servers, or hosting costs. All data lives on the user's own phone; friends share a trip by scanning a QR code from each other's screens.

## Decisions

- **No auth, no backend state.** The device is the account. A `deviceId` (random uuid in localStorage) identifies "me" on each trip. This is what makes the app free to run: the deployment is a static-ish shell with zero per-user cost.
- **The trip is the unit of sharing.** A device holds many trips; each trip carries its own members (with emoji avatars), currency, and expenses. Syncing always moves a whole trip.
- **Splitwise-grade expense semantics.** An expense records who paid and how it splits (`shares`). Splitting equally with everyone, splitting among a subset, custom amounts per person, and pure lending (payer not in the split) are all the same shape. Settling up is an expense of kind `settlement` — payer hands cash to the single share-holder — so payments sync exactly like expenses do.
- **Inviting = QR + identity.** The inviter picks which trip member the other person is (including picking themselves, to sync their own second device). The QR carries the whole trip plus that member id; the scanner's device claims the member on import. Re-scanning any member's code later re-syncs; syncing back is scanning in the other direction.
- **Merges are entity-level last-write-wins.** Every trip, member, and expense carries `updatedAt`; deletions are `deletedAt` tombstones so a deletion propagates instead of resurrecting. Device claims (`deviceIds`) union rather than fight.
- **Charts tab per trip.** Stat tiles (total, per-day, days, biggest day), category bars, daily spending bars, and paid-vs-share per person.
- **Portuguese-first UI (pt-BR), multi-currency.** All copy, dates, and error messages speak Brazilian Portuguese; code identifiers and routes stay in English. One currency per trip, formatted with `Intl.NumberFormat` in the `pt-BR` locale; amounts stored as integer cents; both `12.50` and `12,50` accepted on input.
- **Hosting: Vercel** (or any Node host via `pnpm start`). No paid services anywhere in the stack.
- **Installable PWA with an offline shell.** Manifest + icons make it a home-screen app; a service worker caches the shell and visited pages so the app works offline on the road (registration skips localhost).

## Boundaries (deliberately out, for now)

- No live/background sync — sync happens when two people scan.
- No conflict UI — last write wins is the whole story.
- No expense photos/receipts, no recurring expenses, no cross-trip friend registry.
- No i18n yet.

## Later ideas

- Export/import the whole document as a file (backup).
- Per-member colors in charts once more than two series are needed.
