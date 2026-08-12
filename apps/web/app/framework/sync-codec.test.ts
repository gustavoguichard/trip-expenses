import { describe, expect, it } from 'vitest'

import {
  compress,
  decompress,
  makeChunkCollector,
  toChunks,
} from './sync-codec.ts'

describe('compress and decompress', () => {
  it('round-trips text through deflate and base64url', async () => {
    const text = JSON.stringify({
      trip: 'Chapada 2026',
      expenses: Array.from({ length: 40 }, (_, i) => ({
        id: i,
        description: 'Almoço no rio',
        amountCents: 4200,
      })),
    })

    const encoded = await compress(text)
    expect(encoded).not.toMatch(/[+/=]/)
    expect(encoded.length).toBeLessThan(text.length)
    expect(await decompress(encoded)).toBe(text)
  })
})

describe('toChunks and makeChunkCollector', () => {
  it('splits a payload and reassembles it in any order', () => {
    const payload = 'a'.repeat(950)
    const chunks = toChunks('TRIP1', payload, 400)
    expect(chunks).toHaveLength(3)
    expect(chunks[0]).toBe(`TRIP1:1/3:${'a'.repeat(400)}`)

    const collector = makeChunkCollector('TRIP1')
    expect(collector.collect(String(chunks[2]))).toEqual({
      received: 1,
      total: 3,
      payload: null,
    })
    expect(collector.collect(String(chunks[2]))?.received).toBe(1)
    expect(collector.collect(String(chunks[0]))?.received).toBe(2)
    expect(collector.collect(String(chunks[1]))?.payload).toBe(payload)
  })

  it('keeps a short payload in a single chunk', () => {
    const chunks = toChunks('TRIP1', 'hello')
    expect(chunks).toEqual(['TRIP1:1/1:hello'])

    const collector = makeChunkCollector('TRIP1')
    expect(collector.collect(String(chunks[0]))?.payload).toBe('hello')
  })

  it('ignores foreign codes', () => {
    const collector = makeChunkCollector('TRIP1')
    expect(collector.collect('https://example.com')).toBeNull()
    expect(collector.collect('OTHER:1/1:data')).toBeNull()
  })
})
