import type { Handle } from 'remix/ui'
import { clientEntry, on, ref } from 'remix/ui'
import { renderSVG } from 'uqr'

import { activeMembers, findTrip, type Trip } from '../business/store.common.ts'
import { inviteLinkHash, makeInvitePayload } from '../business/sync.common.ts'
import { myMember } from '../business/trips.common.ts'
import { compress, toChunks } from '../framework/sync-codec.ts'
import { routes } from '../routes.ts'
import { routeParams } from './route-params.ts'
import { bindDocument, deviceId, stampShare } from './store.ts'
import { Loading, TripChrome, TripMissing } from './trip-chrome.tsx'
import { Avatar, buttonPrimary, SectionLabel } from './widgets.tsx'

const chunkPrefix = 'TRIPX1'
const longLinkThreshold = 6000

export const InviteScreen = clientEntry(
  import.meta.url,
  function InviteScreen(handle: Handle) {
    const data = bindDocument(handle)
    let inviteMemberId: string | null = null
    let chunks: string[] = []
    let linkEncoded = ''
    let copied = false
    let qrError = ''
    let frame = 0
    let generation = 0
    let qrNode: HTMLElement | null = null
    let frameCounterNode: HTMLElement | null = null
    let interval: ReturnType<typeof setInterval> | null = null
    let copiedTimer: ReturnType<typeof setTimeout> | null = null

    handle.signal.addEventListener('abort', () => {
      if (interval) clearInterval(interval)
      if (copiedTimer) clearTimeout(copiedTimer)
    })

    async function shareLink(trip: Trip) {
      if (!linkEncoded) return
      const url = `${location.origin}${routes.join.href()}${inviteLinkHash(linkEncoded)}`
      if (typeof navigator.share === 'function') {
        await navigator
          .share({ url })
          .then(() => stampShare(trip.id))
          .catch(() => {})
        return
      }
      await navigator.clipboard.writeText(url)
      stampShare(trip.id)
      copied = true
      handle.update()
      if (copiedTimer) clearTimeout(copiedTimer)
      copiedTimer = setTimeout(() => {
        copied = false
        handle.update()
      }, 2500)
    }

    const frameLabel = () =>
      `quadro ${(frame % chunks.length) + 1}/${chunks.length}`

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
        linkEncoded = encoded
        chunks = toChunks(chunkPrefix, encoded, 700)
        frame = 0
        if (interval) clearInterval(interval)
        if (chunks.length > 1) {
          interval = setInterval(() => {
            frame += 1
            paint()
          }, 800)
        }
        stampShare(trip.id)
        await handle.update()
        paint()
      } catch (exception) {
        if (current !== generation) return
        qrError =
          exception instanceof Error ? exception.message : String(exception)
        chunks = []
        linkEncoded = ''
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

      const trip = findTrip(data.document(), routeParams().tripId ?? '')
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
            Compartilhe esta viagem
          </h2>
          <p class="mono-caption mb-6 text-muted">
            No outro celular, abra o app e toque em{' '}
            <span class="text-ink">Escanear</span>. Tudo sincroniza por este
            código — sem precisar de conta.
          </p>

          <SectionLabel>Quem está com o outro celular?</SectionLabel>
          <div class="mb-6 flex flex-wrap gap-2">
            {members.map((member) => (
              <button
                key={member.id}
                type="button"
                aria-pressed={inviteMemberId === member.id}
                class={`flex cursor-pointer items-center gap-2 rounded-full border py-2 pr-3.5 pl-2 transition-colors ${
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
                  {member.id === me?.id ? ' (eu)' : ''}
                </span>
              </button>
            ))}
          </div>
          <p class="mono-caption -mt-3 mb-6 text-faint">
            Escolha você para sincronizar outro aparelho seu. Não escolha
            ninguém para só compartilhar os números.
          </p>

          <div class="flex flex-col items-center">
            {qrError ? (
              <div class="w-full rounded-2xl border border-line bg-panel px-6 py-14 text-center">
                <p class="text-[17px] font-semibold">
                  Não deu para gerar o código
                </p>
                <p class="mono-caption mx-auto mt-2 max-w-sm text-muted">
                  Este navegador não conseguiu gerar o código QR ({qrError}).
                  Atualize o navegador e recarregue a página para compartilhar a
                  viagem.
                </p>
              </div>
            ) : (
              <div class="contents">
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
                    Código animado · deixe na tela enquanto seu amigo escaneia
                  </p>
                ) : (
                  <p class="mono-caption mt-3 text-faint">
                    Deixe na tela enquanto seu amigo escaneia
                  </p>
                )}
                <button
                  type="button"
                  class={`${buttonPrimary} mt-5 w-full max-w-[320px]`}
                  disabled={!linkEncoded}
                  mix={on('click', () => shareLink(trip))}
                >
                  {copied ? 'Link copiado' : 'Compartilhar link'}
                </button>
                <p class="mono-caption mt-2 max-w-[320px] text-center text-faint">
                  O link abre esta viagem direto no aparelho do seu amigo, sem
                  câmera.
                </p>
                {linkEncoded.length > longLinkThreshold ? (
                  <p class="mono-caption mt-2 max-w-[320px] text-center text-faint">
                    Esta viagem cresceu e o link ficou longo — alguns apps de
                    mensagem cortam links assim. Se não abrir, o código QR é o
                    caminho garantido.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )
    }
  }
)
