---
name: composable-functions
description: Work with composable-functions library for type-safe business logic. Use when working with applySchema, withContext, pipe, sequence, business functions, context validation, input validation, or when user mentions composable functions, schemas, or error handling patterns.
---

# Composable Functions

Work with the composable-functions library (v5.0.0) for building type-safe, composable business logic.

## Overview

Composable functions provide a functional programming approach to building robust business logic with:

- **Type safety**: Full TypeScript support with type inference
- **Error handling**: Structured error types (InputError, ContextError)
- **Composition**: Combinators like pipe, sequence, all, collect
- **Schema validation**: Runtime validation with Zod or other @standard-schema libraries
- **Context passing**: Automatic context forwarding

## Core Types

### Composable

A function that returns `Promise<Result<T>>`:

```typescript
import { composable } from 'composable-functions'

const add = composable((a: number, b: number) => a + b)
//    ^? Composable<(a: number, b: number) => number>
```

### Result

Union type representing success or failure:

```typescript
type Result<T> = Success<T> | Failure

// Success
{
  success: true,
  data: T,
  errors: []
}

// Failure
{
  success: false,
  errors: Error[]
}
```

Always check `success` before accessing `data`:

```typescript
const result = await fn()
if (!result.success) {
  // Handle errors
  return
}
// result.data is now type-safe
```

## Error Types

### InputError

Validation errors for user input:

```typescript
import { InputError } from 'composable-functions'

throw new InputError('Required field', ['description'])
```

### ContextError

Errors about the environment the function runs in:

```typescript
import { ContextError } from 'composable-functions'

throw new ContextError('Document missing', ['document'])
```

### ErrorList

Group multiple errors:

```typescript
import { ErrorList, InputError, ContextError } from 'composable-functions'

throw new ErrorList([
  new InputError('Required', ['name']),
  new ContextError('Missing', ['document'])
])
```

## Schema Validation with applySchema

Use `applySchema` to validate inputs and context at runtime:

```typescript
import { applySchema } from 'composable-functions'
import { z } from 'zod'

const fn = applySchema(
  z.object({ id: z.string() }),        // Input schema
  z.object({ document: documentSchema }) // Context schema
)(({ id }, { document }) => {
  // Both input and context are validated
  return findTrip(document, id)
})
```

In this repo, every mutation uses `documentContextSchema` from `app/business/store.common.ts` — the context is always `{ document }`, and the function returns the **next document** (plus any ids the caller needs):

```typescript
import { applySchema } from 'composable-functions'
import { documentContextSchema, findTrip, now, replaceTrip } from './store.common.ts'

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

Mutations never touch storage — they are pure transformations from `(input, { document })` to `{ document: nextDocument, ... }`. Persisting is the caller's job (`mutateDocument` in `app/assets/store.ts`).

## Composition Combinators

### pipe

Sequential composition (left to right):

```typescript
import { pipe } from 'composable-functions'

const add = (a: number, b: number) => a + b
const double = (n: number) => n * 2
const addAndDouble = pipe(add, double)

const result = await addAndDouble(2, 3)
// result.data = 10
```

### sequence

Like pipe, but returns all intermediate results:

```typescript
import { sequence } from 'composable-functions'

const a = (n: number) => String(n)
const b = (s: string) => s === '1'
const fn = sequence(a, b)

const result = await fn(1)
// result.data = ['1', true]
```

### all

Run functions in parallel with same inputs:

```typescript
import { all } from 'composable-functions'

const add = (a: number, b: number) => a + b
const mul = (a: number, b: number) => a * b
const fn = all(add, mul)

const result = await fn(2, 3)
// result.data = [5, 6]
```

### collect

Like all, but with named results:

```typescript
import { collect } from 'composable-functions'

const sum = (a: number, b: number) => a + b
const product = (a: number, b: number) => a * b
const fn = collect({ sum, product })

const result = await fn(2, 3)
// result.data = { sum: 5, product: 6 }
```

### branch

Conditional execution:

```typescript
import { branch } from 'composable-functions'

const getIdOrName = (data: { id?: string, name?: string }) =>
  data.id ?? data.name

const findById = (id: string) => catalog.get(id)
const findByName = (name: string) => catalog.search(name)

const findEntry = branch(
  getIdOrName,
  (idOrName) => idOrName?.includes('-') ? findById : findByName
)
```

### map

Transform successful output:

```typescript
import { map } from 'composable-functions'

const add = (a: number, b: number) => a + b
const addAndFormat = map(add, (sum) => `Result: ${sum}`)

const result = await addAndFormat(2, 3)
// result.data = 'Result: 5'
```

## Working with Context

The `withContext` namespace provides combinators that automatically pass context through compositions:

### withContext.pipe

```typescript
import { withContext } from 'composable-functions'

const a = (str: string, ctx: { document: TripDocument }) => str === '1'
const b = (bool: boolean, ctx: { document: TripDocument }) => bool && ctx.document.trips.length > 0

const fn = withContext.pipe(a, b)

const result = await fn('1', { document })
// result.data = true
```

### withContext.sequence

```typescript
import { withContext } from 'composable-functions'

