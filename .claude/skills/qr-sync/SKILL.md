---
name: qr-sync
description: Work with device-to-device trip sync over QR codes — invite payloads, compression, chunked animated QR, scanning, and the last-write-wins merge. Use when changing sync.common.ts, sync-codec.ts, the invite or join screens, merge or claim semantics, or QR encoding/decoding, or when the user mentions sync, QR codes, invites, scanning, merging, or sharing trips.
---

# QR Sync

There is no server, so there is no sync backend. Trips move between devices **optically**: one phone renders the whole trip as a (possibly animated) QR code, the other scans it with its camera and merges what it sees into its own document. Every sync is a full-state exchange in one direction; running it in both directions converges both devices.

## The pipeline

**Sending** (invite screen, `app/assets/invite-screen.tsx`):

```
trip → makeInvitePayload → JSON → compress (deflate → base64url)
     → toChunks('TRIPX1', encoded, 400) → uqr renderSVG, one frame per chunk
```

**Receiving** (join screen, `app/assets/join-screen.tsx`):

```
camera → canvas → qr decodeQR per frame → makeChunkCollector('TRIPX1')
       → payload complete → decompress → parseInvitePayload → preview → importTrip (+ claim)
```

The layers are strictly separated:

- **`app/framework/sync-codec.ts`** — generic, app-blind: `compress`/`decompress` (via `CompressionStream('deflate')` + base64url) and the chunk codec. Chunks are `PREFIX:i/n:data` strings (1-based `i` of `n`); `makeChunkCollector(prefix)` accepts them **in any order**, ignores non-matching text, reports `{ received, total, payload }` progress, and yields the joined payload once all `n` arrived.
- **`app/business/sync.common.ts`** — the domain: `invitePayloadSchema` (`{ kind: 'trip', trip, inviteMemberId }`), the merge, and `importTrip`.
- **The screens** — QR rendering/scanning and the `TRIPX1` chunk prefix constant.

## The invite payload

`makeInvitePayload(trip, inviteMemberId)` carries the **whole trip** — every member and expense, tombstones included — plus `inviteMemberId`:

- a member's id → "the person scanning is this member" (or the sender picking themselves to sync a second personal device),
- `null` → data-only share; the scanner gets the numbers without becoming anyone.

`parseInvitePayload` is defensive: bad JSON or a failed schema parse returns `null`, never throws — camera input is untrusted.

## Animated multi-QR

A trip rarely fits one QR code. `toChunks` splits the compressed payload into 400-character frames; when there is more than one, the invite screen cycles them on a 400ms interval and `uqr`'s `renderSVG` redraws each frame (ECC level `M`). The scanner just keeps decoding whatever frame is visible — the collector's order-independence is what makes the animation work. The join screen shows `x of n frames` progress from `ChunkProgress`; on a decompress/parse failure it resets with a **fresh collector** (never reuse one that swallowed a corrupt frame) and asks the user to rescan.

Regeneration is racy by nature (the payload re-compresses when the invite member changes): the invite screen guards with a generation counter so a stale async compress can't paint over a newer one.

## Link transport

The same compressed payload also travels as a URL: `https://<origin>/join#s=<payload>`, where `<payload>` is the deflate+base64url output of `compress` — a **single payload with no chunk framing and no `TRIPX1` prefix**. It rides the URL **fragment**, which browsers never send to the server, so the app stays databaseless. `inviteLinkHash`/`encodedFromLinkHash` in `sync.common.ts` own the `#s=` format.

The invite screen offers "Compartilhar link" next to the QR: `navigator.share({ url })` where available, clipboard + "Link copiado" otherwise, and warns when the payload exceeds ~6000 characters (messengers may truncate very long links; QR stays the reliable path for big trips). The join screen reads `location.hash` on mount: a payload there skips the camera entirely and feeds decompress → `parseInvitePayload` → the same preview + import + claim flow; the hash is cleared via `history.replaceState` after import. A corrupt fragment clears the hash, shows the standard error note, and falls back to the camera.

## The merge: last-write-wins, per entity and per trip field

`mergeTrip(mine, theirs)` in `sync.common.ts`:

