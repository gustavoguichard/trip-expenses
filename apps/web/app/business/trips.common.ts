import { applySchema } from 'composable-functions'
import { z } from 'zod'

import {
  activeExpenses,
  activeMembers,
  documentContextSchema,
  findTrip,
  isActive,
  type Member,
  newId,
  now,
  replaceTrip,
  type Trip,
} from './store.common.ts'

const memberInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  emoji: z.string().min(1).max(16),
})

const createTripSchema = z.object({
  name: z.string().trim().min(1).max(80),
  emoji: z.string().min(1).max(16),
  currency: z.string().length(3).toUpperCase(),
  members: z.array(memberInputSchema).min(1),
})

const createTrip = applySchema(
  createTripSchema,
  documentContextSchema
)(({ name, emoji, currency, members }, { document }) => {
  const timestamp = now()
  const trip: Trip = {
    id: newId(),
    name,
    emoji,
    currency,
    members: members.map((member) => newMember(member, timestamp)),
    expenses: [],
    updatedAt: timestamp,
    deletedAt: null,
  }

  return {
    document: { ...document, trips: [...document.trips, trip] },
    tripId: trip.id,
  }
})

const updateTripSchema = z.object({
  tripId: z.uuid(),
  name: z.string().trim().min(1).max(80).optional(),
  emoji: z.string().min(1).max(16).optional(),
  currency: z.string().length(3).toUpperCase().optional(),
})

const updateTrip = applySchema(
  updateTripSchema,
  documentContextSchema
)(({ tripId, ...fields }, { document }) => {
  const trip = findTrip(document, tripId)
  if (!trip) throw new Error('Trip not found')

  return {
    document: replaceTrip(document, {
      ...trip,
      name: fields.name ?? trip.name,
      emoji: fields.emoji ?? trip.emoji,
      currency: fields.currency ?? trip.currency,
      updatedAt: now(),
    }),
  }
})

const deleteTripSchema = z.object({ tripId: z.uuid() })

const deleteTrip = applySchema(
  deleteTripSchema,
  documentContextSchema
)(({ tripId }, { document }) => {
  const trip = findTrip(document, tripId)
  if (!trip) throw new Error('Trip not found')

  const timestamp = now()
  return {
    document: replaceTrip(document, {
      ...trip,
      updatedAt: timestamp,
      deletedAt: timestamp,
    }),
  }
})

const addMemberSchema = z.object({
  tripId: z.uuid(),
  name: z.string().trim().min(1).max(60),
  emoji: z.string().min(1).max(16),
})

const addMember = applySchema(
  addMemberSchema,
  documentContextSchema
)(({ tripId, name, emoji }, { document }) => {
  const trip = findTrip(document, tripId)
  if (!trip) throw new Error('Trip not found')

  const member = newMember({ name, emoji }, now())
  return {
    document: replaceTrip(document, {
      ...trip,
      members: [...trip.members, member],
      updatedAt: member.updatedAt,
    }),
    memberId: member.id,
  }
})

const updateMemberSchema = z.object({
  tripId: z.uuid(),
  memberId: z.uuid(),
  name: z.string().trim().min(1).max(60).optional(),
  emoji: z.string().min(1).max(16).optional(),
})

const updateMember = applySchema(
  updateMemberSchema,
  documentContextSchema
)(({ tripId, memberId, ...fields }, { document }) => {
  const trip = findTrip(document, tripId)
  if (!trip) throw new Error('Trip not found')

  const member = activeMembers(trip).find(
    (candidate) => candidate.id === memberId
  )
  if (!member) throw new Error('Member not found')

  const updated: Member = {
    ...member,
    name: fields.name ?? member.name,
    emoji: fields.emoji ?? member.emoji,
    updatedAt: now(),
  }

  return { document: replaceTrip(document, withMember(trip, updated)) }
})

const removeMemberSchema = z.object({
  tripId: z.uuid(),
  memberId: z.uuid(),
})

const removeMember = applySchema(
  removeMemberSchema,
  documentContextSchema
)(({ tripId, memberId }, { document }) => {
  const trip = findTrip(document, tripId)
  if (!trip) throw new Error('Trip not found')

  const member = activeMembers(trip).find(
    (candidate) => candidate.id === memberId
  )
  if (!member) throw new Error('Member not found')

  const involved = activeExpenses(trip).some(
    (expense) =>
      expense.paidBy === memberId ||
      expense.shares.some((share) => share.memberId === memberId)
  )
  if (involved) {
    throw new Error(
      'This person has expenses on the trip and cannot be removed'
    )
  }

  const timestamp = now()
  const removed: Member = {
    ...member,
    updatedAt: timestamp,
    deletedAt: timestamp,
  }

  return { document: replaceTrip(document, withMember(trip, removed)) }
})

const claimMemberSchema = z.object({
  tripId: z.uuid(),
  memberId: z.uuid(),
  deviceId: z.string().min(1),
})

const claimMember = applySchema(
  claimMemberSchema,
  documentContextSchema
)(({ tripId, memberId, deviceId }, { document }) => {
  const trip = findTrip(document, tripId)
  if (!trip) throw new Error('Trip not found')

  const members = trip.members.map((member) => {
    if (!isActive(member)) return member
    const claims = member.deviceIds.filter((id) => id !== deviceId)
    if (member.id !== memberId) {
      return claims.length === member.deviceIds.length
        ? member
        : { ...member, deviceIds: claims, updatedAt: now() }
    }
    return { ...member, deviceIds: [...claims, deviceId], updatedAt: now() }
  })

  return { document: replaceTrip(document, { ...trip, members }) }
})

function newMember(
  { name, emoji }: { name: string; emoji: string },
  timestamp: string
): Member {
  return {
    id: newId(),
    name,
    emoji,
    deviceIds: [],
    updatedAt: timestamp,
    deletedAt: null,
  }
}

function withMember(trip: Trip, member: Member): Trip {
  return {
    ...trip,
    members: trip.members.map((candidate) =>
      candidate.id === member.id ? member : candidate
    ),
    updatedAt: member.updatedAt,
  }
}

const myMember = (trip: Trip, deviceId: string) =>
  activeMembers(trip).find((member) => member.deviceIds.includes(deviceId)) ??
  null

export {
  addMember,
  claimMember,
  createTrip,
  deleteTrip,
  myMember,
  removeMember,
  updateMember,
  updateTrip,
}
