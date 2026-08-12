import { z } from 'zod'

import {
  type Expense,
  type Member,
  observeStamp,
  type Trip,
  type TripDocument,
  tripSchema,
} from './store.common.ts'

const invitePayloadSchema = z.object({
  kind: z.literal('trip'),
  trip: tripSchema,
  inviteMemberId: z.uuid().nullable(),
})

type InvitePayload = z.infer<typeof invitePayloadSchema>

function makeInvitePayload(
  trip: Trip,
  inviteMemberId: string | null
): InvitePayload {
  return { kind: 'trip', trip, inviteMemberId }
}

function parseInvitePayload(raw: string) {
  try {
    const parsed = invitePayloadSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

const inviteLinkHashPrefix = '#s='

function inviteLinkHash(encoded: string) {
  return `${inviteLinkHashPrefix}${encoded}`
}

function encodedFromLinkHash(hash: string) {
  return hash.startsWith(inviteLinkHashPrefix)
    ? hash.slice(inviteLinkHashPrefix.length)
    : null
}

function unsharedChanges(trip: Trip, lastSharedAt: string | null) {
  const entities = [trip, ...trip.members, ...trip.expenses]
  if (lastSharedAt === null) {
    return trip.expenses.length === 0 ? 0 : entities.length
  }
  return entities.filter((entity) => entity.updatedAt > lastSharedAt).length
}

const newer = <Entity extends { updatedAt: string }>(a: Entity, b: Entity) =>
  a.updatedAt >= b.updatedAt ? a : b

function mergeMembers(mine: Member[], theirs: Member[]) {
  return mergeById(mine, theirs, (a, b) => {
    const winner = newer(a, b)
    const deviceIds = [...new Set([...a.deviceIds, ...b.deviceIds])]
    return { ...winner, deviceIds }
  })
}

function mergeExpenses(mine: Expense[], theirs: Expense[]) {
  return mergeById(mine, theirs, newer)
}

function mergeById<Entity extends { id: string; updatedAt: string }>(
  mine: Entity[],
  theirs: Entity[],
  resolve: (a: Entity, b: Entity) => Entity
) {
  const merged = new Map(mine.map((entity) => [entity.id, entity]))
  for (const entity of theirs) {
    const existing = merged.get(entity.id)
    merged.set(entity.id, existing ? resolve(existing, entity) : entity)
  }
  return [...merged.values()]
}

type TripScalarField = 'name' | 'emoji' | 'currency'

const tripScalarFields: TripScalarField[] = ['name', 'emoji', 'currency']

const fieldStamp = (trip: Trip, field: TripScalarField) =>
  trip.fieldStamps?.[field] ?? trip.updatedAt

function mergeScalars(mine: Trip, theirs: Trip) {
  const winnerOf = (field: TripScalarField) =>
    fieldStamp(mine, field) >= fieldStamp(theirs, field) ? mine : theirs

  const winners = {
    name: winnerOf('name'),
    emoji: winnerOf('emoji'),
    currency: winnerOf('currency'),
  }
  const tracked = mine.fieldStamps || theirs.fieldStamps

  return {
    name: winners.name.name,
    emoji: winners.emoji.emoji,
    currency: winners.currency.currency,
    ...(tracked
      ? {
          fieldStamps: Object.fromEntries(
            tripScalarFields.map((field) => [
              field,
              fieldStamp(winners[field], field),
            ])
          ),
        }
      : {}),
  }
}

function mergeTrip(mine: Trip, theirs: Trip): Trip {
  const winner = newer(mine, theirs)
  return {
    ...winner,
    ...mergeScalars(mine, theirs),
    members: mergeMembers(mine.members, theirs.members),
    expenses: mergeExpenses(mine.expenses, theirs.expenses),
  }
}

function observeIncomingStamps(incoming: Trip) {
  observeStamp(incoming.updatedAt)
  for (const stamp of Object.values(incoming.fieldStamps ?? {})) {
    observeStamp(stamp)
  }
  for (const member of incoming.members) observeStamp(member.updatedAt)
  for (const expense of incoming.expenses) observeStamp(expense.updatedAt)
}

function importTrip(document: TripDocument, incoming: Trip): TripDocument {
  observeIncomingStamps(incoming)
  const existing = document.trips.find((trip) => trip.id === incoming.id)
  if (!existing) {
    return { ...document, trips: [...document.trips, incoming] }
  }
  return {
    ...document,
    trips: document.trips.map((trip) =>
      trip.id === incoming.id ? mergeTrip(trip, incoming) : trip
    ),
  }
}

export type { InvitePayload }
export {
  encodedFromLinkHash,
  importTrip,
  inviteLinkHash,
  invitePayloadSchema,
  makeInvitePayload,
  mergeTrip,
  parseInvitePayload,
  unsharedChanges,
}
