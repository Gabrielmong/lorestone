import { useRef, useState, useCallback, useEffect } from 'react'
import { useMutation, gql } from '@apollo/client'

const ADD_SEGMENT = gql`
  mutation AddTranscriptSegment($sessionId: ID!, $speakerId: Int, $speakerName: String, $rawText: String!, $startTime: Float!) {
    addTranscriptSegment(sessionId: $sessionId, speakerId: $speakerId, speakerName: $speakerName, rawText: $rawText, startTime: $startTime) {
      id speakerId speakerName rawText cleanText isGameRelated startTime
    }
  }
`

const FILTER_BATCH = gql`
  mutation FilterBatch($sessionId: ID!, $segmentIds: [ID!]!) {
    filterTranscriptBatch(sessionId: $sessionId, segmentIds: $segmentIds)
  }
`

const ASSIGN_SPEAKER = gql`
  mutation AssignSpeaker($sessionId: ID!, $speakerId: Int!, $speakerName: String!) {
    assignSpeakerName(sessionId: $sessionId, speakerId: $speakerId, speakerName: $speakerName)
  }
`

export interface TranscriptSegment {
  id: string
  speakerId: number | null
  speakerName: string | null
  rawText: string
  cleanText: string | null
  isGameRelated: boolean
  startTime: number
}

interface PendingSegment {
  id: string
  speakerId: number | null
}

export function useTranscription(sessionId: string, initialSegments: TranscriptSegment[] = [], language = 'es') {
  const [addSegment] = useMutation(ADD_SEGMENT)
  const [filterBatch] = useMutation(FILTER_BATCH)
  const [assignSpeaker] = useMutation(ASSIGN_SPEAKER)

  const [isRecording, setIsRecording] = useState(false)
  const [segments, setSegments] = useState<TranscriptSegment[]>(initialSegments)
  const [speakerMap, setSpeakerMap] = useState<Record<number, string>>({})
  const [unknownSpeaker, setUnknownSpeaker] = useState<number | null>(null)

  const connectionRef = useRef<any>(null)
  const mediaRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<{ audioCtx: AudioContext; source: MediaStreamAudioSourceNode; processor: ScriptProcessorNode } | null>(null)
  const sessionStartMs = useRef<number>(Date.now())
  const pendingFilterRef = useRef<PendingSegment[]>([])
  const filterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const knownSpeakersRef = useRef<Set<number>>(new Set())
  const speakerMapRef = useRef<Record<number, string>>({})

  // Rebuild speaker map from previously saved segments on mount
  useEffect(() => {
    initialSegments.forEach((s) => {
      if (s.speakerId !== null && s.speakerId !== undefined && s.speakerName) {
        speakerMapRef.current[s.speakerId] = s.speakerName
        knownSpeakersRef.current.add(s.speakerId)
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const scheduleBatchFilter = useCallback(() => {
    if (filterTimerRef.current) clearTimeout(filterTimerRef.current)
    filterTimerRef.current = setTimeout(async () => {
      const batch = pendingFilterRef.current.splice(0)
      if (!batch.length) return
      await filterBatch({ variables: { sessionId, segmentIds: batch.map((s) => s.id) } })
    }, 15000)
  }, [sessionId, filterBatch])

  const handleResult = useCallback(async (data: any) => {
    const alt = data?.channel?.alternatives?.[0]
    if (!alt?.transcript?.trim()) return
    const text: string = alt.transcript.trim()
    const speakerId: number = data.speaker ?? 0
    const startTime = (Date.now() - sessionStartMs.current) / 1000
    const speakerName = speakerMapRef.current[speakerId] ?? null

    if (!knownSpeakersRef.current.has(speakerId)) {
      knownSpeakersRef.current.add(speakerId)
      if (!speakerMapRef.current[speakerId]) setUnknownSpeaker(speakerId)
    }

    const result = await addSegment({
      variables: { sessionId, speakerId, speakerName, rawText: text, startTime },
    })
    const newSeg: TranscriptSegment = result.data.addTranscriptSegment
    setSegments((prev) => [...prev, newSeg])

    pendingFilterRef.current.push({ id: newSeg.id, speakerId })
    if (pendingFilterRef.current.length >= 10) {
      const batch = pendingFilterRef.current.splice(0)
      filterBatch({ variables: { sessionId, segmentIds: batch.map((s) => s.id) } })
    } else {
      scheduleBatchFilter()
    }
  }, [sessionId, addSegment, filterBatch, scheduleBatchFilter])

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRef.current = stream
    sessionStartMs.current = Date.now()

    // Connect to our backend proxy — it forwards audio to Deepgram server-side
    const base = import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace(/^http/, 'ws').replace('/graphql', '')
      : 'ws://localhost:4000'
    const ws = new WebSocket(`${base}/transcribe?lang=${language}`)
    connectionRef.current = ws


    // Wait for proxy to open, then wait for Deepgram 'Connected' signal
    await new Promise<void>((resolve, reject) => {
      ws.onerror = (e) => { console.error('[Transcript] proxy error', e); reject(e) }
      ws.onopen = () => {
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data)
            if (msg.type === 'Connected') resolve()
          } catch {}
        }
      }
    })

    // Now Deepgram is open — attach real message handler and start recording
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'Results' && data.is_final) handleResult(data)
      } catch {}
    }
    ws.onclose = () => setIsRecording(false)

    // Use AudioContext to capture raw 16-bit PCM — more reliable than WebM chunks
    const audioCtx = new AudioContext({ sampleRate: 16000 })
    const source = audioCtx.createMediaStreamSource(stream)
    const processor = audioCtx.createScriptProcessor(4096, 1, 1)
    source.connect(processor)
    processor.connect(audioCtx.destination)
    processor.onaudioprocess = (e) => {
      if (ws.readyState !== WebSocket.OPEN) return
      const float32 = e.inputBuffer.getChannelData(0)
      const int16 = new Int16Array(float32.length)
      for (let i = 0; i < float32.length; i++) {
        int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768))
      }
      ws.send(int16.buffer)
    }
    audioCtxRef.current = { audioCtx, source, processor }
    setIsRecording(true)
  }, [handleResult])

  const stop = useCallback(() => {
    const ctx = audioCtxRef.current
    if (ctx) { ctx.processor.disconnect(); ctx.source.disconnect(); ctx.audioCtx.close(); audioCtxRef.current = null }
    mediaRef.current?.getTracks().forEach((t) => t.stop())
    const ws = connectionRef.current as WebSocket | null
    if (ws && ws.readyState === WebSocket.OPEN) ws.close()
    setIsRecording(false)
    const batch = pendingFilterRef.current.splice(0)
    if (batch.length) filterBatch({ variables: { sessionId, segmentIds: batch.map((s) => s.id) } })
  }, [sessionId, filterBatch])

  const assignName = useCallback(async (speakerId: number, name: string) => {
    speakerMapRef.current[speakerId] = name
    setSpeakerMap((prev) => ({ ...prev, [speakerId]: name }))
    setUnknownSpeaker(null)
    await assignSpeaker({ variables: { sessionId, speakerId, speakerName: name } })
    setSegments((prev) =>
      prev.map((s) => (s.speakerId === speakerId ? { ...s, speakerName: name } : s)),
    )
  }, [sessionId, assignSpeaker])

  return { isRecording, segments, speakerMap, unknownSpeaker, start, stop, assignName }
}
