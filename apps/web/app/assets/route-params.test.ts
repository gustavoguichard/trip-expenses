import { describe, expect, it } from 'vitest'

import { routes } from '../routes.ts'
import { paramsFromPathname } from './route-params.ts'

const tripId = '8a56d02f-3d31-4a10-b8c4-6ea5702c8f21'
const expenseId = 'f1c9a7de-52bb-4f6a-9c53-08c3a4f6d901'

describe('paramsFromPathname', () => {
  it('round-trips every pattern in routes.ts', () => {
    expect(paramsFromPathname(routes.home.href())).toEqual({})
    expect(paramsFromPathname(routes.join.href())).toEqual({})
    expect(paramsFromPathname(routes.trips.new.href())).toEqual({})
    expect(
      paramsFromPathname(routes.assets.href({ path: 'app/assets/entry.ts' }))
    ).toEqual({ path: 'app/assets/entry.ts' })
    expect(paramsFromPathname(routes.trips.show.href({ tripId }))).toEqual({
      tripId,
    })
    expect(
      paramsFromPathname(routes.trips.newExpense.href({ tripId }))
    ).toEqual({ tripId })
    expect(
      paramsFromPathname(routes.trips.expense.href({ tripId, expenseId }))
    ).toEqual({ tripId, expenseId })
    expect(paramsFromPathname(routes.trips.balances.href({ tripId }))).toEqual({
      tripId,
    })
    expect(paramsFromPathname(routes.trips.charts.href({ tripId }))).toEqual({
      tripId,
    })
    expect(paramsFromPathname(routes.trips.members.href({ tripId }))).toEqual({
      tripId,
    })
    expect(paramsFromPathname(routes.trips.invite.href({ tripId }))).toEqual({
      tripId,
    })
  })

  it('never mistakes the static trip pages for parameterized ones', () => {
    expect(paramsFromPathname('/trips/new')).toEqual({})
    expect(paramsFromPathname(`/trips/${tripId}/expenses/new`)).toEqual({
      tripId,
    })
  })

  it('returns no params for unknown paths', () => {
    expect(paramsFromPathname('/nowhere/at/all')).toEqual({})
  })
})
