// =============================================================================
// RTC.tsx: the student's voice conversation with the AI patient
// =============================================================================
//
// Open with /rtc?assignmentId=12 (the Student Portal's Start button does this).
//
// HOW A CONVERSATION WORKS
//   1. Start: ask for the microphone, build a WebRTC offer, and send it to our
//      backend (POST /api/realtime/session). The backend checks the student,
//      builds the patient's instructions, and creates the OpenAI call with its
//      own key. It returns OpenAI's answer, which we plug into the connection.
//   2. Live: the patient's voice plays through <audio>. OpenAI also sends
//      events over a data channel ("oai-events"): we use them for the live
//      transcript. The backend saves the official transcript on its side.
//   3. Typing instead of talking: a typed message goes into the same session,
//      and the patient still answers out loud.
//   4. End: POST /api/realtime/session/<id>/end, then close everything.
//
// MOUTH LEVEL (for Unity lip sync later)
//   We measure how loud the patient's voice is ~30 times a second (0 to 1).
//   For now it drives the bar on the page. Unity can read the same number
//   from the "vera-mouth-level" event: window.addEventListener(...)
// =============================================================================

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Footer from '../components/Footer'
import Header from '../components/Header'
import { endRealtimeSession, startRealtimeSession } from '../api/realtime'

type Phase = 'idle' | 'connecting' | 'live' | 'ending' | 'ended' | 'error'

type Line = {
  id: string                       // OpenAI's conversation item id
  speaker: 'student' | 'patient'
  text: string
}

// What we read from OpenAI's event JSON (only the fields we use).
type RealtimeEvent = {
  type?: string
  item_id?: string
  previous_item_id?: string | null
  delta?: string
  transcript?: string
  text?: string
  item?: {
    id?: string
    type?: string
    role?: string
    content?: Array<{ type?: string; text?: string; transcript?: string }>
  }
  error?: { message?: string }
}

