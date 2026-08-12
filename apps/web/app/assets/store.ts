import { ref } from 'remix/ui'

import {
  documentSchema,
  emptyDocument,
  type TripDocument,
} from '../business/store.common.ts'
import { makeLocalStore } from '../framework/local-store.ts'

const documentStore = makeLocalStore<TripDocument>({
  key: 'trip-expenses:document',
  parse: (raw) => {
    const result = documentSchema.safeParse(raw)
    return result.success ? result.data : null
  },
  empty: emptyDocument,
})

function deviceId() {
  const key = 'trip-expenses:device'
  const existing = localStorage.getItem(key)
  if (existing) return existing
  const id = crypto.randomUUID()
  localStorage.setItem(key, id)
  return id
}

type BindableHandle = {
  update(): Promise<AbortSignal>
  signal: AbortSignal
}

function bindDocument(handle: BindableHandle) {
  let current: TripDocument | null = null

  const sync = () => {
    current = documentStore.load()
    handle.update()
  }

  const unsubscribe = documentStore.subscribe(sync)
  handle.signal.addEventListener('abort', unsubscribe)

  return {
    ready: () => current !== null,
    document: () => current ?? emptyDocument(),
    mount: ref(() => {
      if (current === null) queueMicrotask(sync)
    }),
  }
}

type MutationResult<Data> =
  | { success: true; data: Data; errors: unknown[] }
  | { success: false; errors: Array<{ message?: string }> }

async function mutateDocument<Data extends { document: TripDocument }>(
  mutation: (
    input: unknown,
    context: { document: TripDocument }
  ) => Promise<MutationResult<Data>>,
  input: unknown
): Promise<{ data: Data; error: null } | { data: null; error: string }> {
  const result = await mutation(input, { document: documentStore.load() })
  if (!result.success) {
    const [first] = result.errors
    return {
      data: null,
      error: first?.message || 'Something went wrong. Check the form.',
    }
  }
  documentStore.save(result.data.document)
  return { data: result.data, error: null }
}

export { bindDocument, deviceId, documentStore, mutateDocument }
