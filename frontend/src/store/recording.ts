import { create } from 'zustand'
import type { TranscriptSegment } from '../hooks/useTranscription'

interface RecordingStore {
  // Active session metadata
  activeSessionId: string | null
  sessionNumber: number | null
  sessionName: string | null
  startedAt: string | null
  campaignCharacters: string[]
  dmName: string

  // Timer
  elapsed: number
  paused: boolean
  pausedAt: number | null   // timestamp when we paused
  pausedOffset: number      // accumulated ms of paused time

  // Recording
  isRecording: boolean
  language: 'es' | 'en' | 'multi'

  // Transcript
  segments: TranscriptSegment[]
  speakerMap: Record<number, string>
  unknownSpeaker: number | null

  // Actions
  setActiveSession(opts: {
    id: string
    sessionNumber: number | null
    sessionName: string | null
    startedAt: string | null
    campaignCharacters: string[]
    dmName: string
    initialSegments: TranscriptSegment[]
  }): void
  clearActiveSession(): void
  setRecording(v: boolean): void
  addSegment(seg: TranscriptSegment): void
  assignSpeaker(speakerId: number, name: string): void
  setUnknownSpeaker(id: number | null): void
  setLanguage(lang: 'es' | 'en' | 'multi'): void
  setElapsed(ms: number): void
  pauseTimer(): void
  resumeTimer(): void
}

export const useRecordingStore = create<RecordingStore>((set) => ({
  activeSessionId: null,
  sessionNumber: null,
  sessionName: null,
  startedAt: null,
  campaignCharacters: [],
  dmName: '',

  elapsed: 0,
  paused: false,
  pausedAt: null,
  pausedOffset: 0,

  isRecording: false,
  language: 'es',

  segments: [],
  speakerMap: {},
  unknownSpeaker: null,

  setActiveSession: ({ id, sessionNumber, sessionName, startedAt, campaignCharacters, dmName, initialSegments }) => {
    const speakerMap: Record<number, string> = {}
    initialSegments.forEach((s) => {
      if (s.speakerId !== null && s.speakerName) speakerMap[s.speakerId] = s.speakerName
    })
    set({
      activeSessionId: id,
      sessionNumber,
      sessionName,
      startedAt,
      campaignCharacters,
      dmName,
      segments: initialSegments,
      speakerMap,
      elapsed: 0,
      paused: false,
      pausedAt: null,
      pausedOffset: 0,
    })
  },

  clearActiveSession: () =>
    set({ activeSessionId: null, sessionNumber: null, sessionName: null, startedAt: null }),

  setRecording: (v) => set({ isRecording: v }),

  addSegment: (seg) => set((s) => ({ segments: [...s.segments, seg] })),

  assignSpeaker: (speakerId, name) =>
    set((s) => ({
      speakerMap: { ...s.speakerMap, [speakerId]: name },
      unknownSpeaker: s.unknownSpeaker === speakerId ? null : s.unknownSpeaker,
      segments: s.segments.map((seg) =>
        seg.speakerId === speakerId ? { ...seg, speakerName: name } : seg,
      ),
    })),

  setUnknownSpeaker: (id) => set({ unknownSpeaker: id }),

  setLanguage: (lang) => set({ language: lang }),

  setElapsed: (ms) => set({ elapsed: ms }),

  pauseTimer: () => set({ paused: true, pausedAt: Date.now() }),

  resumeTimer: () =>
    set((s) => ({
      paused: false,
      pausedOffset: s.pausedOffset + (s.pausedAt !== null ? Date.now() - s.pausedAt : 0),
      pausedAt: null,
    })),
}))