const RTC: React.FC = () => {
  const [params] = useSearchParams()
  const assignmentId = Number(params.get('assignmentId'))
  const validAssignment = Number.isSafeInteger(assignmentId) && assignmentId > 0

  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [typed, setTyped] = useState('')
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [mouthLevel, setMouthLevel] = useState(0)

  // Connection pieces live in refs: they change without needing a re-render.
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const channelRef = useRef<RTCDataChannel | null>(null)
  const micRef = useRef<MediaStream | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const frameRef = useRef<number | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const deadlineRef = useRef<number | null>(null)
  const transcriptEndRef = useRef<HTMLDivElement | null>(null)

  // ---------------------------------------------------------------------------
  // Transcript: OpenAI announces each new message ("conversation.item.added",
  // with the id of the message before it), then streams its words. We place
  // each message after its predecessor so the order is right even when the
  // student's transcription arrives after the patient has started talking.
  // ---------------------------------------------------------------------------
  const placeLine = useCallback((id: string, speaker: Line['speaker'], text: string, after?: string | null) => {
    setLines((prev) => {
      if (prev.some((l) => l.id === id)) return prev
      const next = [...prev]
      const index = after ? next.findIndex((l) => l.id === after) : -1
      if (index >= 0) next.splice(index + 1, 0, { id, speaker, text })
      else next.push({ id, speaker, text })
      return next
    })
  }, [])

  const appendText = useCallback((id: string, speaker: Line['speaker'], delta: string) => {
    setLines((prev) => {
      if (!prev.some((l) => l.id === id)) return [...prev, { id, speaker, text: delta }]
      return prev.map((l) => (l.id === id ? { ...l, text: l.text + delta } : l))
    })
  }, [])

  const setText = useCallback((id: string, speaker: Line['speaker'], text: string) => {
    setLines((prev) => {
      if (!prev.some((l) => l.id === id)) return [...prev, { id, speaker, text }]
      return prev.map((l) => (l.id === id ? { ...l, text } : l))
    })
  }, [])

  const handleEvent = useCallback((raw: string) => {
    let event: RealtimeEvent
    try {
      event = JSON.parse(raw)
    } catch {
      return
    }

    switch (event.type) {
      case 'conversation.item.added':
      case 'conversation.item.created': {
        const item = event.item
        if (!item?.id || item.type !== 'message') return
        if (item.role !== 'user' && item.role !== 'assistant') return
        const speaker = item.role === 'user' ? 'student' : 'patient'
        // Typed messages arrive with their text; spoken ones fill in later.
        const text = (item.content ?? []).map((c) => c.text ?? c.transcript ?? '').join('')
        placeLine(item.id, speaker, text, event.previous_item_id)
        return
      }
      // The student's speech, transcribed.
      case 'conversation.item.input_audio_transcription.delta':
        if (event.item_id && event.delta) appendText(event.item_id, 'student', event.delta)
        return
      case 'conversation.item.input_audio_transcription.completed':
        if (event.item_id) setText(event.item_id, 'student', event.transcript ?? '')
        return
      // The patient's words, as they are spoken.
      case 'response.output_audio_transcript.delta':
      case 'response.output_text.delta':
        if (event.item_id && event.delta) appendText(event.item_id, 'patient', event.delta)
        return
      case 'response.output_audio_transcript.done':
        if (event.item_id && event.transcript !== undefined) setText(event.item_id, 'patient', event.transcript)
        return
      case 'response.output_text.done':
        if (event.item_id && event.text !== undefined) setText(event.item_id, 'patient', event.text)
        return
      case 'error':
        setError(event.error?.message ?? 'The conversation reported an error')
        return
      default:
        return
    }
  }, [appendText, placeLine, setText])

  // ---------------------------------------------------------------------------
  // Mouth level: loudness of the patient's voice, 0 (quiet) to 1 (loud).
  // ---------------------------------------------------------------------------
  const startMouthMeter = useCallback((stream: MediaStream) => {
    const ctx = audioCtxRef.current
    if (!ctx) return
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    ctx.createMediaStreamSource(stream).connect(analyser)
    const samples = new Uint8Array(analyser.fftSize)

    const tick = () => {
      analyser.getByteTimeDomainData(samples)
      let sum = 0
      for (const s of samples) {
        const centered = (s - 128) / 128
        sum += centered * centered
      }
      const level = Math.min(1, Math.sqrt(sum / samples.length) * 4)
      setMouthLevel(level)
      window.dispatchEvent(new CustomEvent('vera-mouth-level', { detail: level }))
      frameRef.current = requestAnimationFrame(tick)
    }
    tick()
  }, [])

  // ---------------------------------------------------------------------------
  // Close every local piece (does not call the backend).
  // ---------------------------------------------------------------------------
  const closeLocal = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    channelRef.current?.close()
    channelRef.current = null
    pcRef.current?.close()
    pcRef.current = null
    micRef.current?.getTracks().forEach((t) => t.stop())
    micRef.current = null
    audioCtxRef.current?.close().catch(() => undefined)
    audioCtxRef.current = null
    if (audioRef.current) audioRef.current.srcObject = null
    deadlineRef.current = null
    setSecondsLeft(null)
    setMouthLevel(0)
    window.dispatchEvent(new CustomEvent('vera-mouth-level', { detail: 0 }))
  }, [])

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  async function start() {
    setError('')
    setLines([])
    setPhase('connecting')
    try {
      // Created during the click, so the browser allows audio to play.
      audioCtxRef.current = new AudioContext()

      const mic = await navigator.mediaDevices.getUserMedia({ audio: true })
      micRef.current = mic

      const pc = new RTCPeerConnection()
      pcRef.current = pc
      pc.ontrack = (event) => {
        const [stream] = event.streams
        if (audioRef.current) audioRef.current.srcObject = stream
        startMouthMeter(stream)
      }
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          setError('The connection dropped. End the conversation and start again.')
        }
      }
      mic.getTracks().forEach((track) => pc.addTrack(track, mic))

      const channel = pc.createDataChannel('oai-events')
      channelRef.current = channel
      channel.onmessage = (message) => handleEvent(String(message.data))

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const session = await startRealtimeSession(assignmentId, crypto.randomUUID(), offer.sdp ?? '')
      if (!session.sdp) throw new Error('The server did not return a connection answer')
      sessionIdRef.current = session.sessionId
      deadlineRef.current = Date.parse(session.deadlineAt)

      await pc.setRemoteDescription({ type: 'answer', sdp: session.sdp })
      setPhase('live')
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not start the conversation'
      setError(
        cause instanceof DOMException && cause.name === 'NotAllowedError'
          ? 'Microphone access was blocked. Allow the microphone for this site and try again.'
          : message,
      )
      closeLocal()
      // A session may exist on the server even though setup failed here.
      if (sessionIdRef.current) {
        await endRealtimeSession(sessionIdRef.current).catch(() => undefined)
        sessionIdRef.current = null
      }
      setPhase('error')
    }
  }

  // ---------------------------------------------------------------------------
  // End
  // ---------------------------------------------------------------------------
  const end = useCallback(async () => {
    setPhase('ending')
    const id = sessionIdRef.current
    closeLocal()
    try {
      if (id) await endRealtimeSession(id)
      sessionIdRef.current = null
      setPhase('ended')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not end the conversation cleanly')
      setPhase('error')
    }
  }, [closeLocal])

  // ---------------------------------------------------------------------------
  // Typed message instead of speaking
  // ---------------------------------------------------------------------------
  function sendTyped(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = typed.trim()
    const channel = channelRef.current
    if (!text || !channel || channel.readyState !== 'open') return
    channel.send(JSON.stringify({
      type: 'conversation.item.create',
      item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] },
    }))
    channel.send(JSON.stringify({ type: 'response.create' }))
    setTyped('')
  }

  // Countdown to the backend's deadline; end on our side when it passes.
  useEffect(() => {
    if (phase !== 'live') return
    const timer = window.setInterval(() => {
      if (deadlineRef.current === null) return
      const left = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000))
      setSecondsLeft(left)
      if (left === 0) void end()
    }, 1000)
    return () => window.clearInterval(timer)
  }, [phase, end])

  // Leaving the page ends the conversation.
  useEffect(() => () => {
    const id = sessionIdRef.current
    closeLocal()
    if (id) void endRealtimeSession(id).catch(() => undefined)
  }, [closeLocal])

  // Keep the newest line in view.
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [lines])

  const live = phase === 'live'
  const timeLeft = secondsLeft === null
    ? ''
    : `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')} left`

  return (
    <>
      <Header />
      <main className="content">
        <div className="persona-creator">
          <h1>Patient Conversation</h1>

          {!validAssignment && (
            <p role="alert">
              No assignment selected. Open a scenario from the <Link to="/student-portal">Student Portal</Link>.
            </p>
          )}

          {validAssignment && (
            <>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                {(phase === 'idle' || phase === 'error' || phase === 'ended') && (
                  <button type="button" onClick={start}>
                    {phase === 'idle' ? 'Start conversation' : 'Start a new conversation'}
                  </button>
                )}
                {phase === 'connecting' && <span role="status">Connecting…</span>}
                {live && (
                  <button type="button" onClick={() => void end()}>End conversation</button>
                )}
                {phase === 'ending' && <span role="status">Ending…</span>}
                {live && <span style={{ color: 'var(--text)' }}>{timeLeft}</span>}
              </div>

              {/* Patient view: Unity character goes here; the bar shows mouth level for now. */}
              <div
                aria-label="Patient speaking level"
                style={{
                  marginTop: '16px',
                  height: '10px',
                  borderRadius: '5px',
                  background: 'var(--border)',
                  overflow: 'hidden',
                }}
              >
                <div style={{ width: `${Math.round(mouthLevel * 100)}%`, height: '100%', background: '#1f67a5' }} />
              </div>

              {error && <p role="alert" style={{ color: '#b42318' }}>{error}</p>}
              {phase === 'ended' && (
                <p role="status">
                  Conversation ended and saved. <Link to="/student-portal">Back to your assignments</Link>
                </p>
              )}

              <section aria-label="Transcript" style={{ marginTop: '16px' }}>
                <h2 style={{ fontSize: '18px' }}>Transcript</h2>
                <div
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    background: 'white',
                    padding: '12px',
                    minHeight: '160px',
                    maxHeight: '360px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  {lines.length === 0 && (
                    <p style={{ color: 'var(--text)', margin: 0 }}>
                      {live ? 'Say hello to your patient to begin.' : 'The conversation will appear here.'}
                    </p>
                  )}
                  {lines.filter((l) => l.text.trim()).map((l) => (
                    <p key={l.id} style={{ margin: 0 }}>
                      <strong>{l.speaker === 'student' ? 'You' : 'Patient'}:</strong> {l.text}
                    </p>
                  ))}
                  <div ref={transcriptEndRef} />
                </div>
              </section>

              <form onSubmit={sendTyped} style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <label htmlFor="typed-message" style={{ position: 'absolute', left: '-9999px' }}>
                  Type a message instead of speaking
                </label>
                <input
                  id="typed-message"
                  style={{ flex: 1 }}
                  placeholder={live ? 'Or type a message…' : 'Start the conversation to type'}
                  value={typed}
                  disabled={!live}
                  onChange={(e) => setTyped(e.target.value)}
                />
                <button type="submit" disabled={!live || !typed.trim()}>Send</button>
              </form>
            </>
          )}

          <audio ref={audioRef} autoPlay />
        </div>
      </main>
      <Footer />
    </>
  )
}

export default RTC
