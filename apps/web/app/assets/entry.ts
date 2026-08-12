import { run } from 'remix/ui'

import { warmOfflineCache, warmScreenModules } from './offline.ts'
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
let warmingDelay = 300

function scheduleOfflineCacheWarming() {
  clearTimeout(warmingTimer)
  warmingTimer = setTimeout(() => {
    warmingDelay = 2000
    warmOfflineCache(documentStore.load())
    warmScreenModules()
  }, warmingDelay)
}

documentStore.subscribe(scheduleOfflineCacheWarming)
scheduleOfflineCacheWarming()
