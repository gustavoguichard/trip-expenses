---
name: formatting-datetimes
description: Store dates and timestamps as strings and format them through the shared money.ts helpers. Use when rendering dates, timestamps, or currency amounts, when comparing updatedAt values, when user mentions date formatting, toLocaleDateString, Intl.NumberFormat, or timezone issues.
---

# Formatting Datetimes

All temporal values are **strings** with a fixed shape, and all user-facing formatting goes through the shared helpers in `app/assets/money.ts`. Never scatter ad-hoc `Date` formatting through screens.

## Storage formats

Two string shapes, enforced by the document schema (`app/business/store.common.ts`):

- **Calendar days** — `YYYY-MM-DD` (`z.iso.date()`). An expense's `date` is a calendar day with no time and no timezone: "the boat trip was on Aug 10" is true everywhere on Earth. `today()` in `money.ts` builds it from the device's local clock — the user's "today", not UTC's.
- **Timestamps** — hybrid-logical-clock stamps (`timestampSchema`): `updatedAt` and `deletedAt` on every entity, always produced by `now()` from `store.common.ts` as `<ISO>~<counter>~<device-prefix>`; plain ISO stamps from older versions remain valid and comparable (see the `qr-sync` skill). These are machine values that drive sync merges; users never see them. Compare them with plain `>=`/`>` string operators, never `localeCompare` (locale collation may ignore the `~`) and never `new Date(stamp)` (the suffix breaks parsing).

Never store a `Date` instance, epoch millis, or a locale-formatted string in the document.

## Why strings

1. **JSON-safe**: the whole document round-trips through `JSON.stringify`/`parse` (localStorage, QR payloads) with no revival step.
2. **Lexicographic ordering**: ISO strings sort correctly as plain strings. The sync merge decides winners with `a.updatedAt >= b.updatedAt` — string comparison, no `Date` parsing (see `newer` in `app/business/sync.common.ts`). Grouping and sorting expenses by `date` works the same way.
3. **Determinism**: a `YYYY-MM-DD` day never shifts because a machine is in a different timezone.

## Formatting helpers (`app/assets/money.ts`)

### Days (user-facing)

`formatDay(date)` renders a stored `YYYY-MM-DD` as a short readable day (`Sun, Aug 10`):

```typescript
formatDay('2026-08-10') // 'Sun, Aug 10'
```

Note how it is built: `` new Date(`${date}T12:00:00Z`) `` with `timeZone: 'UTC'`. The noon-UTC anchor is deliberate — `new Date('2026-08-10')` alone is UTC midnight, which `toLocaleDateString` would render as **the previous day** in any timezone west of UTC. Never construct a `Date` from a bare `YYYY-MM-DD` without that anchor; better, never construct one at all outside this helper.

### Currency (user-facing)

Amounts are stored as **integer cents** plus the trip's 3-letter currency code. `formatCents(amountCents, currency)` renders them through a cached `Intl.NumberFormat`:

```typescript
formatCents(9000, 'BRL') // 'R$90.00'
```

Never divide by 100 and interpolate manually, and never instantiate `Intl.NumberFormat` inline in a screen — the helper caches one formatter per currency.

### Today

`today()` returns the device-local `YYYY-MM-DD` — the default for new expense dates. Do not use `new Date().toISOString().slice(0, 10)`, which is UTC's today and wrong in the evening west of Greenwich.

## Comparisons stay on strings

When business logic compares temporal values, compare the strings:

```typescript
// correct — ISO strings order lexicographically
const winner = a.updatedAt >= b.updatedAt ? a : b
const sorted = expenses.toSorted((a, b) => b.date.localeCompare(a.date))

// wrong — pointless round-trip through Date
const winner = new Date(a.updatedAt) >= new Date(b.updatedAt) ? a : b
```

In tests, derive "a later timestamp" arithmetically instead of sleeping:

```typescript
const later = (iso: string) =>
  new Date(new Date(iso).getTime() + 60_000).toISOString()
```

## Component rendering

Screens render the pre-formatted strings and nothing else:

```tsx
// correct
<span>{formatDay(expense.date)}</span>
<span class="tabular">{formatCents(expense.amountCents, trip.currency)}</span>

// wrong
<span>{new Date(expense.date).toLocaleDateString()}</span>
```

Numbers the product measured (amounts, balances) render in mono with the `tabular` utility so columns align — see the `design-system` skill.

## Always bump `updatedAt`

Every mutation that changes an entity must set `updatedAt: now()` on that entity (and tombstoning sets `deletedAt` to the same timestamp). This is not bookkeeping — it is what makes QR sync merges pick the right winner. The `local-data` skill owns the full rules.
