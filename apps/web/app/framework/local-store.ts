type LocalStore<Document> = {
  load(): Document
  save(document: Document): Document
  update(mutate: (document: Document) => Document): Document
  subscribe(listener: () => void): () => void
}

type LocalStoreOptions<Document> = {
  key: string
  parse: (raw: unknown) => Document | null
  empty: () => Document
  storage?: Pick<Storage, 'getItem' | 'setItem'>
}

function makeLocalStore<Document>({
  key,
  parse,
  empty,
  storage,
}: LocalStoreOptions<Document>): LocalStore<Document> {
  const backend = storage ?? globalThis.localStorage
  const listeners = new Set<() => void>()

  function notify() {
    for (const listener of listeners) listener()
  }

  function load() {
    const raw = backend.getItem(key)
    if (raw === null) return empty()
    try {
      return parse(JSON.parse(raw)) ?? empty()
    } catch {
      return empty()
    }
  }

  function save(document: Document) {
    backend.setItem(key, JSON.stringify(document))
    notify()
    return document
  }

  return {
    load,
    save,
    update(mutate) {
      return save(mutate(load()))
    },
    subscribe(listener) {
      listeners.add(listener)
      const onStorage = (event: StorageEvent) => {
        if (event.key === key) listener()
      }
      globalThis.addEventListener?.('storage', onStorage)
      return () => {
        listeners.delete(listener)
        globalThis.removeEventListener?.('storage', onStorage)
      }
    },
  }
}

export type { LocalStore }
export { makeLocalStore }
