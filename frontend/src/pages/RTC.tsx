import { Unity, useUnityContext } from 'react-unity-webgl'

import React, { useCallback, useEffect } from 'react'
import Footer from '../components/Footer'
import Header from '../components/Header'


//basic input of data where we need a name and a type of input

//This page component will be were we set up the person creator interface and functionality.
const RTC: React.FC = () => {
    //functionality goes here
    const { unityProvider, isLoaded, sendMessage } = useUnityContext({
        loaderUrl: '/unity/Build/test.loader.js',
        dataUrl: '/unity/Build/test.data',
        frameworkUrl: '/unity/Build/test.framework.js',
        codeUrl: '/unity/Build/test.wasm',
    })

    const handleSend = () => {
        sendMessage('ReactBridge', 'ReceiveFromReact', 'Hello from React!')
    }

    const handleUnityMessage = useCallback((message: string) => {
        console.log('From Unity:', message)
    }, [])

    useEffect(() => {
        addEventListener('SendToReact', handleUnityMessage)
        return () => removeEventListener('SendToReact', handleUnityMessage)
    }, [addEventListener, removeEventListener, handleUnityMessage])

    //HTML output goes into the return statement below.
    return (
        <>
            <Header />
                <Unity unityProvider={unityProvider} style={{ width: '100%', aspectRatio: '16 / 9' }} />
                <button type="button" onClick={handleSend} disabled={!isLoaded}>
                    Send to Unity
                </button>
            
            <Footer />
        </>
        
    )
}


//We export the component for use by other parts of the app
export default RTC