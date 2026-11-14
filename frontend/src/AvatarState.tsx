// Tells the Unity avatar what the patient is doing: idle, listening or speaking.
// Put this file at frontend/src/avatarState.ts.
//
// State changes are rare (a few per minute) and sent as short strings, which is
// much lighter than streaming the mouth level 30 times a second.
import { useEffect } from 'react'
import type { useUnityContext } from 'react-unity-webgl'

// Name of the GameObject that has ReactBridge on it, and the method to call.
// Change UNITY_OBJECT if your partner's object has a different name.
const UNITY_OBJECT = 'ReactBridge'
const UNITY_METHOD = 'SetState'

export type AvatarState = 'idle' | 'listening' | 'speaking'

let current: AvatarState = 'idle'

/** Announce a new state. Does nothing if the state hasn't changed. */
export function emitAvatarState(next: AvatarState) {
  if (next === current) return
  current = next
  window.dispatchEvent(new CustomEvent<AvatarState>('vera-avatar-state', { detail: next }))
}

// The patient counts as "speaking" while their voice is above this level, and
// goes back to "idle" after it has been quieter than this for HOLD_MS.
// (Your logs show a noise floor around 0.02 and speech from about 0.1 up.)
const SPEAKING_LEVEL = 0.06
const HOLD_MS = 600

type SendMessage = ReturnType<typeof useUnityContext>['sendMessage']

export function useAvatarBridge(isLoaded: boolean, sendMessage: SendMessage) {
  // 1. Work out "speaking" from the loudness events the page already produces.
  useEffect(() => {
    let quietSince = 0
    const onLevel = (event: Event) => {
      const level = (event as CustomEvent<number>).detail
      const now = performance.now()
      if (level > SPEAKING_LEVEL) {
        quietSince = 0
        emitAvatarState('speaking')
      } else if (current === 'speaking') {
        if (!quietSince) quietSince = now
        else if (now - quietSince > HOLD_MS) {
          quietSince = 0
          emitAvatarState('idle')
        }
      }
    }
    window.addEventListener('vera-mouth-level', onLevel)
    return () => {
      window.removeEventListener('vera-mouth-level', onLevel)
      current = 'idle' // fresh start the next time the page opens
    }
  }, [])

  // 2. Forward every state change to Unity (UNITY_OBJECT, SetState(string)).
  useEffect(() => {
    if (!isLoaded) return
    const send = (state: AvatarState) => {
      try {
        sendMessage(UNITY_OBJECT, UNITY_METHOD, state)
      } catch (error) {
        console.error('[rtc] could not send avatar state', state, error)
      }
    }
    const onState = (event: Event) => send((event as CustomEvent<AvatarState>).detail)
    window.addEventListener('vera-avatar-state', onState)
    send(current) // tell Unity where we are as soon as it has loaded
    return () => window.removeEventListener('vera-avatar-state', onState)
  }, [isLoaded, sendMessage])
}