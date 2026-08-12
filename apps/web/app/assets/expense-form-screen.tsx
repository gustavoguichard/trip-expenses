import type { Handle } from 'remix/ui'
import { clientEntry, navigate, on } from 'remix/ui'

import {
  categories,
  settlementCategory,
} from '../business/categories.common.ts'
import {
  addExpense,
  deleteExpense,
  equalShares,
  parseAmount,
  updateExpense,
} from '../business/expenses.common.ts'
import {
  activeExpenses,
  activeMembers,
  findTrip,
  type Member,
  type Trip,
} from '../business/store.common.ts'
import { myMember } from '../business/trips.common.ts'
import { routes } from '../routes.ts'
import { formatCents, today } from './money.ts'
import { bindDocument, deviceId, mutateDocument } from './store.ts'
import { Loading, TripMissing } from './trip-chrome.tsx'
import {
  Avatar,
  BottomBar,
  buttonDanger,
  buttonPrimary,
  EmojiPicker,
  ErrorNote,
  inputClass,
  SectionLabel,
} from './widgets.tsx'

type FormState = {
  description: string
  amountText: string
  date: string
  categoryId: string
  paidBy: string
  splitMode: 'equally' | 'custom'
  splitWith: Set<string>
  customAmounts: Map<string, string>
}

function MemberChip(
  handle: Handle<{
    member: Member
    selected: boolean
    onToggle: () => void
  }>
) {
  return () => {
    const { member, selected, onToggle } = handle.props
    return (
      <button
        type="button"
        aria-pressed={selected}
        class={`flex cursor-pointer items-center gap-2 rounded-full border py-2 pr-3.5 pl-2 transition-colors ${
          selected
            ? 'border-amber bg-amber-wash text-ink'
            : 'border-line-bright text-muted hover:border-amber/60'
        }`}
        mix={on('click', onToggle)}
      >
        <Avatar emoji={member.emoji} size="sm" />
        <span class="text-[13px] font-medium">{member.name}</span>
      </button>
    )
  }
}

