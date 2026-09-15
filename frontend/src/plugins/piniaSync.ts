import type { PiniaPluginContext } from 'pinia'
import axios from 'axios'
import { toRaw } from 'vue'

export function createPiniaSyncPlugin(baseURL = '', debounceMs = 500) {
  return ({ store, options }: PiniaPluginContext) => {
    if (!options.sync) return

    const storeId = store.$id
    const endpoint = `${baseURL}/api/sync/${storeId}`
    const defaultFactory = options.defaultFactory

    console.log(`[piniaSync] defaultFactory for "${storeId}":`, defaultFactory)

    let debounceTimer: ReturnType<typeof setTimeout>
    let lastState: any = {}
    let initialized = false

    function safeClone(obj: any) {
      try {
        return JSON.parse(JSON.stringify(obj))
      } catch (err) {
        console.warn(`[piniaSync] JSON clone failed:`, err)
        return {}
      }
    }

    function postState(state: any) {
      const rawState = toRaw(state)
      const payload = rawState

      axios.post(endpoint, payload).catch(err => {
        console.error(`Failed to sync store "${storeId}"`, err)
      })
    }

    const isEmptyState = (state: any) =>(
        !state?.personas || state.personas.length === 0)
      
    axios.get(endpoint).then(res => {
    let incoming = res.data || {}
    console.log(`[piniaSync] incoming "${storeId}":`, incoming)
    
    const shouldCreateDefault = isEmptyState(incoming) && defaultFactory
    
    if (shouldCreateDefault) {
        console.log(`[piniaSync] calling defaultFactory`)
        const defaultState = defaultFactory()
        incoming = defaultState
        console.log(`[piniaSync] incoming "${storeId}":`, incoming)
        console.log(`[piniaSync] Creating default for "${storeId}"`)
        postState(defaultState) // sync the default back to backend
    }
    
    store.$patch(incoming)
    lastState = safeClone(incoming)
    initialized = true
    })
    .catch(err => {
      console.warn(`[piniaSync] Initial sync failed for "${storeId}"`, err)
    })

    store.$subscribe((_, state) => {
      if (!initialized) return

      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        postState(state)
        lastState = safeClone(toRaw(state))
        console.log(`[piniaSync] Saved "${storeId}"`)
      }, debounceMs)
    })

    window.addEventListener('beforeunload', () => {
      clearTimeout(debounceTimer)
      postState(lastState)
    })
  }
}
