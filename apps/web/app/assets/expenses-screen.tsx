import type { Handle } from 'remix/ui'
import { clientEntry } from 'remix/ui'

import { findCategory } from '../business/categories.common.ts'
import {
  activeExpenses,
  type Expense,
  findTrip,
  type Trip,
} from '../business/store.common.ts'
import { myMember } from '../business/trips.common.ts'
import { routes } from '../routes.ts'
import { formatCents, formatDay } from './money.ts'
import { bindDocument, deviceId } from './store.ts'
import { Loading, TripChrome, TripMissing } from './trip-chrome.tsx'
import { BottomBar, buttonPrimary } from './widgets.tsx'

function memberName(trip: Trip, memberId: string) {
  return trip.members.find((member) => member.id === memberId)?.name ?? 'Alguém'
}

function ExpenseRow(
  handle: Handle<{ trip: Trip; expense: Expense; myMemberId: string | null }>
) {
  return () => {
    const { trip, expense, myMemberId } = handle.props
    const category = findCategory(expense.categoryId)
    const payer = memberName(trip, expense.paidBy)
    const myShare =
      expense.shares.find((share) => share.memberId === myMemberId)
        ?.amountCents ?? 0
    const iPaid = expense.paidBy === myMemberId
    const lentCents = iPaid ? expense.amountCents - myShare : 0
    const settlement = expense.kind === 'settlement'

    return (
      <a
        href={routes.trips.expense.href({
          tripId: trip.id,
          expenseId: expense.id,
        })}
        class="flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-raised/60"
      >
        <span
          class={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-[17px] ${
            settlement
              ? 'border-green/30 bg-green-wash'
              : 'border-line-bright bg-raised'
          }`}
        >
          {category?.emoji ?? '💸'}
        </span>
        <span class="min-w-0 flex-1">
          <span
            class={`block truncate text-[15px] ${settlement ? 'text-muted' : 'font-medium'}`}
          >
            {expense.description}
          </span>
          <span class="mono-caption text-faint">
            {settlement
              ? 'contas acertadas'
              : `${payer} pagou · ${expense.shares.length} ${
                  expense.shares.length === 1 ? 'parte' : 'partes'
                }`}
          </span>
        </span>
        <span class="text-right">
          <span class="tabular block text-[15px] font-semibold">
            {formatCents(expense.amountCents, trip.currency)}
          </span>
          {settlement || myMemberId === null ? null : iPaid ? (
            lentCents > 0 ? (
              <span class="mono-caption text-green">
                você emprestou {formatCents(lentCents, trip.currency)}
              </span>
            ) : (
              <span class="mono-caption text-faint">despesa sua</span>
            )
          ) : myShare > 0 ? (
            <span class="mono-caption text-red">
              você deve {formatCents(myShare, trip.currency)}
            </span>
          ) : (
            <span class="mono-caption text-faint">você está de fora</span>
          )}
        </span>
      </a>
    )
  }
}

export const ExpensesScreen = clientEntry(
  import.meta.url,
  function ExpensesScreen(handle: Handle<{ tripId: string }>) {
    const data = bindDocument(handle)

    return () => {
      if (!data.ready()) {
        return (
          <div mix={data.mount}>
            <Loading />
          </div>
        )
      }

      const trip = findTrip(data.document(), handle.props.tripId)
      if (!trip) {
        return (
          <div mix={data.mount}>
            <TripMissing />
          </div>
        )
      }

      const me = myMember(trip, deviceId())
      const expenses = [...activeExpenses(trip)].sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          (b.updatedAt > a.updatedAt ? 1 : b.updatedAt < a.updatedAt ? -1 : 0)
      )
      const days = [...new Set(expenses.map((expense) => expense.date))]

      return (
        <div mix={data.mount}>
          <TripChrome trip={trip} active="expenses" />

          {expenses.length === 0 ? (
            <div class="rounded-2xl border border-line bg-panel px-6 py-14 text-center">
              <p class="text-[24px]">🧾</p>
              <p class="mt-3 text-[17px] font-semibold">
                Nenhuma despesa ainda
              </p>
              <p class="mono-caption mx-auto mt-2 max-w-xs text-muted">
                Adicione a primeira — jantares, corridas, ingressos — e a gente
                mantém a conta em dia.
              </p>
            </div>
          ) : (
            <div class="space-y-5">
              {days.map((date) => {
                const dayExpenses = expenses.filter(
                  (expense) => expense.date === date
                )
                const dayTotal = dayExpenses
                  .filter((expense) => expense.kind === 'expense')
                  .reduce((total, expense) => total + expense.amountCents, 0)
                return (
                  <section key={date}>
                    <header class="mb-2 flex items-baseline justify-between px-1">
                      <h2 class="mono-label text-faint">{formatDay(date)}</h2>
                      <span class="mono-caption tabular text-faint">
                        {formatCents(dayTotal, trip.currency)}
                      </span>
                    </header>
                    <div class="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
                      {dayExpenses.map((expense) => (
                        <ExpenseRow
                          key={expense.id}
                          trip={trip}
                          expense={expense}
                          myMemberId={me?.id ?? null}
                        />
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          )}

          <div class="sm:hidden">
            <BottomBar>
              <a
                href={routes.trips.newExpense.href({ tripId: trip.id })}
                class={`${buttonPrimary} flex-1`}
              >
                + Adicionar despesa
              </a>
            </BottomBar>
          </div>
          <div class="pointer-events-none fixed inset-x-0 bottom-6 z-30 hidden justify-center px-4 sm:flex">
            <a
              href={routes.trips.newExpense.href({ tripId: trip.id })}
              class={`${buttonPrimary} pointer-events-auto shadow-[0_12px_32px_rgba(0,0,0,0.55)]`}
            >
              + Adicionar despesa
            </a>
          </div>
        </div>
      )
    }
  }
)
