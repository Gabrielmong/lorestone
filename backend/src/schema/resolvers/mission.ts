import type { Context } from './types'

export const missionResolvers = {
  Query: {
    missions: (
      _: unknown,
      args: { campaignId: string; chapterId?: string; status?: string },
      ctx: Context
    ) => {
      const where: Record<string, unknown> = { campaignId: args.campaignId }
      if (args.chapterId) where.chapterId = args.chapterId
      if (args.status) where.status = args.status.toLowerCase()
      return ctx.prisma.mission.findMany({ where, orderBy: { orderIndex: 'asc' } })
    },
  },

  Mutation: {
    createMission: (
      _: unknown,
      args: {
        input: {
          campaignId: string
          chapterId?: string
          name: string
          type?: string
          description?: string
          orderIndex?: number
        }
      },
      ctx: Context
    ) =>
      ctx.prisma.mission.create({
        data: {
          campaignId: args.input.campaignId,
          chapterId: args.input.chapterId,
          name: args.input.name,
          type: (args.input.type ?? 'MAIN').toLowerCase(),
          description: args.input.description,
          orderIndex: args.input.orderIndex ?? 0,
          status: 'pending',
        },
      }),

    updateMission: (_: unknown, args: { id: string; input: Record<string, unknown> }, ctx: Context) => {
      const data: Record<string, unknown> = { ...args.input }
      if (data.status) data.status = (data.status as string).toLowerCase()
      if (data.type) data.type = (data.type as string).toLowerCase()
      return ctx.prisma.mission.update({ where: { id: args.id }, data })
    },

    updateMissionStatus: (_: unknown, args: { id: string; status: string }, ctx: Context) =>
      ctx.prisma.mission.update({
        where: { id: args.id },
        data: { status: args.status.toLowerCase() },
      }),

    deleteMission: async (_: unknown, args: { id: string }, ctx: Context) => {
      await ctx.prisma.mission.delete({ where: { id: args.id } })
      return true
    },
  },

  Mission: {
    campaign: (m: { campaignId: string }, _: unknown, ctx: Context) =>
      ctx.prisma.campaign.findUnique({ where: { id: m.campaignId } }),

    chapter: (m: { chapterId: string | null }, _: unknown, ctx: Context) =>
      m.chapterId ? ctx.prisma.chapter.findUnique({ where: { id: m.chapterId } }) : null,

    decisions: (m: { id: string }, _: unknown, ctx: Context) =>
      ctx.prisma.decision.findMany({ where: { missionId: m.id }, orderBy: { orderIndex: 'asc' } }),

    type: (m: { type: string }) => m.type.toUpperCase(),
    status: (m: { status: string }) => m.status.toUpperCase(),
  },
}
