---
name: testing
description: Write and run unit tests using Vitest. Use when writing tests, fixing tests, running tests, implementing TDD, or when user mentions testing, test-driven development, Vitest, or unit tests.
---

# Testing

Unit testing guidelines covering Vitest, test organization, and test-driven development workflows. E2E testing is deferred — there is no Playwright suite yet.

## Test Execution Commands

```bash
pnpm run test:unit                  # Run all unit tests (from the repo root)
```

The root script runs `TZ=UTC vitest run` in `apps/web` through Turborepo. There is **no global setup** — no database, no env files, no browser emulation. The domain is pure functions over an in-memory document, so tests need nothing but the code under test.

**Important**: Always run tests before committing changes.

## Test-Driven Development Workflow

When addressing bugs or implementing new features, follow the Red-Green-Refactor cycle:

1. **Red** – Write a test that reproduces the issue or validates the new behavior. The test should fail.
2. **Green** – Implement the minimal code to make the test pass.
3. **Refactor** – Clean up the solution while keeping all tests green.

### Mutation proofs

A green suite proves nothing about a specific test until that test has been seen red for the right reason. When the code under test already exists (a fix being re-verified, a regression test against already-correct code), red-first isn't natural — substitute a mutation proof:

1. Back up the file with `cp file file.bak` — never `git checkout -- <file>` to undo a mutation on a file that also carries uncommitted work, since it discards everything.
2. Revert or neuter exactly the behavior the test pins.
3. Run the specific test and confirm it fails with the expected message — not just "a" failure.
4. Restore the backup and verify it landed (diff or checksum against the original), then confirm green.

False-green smells to check whenever a test passes suspiciously easily: the expected value coincides with the old buggy behavior (the test passes whether the bug is fixed or not); the code path is stubbed above the change under test; an error assertion satisfied by a different error than the one under test firing first.

### Gate reconciliation

Record the exact test and file counts before starting. After the change, compute the expected totals from every `it()`/`describe` block added or removed, then run `test:unit` twice: both runs must match the arithmetic and each other. Any mismatch is a signal — a dropped test file, a duplicated suite, or a flaky test — never noise to shrug off.

## Unit Testing Guidelines

Unit tests use Vitest and are colocated with the code they cover (`apps/web/app/**/*.test.ts`).

### Core Principles

- Test the exposed API, its inputs and outputs rather than implementation details
- Focus on application behavior
- Do not test Zod schemas

### Test Organization

- Group tests with a single `describe` block per subject (e.g., per public function)
- Use the name of the subject as the parameter for `describe`
- Avoid catch-all labels like "additional tests"
- Use descriptive names for both `describe` and `it` blocks to make code folding and navigation easier

Example:
```typescript
describe('deleteTrip', () => {
  it('tombstones the trip instead of erasing it', async () => {
    // test implementation
  })
})
```

### Building state through the business functions

There are no database fixtures — state is a document, and tests build it by running the real mutations. `app/business/fixtures.common.ts` provides `seedTrip()` (a trip with three members, created through `createTrip`) and `tripOf(document, tripId)`; chain further mutations by threading each result's document into the next call's context:

```typescript
const { document, trip, guga, ana } = await seedTrip()

const spent = await fromSuccess(addExpense)(
  { tripId: trip.id, description: 'Boat day', categoryId: 'activities',
    amountCents: 9000, date: '2026-08-10', paidBy: guga.id,
    shares: equalShares(9000, [guga.id, ana.id]) },
  { document }
)

const result = await removeMember(
  { tripId: trip.id, memberId: ana.id },
  { document: spent.document }
)
expect(result.success).toBe(false)
```

This keeps every test honest: the state it asserts against could only have been produced by the product's own rules. See `app/business/*.test.ts` for the full pattern.

### Testing composable results

Business functions return composable-functions `Result` values. Use `fromSuccess(fn)` on the happy path so failures throw with their real message, and assert the failure channel explicitly when failure is the behavior under test:

```typescript
import { fromSuccess } from 'composable-functions'

// ✅ Happy path: unwrap
const deleted = await fromSuccess(deleteTrip)({ tripId: trip.id }, { document })
expect(findTrip(deleted.document, trip.id)).toBeNull()

// ✅ Failure path: assert on the result
const result = await createTrip(
  { name: 'Solo', emoji: '🧳', currency: 'USD', members: [] },
  { document: { version: 1, trips: [] } }
)
expect(result.success).toBe(false)
```

When a failure case matters beyond the flag, assert on the specific error (`isInputError`, or the message) rather than only checking `result.success === false`.

### Framework-folder tests

`app/framework/*.test.ts` tests the generic primitives with injected environments, never the real browser: `local-store.test.ts` passes an in-memory `storage` object, `sync-codec.test.ts` round-trips compression and chunking as plain functions. Keep that discipline — a framework test that needs `globalThis.localStorage` or a DOM is testing at the wrong seam.

### Time and tombstones

Merge behavior is driven by `updatedAt` ordering. When a test needs "a later edit", derive the timestamp (`new Date(t).getTime() + 60_000`) instead of sleeping. Assert tombstones structurally: the entity is still in the array with `deletedAt` set, and the `active*` helpers no longer return it.

### Assertion Best Practices

- Prefer expressive matchers such as `toContain`, `toContainEqual`, or `toMatchObject` instead of manual array scans with `.some`
- Mutations generate ids with `crypto.randomUUID()`; capture them from the mutation result (`created.tripId`) rather than hand-typing uuids — zod's `.uuid()` validates version/variant bits and rejects made-up ids like `'11111111-1111-1111-1111-111111111111'`

### Additional Guidelines

- Don't export internal helpers purely for test coverage
- The suite runs with `TZ=UTC` — never write an assertion that only holds in one machine's timezone

## Route-Level Testing

The intended pattern for testing route behavior is Remix's router testing: drive the app with `router.fetch(new Request(...))` and assert on the returned `Response`, using `routes.<name>.href(...)` so URLs stay coupled to the route contract. See `.agents/skills/remix/references/testing-patterns.md` for the full patterns. There are no router tests in the codebase yet — the server only renders page shells, so almost all behavior lives in the business layer and screens. When adding the first router test, follow that reference.

## E2E Testing

Deferred. There is no Playwright suite, no coverage gate, and no E2E harness yet. When E2E lands, this skill must be extended in the same change.
