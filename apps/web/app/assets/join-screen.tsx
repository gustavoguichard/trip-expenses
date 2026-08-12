import { decodeQR } from 'qr/decode.js'

import type { Handle } from 'remix/ui'
import { clientEntry, on, ref } from 'remix/ui'

import { activeExpenses, activeMembers } from '../business/store.common.ts'
import {
  encodedFromLinkHash,
  type InvitePayload,
  importTrip,
  parseInvitePayload,
} from '../business/sync.common.ts'
import { claimMember, myMember } from '../business/trips.common.ts'
import { decompress, makeChunkCollector } from '../framework/sync-codec.ts'
import { routes } from '../routes.ts'
import {
  bindDocument,
  deviceId,
  documentStore,
  mutateDocument,
} from './store.ts'
import { Loading } from './trip-chrome.tsx'
import { Avatar, buttonGhost, buttonPrimary, ErrorNote } from './widgets.tsx'

const chunkPrefix = 'TRIPX1'

function readQR(image: ImageData) {
  try {
    return decodeQR({
      width: image.width,
      height: image.height,
      data: image.data,
    })
  } catch {
    return null
  }
}

export const JoinScreen = clientEntry(
  import.meta.url,
  function JoinScreen(handle: Handle) {
    const data = bindDocument(handle)
    const linkEncoded =
      typeof location === 'undefined'
        ? null
        : encodedFromLinkHash(location.hash)
    let status: 'scanning' | 'opening' | 'found' | 'imported' | 'blocked' =
      linkEncoded ? 'opening' : 'scanning'
    let progress = ''
    let error = ''
    let payload: InvitePayload | null = null
    let stream: MediaStream | null = null
    let collector = makeChunkCollector(chunkPrefix)

    function stopCamera() {
      for (const track of stream?.getTracks() ?? []) track.stop()
      stream = null
    }

    handle.signal.addEventListener('abort', stopCamera)

    function clearLinkHash() {
      if (encodedFromLinkHash(location.hash) === null) return
      history.replaceState(null, '', location.pathname + location.search)
    }

    async function openLink(encoded: string) {
      try {
        const parsed = parseInvitePayload(await decompress(encoded))
        if (!parsed) throw new Error('Link não reconhecido')
        payload = parsed
        status = 'found'
      } catch {
        clearLinkHash()
        status = 'scanning'
        error =
          'Esse link não abriu por aqui. Dá para escanear o código QR direto da tela do seu amigo.'
      }
      handle.update()
    }

    if (linkEncoded) openLink(linkEncoded)

    async function handleText(text: string) {
      const chunk = collector.collect(text)
      if (!chunk) return
      if (chunk.payload === null) {
        progress = `${chunk.received} de ${chunk.total} quadros`
        handle.update()
        return
      }

      try {
        const decoded = await decompress(chunk.payload)
        const parsed = parseInvitePayload(decoded)
        if (!parsed) throw new Error('Código não reconhecido')
        payload = parsed
        status = 'found'
        stopCamera()
        handle.update()
      } catch {
        collector = makeChunkCollector(chunkPrefix)
        progress = ''
        error = 'Esse código não bateu. Tente escanear de novo.'
        handle.update()
      }
    }

    const mountCamera = ref((node) => {
      const video = node as HTMLVideoElement
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d', { willReadFrequently: true })

      if (!navigator.mediaDevices?.getUserMedia) {
        status = 'blocked'
        handle.update()
        return
      }

      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment' } })
        .then((mediaStream) => {
          stream = mediaStream
          video.srcObject = mediaStream
          video.play()
          const scan = () => {
            if (!stream) return
            if (video.readyState === video.HAVE_ENOUGH_DATA && context) {
              canvas.width = video.videoWidth
              canvas.height = video.videoHeight
              context.drawImage(video, 0, 0)
              const image = context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height
              )
              const text = readQR(image)
              if (text) handleText(text)
            }
            requestAnimationFrame(scan)
          }
          requestAnimationFrame(scan)
        })
        .catch(() => {
          status = 'blocked'
          handle.update()
        })
    })

    async function accept() {
      if (!payload) return
      const merged = importTrip(documentStore.load(), payload.trip)
      documentStore.save(merged)

      const local = merged.trips.find((trip) => trip.id === payload?.trip.id)
      const alreadyMe = local ? myMember(local, deviceId()) : null
      if (payload.inviteMemberId && !alreadyMe) {
        await mutateDocument(claimMember, {
          tripId: payload.trip.id,
          memberId: payload.inviteMemberId,
          deviceId: deviceId(),
        })
      }
      clearLinkHash()
      status = 'imported'
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

      if (status === 'opening') {
        return (
          <div mix={data.mount}>
            <h1 class="mb-6 text-[22px] font-bold tracking-tight">
              Abrindo o convite
            </h1>
            <Loading />
          </div>
        )
      }

      if (status === 'imported' && payload) {
        const trip = payload.trip
        return (
          <div mix={data.mount}>
            <h1 class="mb-6 text-[22px] font-bold tracking-tight">
              Viagem adicionada
            </h1>
            <div class="rounded-2xl border border-line bg-panel p-5">
              <div class="flex items-center gap-4">
                <span class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-line-bright bg-raised text-[26px]">
                  {trip.emoji}
                </span>
                <p class="text-[18px] font-bold tracking-tight">{trip.name}</p>
              </div>
              <p class="mono-caption mt-4 text-muted">
                A viagem já está neste aparelho. Agora mostre o seu código para
                quem te convidou — assim o que você lançar por aqui chega no
                aparelho da outra pessoa também.
              </p>
              <a
                href={routes.trips.invite.href({ tripId: trip.id })}
                class={`${buttonPrimary} mt-5 w-full`}
              >
                Mostrar meu código
              </a>
              <a
                href={routes.trips.show.href({ tripId: trip.id })}
                class={`${buttonGhost} mt-3 w-full`}
              >
                Ir para a viagem
              </a>
            </div>
          </div>
        )
      }

      if (status === 'found' && payload) {
        const trip = payload.trip
        const members = activeMembers(trip)
        const invited = members.find(
          (member) => member.id === payload?.inviteMemberId
        )

        return (
          <div mix={data.mount}>
            <h1 class="mb-6 text-[22px] font-bold tracking-tight">
              Achamos uma viagem
            </h1>
            <div class="rounded-2xl border border-line bg-panel p-5">
              <div class="flex items-center gap-4">
                <span class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-line-bright bg-raised text-[26px]">
                  {trip.emoji}
                </span>
                <div>
                  <p class="text-[18px] font-bold tracking-tight">
                    {trip.name}
                  </p>
                  <p class="mono-caption text-muted">
                    {members.length}{' '}
                    {members.length === 1 ? 'pessoa' : 'pessoas'} ·{' '}
                    {activeExpenses(trip).length}{' '}
                    {activeExpenses(trip).length === 1 ? 'despesa' : 'despesas'}{' '}
                    · {trip.currency}
                  </p>
                </div>
              </div>
              <div class="mt-4 flex items-center gap-1.5">
                {members.map((member) => (
                  <span key={member.id} title={member.name}>
                    <Avatar emoji={member.emoji} size="sm" />
                  </span>
                ))}
              </div>
              {invited ? (
                <p class="mono-caption mt-4 rounded-lg border border-amber/30 bg-amber-wash px-3 py-2.5 text-muted">
                  Você entra como{' '}
                  <span class="text-ink">
                    {invited.emoji} {invited.name}
                  </span>{' '}
                  e pode adicionar suas próprias despesas.
                </p>
              ) : null}
              <button
                type="button"
                class={`${buttonPrimary} mt-5 w-full`}
                mix={on('click', accept)}
              >
                Adicionar viagem a este aparelho
              </button>
            </div>
          </div>
        )
      }

      return (
        <div mix={data.mount}>
          <h1 class="mb-2 text-[22px] font-bold tracking-tight">
            Escaneie o código de um amigo
          </h1>
          <p class="mono-caption mb-6 text-muted">
            Peça para abrirem a viagem e tocarem no botão de QR, depois aponte
            sua câmera para a tela.
          </p>

          {status === 'blocked' ? (
            <div class="rounded-2xl border border-line bg-panel px-6 py-14 text-center">
              <p class="text-[24px]">📷</p>
              <p class="mt-3 text-[17px] font-semibold">Câmera indisponível</p>
              <p class="mono-caption mx-auto mt-2 max-w-sm text-muted">
                {window.isSecureContext
                  ? 'Permita o acesso à câmera para este site nas configurações do navegador e recarregue a página.'
                  : 'Você está usando o app em um endereço inseguro (http), e os navegadores só liberam a câmera em https. Abra o endereço https do app e tente de novo.'}
              </p>
            </div>
          ) : (
            <div class="relative overflow-hidden rounded-2xl border border-line bg-panel">
              <video
                class="block aspect-square w-full object-cover"
                muted
                playsInline
                mix={mountCamera}
              />
              <div class="pointer-events-none absolute inset-0 grid place-items-center">
                <div class="h-[62%] w-[62%] rounded-2xl border-2 border-amber/80 shadow-[0_0_0_9999px_rgba(11,10,8,0.45)]" />
              </div>
              {progress ? (
                <p class="mono-label absolute inset-x-0 bottom-3 text-center text-amber">
                  {progress}
                </p>
              ) : null}
            </div>
          )}

          <div class="mt-4">
            <ErrorNote message={error} />
          </div>
        </div>
      )
    }
  }
)
