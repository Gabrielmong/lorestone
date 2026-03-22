import type { Context } from './types'

export const encounterResolvers = {
  Query: {
    encounters: (_: unknown, args: { campaignId: string; status?: string }, ctx: Context) => {
      const where: Record<string, unknown> = { campaignId: args.campaignId }
      if (args.status) where.status = args.status.toLowerCase()
      return ctx.prisma.encounter.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      })
    },

    encounter: (_: unknown, args: { id: string }, ctx: Context) =>
      ctx.prisma.encounter.findUnique({ where: { id: args.id } }),

    activeEncounter: (_: unknown, args: { campaignId: string }, ctx: Context) =>
      ctx.prisma.encounter.findFirst({
        where: { campaignId: args.campaignId, status: 'active' },
      }),
  },

  Mutation: {
    createEncounter: (_: unknown, args: { input: Record<string, unknown> }, ctx: Context) =>
      ctx.prisma.encounter.create({ data: args.input as never }),

    updateEncounter: (_: unknown, args: { id: string; input: Record<string, unknown> }, ctx: Context) => {
      const data: Record<string, unknown> = { ...args.input }
      if (data.outcomeType) data.outcomeType = (data.outcomeType as string).toLowerCase()
      return ctx.prisma.encounter.update({ where: { id: args.id }, data })
    },

    deleteEncounter: async (_: unknown, args: { id: string }, ctx: Context) => {
      await ctx.prisma.encounter.delete({ where: { id: args.id } })
      return true
    },

    startEncounter: (_: unknown, args: { id: string }, ctx: Context) =>
      ctx.prisma.encounter.update({
        where: { id: args.id },
        data: { status: 'active', startedAt: new Date(), round: 1, currentTurnIndex: 0 },
      }),

    pauseEncounter: async (_: unknown, args: { id: string }, ctx: Context) => {
      const enc = await ctx.prisma.encounter.findUnique({ where: { id: args.id } })
      if (!enc || (enc.status !== 'active' && enc.status !== 'pending')) throw new Error('Encounter cannot be paused')
      const now = new Date()
      const additional = enc.startedAt ? Math.floor((now.getTime() - enc.startedAt.getTime()) / 1000) : 0
      return ctx.prisma.encounter.update({
        where: { id: args.id },
        data: { status: 'paused', pausedAt: now, elapsedSeconds: enc.elapsedSeconds + additional, startedAt: null },
      })
    },

    resumeEncounter: (_: unknown, args: { id: string }, ctx: Context) =>
      ctx.prisma.encounter.update({
        where: { id: args.id },
        data: { status: 'active', startedAt: new Date(), pausedAt: null },
      }),

    endEncounter: async (_: unknown, args: { id: string; outcomeType: string; outcome?: string }, ctx: Context) => {
      const enc = await ctx.prisma.encounter.findUnique({ where: { id: args.id } })
      if (!enc) throw new Error('Encounter not found')
      const now = new Date()
      const additional = enc.startedAt ? Math.floor((now.getTime() - enc.startedAt.getTime()) / 1000) : 0
      return ctx.prisma.encounter.update({
        where: { id: args.id },
        data: {
          status: 'completed',
          endedAt: now,
          elapsedSeconds: enc.elapsedSeconds + additional,
          outcomeType: args.outcomeType.toLowerCase(),
          outcome: args.outcome,
        },
      })
    },

    addParticipant: (_: unknown, args: { encounterId: string; input: Record<string, unknown> }, ctx: Context) =>
      ctx.prisma.encounterParticipant.create({
        data: { ...args.input, encounterId: args.encounterId } as never,
      }),

    updateParticipant: (_: unknown, args: { id: string; input: Record<string, unknown> }, ctx: Context) =>
      ctx.prisma.encounterParticipant.update({ where: { id: args.id }, data: args.input as never }),

    removeParticipant: async (_: unknown, args: { id: string }, ctx: Context) => {
      await ctx.prisma.encounterParticipant.delete({ where: { id: args.id } })
      return true
    },

    nextTurn: async (_: unknown, args: { encounterId: string }, ctx: Context) => {
      const encounter = await ctx.prisma.encounter.findUnique({
        where: { id: args.encounterId },
        include: { participants: { where: { isActive: true }, orderBy: [{ initiative: 'desc' }, { name: 'asc' }] } },
      })
      if (!encounter) throw new Error('Encounter not found')
      const count = encounter.participants.length
      if (count === 0) return encounter
      let nextIndex = encounter.currentTurnIndex + 1
      let nextRound = encounter.round
      if (nextIndex >= count) {
        nextIndex = 0
        nextRound += 1
      }
      return ctx.prisma.encounter.update({
        where: { id: args.encounterId },
        data: { currentTurnIndex: nextIndex, round: nextRound },
      })
    },

    prevTurn: async (_: unknown, args: { encounterId: string }, ctx: Context) => {
      const encounter = await ctx.prisma.encounter.findUnique({
        where: { id: args.encounterId },
        include: { participants: { where: { isActive: true }, orderBy: [{ initiative: 'desc' }, { name: 'asc' }] } },
      })
      if (!encounter) throw new Error('Encounter not found')
      const count = encounter.participants.length
      if (count === 0) return encounter
      let prevIndex = encounter.currentTurnIndex - 1
      let prevRound = encounter.round
      if (prevIndex < 0) {
        prevIndex = count - 1
        prevRound = Math.max(1, prevRound - 1)
      }
      return ctx.prisma.encounter.update({
        where: { id: args.encounterId },
        data: { currentTurnIndex: prevIndex, round: prevRound },
      })
    },
  },

  Encounter: {
    campaign: (e: { campaignId: string }, _: unknown, ctx: Context) =>
      ctx.prisma.campaign.findUnique({ where: { id: e.campaignId } }),

    participants: (e: { id: string }, _: unknown, ctx: Context) =>
      ctx.prisma.encounterParticipant.findMany({
        where: { encounterId: e.id },
        orderBy: [{ initiative: 'desc' }, { name: 'asc' }],
      }),

    linkedDecision: (e: { linkedDecisionId: string | null }, _: unknown, ctx: Context) =>
      e.linkedDecisionId ? ctx.prisma.decision.findUnique({ where: { id: e.linkedDecisionId } }) : null,

    outcomeDecision: (e: { outcomeDecisionId: string | null }, _: unknown, ctx: Context) =>
      e.outcomeDecisionId ? ctx.prisma.decision.findUnique({ where: { id: e.outcomeDecisionId } }) : null,

    status: (e: { status: string }) => e.status.toUpperCase(),
    outcomeType: (e: { outcomeType: string | null }) => e.outcomeType?.toUpperCase() ?? null,
  },

  EncounterParticipant: {
    encounter: (p: { encounterId: string }, _: unknown, ctx: Context) =>
      ctx.prisma.encounter.findUnique({ where: { id: p.encounterId } }),

    character: (p: { characterId: string | null }, _: unknown, ctx: Context) =>
      p.characterId ? ctx.prisma.character.findUnique({ where: { id: p.characterId } }) : null,
  },
}
