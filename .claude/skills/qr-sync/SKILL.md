---
name: qr-sync
description: Work with device-to-device trip sync over QR codes — invite payloads, compression, chunked animated QR, scanning, and the last-write-wins merge. Use when changing sync.common.ts, sync-codec.ts, the invite or join screens, merge or claim semantics, or QR encoding/decoding, or when the user mentions sync, QR codes, invites, scanning, merging, or sharing trips.
---

# QR Sync

There is no server, so there is no sync backend. Trips move between devices **optically**: one phone renders the whole trip as a (possibly animated) QR code, the other scans it with its camera and merges what it sees into its own document. Every sync is a full-state exchange in one direction; running it in both directions converges both devices.

## The pipeline

**Sending** (invite screen, `app/assets/invite-screen.tsx`):

```
trip → makeInvitePayload → JSON → compress (deflate-raw → base64url)
     → toChunks('TRIPX1', encoded, 400) → uqr renderSVG, one frame per chunk
```

**Receiving** (join screen, `app/assets/join-screen.tsx`):

```
camera → canvas → qr decodeQR per frame → makeChunkCollector('TRIPX1')
       → payload complete → decompress → parseInvitePayload → preview → importTrip (+ claim)
```

The layers are strictly separated:

- **`app/framework/sync-codec.ts`** — generic, app-blind: `compress`/`decompress` (via `CompressionStream('deflate-raw')` + base64url) and the chunk codec. Chunks are `PREFIX:i/n:data` strings (1-based `i` of `n`); `makeChunkCollector(prefix)` accepts them **in any order**, ignores non-matching text, reports `{ received, total, payload }` progress, and yields the joined payload once all `n` arrived.
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

## The merge: entity-level last-write-wins

`mergeTrip(mine, theirs)` in `sync.common.ts`:

- **Trip fields**: the trip with the newer `updatedAt` wins wholesale (name, emoji, currency).
- **Members and expenses**: union by `id`; on conflict the newer `updatedAt` wins (`newer` compares the ISO strings lexicographically — see the `formatting-datetimes` skill).
- **Tombstones travel**: a deletion is just an entity whose newer version has `deletedAt` set, so deletes propagate exactly like edits. This is why physical deletion is banned (`local-data` skill) — an entity missing from one side would simply be re-added by the union.
- **`deviceIds` union**: members merge their device claims from both sides regardless of which version won, so no device loses its identity in a merge.

`importTrip(document, incoming)` adds the trip if unknown, merges if present. Import is **idempotent and commutative in the limit**: scanning the same code twice is harmless, and A→B then B→A converges both documents.

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
