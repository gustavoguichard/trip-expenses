import type { Handle } from 'remix/ui'
import { clientEntry, on } from 'remix/ui'

import {
  totalsByCategory,
  totalsByDay,
  totalsByMember,
  tripTotal,
} from '../business/balances.common.ts'
import { findCategory } from '../business/categories.common.ts'
import { activeMembers, findTrip } from '../business/store.common.ts'
import { formatCents, formatDay } from './money.ts'
import { routeParams } from './route-params.ts'
import { bindDocument } from './store.ts'
import { Loading, TripChrome, TripMissing } from './trip-chrome.tsx'
import { SectionLabel } from './widgets.tsx'

function StatTile(handle: Handle<{ label: string; value: string }>) {
  return () => (
    <div class="rounded-2xl border border-line bg-panel px-4 py-3.5">
      <p class="mono-label text-faint">{handle.props.label}</p>
      <p class="tabular mt-1.5 truncate text-[19px] font-bold tracking-tight">
        {handle.props.value}
      </p>
    </div>
  )
}

export const ChartsScreen = clientEntry(
  import.meta.url,
  function ChartsScreen(handle: Handle) {
    const data = bindDocument(handle)
    let selectedDay: string | null = null

    return () => {
      if (!data.ready()) {
        return (
          <div mix={data.mount}>
            <Loading />
          </div>
        )
      }

      const trip = findTrip(data.document(), routeParams().tripId ?? '')
      if (!trip) {
        return (
          <div mix={data.mount}>
            <TripMissing />
          </div>
        )
      }

      const total = tripTotal(trip)
      const byCategory = totalsByCategory(trip)
      const byDay = totalsByDay(trip)
      const byMember = totalsByMember(trip)
      const members = activeMembers(trip)
      const money = (cents: number) => formatCents(cents, trip.currency)

      if (total === 0) {
        return (
          <div mix={data.mount}>
            <TripChrome trip={trip} active="charts" />
            <div class="rounded-2xl border border-line bg-panel px-6 py-14 text-center">
              <p class="text-[24px]">📊</p>
              <p class="mt-3 text-[17px] font-semibold">
                Nada para mostrar ainda
              </p>
              <p class="mono-caption mx-auto mt-2 max-w-xs text-muted">
                Adicione algumas despesas e esta aba vira a história do dinheiro
                da viagem.
              </p>
            </div>
          </div>
        )
      }

      const maxCategory = Math.max(...byCategory.map((c) => c.amountCents))
      const maxDay = Math.max(...byDay.map((d) => d.amountCents))
      const biggestDay = byDay.reduce((a, b) =>
        b.amountCents > a.amountCents ? b : a
      )
      const maxMemberValue = Math.max(
        1,
        ...byMember.flatMap((m) => [m.paidCents, m.shareCents])
      )
      const selected = byDay.find((d) => d.date === selectedDay) ?? null

      return (
        <div mix={data.mount}>
          <TripChrome trip={trip} active="charts" />

          <div class="grid grid-cols-2 gap-3">
            <StatTile label="Total gasto" value={money(total)} />
            <StatTile
              label="Por dia"
              value={money(Math.round(total / byDay.length))}
            />
            <StatTile label="Dias com gastos" value={String(byDay.length)} />
            <StatTile
              label="Maior dia"
              value={`${formatDay(biggestDay.date)}`}
            />
          </div>

          <section class="mt-8">
            <SectionLabel>Por categoria</SectionLabel>
            <div class="space-y-2.5 rounded-2xl border border-line bg-panel px-4 py-4">
              {byCategory.map((entry) => {
                const category = findCategory(entry.categoryId)
                const width = Math.max(
                  2,
                  Math.round((entry.amountCents / maxCategory) * 100)
                )
                return (
                  <div key={entry.categoryId} class="flex items-center gap-3">
                    <span class="mono-caption w-32 shrink-0 truncate text-muted">
                      {category?.emoji} {category?.label ?? entry.categoryId}
                    </span>
                    <span class="h-4 flex-1">
                      <span
                        class="block h-full rounded-r-[4px] bg-chart-paid"
                        style={{ width: `${width}%` }}
                      />
                    </span>
                    <span class="tabular mono-caption w-24 shrink-0 text-right text-ink">
                      {money(entry.amountCents)}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>

          <section class="mt-8">
            <div class="mb-2.5 flex items-baseline justify-between">
              <p class="mono-label text-faint">Gastos por dia</p>
              <p class="mono-caption tabular text-muted">
                {selected
                  ? `${formatDay(selected.date)} · ${money(selected.amountCents)}`
                  : 'toque numa barra'}
              </p>
            </div>
            <div class="rounded-2xl border border-line bg-panel px-4 pt-5 pb-3">
              <div
                class="flex h-32 items-end gap-[2px]"
                role="img"
                aria-label={`Gastos por dia, ${byDay.length} dias, maior em ${formatDay(biggestDay.date)} com ${money(biggestDay.amountCents)}`}
              >
                {byDay.map((entry) => (
                  <button
                    key={entry.date}
                    type="button"
                    title={`${formatDay(entry.date)} · ${money(entry.amountCents)}`}
                    class="group flex h-full flex-1 cursor-pointer items-end"
                    mix={on('click', () => {
                      selectedDay =
                        selectedDay === entry.date ? null : entry.date
                      handle.update()
                    })}
                  >
                    <span
                      class={`block w-full rounded-t-[4px] transition-colors ${
                        selectedDay === entry.date
                          ? 'bg-amber-bright'
                          : 'bg-chart-paid group-hover:bg-amber'
                      }`}
                      style={{
                        height: `${Math.max(3, Math.round((entry.amountCents / maxDay) * 100))}%`,
                      }}
                    />
                  </button>
                ))}
              </div>
              <div class="mono-caption mt-2 flex justify-between text-faint">
                {[byDay.at(0), byDay.length > 1 ? byDay.at(-1) : null].map(
                  (entry) =>
                    entry ? (
                      <span key={entry.date}>{formatDay(entry.date)}</span>
                    ) : null
                )}
              </div>
            </div>
          </section>

          <section class="mt-8">
            <div class="mb-2.5 flex items-center justify-between">
              <p class="mono-label text-faint">Pagou vs parte</p>
              <div class="mono-caption flex items-center gap-4 text-muted">
                <span class="inline-flex items-center gap-1.5">
                  <span class="h-2 w-2 rounded-full bg-chart-paid" /> pagou
                </span>
                <span class="inline-flex items-center gap-1.5">
                  <span class="h-2 w-2 rounded-full bg-chart-share" /> parte
                </span>
              </div>
            </div>
            <div class="space-y-4 rounded-2xl border border-line bg-panel px-4 py-4">
              {byMember.map((entry) => {
                const member = members.find((m) => m.id === entry.memberId)
                return (
                  <div key={entry.memberId}>
                    <div class="mb-1.5 flex items-baseline justify-between">
                      <span class="mono-caption truncate text-muted">
                        {member?.emoji} {member?.name}
                      </span>
                      <span class="tabular mono-caption text-faint">
                        {money(entry.paidCents)} · {money(entry.shareCents)}
                      </span>
                    </div>
                    <div class="space-y-[2px]">
                      <span class="block h-2.5">
                        <span
                          class="block h-full rounded-r-[4px] bg-chart-paid"
                          style={{
                            width: `${Math.max(1, Math.round((entry.paidCents / maxMemberValue) * 100))}%`,
                          }}
                        />
                      </span>
                      <span class="block h-2.5">
                        <span
                          class="block h-full rounded-r-[4px] bg-chart-share"
                          style={{
                            width: `${Math.max(1, Math.round((entry.shareCents / maxMemberValue) * 100))}%`,
                          }}
                        />
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      )
    }
  }
)
