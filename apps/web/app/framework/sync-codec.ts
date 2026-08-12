async function drainStream(stream: ReadableStream<Uint8Array>) {
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

function toBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

function fromBase64Url(encoded: string) {
  const binary = atob(encoded.replaceAll('-', '+').replaceAll('_', '/'))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

async function compress(text: string) {
  const stream = new Blob([new TextEncoder().encode(text)])
    .stream()
    .pipeThrough(new CompressionStream('deflate'))
  return toBase64Url(await drainStream(stream))
}

async function decompress(encoded: string) {
  const stream = new Blob([fromBase64Url(encoded) as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate'))
  return new TextDecoder().decode(await drainStream(stream))
}

type ChunkProgress = {
  received: number
  total: number
  payload: string | null
}

function toChunks(prefix: string, payload: string, chunkSize = 400) {
  const total = Math.max(1, Math.ceil(payload.length / chunkSize))
  return Array.from({ length: total }, (_, index) => {
    const slice = payload.slice(index * chunkSize, (index + 1) * chunkSize)
    return `${prefix}:${index + 1}/${total}:${slice}`
  })
}

function makeChunkCollector(prefix: string) {
  const parts = new Map<number, string>()
  let total = 0

  return {
    collect(text: string): ChunkProgress | null {
      const match = text.match(/^([^:]+):(\d+)\/(\d+):([\s\S]*)$/)
      if (!match || match[1] !== prefix) return null

      const index = Number(match[2])
      total = Number(match[3])
      parts.set(index, match[4] ?? '')

      const complete = parts.size === total
      return {
        received: parts.size,
        total,
        payload: complete
          ? Array.from(
              { length: total },
              (_, i) => parts.get(i + 1) ?? ''
            ).join('')
          : null,
      }
    },
  }
}

export type { ChunkProgress }
export { compress, decompress, makeChunkCollector, toChunks }