- **Trip scalars are per-field LWW**: name, emoji, and currency each resolve through the trip's optional `fieldStamps` record (`{ name?, emoji?, currency? }`), written by `updateTrip` — the mutation timestamp for changed fields, the pre-mutation `updatedAt` backfilled for untouched ones. A field with no stamp (old documents, old peers) falls back to the trip's `updatedAt`. A concurrent rename on one phone and currency change on another both survive the merge.
- **Members and expenses**: union by `id`; on conflict the newer `updatedAt` wins (`newer` compares the stamp strings lexicographically — see Clocks below and the `formatting-datetimes` skill).
- **Tombstones travel**: a deletion is just an entity whose newer version has `deletedAt` set, so deletes propagate exactly like edits. This is why physical deletion is banned (`local-data` skill) — an entity missing from one side would simply be re-added by the union.
- **`deviceIds` union**: members merge their device claims from both sides regardless of which version won, so no device loses its identity in a merge.

`importTrip(document, incoming)` adds the trip if unknown, merges if present — and feeds every incoming stamp into the clock (`observeStamp`) first. Import is **idempotent and commutative in the limit**: scanning the same code twice is harmless, and A→B then B→A converges both documents.

## Clocks: hybrid-logical-clock stamps

Wall clocks skew between phones, so `now()` in `store.common.ts` is an HLC, not `toISOString()`. It emits `<ISO>~<counter>~<device-prefix>` where ISO is `max(wall clock, last seen ISO)`, the zero-padded 4-digit counter bumps while wall time fails to pass the last seen stamp, and the 8-char device prefix breaks exact ties. Because `~` (0x7E) sorts after every character ISO uses, the new stamps compare correctly against plain ISO stamps from old app versions with the very same `>=` string comparison — no migration, no special cases in `newer`.

The clock is module-level state: `configureClock(deviceId)` (called at boot by `app/assets/store.ts`) sets the device prefix, and `observeStamp` advances the last-seen state — fed by every document load and every `importTrip`. The consequence that matters: a device whose wall clock runs behind still produces stamps that outrank everything it has already seen, so its edits keep winning counter-wise instead of silently losing merges. `timestampSchema` accepts both stamp shapes; mutations always write the new one.

## Share stamps and the unshared badge

Each device remembers when it last *showed* each trip to someone: `trip-expenses:shared` (tripId → timestamp), owned by `stampShare`/`lastSharedAt` in `app/assets/store.ts`. Painting the QR stamps; sharing or copying the link stamps; **importing never stamps** — receiving is not sharing. This map is device-local metadata and must never enter the synced document.

`unsharedChanges(trip, lastSharedAt)` in `sync.common.ts` counts entities (trip, members, expenses — tombstones included) with `updatedAt` newer than the stamp; with no stamp it counts everything once the trip has expenses, and stays at zero for a never-shared trip without them. `UnsharedBadge` in `trip-chrome.tsx` renders the quiet mono-caption ("3 alterações não compartilhadas") on the home trip card and under the trip header. After a successful import, the join screen's interstitial offers "Mostrar meu código" (the trip's invite screen — which stamps the share on this device, closing the loop) next to "Ir para a viagem".

## Claim rules

A device claims **at most one member per trip** — `claimMember` (in `trips.common.ts`) adds the deviceId to the chosen member and strips it from every other member of that trip. `myMember(trip, deviceId())` resolves "who am I here".

On import, the join screen claims `inviteMemberId` **only if this device has no claim on that trip yet** (`myMember` returns null after the merge). Rescanning a code that says "you are Ana" never steals the identity of a device that already claimed someone else.

## Hard constraint: browser deps must be pure ESM

The QR libraries run in the browser, and the Remix asset server **refuses CommonJS modules** — it compiles browser assets on demand and only speaks ESM. That is why the stack is `uqr` (encode) and `qr` (decode, imported as `qr/decode.js`), both pure ESM. Before adding any browser-side dependency to this flow (or anywhere in `app/assets/`), verify its published format; a CJS-only package will fail at asset-serve time, not at install time.

Compression needs no dependency at all: `CompressionStream`/`DecompressionStream` are platform APIs, available in every supported browser and in Node ≥ 24 (which is how `sync-codec.test.ts` exercises them without a browser).

## Changing the protocol

- The chunk prefix `TRIPX1` is the wire version. A change to the chunk format, compression, or payload schema that old apps cannot parse must bump it (`TRIPX2`), so an old scanner cleanly ignores new codes instead of half-reading them.
- Additive-optional schema changes (see `local-data`) keep old and new apps mutually scannable — prefer them.
- Test merge changes in both directions: `sync.common.test.ts` builds two divergent documents through the real mutations and asserts convergence, tombstone propagation, and claim behavior. Any new merge rule gets the same treatment, including the A→B/B→A symmetry.
