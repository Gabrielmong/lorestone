/**
 * RecordingService — module singleton that owns the WebSocket + AudioContext lifecycle.
 * Lives outside React so it survives navigation. Updates the Zustand recording store directly.
 * Calls Apollo mutations via the shared client instance.
 */

import { gql } from '@apollo/client'
import { client } from '../apollo'
import { useRecordingStore } from '../store/recording'

const ADD_SEGMENT = gql`
  mutation AddTranscriptSegment(
    $sessionId: ID!
    $speakerId: Int
    $speakerName: String
    $rawText: String!
    $startTime: Float!
  ) {
    addTranscriptSegment(
      sessionId: $sessionId
      speakerId: $speakerId
      speakerName: $speakerName
      rawText: $rawText
      startTime: $startTime
    ) {
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

class RecordingService {
  private ws: WebSocket | null = null
  private audioCtx: AudioContext | null = null
  private audioSource: MediaStreamAudioSourceNode | null = null
  private processor: ScriptProcessorNode | null = null
  private media: MediaStream | null = null

  private sessionStartMs = 0
  private pending: { id: string; speakerId: number | null }[] = []
  private filterTimer: ReturnType<typeof setTimeout> | null = null
  private knownSpeakers = new Set<number>()

  async start(sessionId: string, language: string): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this.media = stream
    this.sessionStartMs = Date.now()

    // Seed known speakers from existing speaker map
    const { speakerMap } = useRecordingStore.getState()
    this.knownSpeakers = new Set(Object.keys(speakerMap).map(Number))

    const base = import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace(/^http/, 'ws').replace('/graphql', '')
      : 'ws://localhost:4000'
    const ws = new WebSocket(`${base}/transcribe?lang=${language}`)
    this.ws = ws

    await new Promise<void>((resolve, reject) => {
      ws.onerror = (e) => { console.error('[RecordingService] WS error', e); reject(e) }
      ws.onopen = () => {
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data)
            if (msg.type === 'Connected') resolve()
          } catch {}
        }
      }
    })

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'Results' && data.is_final) this.handleResult(sessionId, data)
      } catch {}
    }
    ws.onclose = () => useRecordingStore.getState().setRecording(false)

    const audioCtx = new AudioContext({ sampleRate: 16000 })
    const source = audioCtx.createMediaStreamSource(stream)
    const proc = audioCtx.createScriptProcessor(4096, 1, 1)
    source.connect(proc)
    proc.connect(audioCtx.destination)
    proc.onaudioprocess = (e) => {
      if (ws.readyState !== WebSocket.OPEN) return
      const float32 = e.inputBuffer.getChannelData(0)
      const int16 = new Int16Array(float32.length)
      for (let i = 0; i < float32.length; i++) {
        int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768))
      }
      ws.send(int16.buffer)
    }

    this.audioCtx = audioCtx
    this.audioSource = source
    this.processor = proc
    useRecordingStore.getState().setRecording(true)
  }

  stop(sessionId: string): void {
    this.processor?.disconnect()
    this.audioSource?.disconnect()
    this.audioCtx?.close()
    this.audioCtx = null
    this.audioSource = null
    this.processor = null
    this.media?.getTracks().forEach((t) => t.stop())
    this.media = null
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.close()
    this.ws = null
    useRecordingStore.getState().setRecording(false)

    const batch = this.pending.splice(0)
    if (batch.length) {
      client.mutate({
        mutation: FILTER_BATCH,
        variables: { sessionId, segmentIds: batch.map((s) => s.id) },
      })
    }
  }

  async assignName(sessionId: string, speakerId: number, name: string): Promise<void> {
    useRecordingStore.getState().assignSpeaker(speakerId, name)
    await client.mutate({
      mutation: ASSIGN_SPEAKER,
      variables: { sessionId, speakerId, speakerName: name },
    })
  }

  private scheduleBatchFilter(sessionId: string): void {
    if (this.filterTimer) clearTimeout(this.filterTimer)
    this.filterTimer = setTimeout(() => {
      const batch = this.pending.splice(0)
      if (!batch.length) return
      client.mutate({
        mutation: FILTER_BATCH,
        variables: { sessionId, segmentIds: batch.map((s) => s.id) },
      })
    }, 15000)
  }

  private async handleResult(sessionId: string, data: any): Promise<void> {
    const alt = data?.channel?.alternatives?.[0]
    if (!alt?.transcript?.trim()) return
    const text: string = alt.transcript.trim()
    const speakerId: number = data.speaker ?? 0
    const startTime = (Date.now() - this.sessionStartMs) / 1000
    const { speakerMap } = useRecordingStore.getState()
    const speakerName = speakerMap[speakerId] ?? null

    if (!this.knownSpeakers.has(speakerId)) {
      this.knownSpeakers.add(speakerId)
      if (!speakerMap[speakerId]) {
        useRecordingStore.getState().setUnknownSpeaker(speakerId)
      }
    }

    const result = await client.mutate({
      mutation: ADD_SEGMENT,
      variables: { sessionId, speakerId, speakerName, rawText: text, startTime },
    })
    const newSeg = result.data.addTranscriptSegment
    useRecordingStore.getState().addSegment(newSeg)

    this.pending.push({ id: newSeg.id, speakerId })
    if (this.pending.length >= 10) {
      const batch = this.pending.splice(0)
      client.mutate({
        mutation: FILTER_BATCH,
        variables: { sessionId, segmentIds: batch.map((s) => s.id) },
      })
    } else {
      this.scheduleBatchFilter(sessionId)
    }
  }
}

export const recordingService = new RecordingService()
