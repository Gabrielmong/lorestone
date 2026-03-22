import type { Context } from './types'
import { computeCampaignStats } from './campaignStats'

function mapDecision(d: {
  id: string; question: string; missionName: string | null; chosenBranchId: string | null
  chosenBranch?: { label: string } | null
  branches: Array<{ id: string; label: string; outcomeType: string }>
  chapter?: { name: string } | null
  incomingLinks: Array<{ fromDecisionId: string; fromBranchId: string | null }>
}, chosenLabel?: string) {
  return {
    id: d.id,
    question: d.question,
    chosenLabel: chosenLabel ?? d.chosenBranch?.label ?? '',
    missionName: d.missionName,
    chapterName: d.chapter?.name ?? null,
    branches: d.branches.map((b) => ({
      id: b.id,
      label: b.label,
      outcomeType: b.outcomeType.toUpperCase(),
    })),
    chosenBranchId: d.chosenBranchId ?? '',
    incomingLinks: d.incomingLinks.map((l) => ({
      fromDecisionId: l.fromDecisionId,
      fromBranchId: l.fromBranchId ?? null,
    })),
  }
}

export const playerViewResolvers = {
  Query: {
    playerView: async (_: unknown, args: { shareToken: string }, ctx: Context) => {
      const campaign = await ctx.prisma.campaign.findUnique({
        where: { shareToken: args.shareToken },
        include: { user: { select: { name: true } } },
      })
      if (!campaign) throw new Error('Campaign not found or link is invalid')

      const [sessions, items, factions, characters, resolvedDecisions, allChapters] = await Promise.all([
        ctx.prisma.session.findMany({
          where: { campaignId: campaign.id, status: 'completed' },
          orderBy: { sessionNumber: 'asc' },
        }),
        ctx.prisma.item.findMany({
          where: { campaignId: campaign.id, inPossession: true },
          orderBy: { name: 'asc' },
        }),
        ctx.prisma.faction.findMany({
          where: { campaignId: campaign.id },
          orderBy: { name: 'asc' },
        }),
        ctx.prisma.character.findMany({
          where: { campaignId: campaign.id, status: { not: 'pending' } },
          orderBy: { name: 'asc' },
        }),
        ctx.prisma.decision.findMany({
          where: { campaignId: campaign.id, status: 'resolved', chosenBranchId: { not: null } },
          include: { chosenBranch: true, branches: true, chapter: true, incomingLinks: true },
          orderBy: { resolvedAt: 'asc' },
        }),
        ctx.prisma.chapter.findMany({
          where: { campaignId: campaign.id },
          orderBy: { orderIndex: 'asc' },
        }),
      ])

      const resolvedIds = new Set(resolvedDecisions.map((d) => d.id))

      // Decisions reachable from resolved ones that weren't taken (missed paths)
      const [missedDecisions, encounters] = await Promise.all([
        ctx.prisma.decision.findMany({
          where: {
            campaignId: campaign.id,
            status: { not: 'resolved' },
            incomingLinks: { some: { fromDecisionId: { in: [...resolvedIds] } } },
          },
          include: { branches: true, chapter: true, incomingLinks: true },
        }),
        ctx.prisma.encounter.findMany({
          where: {
            campaignId: campaign.id,
            OR: [
              { linkedDecisionId: { in: [...resolvedIds] } },
              { outcomeDecisionId: { in: [...resolvedIds] } },
            ],
          },
          include: { participants: { select: { id: true } } },
        }),
      ])

      return {
        campaign: {
          name: campaign.name,
          system: campaign.system,
          yearInGame: campaign.yearInGame,
          dmName: campaign.user?.name ?? null,
        },
        sessions: sessions.map((s) => ({
          sessionNumber: s.sessionNumber,
          title: s.title,
          playedAt: s.playedAt,
          playerSummary: s.playerSummary,
        })),
        items: items.map((i) => ({
          name: i.name,
          description: i.description,
          type: i.type.toUpperCase(),
        })),
        factions: factions.map((f) => ({
          name: f.name,
          reputation: f.reputation,
          repMin: f.repMin,
          repMax: f.repMax,
        })),
        characters: characters.map((c) => ({
          name: c.name,
          description: c.description,
          status: c.status.toUpperCase(),
          role: c.role.toUpperCase(),
          portraitUrl: c.portraitUrl ?? null,
        })),
        stats: await computeCampaignStats(campaign.id, ctx),
        resolvedDecisions: resolvedDecisions.map((d) => mapDecision(d)),
        missedDecisions: missedDecisions.map((d) => mapDecision(d as Parameters<typeof mapDecision>[0])),
        encounters: encounters.map((e) => ({
          id: e.id,
          name: e.name,
          status: e.status.toUpperCase(),
          outcomeType: e.outcomeType ?? null,
          participantCount: e.participants.length,
          linkedDecisionId: e.linkedDecisionId ?? null,
          outcomeDecisionId: e.outcomeDecisionId ?? null,
        })),
        chapterLanes: allChapters
          .filter((c) => c.playerVisible)
          .map((c, i) => ({ name: c.name, colorIndex: i })),
      }
    },
  },
}
