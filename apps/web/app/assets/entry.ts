import { run } from 'remix/ui'

import { warmOfflineCache } from './offline.ts'
import { documentStore } from './store.ts'

const app = run({
  async loadModule(moduleUrl, exportName) {
    const mod = await import(moduleUrl)
    return mod[exportName]
  },
  async resolveFrame(src, signal) {
    const response = await fetch(src, {
      headers: { Accept: 'text/html' },
      signal,
    })
    if (!response.ok) {
      return `<pre>Frame error: ${response.status} ${response.statusText}</pre>`
    }

    if (response.body) return response.body
    return await response.text()
  },
})

app.addEventListener('error', (event) => {
  console.error('Component error:', event.error)
})

let warmingTimer: ReturnType<typeof setTimeout> | undefined

function scheduleOfflineCacheWarming() {
  clearTimeout(warmingTimer)
  warmingTimer = setTimeout(() => warmOfflineCache(documentStore.load()), 2000)
}

documentStore.subscribe(scheduleOfflineCacheWarming)
scheduleOfflineCacheWarming()
