import type { Context } from './types'

interface OutcomeEntry {
  type: string
  faction_id?: string
  delta?: number
  character_id?: string
  status?: string
  item_id?: string
  decision_id?: string
  text?: string
}

export const decisionResolvers = {
  Query: {
    decision: (_: unknown, args: { id: string }, ctx: Context) =>
      ctx.prisma.decision.findUnique({ where: { id: args.id } }),

    decisions: (
      _: unknown,
      args: { campaignId: string; chapterId?: string; status?: string; missionId?: string },
      ctx: Context
    ) => {
      const where: Record<string, unknown> = { campaignId: args.campaignId }
      if (args.chapterId) where.chapterId = args.chapterId
      if (args.status) where.status = args.status.toLowerCase()
      if (args.missionId) where.missionId = args.missionId
      return ctx.prisma.decision.findMany({ where, orderBy: { orderIndex: 'asc' } })
    },

    pendingDecisions: (_: unknown, args: { campaignId: string }, ctx: Context) =>
      ctx.prisma.decision.findMany({
        where: { campaignId: args.campaignId, status: 'pending' },
        orderBy: { orderIndex: 'asc' },
      }),
  },

  Mutation: {
    createDecision: async (
      _: unknown,
      args: {
        input: {
          campaignId: string
          chapterId?: string
          missionId?: string
          missionName?: string
          question: string
          context?: string
          orderIndex?: number
          branches: Array<{
            label: string
            description?: string
            consequence?: string
            outcomeType?: string
            orderIndex?: number
            outcomes?: unknown
            characterStates?: Array<{
              characterId: string
              stateLabel?: string
              description: string
              statusChange?: string
            }>
          }>
        }
      },
      ctx: Context
    ) => {
      const { branches, ...decisionData } = args.input
      const decision = await ctx.prisma.decision.create({
        data: {
          ...decisionData,
          status: 'pending',
          branches: {
            create: branches.map((b, i) => ({
              label: b.label,
              description: b.description,
              consequence: b.consequence,
              outcomeType: (b.outcomeType ?? 'NEUTRAL').toLowerCase(),
              orderIndex: b.orderIndex ?? i,
              outcomes: b.outcomes ?? [],
              characterStates: b.characterStates
                ? { create: b.characterStates }
                : undefined,
            })),
          },
        },
        include: { branches: { include: { characterStates: true } } },
      })
      return decision
    },

    resolveDecision: async (
      _: unknown,
      args: { id: string; branchId: string; sessionId?: string },
      ctx: Context
    ) => {
      const branch = await ctx.prisma.decisionBranch.findUnique({ where: { id: args.branchId } })
      if (!branch) throw new Error('Branch not found')

      const decision = await ctx.prisma.decision.update({
        where: { id: args.id },
        data: {
          status: 'resolved',
          chosenBranchId: args.branchId,
          resolvedAt: new Date(),
        },
      })

      const outcomes = (branch.outcomes as unknown as OutcomeEntry[]) ?? []
      for (const outcome of outcomes) {
        if (outcome.type === 'reputation' && outcome.faction_id && outcome.delta !== undefined) {
          const faction = await ctx.prisma.faction.findUnique({ where: { id: outcome.faction_id } })
          if (faction) {
            const newRep = Math.max(faction.repMin, Math.min(faction.repMax, faction.reputation + outcome.delta))
            await ctx.prisma.faction.update({ where: { id: outcome.faction_id }, data: { reputation: newRep } })
          }
          if (args.sessionId) {
            await ctx.prisma.sessionEvent.create({
              data: {
                sessionId: args.sessionId,
                eventType: 'reputation_change',
                description: `Reputation changed by ${outcome.delta}`,
                decisionId: args.id,
                branchId: args.branchId,
                factionId: outcome.faction_id,
                reputationDelta: outcome.delta,
              },
            })
          }
        }

        if (outcome.type === 'character_status' && outcome.character_id && outcome.status) {
          await ctx.prisma.character.update({
            where: { id: outcome.character_id },
            data: { status: outcome.status.toLowerCase() },
          })
          if (args.sessionId) {
            await ctx.prisma.sessionEvent.create({
              data: {
                sessionId: args.sessionId,
                eventType: 'character_status_change',
                description: `Character status changed to ${outcome.status}`,
                decisionId: args.id,
                branchId: args.branchId,
                characterId: outcome.character_id,
              },
            })
          }
        }

        if (outcome.type === 'item_obtained' && outcome.item_id) {
          await ctx.prisma.item.update({
            where: { id: outcome.item_id },
            data: { inPossession: true },
          })
          if (args.sessionId) {
            await ctx.prisma.sessionEvent.create({
              data: {
                sessionId: args.sessionId,
                eventType: 'item_obtained',
                description: `Item obtained`,
                decisionId: args.id,
                branchId: args.branchId,
                itemId: outcome.item_id,
              },
            })
          }
        }
      }

      if (args.sessionId) {
        await ctx.prisma.sessionEvent.create({
          data: {
            sessionId: args.sessionId,
            eventType: 'decision_resolved',
            description: `Decision resolved: ${branch.label}`,
            decisionId: args.id,
            branchId: args.branchId,
          },
        })
      }

      return decision
    },

    unresolveDecision: (_: unknown, args: { id: string }, ctx: Context) =>
      ctx.prisma.decision.update({
        where: { id: args.id },
        data: { status: 'pending', chosenBranchId: null, resolvedAt: null },
      }),

    updateDecision: (_: unknown, args: { id: string; input: Record<string, unknown> }, ctx: Context) => {
      const data: Record<string, unknown> = { ...args.input }
      if (data.status) data.status = (data.status as string).toLowerCase()
      return ctx.prisma.decision.update({ where: { id: args.id }, data })
    },

    deleteDecision: async (_: unknown, args: { id: string }, ctx: Context) => {
      await ctx.prisma.decision.delete({ where: { id: args.id } })
      return true
    },

    updateBranch: (_: unknown, args: { id: string; input: Record<string, unknown> }, ctx: Context) => {
      const data: Record<string, unknown> = { ...args.input }
      if (data.outcomeType) data.outcomeType = (data.outcomeType as string).toLowerCase()
      return ctx.prisma.decisionBranch.update({ where: { id: args.id }, data })
    },

    addBranch: (
      _: unknown,
      args: { decisionId: string; input: { label: string; description?: string; consequence?: string; outcomeType?: string; orderIndex?: number; outcomes?: unknown } },
      ctx: Context
    ) =>
      ctx.prisma.decisionBranch.create({
        data: {
          decisionId: args.decisionId,
          label: args.input.label,
          description: args.input.description,
          consequence: args.input.consequence,
          outcomeType: (args.input.outcomeType ?? 'NEUTRAL').toLowerCase(),
          orderIndex: args.input.orderIndex ?? 0,
          outcomes: args.input.outcomes ?? [],
        },
      }),

    deleteBranch: async (_: unknown, args: { id: string }, ctx: Context) => {
      await ctx.prisma.decisionBranch.delete({ where: { id: args.id } })
      return true
    },

    addDecisionLink: (
      _: unknown,
      args: { fromDecisionId: string; toDecisionId: string; fromBranchId?: string },
      ctx: Context
    ) =>
      ctx.prisma.decisionLink.upsert({
        where: { fromDecisionId_toDecisionId: { fromDecisionId: args.fromDecisionId, toDecisionId: args.toDecisionId } },
        create: { fromDecisionId: args.fromDecisionId, toDecisionId: args.toDecisionId, fromBranchId: args.fromBranchId ?? null },
        update: { fromBranchId: args.fromBranchId ?? null },
      }),

    removeDecisionLink: async (_: unknown, args: { id: string }, ctx: Context) => {
      await ctx.prisma.decisionLink.delete({ where: { id: args.id } })
      return true
    },
  },

  Decision: {
    campaign: (d: { campaignId: string }, _: unknown, ctx: Context) =>
      ctx.prisma.campaign.findUnique({ where: { id: d.campaignId } }),

    chapter: (d: { chapterId: string | null }, _: unknown, ctx: Context) =>
      d.chapterId ? ctx.prisma.chapter.findUnique({ where: { id: d.chapterId } }) : null,

    mission: (d: { missionId: string | null }, _: unknown, ctx: Context) =>
      d.missionId ? ctx.prisma.mission.findUnique({ where: { id: d.missionId } }) : null,

    branches: (d: { id: string }, _: unknown, ctx: Context) =>
      ctx.loaders.branchesByDecisionId.load(d.id),

    chosenBranch: (d: { chosenBranchId: string | null }, _: unknown, ctx: Context) =>
      d.chosenBranchId ? ctx.prisma.decisionBranch.findUnique({ where: { id: d.chosenBranchId } }) : null,

    incomingLinks: (d: { id: string }, _: unknown, ctx: Context) =>
      ctx.prisma.decisionLink.findMany({ where: { toDecisionId: d.id } }),

    outgoingLinks: (d: { id: string }, _: unknown, ctx: Context) =>
      ctx.prisma.decisionLink.findMany({ where: { fromDecisionId: d.id } }),

    status: (d: { status: string }) => d.status.toUpperCase(),
  },

  DecisionLink: {
    fromDecision: (l: { fromDecisionId: string }, _: unknown, ctx: Context) =>
      ctx.prisma.decision.findUnique({ where: { id: l.fromDecisionId } }),

    fromBranch: (l: { fromBranchId: string | null }, _: unknown, ctx: Context) =>
      l.fromBranchId ? ctx.prisma.decisionBranch.findUnique({ where: { id: l.fromBranchId } }) : null,

    toDecision: (l: { toDecisionId: string }, _: unknown, ctx: Context) =>
      ctx.prisma.decision.findUnique({ where: { id: l.toDecisionId } }),
  },

  DecisionBranch: {
    decision: (b: { decisionId: string }, _: unknown, ctx: Context) =>
      ctx.prisma.decision.findUnique({ where: { id: b.decisionId } }),

    characterStates: (b: { id: string }, _: unknown, ctx: Context) =>
      ctx.loaders.characterStatesByBranchId.load(b.id),

    outcomeType: (b: { outcomeType: string }) => b.outcomeType.toUpperCase(),
  },

  CharacterDecisionState: {
    branch: (s: { branchId: string }, _: unknown, ctx: Context) =>
      ctx.prisma.decisionBranch.findUnique({ where: { id: s.branchId } }),

    character: (s: { characterId: string }, _: unknown, ctx: Context) =>
      ctx.loaders.characterById.load(s.characterId),

    statusChange: (s: { statusChange: string | null }) => s.statusChange?.toUpperCase() ?? null,
  },
}