export const ExpenseFormScreen = clientEntry(
  import.meta.url,
  function ExpenseFormScreen(
    handle: Handle<{ tripId: string; expenseId?: string }>
  ) {
    const data = bindDocument(handle)
    let form: FormState | null = null
    let error = ''
    let saving = false

    function seedForm(trip: Trip) {
      const members = activeMembers(trip)
      const expense = handle.props.expenseId
        ? activeExpenses(trip).find(
            (candidate) => candidate.id === handle.props.expenseId
          )
        : undefined
      const me = myMember(trip, deviceId())

      if (expense) {
        form = {
          description: expense.description,
          amountText: (expense.amountCents / 100).toFixed(2),
          date: expense.date,
          categoryId: expense.categoryId,
          paidBy: expense.paidBy,
          splitMode: isEqualSplit(expense.amountCents, expense.shares)
            ? 'equally'
            : 'custom',
          splitWith: new Set(expense.shares.map((share) => share.memberId)),
          customAmounts: new Map(
            expense.shares.map((share) => [
              share.memberId,
              (share.amountCents / 100).toFixed(2),
            ])
          ),
        }
      } else {
        form = {
          description: '',
          amountText: '',
          date: today(),
          categoryId: 'food',
          paidBy: me?.id ?? members[0]?.id ?? '',
          splitMode: 'equally',
          splitWith: new Set(members.map((member) => member.id)),
          customAmounts: new Map(),
        }
      }
    }

    function isEqualSplit(
      amountCents: number,
      shares: Array<{ memberId: string; amountCents: number }>
    ) {
      const equal = equalShares(
        amountCents,
        shares.map((share) => share.memberId)
      )
      return shares.every(
        (share) =>
          equal.find((candidate) => candidate.memberId === share.memberId)
            ?.amountCents === share.amountCents
      )
    }

    function buildShares(state: FormState, amountCents: number) {
      const selected = [...state.splitWith]
      if (state.splitMode === 'equally') {
        return equalShares(amountCents, selected)
      }
      return selected
        .map((memberId) => ({
          memberId,
          amountCents:
            parseAmount(state.customAmounts.get(memberId) ?? '') ?? 0,
        }))
        .filter((share) => share.amountCents > 0)
    }

    async function save(trip: Trip) {
      if (!form || saving) return
      const state = form
      const amountCents = parseAmount(state.amountText)
      if (amountCents === null) {
        error = 'Informe um valor maior que zero.'
        handle.update()
        return
      }

      saving = true
      error = ''
      handle.update()

      const input = {
        tripId: trip.id,
        description: state.description,
        categoryId: state.categoryId,
        amountCents,
        date: state.date,
        paidBy: state.paidBy,
        shares: buildShares(state, amountCents),
      }
      const result = handle.props.expenseId
        ? await mutateDocument(updateExpense, {
            ...input,
            expenseId: handle.props.expenseId,
          })
        : await mutateDocument(addExpense, input)

      if (result.error !== null) {
        error = result.error
        saving = false
        handle.update()
        return
      }
      navigate(routes.trips.show.href({ tripId: trip.id }))
    }

    async function remove(trip: Trip) {
      if (!handle.props.expenseId || saving) return
      saving = true
      handle.update()
      const result = await mutateDocument(deleteExpense, {
        tripId: trip.id,
        expenseId: handle.props.expenseId,
      })
      if (result.error !== null) {
        error = result.error
        saving = false
        handle.update()
        return
      }
      navigate(routes.trips.show.href({ tripId: trip.id }))
    }

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

      if (!form) seedForm(trip)
      const state = form as FormState
      const members = activeMembers(trip)
      const editing = Boolean(handle.props.expenseId)
      const settlement = state.categoryId === settlementCategory.id
      const amountCents = parseAmount(state.amountText)
      const selectedMembers = members.filter((member) =>
        state.splitWith.has(member.id)
      )
      const preview =
        amountCents !== null && state.splitMode === 'equally'
          ? equalShares(amountCents, [...state.splitWith])
          : null
      const customTotal = [...state.splitWith].reduce(
        (total, memberId) =>
          total + (parseAmount(state.customAmounts.get(memberId) ?? '') ?? 0),
        0
      )

      return (
        <div mix={data.mount}>
          <a
            href={routes.trips.show.href({ tripId: trip.id })}
            class="mono-label mb-5 inline-flex items-center gap-1.5 text-faint transition-colors hover:text-ink"
          >
            <span aria-hidden="true">←</span> {trip.emoji} {trip.name}
          </a>
          <h1 class="mb-6 text-[22px] font-bold tracking-tight">
            {editing
              ? settlement
                ? 'Editar pagamento'
                : 'Editar despesa'
              : 'Adicionar despesa'}
          </h1>

          <form
            class="space-y-7"
            mix={on('submit', (event) => {
              event.preventDefault()
              save(trip)
            })}
          >
            <div>
              <SectionLabel>O que foi?</SectionLabel>
              <div class="flex items-center gap-3">
                {settlement ? null : (
                  <EmojiPicker
                    value={state.categoryId}
                    options={categories.map((category) => ({
                      value: category.id,
                      emoji: category.emoji,
                      label: category.label,
                    }))}
                    label="Escolher a categoria"
                    onPick={(categoryId) => {
                      state.categoryId = categoryId
                      handle.update()
                    }}
                  />
                )}
                <input
                  class={inputClass}
                  placeholder="Jantar na beira do rio"
                  defaultValue={state.description}
                  mix={on('input', (event) => {
                    state.description = (
                      event.currentTarget as HTMLInputElement
                    ).value
                  })}
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <SectionLabel>Valor ({trip.currency})</SectionLabel>
                <input
                  class={`${inputClass} tabular`}
                  placeholder="0.00"
                  inputMode="decimal"
                  defaultValue={state.amountText}
                  mix={on('input', (event) => {
                    state.amountText = (
                      event.currentTarget as HTMLInputElement
                    ).value
                    handle.update()
                  })}
                />
              </div>
              <div>
                <SectionLabel>Quando</SectionLabel>
                <input
                  type="date"
                  class={inputClass}
                  defaultValue={state.date}
                  mix={on('input', (event) => {
                    state.date = (event.currentTarget as HTMLInputElement).value
                  })}
                />
              </div>
            </div>

            <div>
              <SectionLabel>Quem pagou</SectionLabel>
              <div class="flex flex-wrap gap-2">
                {members.map((member) => (
                  <MemberChip
                    key={member.id}
                    member={member}
                    selected={member.id === state.paidBy}
                    onToggle={() => {
                      state.paidBy = member.id
                      handle.update()
                    }}
                  />
                ))}
              </div>
            </div>

            {settlement ? null : (
              <div>
                <div class="mb-2.5 flex items-center justify-between">
                  <p class="mono-label text-faint">Dividir entre</p>
                  <div class="flex rounded-lg border border-line bg-panel p-0.5">
                    {(['equally', 'custom'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        class={`mono-label cursor-pointer rounded-md px-3 py-2 transition-colors ${
                          state.splitMode === mode
                            ? 'bg-raised text-amber'
                            : 'text-faint hover:text-ink'
                        }`}
                        mix={on('click', () => {
                          state.splitMode = mode
                          handle.update()
                        })}
                      >
                        {mode === 'equally' ? 'Igualmente' : 'Personalizado'}
                      </button>
                    ))}
                  </div>
                </div>

                <div class="flex flex-wrap gap-2">
                  {members.map((member) => (
                    <MemberChip
                      key={member.id}
                      member={member}
                      selected={state.splitWith.has(member.id)}
                      onToggle={() => {
                        if (state.splitWith.has(member.id)) {
                          state.splitWith.delete(member.id)
                        } else {
                          state.splitWith.add(member.id)
                        }
                        handle.update()
                      }}
                    />
                  ))}
                </div>
                <p class="mono-caption mt-2 text-faint">
                  Deixe quem pagou de fora para virar um empréstimo.
                </p>

                {state.splitMode === 'equally' && preview ? (
                  <div class="mt-3 divide-y divide-line rounded-xl border border-line bg-panel px-4">
                    {selectedMembers.map((member) => (
                      <div
                        key={member.id}
                        class="flex items-center justify-between py-2.5"
                      >
                        <span class="mono-caption text-muted">
                          {member.emoji} {member.name}
                        </span>
                        <span class="tabular mono-caption text-ink">
                          {formatCents(
                            preview.find(
                              (share) => share.memberId === member.id
                            )?.amountCents ?? 0,
                            trip.currency
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}

                {state.splitMode === 'custom' ? (
                  <div class="mt-3 space-y-2">
                    {selectedMembers.map((member) => (
                      <div key={member.id} class="flex items-center gap-3">
                        <span class="mono-caption w-32 shrink-0 truncate text-muted">
                          {member.emoji} {member.name}
                        </span>
                        <input
                          class={`${inputClass} tabular`}
                          placeholder="0.00"
                          inputMode="decimal"
                          defaultValue={
                            state.customAmounts.get(member.id) ?? ''
                          }
                          mix={on('input', (event) => {
                            state.customAmounts.set(
                              member.id,
                              (event.currentTarget as HTMLInputElement).value
                            )
                            handle.update()
                          })}
                        />
                      </div>
                    ))}
                    {amountCents !== null ? (
                      <p
                        class={`mono-caption text-right ${
                          customTotal === amountCents
                            ? 'text-green'
                            : 'text-red'
                        }`}
                      >
                        {customTotal === amountCents
                          ? `Tudo dividido — ${formatCents(amountCents, trip.currency)}`
                          : customTotal < amountCents
                            ? `Faltam ${formatCents(amountCents - customTotal, trip.currency)}`
                            : `${formatCents(customTotal - amountCents, trip.currency)} a mais`}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}

            <ErrorNote message={error} />

            <BottomBar>
              {editing ? (
                <button
                  type="button"
                  class={`${buttonDanger} flex-1`}
                  disabled={saving}
                  mix={on('click', () => remove(trip))}
                >
                  Excluir
                </button>
              ) : null}
              <button
                type="submit"
                class={`${buttonPrimary} flex-2`}
                disabled={saving}
              >
                {saving
                  ? 'Salvando…'
                  : editing
                    ? 'Salvar alterações'
                    : 'Adicionar despesa'}
              </button>
            </BottomBar>
          </form>
        </div>
      )
    }
  }
)
