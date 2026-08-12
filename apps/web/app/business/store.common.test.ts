import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { newId, uuidFromBytes } from './store.common.ts'

describe('newId', () => {
  it('produces a valid uuid', () => {
    expect(z.uuid().safeParse(newId()).success).toBe(true)
  })
})

describe('uuidFromBytes', () => {
  it('formats random bytes as a valid uuid v4', () => {
    const id = uuidFromBytes(crypto.getRandomValues(new Uint8Array(16)))
    expect(z.uuid().safeParse(id).success).toBe(true)
    expect(id[14]).toBe('4')
    expect(['8', '9', 'a', 'b']).toContain(id[19])
  })
})
