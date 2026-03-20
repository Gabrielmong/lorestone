import type { Context } from './types'

export async function computeCampaignStats(campaignId: string, ctx: Context) {
  const [sessions, encounters, characters, decisions, participants, items, missions, chapters] =
    await Promise.all([
      ctx.prisma.session.findMany({
        where: { campaignId, status: 'completed' },
        select: { startedAt: true, endedAt: true },
      }),
      ctx.prisma.encounter.findMany({
        where: { campaignId },
        select: { status: true, outcomeType: true },
      }),
      ctx.prisma.character.findMany({
        where: { campaignId, status: { not: 'pending' } },
        select: { role: true },
      }),
      ctx.prisma.decision.count({ where: { campaignId, status: 'resolved' } }),
      ctx.prisma.encounterParticipant.findMany({
        where: { encounter: { campaignId }, isPlayer: false, killedByName: { not: null } },
        select: { id: true },
      }),
      ctx.prisma.item.count({ where: { campaignId, inPossession: true } }),
      ctx.prisma.mission.count({ where: { campaignId, status: 'completed' } }),
      ctx.prisma.chapter.count({ where: { campaignId, status: 'completed' } }),
    ])

  const totalPlayMinutes = sessions.reduce((sum, s) => {
    if (!s.startedAt || !s.endedAt) return sum
    return sum + Math.floor((s.endedAt.getTime() - s.startedAt.getTime()) / 60000)
  }, 0)

  return {
    totalPlayMinutes,
    sessionsPlayed: sessions.length,
    totalEncounters: encounters.length,
    encountersWon: encounters.filter((e) => e.outcomeType?.toLowerCase() === 'victory').length,
    npcsMet: characters.filter((c) => c.role.toLowerCase() === 'npc').length,
    decisionsResolved: decisions,
    enemiesKilled: participants.length,
    itemsCollected: items,
    missionsCompleted: missions,
    chaptersCompleted: chapters,
  }
}

export const campaignStatsResolvers = {
  Query: {
    campaignStats: (_: unknown, args: { campaignId: string }, ctx: Context) =>
      computeCampaignStats(args.campaignId, ctx),
  },
}
