import { get, route } from 'remix/routes'

export const routes = route({
  assets: get('/assets/*path'),
  home: '/',
  join: get('/join'),
  trips: route('trips', {
    new: get('new'),
    show: get(':tripId'),
    newExpense: get(':tripId/expenses/new'),
    expense: get(':tripId/expenses/:expenseId'),
    balances: get(':tripId/balances'),
    charts: get(':tripId/charts'),
    members: get(':tripId/members'),
    invite: get(':tripId/invite'),
  }),
})
