import type { Context } from './types'
import { requireAuth } from './types'

export const campaignResolvers = {
  Query: {
    campaigns: (_: unknown, __: unknown, ctx: Context) => {
      const user = requireAuth(ctx)
      return ctx.prisma.campaign.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } })
    },

    campaign: (_: unknown, args: { id: string }, ctx: Context) =>
      ctx.prisma.campaign.findUnique({ where: { id: args.id } }),
  },

  Mutation: {
    createCampaign: async (_: unknown, args: { input: Record<string, unknown> }, ctx: Context) => {
      const user = requireAuth(ctx)
      return ctx.prisma.campaign.create({
        data: {
          name: args.input.name as string,
          system: args.input.system as string | undefined,
          description: args.input.description as string | undefined,
          yearInGame: args.input.yearInGame as string | undefined,
          playerCount: args.input.playerCount as number | undefined,
          coverImageUrl: args.input.coverImageUrl as string | undefined,
          settings: args.input.settings ?? {},
          userId: user.id,
        },
      })
    },

    updateCampaign: async (_: unknown, args: { id: string; input: Record<string, unknown> }, ctx: Context) => {
      const user = requireAuth(ctx)
      const campaign = await ctx.prisma.campaign.findUnique({ where: { id: args.id } })
      if (!campaign || campaign.userId !== user.id) throw new Error('Forbidden')
      return ctx.prisma.campaign.update({ where: { id: args.id }, data: args.input })
    },

    deleteCampaign: async (_: unknown, args: { id: string }, ctx: Context) => {
      const user = requireAuth(ctx)
      const campaign = await ctx.prisma.campaign.findUnique({ where: { id: args.id } })
      if (!campaign || campaign.userId !== user.id) throw new Error('Forbidden')
      await ctx.prisma.campaign.delete({ where: { id: args.id } })
      return true
    },

    createChapter: (_: unknown, args: { input: Record<string, unknown> }, ctx: Context) =>
      ctx.prisma.chapter.create({
        data: {
          campaignId: args.input.campaignId as string,
          name: args.input.name as string,
          orderIndex: (args.input.orderIndex as number) ?? 0,
          summary: args.input.summary as string | undefined,
          status: 'pending',
        },
      }),

    updateChapter: (_: unknown, args: { id: string; input: Record<string, unknown> }, ctx: Context) => {
      const data: Record<string, unknown> = { ...args.input }
      if (data.status) data.status = (data.status as string).toLowerCase()
      return ctx.prisma.chapter.update({ where: { id: args.id }, data })
    },

    updateChapterStatus: (_: unknown, args: { id: string; status: string }, ctx: Context) =>
      ctx.prisma.chapter.update({ where: { id: args.id }, data: { status: args.status.toLowerCase() } }),

    deleteChapter: async (_: unknown, args: { id: string }, ctx: Context) => {
      await ctx.prisma.chapter.delete({ where: { id: args.id } })
      return true
    },
  },

  Campaign: {
    owner: (campaign: { userId: string | null }, _: unknown, ctx: Context) =>
      campaign.userId ? ctx.prisma.user.findUnique({ where: { id: campaign.userId } }) : null,

    shareToken: (campaign: { shareToken: string }) => campaign.shareToken,

    chapters: (campaign: { id: string }, _: unknown, ctx: Context) =>
      ctx.prisma.chapter.findMany({ where: { campaignId: campaign.id }, orderBy: { orderIndex: 'asc' } }),

    characters: (
      campaign: { id: string },
      args: { role?: string; status?: string; search?: string },
      ctx: Context
    ) => {
      const where: Record<string, unknown> = { campaignId: campaign.id }
      if (args.role) where.role = args.role.toLowerCase()
      if (args.status) where.status = args.status.toLowerCase()
      if (args.search) where.name = { contains: args.search, mode: 'insensitive' }
      return ctx.prisma.character.findMany({ where, orderBy: { name: 'asc' } })
    },

    factions: (campaign: { id: string }, _: unknown, ctx: Context) =>
      ctx.prisma.faction.findMany({ where: { campaignId: campaign.id }, orderBy: { name: 'asc' } }),

    items: (campaign: { id: string }, args: { inPossession?: boolean; type?: string }, ctx: Context) => {
      const where: Record<string, unknown> = { campaignId: campaign.id }
      if (args.inPossession !== undefined) where.inPossession = args.inPossession
      if (args.type) where.type = args.type.toLowerCase()
      return ctx.prisma.item.findMany({ where, orderBy: { name: 'asc' } })
    },

    decisions: (
      campaign: { id: string },
      args: { status?: string; chapterId?: string },
      ctx: Context
    ) => {
      const where: Record<string, unknown> = { campaignId: campaign.id }
      if (args.status) where.status = args.status.toLowerCase()
      if (args.chapterId) where.chapterId = args.chapterId
      return ctx.prisma.decision.findMany({ where, orderBy: { orderIndex: 'asc' } })
    },

    sessions: (campaign: { id: string }, _: unknown, ctx: Context) =>
      ctx.prisma.session.findMany({ where: { campaignId: campaign.id }, orderBy: { sessionNumber: 'asc' } }),

    missions: (campaign: { id: string }, args: { chapterId?: string }, ctx: Context) => {
      const where: Record<string, unknown> = { campaignId: campaign.id }
      if (args.chapterId) where.chapterId = args.chapterId
      return ctx.prisma.mission.findMany({ where, orderBy: { orderIndex: 'asc' } })
    },

    activeChapter: (campaign: { id: string }, _: unknown, ctx: Context) =>
      ctx.prisma.chapter.findFirst({ where: { campaignId: campaign.id, status: 'active' } }),

    currentSession: (campaign: { id: string }, _: unknown, ctx: Context) =>
      ctx.prisma.session.findFirst({ where: { campaignId: campaign.id, status: 'active' } }),
  },

  Chapter: {
    campaign: (chapter: { campaignId: string }, _: unknown, ctx: Context) =>
      ctx.prisma.campaign.findUnique({ where: { id: chapter.campaignId } }),

    missions: (chapter: { id: string }, _: unknown, ctx: Context) =>
      ctx.loaders.missionsByChapterId.load(chapter.id),

    decisions: (chapter: { id: string }, _: unknown, ctx: Context) =>
      ctx.loaders.decisionsByChapterId.load(chapter.id),

    characters: (chapter: { id: string }, _: unknown, ctx: Context) =>
      ctx.loaders.charactersByChapterId.load(chapter.id),

    status: (chapter: { status: string }) => chapter.status.toUpperCase(),
  },
}
