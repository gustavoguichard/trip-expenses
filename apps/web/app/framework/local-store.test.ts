import { describe, expect, it } from 'vitest'

import { makeLocalStore } from './local-store.ts'

function makeMemoryStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
  }
}

type Document = { count: number }

function makeStore(storage = makeMemoryStorage()) {
  return makeLocalStore<Document>({
    key: 'test',
    parse: (raw) =>
      typeof raw === 'object' && raw !== null && 'count' in raw
        ? (raw as Document)
        : null,
    empty: () => ({ count: 0 }),
    storage,
  })
}

describe('makeLocalStore', () => {
  it('returns the empty document when nothing is stored', () => {
    expect(makeStore().load()).toEqual({ count: 0 })
  })

  it('round-trips a saved document', () => {
    const store = makeStore()
    store.save({ count: 3 })
    expect(store.load()).toEqual({ count: 3 })
  })

  it('falls back to the empty document on corrupt data', () => {
    const storage = makeMemoryStorage()
    storage.setItem('test', 'not json')
    expect(makeStore(storage).load()).toEqual({ count: 0 })

    storage.setItem('test', JSON.stringify({ wrong: true }))
    expect(makeStore(storage).load()).toEqual({ count: 0 })
  })

  it('updates through a mutation and notifies subscribers', () => {
    const store = makeStore()
    let notified = 0
    const unsubscribe = store.subscribe(() => {
      notified += 1
    })

    const updated = store.update((document) => ({
      count: document.count + 1,
    }))

    expect(updated).toEqual({ count: 1 })
    expect(store.load()).toEqual({ count: 1 })
    expect(notified).toBe(1)

    unsubscribe()
    store.save({ count: 9 })
    expect(notified).toBe(1)
  })
})