const a = (n: number, ctx: { document: TripDocument }) => String(n)
const b = (s: string, ctx: { document: TripDocument }) => s === '1'

const fn = withContext.sequence(a, b)

const result = await fn(1, { document })
// result.data = ['1', true]
```

Note: a pipeline of document mutations cannot thread the document through `withContext` — each step returns a **new** document while the context keeps the old one. Compose mutations by passing the previous step's `result.data.document` as the next step's context (see `addSettlement` in `app/business/expenses.common.ts`, which calls `addExpense` with the same context it received).

## Application Patterns

The three-layer architecture is: screens (`app/assets/*-screen.tsx` clientEntry components) → the store glue (`app/assets/store.ts`) → business mutations (`app/business/*.common.ts`).

### Screens call mutations through mutateDocument

`mutateDocument(mutation, input)` loads the current document from localStorage, runs the composable with `{ document }` as context, persists `result.data.document` on success, and surfaces the first error message on failure:

```typescript
const { data, error } = await mutateDocument(addMember, {
  tripId: handle.props.tripId,
  name,
  emoji,
})
if (error) {
  // show the message; the document was not touched
}
```

Because `applySchema` catches thrown errors into the failure channel, plain `throw new Error('Trip not found')` inside a mutation becomes the user-facing message — write those messages for the user.

### Deriving types

Use `UnpackData` to type values from a business function's output when a screen or helper needs the shape:

```typescript
import type { UnpackData } from 'composable-functions'
import type { createTrip } from '../business/trips.common.ts'

type CreateTripOutput = UnpackData<typeof createTrip>
```

## Error Handling

### Check error types

```typescript
import { isInputError, isContextError } from 'composable-functions'

const result = await fn(input)
if (!result.success) {
  const inputErrors = result.errors.filter(isInputError)
  const contextErrors = result.errors.filter(isContextError)
}
```

### Transform errors

```typescript
import { mapErrors } from 'composable-functions'

const withCustomErrors = mapErrors(fn, (errors) =>
  errors.map(e => e.message.includes('Not found')
    ? new NotFoundError()
    : e
  )
)
```

### Catch failures

```typescript
import { catchFailure } from 'composable-functions'

const optional = catchFailure(fn, (errors, ...args) => {
  console.log('Failed:', errors)
  return null
})
```

## Utilities

### fromSuccess

Unwrap successful result or throw errors:

```typescript
import { fromSuccess } from 'composable-functions'

const created = await fromSuccess(createTrip)(input, { document })
// created.document, created.tripId — no success check needed
```

This is the workhorse of the test suite and of `fixtures.common.ts` — use it whenever a failure would be a bug rather than a case to handle.

### success / failure

Create results manually:

```typescript
import { success, failure } from 'composable-functions'

return success({ data: 'value' })
return failure([new Error('Something wrong')])
```

### serialize / serializeError

Make results JSON-safe:

```typescript
import { serialize } from 'composable-functions'

const serialized = JSON.stringify(serialize(result))
```

## Form Input Helpers

Extract structured data from web requests:

```typescript
import {
  inputFromForm,      // Extract from Request (FormData)
  inputFromFormData,  // Extract from FormData object
  inputFromUrl,       // Extract from Request (query params)
  inputFromSearch,    // Extract from URLSearchParams
} from 'composable-functions'
```

These matter little here — screens build mutation inputs as plain objects from their own uncontrolled inputs, not from form posts. If they ever come into play: form parsing builds an array from a field only when the request body repeats the key with a `[]` suffix (`shares[]=30&shares[]=31`). A repeated bare key only parses as an array when there are two or more entries; a single entry arrives as a scalar and fails an array schema.

## Common Patterns

### Chained mutations

```typescript
const spent = await fromSuccess(addExpense)(expenseInput, { document })
const settled = await fromSuccess(addSettlement)(settlementInput, {
  document: spent.document,
})
// settled.document carries both changes
```

### Parallel derived data

```typescript
const overview = collect({
  balances: composable(memberBalances),
  total: composable(tripTotal),
})

const result = await overview(trip)
// result.data = { balances, total }
```

### Guarding inside a mutation

```typescript
const removeMember = applySchema(inputSchema, documentContextSchema)(
  ({ tripId, memberId }, { document }) => {
    const trip = findTrip(document, tripId)
    if (!trip) throw new Error('Trip not found')
    if (memberHasExpenses(trip, memberId)) {
      throw new Error('This person has expenses on the trip and cannot be removed')
    }
    return { document: replaceTrip(document, tombstoneMember(trip, memberId)) }
  }
)
```

## Complete Documentation

For the full API reference, migration guides, and all code examples, see [references/complete-docs.md](references/complete-docs.md).

## Best Practices

1. **Always validate context**: Use `documentContextSchema` with `applySchema`
2. **Check success before data access**: TypeScript enforces this
3. **Return the next document**: Mutations are pure — `{ document: nextDocument, ...ids }`, never a storage write
4. **Use specific error types**: InputError for user input problems the schema can't express; plain `throw new Error` for user-facing domain messages
5. **Prefer composition over nesting**: Use combinators instead of manual composition
6. **Keep functions focused**: One composable = one responsibility
7. **Test with fromSuccess**: Unwrap results in tests for simpler assertions
