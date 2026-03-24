import Anthropic from '@anthropic-ai/sdk'
import type { Context } from './types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const transcriptResolvers = {
  Query: {
    transcriptSegments: (_: unknown, args: { sessionId: string }, ctx: Context) =>
      ctx.prisma.sessionTranscript.findMany({
        where: { sessionId: args.sessionId },
        orderBy: { startTime: 'asc' },
      }),

    deepgramToken: async () => {
      // Return the API key — browser connects directly to Deepgram
      // In production you'd issue a short-lived token via Deepgram's key API
      return process.env.DEEPGRAM_API_KEY ?? ''
    },
  },

  Mutation: {
    addTranscriptSegment: (
      _: unknown,
      args: { sessionId: string; speakerId?: number; speakerName?: string; rawText: string; startTime: number },
      ctx: Context,
    ) =>
      ctx.prisma.sessionTranscript.create({
        data: {
          sessionId: args.sessionId,
          speakerId: args.speakerId ?? null,
          speakerName: args.speakerName ?? null,
          rawText: args.rawText,
          startTime: args.startTime,
        },
      }),

    assignSpeakerName: async (
      _: unknown,
      args: { sessionId: string; speakerId: number; speakerName: string },
      ctx: Context,
    ) => {
      await ctx.prisma.sessionTranscript.updateMany({
        where: { sessionId: args.sessionId, speakerId: args.speakerId },
        data: { speakerName: args.speakerName },
      })
      return true
    },

    generateSessionSummary: async (_: unknown, args: { sessionId: string }, ctx: Context) => {
      const session = await ctx.prisma.session.findUnique({
        where: { id: args.sessionId },
        include: { campaign: true },
      })
      const segments = await ctx.prisma.sessionTranscript.findMany({
        where: { sessionId: args.sessionId, isGameRelated: true },
        orderBy: { startTime: 'asc' },
      })

      const transcript = segments
        .map((s) => `[${s.speakerName ?? `Speaker ${s.speakerId ?? '?'}`}]: ${s.cleanText ?? s.rawText}`)
        .join('\n')

      if (!transcript.trim() || !process.env.ANTHROPIC_API_KEY) {
        return { playerSummary: '', dmNotes: '' }
      }

      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: `You are a scribe for a D&D campaign called "${session?.campaign?.name ?? 'unknown'}". Given a session transcript, write two summaries in the same language as the transcript:
1. A player-facing summary (2-4 sentences, narrative style, what the party experienced)
2. DM notes (bullet points: key events, decisions made, plot threads, NPCs encountered)
Respond with JSON: { "playerSummary": "...", "dmNotes": "..." }`,
        messages: [{ role: 'user', content: transcript }],
      })

      try {
        const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
        const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}')
        return { playerSummary: json.playerSummary ?? '', dmNotes: json.dmNotes ?? '' }
      } catch {
        return { playerSummary: '', dmNotes: '' }
      }
    },

    filterTranscriptBatch: async (
      _: unknown,
      args: { sessionId: string; segmentIds: string[] },
      ctx: Context,
    ) => {
      if (!process.env.ANTHROPIC_API_KEY) return true

      const segments = await ctx.prisma.sessionTranscript.findMany({
        where: { id: { in: args.segmentIds } },
        orderBy: { startTime: 'asc' },
      })
      if (!segments.length) return true

      // Get session + campaign context
      const session = await ctx.prisma.session.findUnique({
        where: { id: args.sessionId },
        include: { campaign: true },
      })

      const rawLines = segments
        .map((s) => `[${s.speakerName ?? `Speaker ${s.speakerId ?? '?'}`}]: ${s.rawText}`)
        .join('\n')

      const systemPrompt = `You are a D&D session scribe. You receive raw audio transcripts from a tabletop RPG session for the campaign "${session?.campaign?.name ?? 'unknown'}".
Your job is to identify which lines are related to the game (actions, dialogue, dice roll outcomes, story, rules questions, character decisions) and which are off-topic (personal chat, sports, phones, etc).
For each line that IS game-related, return a clean version. For off-topic lines return null.
Respond ONLY with a JSON array in the same order as the input, each item either a cleaned string or null.`

      try {
        const response = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2048,
          system: systemPrompt,
          messages: [{ role: 'user', content: rawLines }],
        })

        const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
        const jsonMatch = text.match(/\[[\s\S]*\]/)
        if (!jsonMatch) return true
        const results: (string | null)[] = JSON.parse(jsonMatch[0])

        for (let i = 0; i < segments.length; i++) {
          const clean = results[i]
          await ctx.prisma.sessionTranscript.update({
            where: { id: segments[i].id },
            data: {
              cleanText: clean ?? null,
              isGameRelated: clean !== null,
            },
          })
        }
      } catch (e) {
        console.error('Transcript filter error:', e)
      }

      return true
    },
  },
}
