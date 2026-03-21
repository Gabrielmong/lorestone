import type { Context } from './types'

export const characterResolvers = {
  Query: {
    character: (_: unknown, args: { id: string }, ctx: Context) =>
      ctx.prisma.character.findUnique({ where: { id: args.id } }),

    characters: (
      _: unknown,
      args: { campaignId: string; role?: string; status?: string; search?: string },
      ctx: Context
    ) => {
      const where: Record<string, unknown> = { campaignId: args.campaignId }
      if (args.role) where.role = args.role.toLowerCase()
      if (args.status) where.status = args.status.toLowerCase()
      if (args.search) where.name = { contains: args.search, mode: 'insensitive' }
      return ctx.prisma.character.findMany({ where, orderBy: { name: 'asc' } })
    },
  },

  Mutation: {
    createCharacter: (_: unknown, args: { input: Record<string, unknown> }, ctx: Context) =>
      ctx.prisma.character.create({
        data: {
          campaignId: args.input.campaignId as string,
          name: args.input.name as string,
          role: ((args.input.role as string) ?? 'NPC').toLowerCase(),
          description: args.input.description as string | undefined,
          location: args.input.location as string | undefined,
          chapterIntroducedId: args.input.chapterIntroducedId as string | undefined,
          hpMax: args.input.hpMax as number | undefined,
          hpCurrent: args.input.hpCurrent as number | undefined,
          armorClass: args.input.armorClass as number | undefined,
          speed: args.input.speed as number | undefined,
          initiative: args.input.initiative as number | undefined,
          stats: args.input.stats ?? {},
          attacks: args.input.attacks ?? [],
          specialAbilities: args.input.specialAbilities ?? [],
          narrativeNotes: args.input.narrativeNotes as string | undefined,
          miniPrinted: (args.input.miniPrinted as boolean) ?? false,
          miniStlSource: args.input.miniStlSource as string | undefined,
          miniSearchHint: args.input.miniSearchHint as string | undefined,
          portraitUrl: args.input.portraitUrl as string | undefined,
          tags: (args.input.tags as string[]) ?? [],
          extra: args.input.extra ?? {},
        },
      }),

    updateCharacter: (_: unknown, args: { id: string; input: Record<string, unknown> }, ctx: Context) => {
      const data: Record<string, unknown> = { ...args.input }
      if (data.role) data.role = (data.role as string).toLowerCase()
      if (data.status) data.status = (data.status as string).toLowerCase()
      return ctx.prisma.character.update({ where: { id: args.id }, data })
    },

    updateCharacterHP: (_: unknown, args: { id: string; hpCurrent: number }, ctx: Context) =>
      ctx.prisma.character.update({ where: { id: args.id }, data: { hpCurrent: args.hpCurrent } }),

    updateCharacterStatus: (_: unknown, args: { id: string; status: string }, ctx: Context) =>
      ctx.prisma.character.update({
        where: { id: args.id },
        data: { status: args.status.toLowerCase() },
      }),

    addCharacterCondition: async (
      _: unknown,
      args: { characterId: string; sessionId: string; condition: string },
      ctx: Context
    ) => {
      const existing = await ctx.prisma.characterSessionState.findFirst({
        where: { characterId: args.characterId, sessionId: args.sessionId },
      })
      if (existing) {
        if (existing.conditions.includes(args.condition)) return existing
        return ctx.prisma.characterSessionState.update({
          where: { id: existing.id },
          data: { conditions: { push: args.condition } },
        })
      }
      return ctx.prisma.characterSessionState.create({
        data: {
          characterId: args.characterId,
          sessionId: args.sessionId,
          conditions: [args.condition],
        },
      })
    },

    deleteCharacter: async (_: unknown, args: { id: string }, ctx: Context) => {
      await ctx.prisma.character.delete({ where: { id: args.id } })
      return true
    },

    removeCharacterCondition: async (
      _: unknown,
      args: { characterId: string; sessionId: string; condition: string },
      ctx: Context
    ) => {
      const existing = await ctx.prisma.characterSessionState.findFirst({
        where: { characterId: args.characterId, sessionId: args.sessionId },
      })
      if (!existing) throw new Error('Session state not found')
      return ctx.prisma.characterSessionState.update({
        where: { id: existing.id },
        data: { conditions: existing.conditions.filter((c) => c !== args.condition) },
      })
    },
  },

  Character: {
    campaign: (char: { campaignId: string }, _: unknown, ctx: Context) =>
      ctx.prisma.campaign.findUnique({ where: { id: char.campaignId } }),

    chapterIntroduced: (char: { chapterIntroducedId: string | null }, _: unknown, ctx: Context) =>
      char.chapterIntroducedId
        ? ctx.prisma.chapter.findUnique({ where: { id: char.chapterIntroducedId } })
        : null,

    heldItems: (char: { id: string }, _: unknown, ctx: Context) =>
      ctx.loaders.itemsByHolderId.load(char.id),

    decisionStates: (char: { id: string }, _: unknown, ctx: Context) =>
      ctx.loaders.decisionStatesByCharacterId.load(char.id),

    sessionStates: (char: { id: string }, args: { sessionId?: string }, ctx: Context) => {
      const where: Record<string, unknown> = { characterId: char.id }
      if (args.sessionId) where.sessionId = args.sessionId
      return ctx.prisma.characterSessionState.findMany({ where })
    },

    // Enum mapping: DB stores lowercase, GraphQL expects uppercase
    role: (char: { role: string }) => char.role.toUpperCase(),
    status: (char: { status: string }) => char.status.toUpperCase(),
  },

  CharacterSessionState: {
    character: (state: { characterId: string }, _: unknown, ctx: Context) =>
      ctx.loaders.characterById.load(state.characterId),

    session: (state: { sessionId: string }, _: unknown, ctx: Context) =>
      ctx.prisma.session.findUnique({ where: { id: state.sessionId } }),

    status: (state: { status: string | null }) => state.status?.toUpperCase() ?? null,
  },
}
