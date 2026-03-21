import type { Context } from './types'

interface SaveDiceSetInput {
  name: string
  colorset: string
  customBg: string
  customFg: string
  material: string
  surface: string
  texture: string
}

export const diceSetResolvers = {
  Query: {
    myDiceSets: (_: unknown, __: unknown, ctx: Context) => {
      if (!ctx.user) return []
      return ctx.prisma.diceSet.findMany({
        where: { userId: ctx.user.id },
        orderBy: { createdAt: 'asc' },
      })
    },
  },

  Mutation: {
    saveDiceSet: (_: unknown, args: { id?: string; input: SaveDiceSetInput }, ctx: Context) => {
      if (!ctx.user) throw new Error('Not authenticated')
      if (args.id) {
        return ctx.prisma.diceSet.update({
          where: { id: args.id },
          data: args.input,
        })
      }
      return ctx.prisma.diceSet.create({
        data: { userId: ctx.user.id, ...args.input },
      })
    },

    deleteDiceSet: async (_: unknown, args: { id: string }, ctx: Context) => {
      if (!ctx.user) throw new Error('Not authenticated')
      await ctx.prisma.diceSet.delete({ where: { id: args.id } })
      return true
    },
  },
}
