import { useEffect } from 'react'
import { Unity, useUnityContext } from 'react-unity-webgl'

type UmaAvatarProps = {
  mouthLevel: number
}

const defaultBuildBase = '/unity/UMA/Build/UMA'

export default function UmaAvatar({ mouthLevel }: UmaAvatarProps) {
  const buildBase = (import.meta.env.VITE_UMA_MODEL_URL?.trim() || defaultBuildBase).replace(/\/+$/, '')
  const { unityProvider, isLoaded, loadingProgression, sendMessage } = useUnityContext({
    loaderUrl: `${buildBase}.loader.js`,
    dataUrl: `${buildBase}.data`,
    frameworkUrl: `${buildBase}.framework.js`,
    codeUrl: `${buildBase}.wasm`,
  })
  const level = Math.max(0, Math.min(1, mouthLevel))

  useEffect(() => {
    const detail = { mouthLevel: level }
    window.dispatchEvent(new CustomEvent('uma:puppet', { detail }))

    // Match the ReactBridge object and ReceiveFromReact method used by the
    // Unity integration in the earlier RTC page. Unity's SendMessage API takes
    // a string for the method argument.
    if (isLoaded) {
      sendMessage('ReactBridge', 'ReceiveFromReact', level.toFixed(3))
    }
  }, [isLoaded, level, sendMessage])

  return (
    <section className="uma-avatar" aria-label="Patient avatar">
      <div className="uma-avatar-stage">
        <Unity
          unityProvider={unityProvider}
          className="uma-avatar-canvas"
          style={{ width: '100%', aspectRatio: '16 / 9' }}
        />
        {!isLoaded && (
          <div className="uma-avatar-loading" role="status" aria-live="polite">
            Loading UMA avatar… {Math.round(loadingProgression * 100)}%
          </div>
        )}
      </div>
      <div className="uma-mouth-meter" aria-label={`Patient voice level ${Math.round(level * 100)} percent`}>
        <div style={{ width: `${Math.round(level * 100)}%` }} />
      </div>
    </section>
  )
}
