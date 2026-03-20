import type { Context } from './types'

export const factionResolvers = {
  Query: {
    factions: (_: unknown, args: { campaignId: string }, ctx: Context) =>
      ctx.prisma.faction.findMany({ where: { campaignId: args.campaignId }, orderBy: { name: 'asc' } }),
  },

  Mutation: {
    createFaction: (
      _: unknown,
      args: {
        input: {
          campaignId: string
          name: string
          description?: string
          repMin?: number
          repMax?: number
          color?: string
          icon?: string
        }
      },
      ctx: Context
    ) =>
      ctx.prisma.faction.create({
        data: {
          campaignId: args.input.campaignId,
          name: args.input.name,
          description: args.input.description,
          repMin: args.input.repMin ?? -3,
          repMax: args.input.repMax ?? 3,
          color: args.input.color,
          icon: args.input.icon,
        },
      }),

    updateFaction: (_: unknown, args: { id: string; input: Record<string, unknown> }, ctx: Context) =>
      ctx.prisma.faction.update({ where: { id: args.id }, data: args.input }),

    deleteFaction: async (_: unknown, args: { id: string }, ctx: Context) => {
      await ctx.prisma.faction.delete({ where: { id: args.id } })
      return true
    },

    updateFactionReputation: async (
      _: unknown,
      args: { id: string; delta: number; sessionId?: string },
      ctx: Context
    ) => {
      const faction = await ctx.prisma.faction.findUnique({ where: { id: args.id } })
      if (!faction) throw new Error('Faction not found')

      const newRep = Math.max(faction.repMin, Math.min(faction.repMax, faction.reputation + args.delta))
      const updated = await ctx.prisma.faction.update({
        where: { id: args.id },
        data: { reputation: newRep },
      })

      if (args.sessionId) {
        await ctx.prisma.sessionEvent.create({
          data: {
            sessionId: args.sessionId,
            eventType: 'reputation_change',
            description: `${faction.name} reputation changed by ${args.delta > 0 ? '+' : ''}${args.delta}`,
            factionId: args.id,
            reputationDelta: args.delta,
          },
        })
      }

      return updated
    },
  },

  Faction: {
    campaign: (f: { campaignId: string }, _: unknown, ctx: Context) =>
      ctx.prisma.campaign.findUnique({ where: { id: f.campaignId } }),
  },
}
