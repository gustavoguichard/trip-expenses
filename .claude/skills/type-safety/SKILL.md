---
name: type-safety
description: Write minimal, correct TypeScript type annotations. Use when adding types, declaring variables, writing function signatures, creating type aliases, or reviewing code for unnecessary type declarations.
---

# Type Safety

Lean on TypeScript's inference. Only add type annotations when removing them would lose type safety or cause a compile error. Before adding any annotation, ask: "Would TypeScript infer the correct type without this?"

## Return Types

Do not add return types to functions. TypeScript infers them from the function body.

```typescript
// correct
function activeShares(expense: Expense) {
  const shares: Share[] = []
  // ...
  return shares
}

// wrong — redundant return type
function activeShares(expense: Expense): Share[] {
  const shares: Share[] = []
  // ...
  return shares
}
```

### Exceptions where return types are required

- **Interface implementations** — when a method must satisfy a library interface
- **Non-async functions returning promises** — when the function returns a promise without `async`, TypeScript may infer a more complex type than intended
- **Literal-typed entity construction** — annotating a constructed value (`const trip: Trip = { ... }`) is sometimes clearer than annotating the function; either way, one annotation, not both

## Variable Annotations

Do not annotate variables when the type is obvious from the right-hand side.

```typescript
// correct — type inferred from string literal
const name = 'hello'

// wrong — redundant
const name: string = 'hello'
```

### Empty collections need annotations

TypeScript cannot infer the element type from an empty literal. Always annotate empty arrays and objects that will be populated later.

```typescript
// correct — TypeScript can't know this will hold strings
const lines: string[] = []
const chunks: Uint8Array[] = []

// correct — TypeScript can't infer target shape from {}
const totals = expenses.reduce<Record<string, number>>(
  (sums, expense) => ({
    ...sums,
    [expense.categoryId]: (sums[expense.categoryId] ?? 0) + expense.amountCents,
  }),
  {},
)
```

## Record Types on Map Constants

When a constant object is indexed with a dynamic string key, it needs `Record<string, string>`. Without it, TypeScript infers a specific literal object type that doesn't accept arbitrary string indexing.

```typescript
// correct — indexed with dynamic key: MAP[someVariable]
const CURRENCY_SYMBOLS: Record<string, string> = {
  BRL: 'R$',
  USD: '$',
  EUR: '€',
}
const symbol = CURRENCY_SYMBOLS[currency] // works

// If only accessed via Object.entries or Object.keys, the annotation
// is optional but keep it for consistency with other maps in the file
```

## Function Parameter Defaults

A default value of `{}` or `[]` does not tell TypeScript the intended type. Annotate the parameter.

```typescript
// correct — the default alone would give the parameter no useful type
async function seedTrip(document: TripDocument = emptyDocument()) { ... }
```

## Zod Type Aliases

Use `z.infer<typeof schema>` to derive types from Zod schemas. Do not manually write a type that mirrors a schema.

```typescript
// correct — single source of truth (see app/business/store.common.ts)
const tripSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(80),
  // ...
})
type Trip = z.infer<typeof tripSchema>
```

Only keep a `z.infer` type alias if it is used in more than one place. If it only appears as a function return type annotation, remove both the alias and the annotation — TypeScript infers the return type from the Zod-parsed result.

## Reuse Existing Types

Before writing an inline type, check if the same shape already exists. Import it instead of duplicating.

```typescript
// correct — reuses the entity types from the document schema
import type { Member, Trip } from './store.common.ts'
function withMember(trip: Trip, member: Member) { ... }

// wrong — duplicates the Member shape
function withMember(trip: Trip, member: { id: string; name: string; emoji: string }) { ... }
```

Key shared types in this codebase:
- Entity types (`Trip`, `Member`, `Expense`, `Share`, `TripDocument`) from `app/business/store.common.ts` — all `z.infer` of the document schema
- `InvitePayload` from `app/business/sync.common.ts`
- `Category` from `app/business/categories.common.ts`
- `LocalStore<Document>` and `ChunkProgress` from `app/framework/`

## Route and Business-Derived Types

URLs come from the route contract: use `routes.<name>.href(...)` from `app/routes.ts` for every link, navigation, and test URL — never string concatenation.

Code consuming a business function's output derives the type from that function with `UnpackData` instead of re-declaring the shape:

```typescript
// correct — derived from the mutation
import type { UnpackData } from 'composable-functions'
import type { createTrip } from '../business/trips.common.ts'

type CreateTripOutput = UnpackData<typeof createTrip>

// wrong — hand-writing a type that mirrors the mutation's return
type CreateTripOutput = { document: TripDocument; tripId: string }
```

## Generic Type Arguments

Do not pass explicit generic arguments when TypeScript can infer them from the function arguments. The one standing exception is a factory whose generic cannot be inferred from its inputs — `makeLocalStore<TripDocument>({ ... })` names the document type on purpose.

```typescript
// correct — generics inferred from arguments
const merged = mergeById(mine, theirs, newer)

// wrong — unnecessarily explicit
const merged = mergeById<Expense>(mine, theirs, newer)
```

## Type Assertions

Use `as` assertions only when TypeScript genuinely cannot know the type:
- DOM nodes from `ref` callbacks — `node as HTMLVideoElement` when the mixin target is known
- `response.json()` from untyped HTTP APIs — cast to the expected shape
- `as const` for literal tuples and objects that should not be widened
- `{} as LibraryType` in tests for mocking

Do not use `as` to silence type errors — fix the underlying type instead. And never reach for a non-null assertion (`!`): Biome flags it as a warning and warnings fail the lint gate — write the guard instead.
