import type { Handle } from 'remix/ui'
import { clientEntry, on } from 'remix/ui'

import { memberBalances, simplifyDebts } from '../business/balances.common.ts'
import { addSettlement } from '../business/expenses.common.ts'
import { activeMembers, findTrip, type Trip } from '../business/store.common.ts'
import { myMember } from '../business/trips.common.ts'
import { formatCents, today } from './money.ts'
import { bindDocument, deviceId, mutateDocument } from './store.ts'
import { Loading, TripChrome, TripMissing } from './trip-chrome.tsx'
import { Avatar, ErrorNote, SectionLabel } from './widgets.tsx'

export const BalancesScreen = clientEntry(
  import.meta.url,
  function BalancesScreen(handle: Handle<{ tripId: string }>) {
    const data = bindDocument(handle)
    let error = ''
    let settling = ''

    async function settle(trip: Trip, from: string, to: string, cents: number) {
      settling = `${from}:${to}`
      error = ''
      handle.update()
      const result = await mutateDocument(addSettlement, {
        tripId: trip.id,
        from,
        to,
        amountCents: cents,
        date: today(),
      })
      settling = ''
      if (result.error !== null) error = result.error
      handle.update()
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

      const members = activeMembers(trip)
      const me = myMember(trip, deviceId())
      const balances = memberBalances(trip)
      const transfers = simplifyDebts(balances)
      const maxAbs = Math.max(
        1,
        ...[...balances.values()].map((cents) => Math.abs(cents))
      )
      const nameOf = (memberId: string) =>
        members.find((member) => member.id === memberId)?.name ?? 'Alguém'
      const emojiOf = (memberId: string) =>
        members.find((member) => member.id === memberId)?.emoji ?? '💸'
      const allSettled = transfers.length === 0

      return (
        <div mix={data.mount}>
          <TripChrome trip={trip} active="balances" />

          <SectionLabel>Como cada um está</SectionLabel>
          <div class="divide-y divide-line rounded-2xl border border-line bg-panel">
            {members.map((member) => {
              const cents = balances.get(member.id) ?? 0
              const width = Math.round((Math.abs(cents) / maxAbs) * 100)
              return (
                <div
                  key={member.id}
                  class="flex items-center gap-3.5 px-4 py-3.5"
                >
                  <Avatar emoji={member.emoji} />
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-[15px] font-medium">
                      {member.name}
                      {member.id === me?.id ? (
                        <span class="mono-caption ml-2 text-amber">você</span>
                      ) : null}
                    </p>
                    <div class="mt-1.5 h-1 overflow-hidden rounded-full bg-raised">
                      <div
                        class={`h-full rounded-full ${
                          cents > 0
                            ? 'bg-green'
                            : cents < 0
                              ? 'bg-red'
                              : 'bg-line-bright'
                        }`}
                        style={{ width: `${Math.max(width, 2)}%` }}
                      />
                    </div>
                  </div>
                  <span
                    class={`tabular text-right text-[15px] font-semibold ${
                      cents > 0
                        ? 'text-green'
                        : cents < 0
                          ? 'text-red'
                          : 'text-faint'
                    }`}
                  >
                    {cents === 0
                      ? 'em dia'
                      : `${cents > 0 ? '+' : '−'}${formatCents(Math.abs(cents), trip.currency)}`}
                  </span>
                </div>
              )
            })}
          </div>

          <div class="mt-8">
            <SectionLabel>Acertar as contas</SectionLabel>
            {allSettled ? (
              <div class="rounded-2xl border border-green/30 bg-green-wash px-6 py-10 text-center">
                <p class="text-[24px]">🤝</p>
                <p class="mt-2 text-[15px] font-semibold text-green">
                  Tudo acertado — ninguém deve nada a ninguém
                </p>
              </div>
            ) : (
              <div class="divide-y divide-line rounded-2xl border border-line bg-panel">
                {transfers.map((transfer) => (
                  <div
                    key={`${transfer.from}:${transfer.to}`}
                    class="flex items-center gap-3 px-4 py-3.5"
                  >
                    <span class="flex items-center gap-1.5">
                      <Avatar emoji={emojiOf(transfer.from)} size="sm" />
                      <span aria-hidden="true" class="mono-caption text-faint">
                        →
                      </span>
                      <Avatar emoji={emojiOf(transfer.to)} size="sm" />
                    </span>
                    <p class="min-w-0 flex-1 text-[14px] text-muted">
                      <span class="font-medium text-ink">
                        {nameOf(transfer.from)}
                      </span>{' '}
                      paga{' '}
                      <span class="font-medium text-ink">
                        {nameOf(transfer.to)}
                      </span>
                    </p>
                    <span class="tabular text-[15px] font-semibold">
                      {formatCents(transfer.amountCents, trip.currency)}
                    </span>
                    <button
                      type="button"
                      class="mono-label cursor-pointer rounded-lg border border-green/40 px-3 py-2 text-green transition-colors hover:bg-green-wash disabled:opacity-40"
                      disabled={settling === `${transfer.from}:${transfer.to}`}
                      mix={on('click', () =>
                        settle(
                          trip,
                          transfer.from,
                          transfer.to,
                          transfer.amountCents
                        )
                      )}
                    >
                      Marcar pago
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p class="mono-caption mt-2 px-1 text-faint">
              Marcar um pagamento registra na viagem, e a cópia de cada um
              continua em sincronia.
            </p>
          </div>

          <div class="mt-4">
            <ErrorNote message={error} />
          </div>
        </div>
      )
    }
  }
)
