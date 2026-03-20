import type { Context } from './types'

export const itemResolvers = {
  Query: {
    items: (
      _: unknown,
      args: { campaignId: string; inPossession?: boolean; type?: string },
      ctx: Context
    ) => {
      const where: Record<string, unknown> = { campaignId: args.campaignId }
      if (args.inPossession !== undefined) where.inPossession = args.inPossession
      if (args.type) where.type = args.type.toLowerCase()
      return ctx.prisma.item.findMany({ where, orderBy: { name: 'asc' } })
    },
  },

  Mutation: {
    createItem: (
      _: unknown,
      args: {
        input: {
          campaignId: string
          name: string
          type?: string
          description?: string
          narrativeWeight?: string
          locationFound?: string
          chapterFoundId?: string
          requiredFor?: string
          discoveryRequires?: string[]
          extra?: unknown
        }
      },
      ctx: Context
    ) =>
      ctx.prisma.item.create({
        data: {
          campaignId: args.input.campaignId,
          name: args.input.name,
          type: (args.input.type ?? 'ITEM').toLowerCase(),
          description: args.input.description,
          narrativeWeight: args.input.narrativeWeight,
          locationFound: args.input.locationFound,
          chapterFoundId: args.input.chapterFoundId,
          requiredFor: args.input.requiredFor,
          discoveryRequires: args.input.discoveryRequires ?? [],
          extra: args.input.extra ?? {},
        },
      }),

    updateItem: (_: unknown, args: { id: string; input: Record<string, unknown> }, ctx: Context) => {
      const data: Record<string, unknown> = { ...args.input }
      if (data.type) data.type = (data.type as string).toLowerCase()
      return ctx.prisma.item.update({ where: { id: args.id }, data })
    },

    deleteItem: async (_: unknown, args: { id: string }, ctx: Context) => {
      await ctx.prisma.item.delete({ where: { id: args.id } })
      return true
    },

    updateItemPossession: async (
      _: unknown,
      args: { id: string; inPossession: boolean; holderId?: string },
      ctx: Context
    ) => {
      const item = await ctx.prisma.item.update({
        where: { id: args.id },
        data: { inPossession: args.inPossession, holderId: args.holderId ?? null },
      })

      return item
    },
  },

  Item: {
    campaign: (item: { campaignId: string }, _: unknown, ctx: Context) =>
      ctx.prisma.campaign.findUnique({ where: { id: item.campaignId } }),

    chapterFound: (item: { chapterFoundId: string | null }, _: unknown, ctx: Context) =>
      item.chapterFoundId ? ctx.prisma.chapter.findUnique({ where: { id: item.chapterFoundId } }) : null,

    holder: (item: { holderId: string | null }, _: unknown, ctx: Context) =>
      item.holderId ? ctx.loaders.characterById.load(item.holderId) : null,

    type: (item: { type: string }) => item.type.toUpperCase(),
  },
}
