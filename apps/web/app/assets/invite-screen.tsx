import type { Handle } from 'remix/ui'
import { clientEntry, on, ref } from 'remix/ui'
import { renderSVG } from 'uqr'

import { activeMembers, findTrip, type Trip } from '../business/store.common.ts'
import { makeInvitePayload } from '../business/sync.common.ts'
import { myMember } from '../business/trips.common.ts'
import { compress, toChunks } from '../framework/sync-codec.ts'
import { bindDocument, deviceId } from './store.ts'
import { Loading, TripChrome, TripMissing } from './trip-chrome.tsx'
import { Avatar, SectionLabel } from './widgets.tsx'

const chunkPrefix = 'TRIPX1'

export const InviteScreen = clientEntry(
  import.meta.url,
  function InviteScreen(handle: Handle<{ tripId: string }>) {
    const data = bindDocument(handle)
    let inviteMemberId: string | null = null
    let chunks: string[] = []
    let qrError = ''
    let frame = 0
    let generation = 0
    let qrNode: HTMLElement | null = null
    let frameCounterNode: HTMLElement | null = null
    let interval: ReturnType<typeof setInterval> | null = null

    handle.signal.addEventListener('abort', () => {
      if (interval) clearInterval(interval)
    })

    const frameLabel = () =>
      `frame ${(frame % chunks.length) + 1}/${chunks.length}`

    function paint() {
      if (!qrNode || chunks.length === 0) return
      qrNode.innerHTML = renderSVG(chunks[frame % chunks.length] ?? '', {
        ecc: 'M',
        border: 2,
      })
      if (frameCounterNode) frameCounterNode.textContent = frameLabel()
    }

    async function regenerate(trip: Trip) {
      const current = ++generation
      try {
        const payload = JSON.stringify(makeInvitePayload(trip, inviteMemberId))
        const encoded = await compress(payload)
        if (current !== generation) return
        qrError = ''
        chunks = toChunks(chunkPrefix, encoded, 700)
        frame = 0
        if (interval) clearInterval(interval)
        if (chunks.length > 1) {
          interval = setInterval(() => {
            frame += 1
            paint()
          }, 800)
        }
        handle.update()
        paint()
      } catch (exception) {
        if (current !== generation) return
        qrError =
          exception instanceof Error ? exception.message : String(exception)
        chunks = []
        if (interval) clearInterval(interval)
        handle.update()
      }
    }

    const mountQr = (trip: Trip) =>
      ref((node) => {
        qrNode = node as HTMLElement
        regenerate(trip)
      })

    const mountFrameCounter = ref((node) => {
      frameCounterNode = node as HTMLElement
      frameCounterNode.textContent = frameLabel()
    })

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

      return (
        <div mix={data.mount}>
          <TripChrome trip={trip} active="people" />

          <h2 class="mb-1 text-[19px] font-bold tracking-tight">
            Share this trip
          </h2>
          <p class="mono-caption mb-6 text-muted">
            On the other phone, open the app and tap{' '}
            <span class="text-ink">Scan</span>. Everything syncs from this code
            — no account needed.
          </p>

          <SectionLabel>Who is holding the other phone?</SectionLabel>
          <div class="mb-6 flex flex-wrap gap-2">
            {members.map((member) => (
              <button
                key={member.id}
                type="button"
                aria-pressed={inviteMemberId === member.id}
                class={`flex cursor-pointer items-center gap-2 rounded-full border py-1.5 pr-3.5 pl-1.5 transition-colors ${
                  inviteMemberId === member.id
                    ? 'border-amber bg-amber-wash text-ink'
                    : 'border-line-bright text-muted hover:border-amber/60'
                }`}
                mix={on('click', () => {
                  inviteMemberId =
                    inviteMemberId === member.id ? null : member.id
                  handle.update()
                  regenerate(trip)
                })}
              >
                <Avatar emoji={member.emoji} size="sm" />
                <span class="text-[13px] font-medium">
                  {member.name}
                  {member.id === me?.id ? ' (me)' : ''}
                </span>
              </button>
            ))}
          </div>
          <p class="mono-caption -mt-3 mb-6 text-faint">
            Pick yourself to sync another one of your own devices. Pick no one
            to just share the numbers.
          </p>

          <div class="flex flex-col items-center">
            {qrError ? (
              <div class="w-full rounded-2xl border border-line bg-panel px-6 py-14 text-center">
                <p class="text-[17px] font-semibold">Couldn't build the code</p>
                <p class="mono-caption mx-auto mt-2 max-w-sm text-muted">
                  This browser refused to generate the QR code ({qrError}).
                  Update it and reload the page to share this trip.
                </p>
              </div>
            ) : (
              <>
                <div class="w-full max-w-[320px] rounded-2xl bg-white p-3 [&_svg]:block [&_svg]:h-full [&_svg]:w-full">
                  <div class="aspect-square w-full" mix={mountQr(trip)} />
                </div>
                {chunks.length > 1 ? (
                  <p
                    class="mono-caption mt-3 text-ink"
                    mix={mountFrameCounter}
                  />
                ) : null}
                {chunks.length > 1 ? (
                  <p class="mono-caption mt-1 text-faint">
                    Animated code · keep it on screen while your friend scans
                  </p>
                ) : (
                  <p class="mono-caption mt-3 text-faint">
                    Keep it on screen while your friend scans
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )
    }
  }
)
