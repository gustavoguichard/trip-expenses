import { createController } from 'remix/router'

import { BalancesScreen } from '../../assets/balances-screen.tsx'
import { ChartsScreen } from '../../assets/charts-screen.tsx'
import { ExpenseFormScreen } from '../../assets/expense-form-screen.tsx'
import { ExpensesScreen } from '../../assets/expenses-screen.tsx'
import { InviteScreen } from '../../assets/invite-screen.tsx'
import { MembersScreen } from '../../assets/members-screen.tsx'
import { TripNewScreen } from '../../assets/trip-new-screen.tsx'
import { routes } from '../../routes.ts'
import { AppShell } from '../../ui/app-shell.tsx'

export default createController(routes.trips, {
  actions: {
    new(context) {
      return context.render(
        <AppShell title="Nova viagem — Trip Expenses">
          <TripNewScreen />
        </AppShell>
      )
    },
    show(context) {
      return context.render(
        <AppShell>
          <ExpensesScreen />
        </AppShell>
      )
    },
    newExpense(context) {
      return context.render(
        <AppShell title="Adicionar despesa — Trip Expenses">
          <ExpenseFormScreen />
        </AppShell>
      )
    },
    expense(context) {
      return context.render(
        <AppShell title="Editar despesa — Trip Expenses">
          <ExpenseFormScreen />
        </AppShell>
      )
    },
    balances(context) {
      return context.render(
        <AppShell title="Saldos — Trip Expenses">
          <BalancesScreen />
        </AppShell>
      )
    },
    charts(context) {
      return context.render(
        <AppShell title="Gráficos — Trip Expenses">
          <ChartsScreen />
        </AppShell>
      )
    },
    members(context) {
      return context.render(
        <AppShell title="Pessoas — Trip Expenses">
          <MembersScreen />
        </AppShell>
      )
    },
    invite(context) {
      return context.render(
        <AppShell title="Convite — Trip Expenses">
          <InviteScreen />
        </AppShell>
      )
    },
  },
})
