---
name: local-data
description: Work with the local document store — the single versioned JSON document in localStorage that holds all user data. Use when changing the document schema, adding entities or fields, writing document mutations, working with store.common.ts, bindDocument, mutateDocument, tombstones, or updatedAt, or when the user mentions localStorage, persistence, the document, or data storage.
---

# Local Data

There is no database. Every user's entire state is **one versioned JSON document** in their browser's localStorage, validated by Zod on every load. Understanding this one document — its shape, its invariants, and the mutation discipline around it — is understanding the whole persistence layer.

## The document

`app/business/store.common.ts` owns `documentSchema`:

```
{ version: 1, trips: [ { id, name, emoji, currency, updatedAt, deletedAt,
    members:  [ { id, name, emoji, deviceIds[], updatedAt, deletedAt } ],
    expenses: [ { id, description, categoryId, amountCents, date, paidBy,
                  shares: [{ memberId, amountCents }], kind, updatedAt, deletedAt } ] } ] }
```

It lives under the localStorage key `trip-expenses:document`, wrapped by `makeLocalStore` (the generic factory in `app/framework/local-store.ts` — see the `framework-folder` skill). A second key, `trip-expenses:device`, holds this device's uuid (`deviceId()` in `app/assets/store.ts`).

## Entity shape rules

Every entity (trip, member, expense) carries the same spine, and every new entity must too:

- **`id`** — `crypto.randomUUID()`, generated once at creation, validated as `z.uuid()`.
- **`updatedAt`** — a sortable stamp from `now()` in `store.common.ts`: a hybrid-logical-clock string `<ISO>~<counter>~<device-prefix>` that compares lexicographically, including against plain ISO stamps written by older versions (see the `qr-sync` skill). **Bumped on every mutation of the entity**, no exceptions. This is the sync merge's clock: an entity whose `updatedAt` didn't move loses conflicts it should win.
- **`deletedAt`** — a stamp (same shape) or `null`. **Deletion is always a tombstone**: set `deletedAt` (and `updatedAt`) to the same `now()` value; never splice the entity out of its array. Physical removal would resurrect the entity on the next QR merge — the other device still has it, and there would be no tombstone to outrank it.

Reads go through the `isActive`/`activeTrips`/`activeMembers`/`activeExpenses` helpers so tombstoned entities stay invisible to the product while remaining in the document for sync.

## Mutations: pure, immutable, composable

Mutations are composable-functions built with `applySchema(inputSchema, documentContextSchema)` — context is always `{ document }`, and the function returns `{ document: nextDocument, ...ids }`:

```typescript
const deleteTrip = applySchema(
  z.object({ tripId: z.uuid() }),
  documentContextSchema
)(({ tripId }, { document }) => {
  const trip = findTrip(document, tripId)
  if (!trip) throw new Error('Trip not found')

  const timestamp = now()
  return {
    document: replaceTrip(document, { ...trip, updatedAt: timestamp, deletedAt: timestamp }),
  }
})
```

The rules:

- **Never mutate in place.** Spread and rebuild (`replaceTrip`, `{ ...trip, members: [...] }`). The previous document must remain untouched — tests and chained mutations depend on it.
- **Never touch storage.** Mutations are pure `(input, { document }) → { document, ... }`. Only `app/assets/store.ts` reads or writes localStorage.
- **Bump `updatedAt` on whatever changed** — the entity itself, and the trip when its collections change (adding an expense updates the trip's `updatedAt` too, via `replaceTrip`-style helpers like `withMember`/`withExpense`).
- **Throw user-facing messages.** `applySchema` routes thrown errors into the failure channel and `mutateDocument` shows the first message to the user — write `throw new Error('This person has expenses on the trip and cannot be removed')`, not internal jargon.
- **Return the ids the caller needs** (`tripId`, `memberId`, `expenseId`) alongside the document so screens can navigate.

Derived data (balances, totals, debt simplification) are plain pure functions over a trip — no composable wrapper, no document context. See `app/business/balances.common.ts`.

## The client glue (`app/assets/store.ts`)

- **`documentStore`** — the `makeLocalStore` instance: `load()` parses through `documentSchema.safeParse` and falls back to `emptyDocument()`; `save()` persists and notifies subscribers (including other tabs via `storage` events).
- **`bindDocument(handle)`** — how every screen reads: returns `ready()`, `document()`, and a `mount` ref mixin. The document loads only after mount — SSR and the first client render always show the skeleton, keeping hydration deterministic. **Never read localStorage in a component body.**
- **`mutateDocument(mutation, input)`** — how every screen writes: loads the current document, runs the composable with `{ document }`, saves `result.data.document` on success, returns `{ data, error }` with the first error message on failure. Screens never call `documentStore.save` directly — the one exception is the join screen persisting a merged document from `importTrip`.

## Schema changes: backward-compatible or bust

A stored document is user data you cannot migrate on a server — it lives on devices you will never see again. `documentStore.load()` falls back to **an empty document on any parse failure**, which means a careless schema change silently erases a user's trips.

- **Prefer additive optional fields**: `z.string().optional()`, or `.default(...)` so old documents parse cleanly and gain the field on next save.
- **Never rename, retype, or make-required an existing field** without a migration story. If a breaking reshape is truly needed, bump `version` and translate old shapes inside `parse` before validating — the fallback-to-empty path is for corruption, not for documents your last release wrote.
- **Test it**: when the schema changes, add a test parsing a document literal in the previous shape and assert it still loads.

The same constraint protects sync: an old app version may scan a QR payload from a new one. Additive-optional keeps `invitePayloadSchema` (which embeds `tripSchema`) compatible in both directions.

## Litmus test

Before touching the document or its mutations, ask:

1. Does every changed entity get a fresh `updatedAt`?
2. Is every "delete" a `deletedAt` tombstone, with reads going through the `active*` helpers?
3. Would a document written by the previous release still parse? (If not, you are deleting user data.)
4. Is the mutation pure — no storage access, no in-place mutation, next document returned?
5. Do tests build their state through the real mutations (`fixtures.common.ts` / `seedTrip`), not hand-rolled document literals?
