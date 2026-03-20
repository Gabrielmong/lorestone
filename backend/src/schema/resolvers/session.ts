import type { Context } from './types'

export const sessionResolvers = {
  Query: {
    session: (_: unknown, args: { id: string }, ctx: Context) =>
      ctx.prisma.session.findUnique({ where: { id: args.id } }),

    sessions: (_: unknown, args: { campaignId: string }, ctx: Context) =>
      ctx.prisma.session.findMany({ where: { campaignId: args.campaignId }, orderBy: { sessionNumber: 'asc' } }),

    activeSession: (_: unknown, args: { campaignId: string }, ctx: Context) =>
      ctx.prisma.session.findFirst({ where: { campaignId: args.campaignId, status: 'active' } }),
  },

  Mutation: {
    createSession: (
      _: unknown,
      args: { input: { campaignId: string; chapterId?: string; sessionNumber: number; title?: string; playedAt?: string } },
      ctx: Context
    ) =>
      ctx.prisma.session.create({
        data: {
          campaignId: args.input.campaignId,
          chapterId: args.input.chapterId,
          sessionNumber: args.input.sessionNumber,
          title: args.input.title,
          playedAt: args.input.playedAt ? new Date(args.input.playedAt) : undefined,
          status: 'planned',
        },
      }),

    startSession: (_: unknown, args: { id: string }, ctx: Context) =>
      ctx.prisma.session.update({ where: { id: args.id }, data: { status: 'active', startedAt: new Date() } }),

    endSession: (_: unknown, args: { id: string; playerSummary?: string }, ctx: Context) =>
      ctx.prisma.session.update({
        where: { id: args.id },
        data: { status: 'completed', endedAt: new Date(), playerSummary: args.playerSummary },
      }),

    updateSession: (_: unknown, args: { id: string; input: Record<string, unknown> }, ctx: Context) =>
      ctx.prisma.session.update({ where: { id: args.id }, data: args.input }),

    deleteSession: async (_: unknown, args: { id: string }, ctx: Context) => {
      await ctx.prisma.session.delete({ where: { id: args.id } })
      return true
    },

    addSessionNote: async (_: unknown, args: { sessionId: string; note: string }, ctx: Context) =>
      ctx.prisma.sessionEvent.create({
        data: {
          sessionId: args.sessionId,
          eventType: 'note',
          description: args.note,
        },
      }),
  },

  Session: {
    campaign: (s: { campaignId: string }, _: unknown, ctx: Context) =>
      ctx.prisma.campaign.findUnique({ where: { id: s.campaignId } }),

    chapter: (s: { chapterId: string | null }, _: unknown, ctx: Context) =>
      s.chapterId ? ctx.prisma.chapter.findUnique({ where: { id: s.chapterId } }) : null,

    events: (s: { id: string }, _: unknown, ctx: Context) =>
      ctx.prisma.sessionEvent.findMany({ where: { sessionId: s.id }, orderBy: { createdAt: 'asc' } }),

    characterStates: (s: { id: string }, _: unknown, ctx: Context) =>
      ctx.prisma.characterSessionState.findMany({ where: { sessionId: s.id } }),

    decisionsResolved: async (s: { id: string }, _: unknown, ctx: Context) => {
      const events = await ctx.prisma.sessionEvent.findMany({
        where: { sessionId: s.id, eventType: 'decision_resolved', decisionId: { not: null } },
      })
      const ids = events.map((e) => e.decisionId).filter(Boolean) as string[]
      return ctx.prisma.decision.findMany({ where: { id: { in: ids } } })
    },

    itemsObtained: async (s: { id: string }, _: unknown, ctx: Context) => {
      const events = await ctx.prisma.sessionEvent.findMany({
        where: { sessionId: s.id, eventType: 'item_obtained', itemId: { not: null } },
      })
      const ids = events.map((e) => e.itemId).filter(Boolean) as string[]
      return ctx.prisma.item.findMany({ where: { id: { in: ids } } })
    },

    reputationChanges: async (s: { id: string }, _: unknown, ctx: Context) => {
      const events = await ctx.prisma.sessionEvent.findMany({
        where: { sessionId: s.id, eventType: 'reputation_change', factionId: { not: null } },
      })
      const factions = await ctx.prisma.faction.findMany({
        where: { id: { in: events.map((e) => e.factionId!).filter(Boolean) } },
      })
      const factionMap = new Map(factions.map((f) => [f.id, f]))
      return events.map((e) => ({
        faction: factionMap.get(e.factionId!),
        delta: e.reputationDelta ?? 0,
        session: s,
      }))
    },

    status: (s: { status: string }) => s.status.toUpperCase(),
  },

  SessionEvent: {
    session: (e: { sessionId: string }, _: unknown, ctx: Context) =>
      ctx.prisma.session.findUnique({ where: { id: e.sessionId } }),

    decision: (e: { decisionId: string | null }, _: unknown, ctx: Context) =>
      e.decisionId ? ctx.prisma.decision.findUnique({ where: { id: e.decisionId } }) : null,

    branch: (e: { branchId: string | null }, _: unknown, ctx: Context) =>
      e.branchId ? ctx.prisma.decisionBranch.findUnique({ where: { id: e.branchId } }) : null,

    character: (e: { characterId: string | null }, _: unknown, ctx: Context) =>
      e.characterId ? ctx.loaders.characterById.load(e.characterId) : null,

    item: (e: { itemId: string | null }, _: unknown, ctx: Context) =>
      e.itemId ? ctx.prisma.item.findUnique({ where: { id: e.itemId } }) : null,

    faction: (e: { factionId: string | null }, _: unknown, ctx: Context) =>
      e.factionId ? ctx.prisma.faction.findUnique({ where: { id: e.factionId } }) : null,

    eventType: (e: { eventType: string }) => e.eventType.toUpperCase(),
  },
}
