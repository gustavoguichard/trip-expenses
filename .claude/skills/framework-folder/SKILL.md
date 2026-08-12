---
name: framework-folder
description: Enforce separation between framework and app code in app/framework/. Use when adding new files or logic to app/framework/, importing framework modules, or deciding where to place new abstractions.
---

# Framework Folder

The `apps/web/app/framework/` folder must contain **zero app-specific logic**. It should be self-contained enough to extract as a separate npm package at any time.

## What Belongs in `app/framework/`

Only reusable abstractions that apply across any app built on this framework:

- Local document store (`local-store.ts`) — `makeLocalStore<Document>({ key, parse, empty, storage? })`, a generic typed localStorage document store with `load`/`save`/`update`/`subscribe` (including cross-tab `storage` events). It knows nothing about trips: the app supplies the key, the Zod parse, and the empty document.
- Sync codec (`sync-codec.ts`) — `compress`/`decompress` (deflate-raw + base64url over `CompressionStream`) and the chunk codec: `toChunks(prefix, payload, chunkSize)` produces `PREFIX:i/n:data` frames, `makeChunkCollector(prefix)` reassembles them in any order. It knows nothing about invites or QR rendering — those live in `app/business/sync.common.ts` and the screens.

Everything here is isomorphic — there are no `.server.ts` files because there is no server state. Files that can only run in a browser (like `local-store.ts` defaulting to `globalThis.localStorage`) still take their environment as an injectable option so they stay testable in Node.

## What Does NOT Belong in `app/framework/`

- App-specific document schemas, entity shapes, or merge rules (those are `app/business/store.common.ts` and `sync.common.ts`)
- The app's storage keys, chunk prefixes, or invite payload shapes — the framework exposes the parameters; the app supplies the values
- Anything that references `app/business/`, `app/actions/`, `app/assets/`, or other app-level files

## Import Direction

The dependency flow is strictly one-directional:

```
app/business/   → imports from → app/framework/
app/assets/     → imports from → app/framework/
app/actions/    → imports from → app/framework/

app/framework/  → NEVER imports from → app/business/, app/assets/, or app-level files
```

Framework files may import from each other using relative paths. All imports use explicit `.ts`/`.tsx` extensions — there is no path alias.

## The Factory Pattern

When framework code needs app-specific configuration, expose a factory function that the app calls with its own config:

```typescript
// app/framework/local-store.ts — framework provides the factory
function makeLocalStore<Document>({ key, parse, empty, storage }: LocalStoreOptions<Document>) {
  /* generic load/save/update/subscribe */
}

// app/assets/store.ts — app instantiates with its own schema
import { makeLocalStore } from '../framework/local-store.ts'
import { documentSchema, emptyDocument, type TripDocument } from '../business/store.common.ts'

const documentStore = makeLocalStore<TripDocument>({
  key: 'trip-expenses:document',
  parse: (raw) => {
    const result = documentSchema.safeParse(raw)
    return result.success ? result.data : null
  },
  empty: emptyDocument,
})
```

The same shape holds for the codec: `toChunks`/`makeChunkCollector` take the prefix as a parameter; the `TRIPX1` constant lives with the screens that use it.

## Litmus Test

Before adding anything to `app/framework/`, ask:

1. Would another app built on this framework need this?
2. Does it reference any app-specific modules, schemas, or constants?
3. Could this be published as part of a standalone npm package?

If the answer to #1 is no, or #2 is yes, or #3 is no — it belongs in `app/business/` or `app/assets/` instead.
