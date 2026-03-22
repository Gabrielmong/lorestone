import type { Context } from './types'

export async function snapshotSessionEndFn(sessionId: string, ctx: Context) {
  const session = await ctx.prisma.session.findUnique({ where: { id: sessionId } })
  if (!session) return

  const [factions, characters] = await Promise.all([
    ctx.prisma.faction.findMany({ where: { campaignId: session.campaignId } }),
    ctx.prisma.character.findMany({
      where: { campaignId: session.campaignId, status: { not: 'pending' } },
    }),
  ])

  await Promise.all([
    ...factions.map((f) =>
      ctx.prisma.factionRepSnapshot.upsert({
        where: { sessionId_factionId: { sessionId, factionId: f.id } },
        create: { campaignId: session.campaignId, sessionId, factionId: f.id, reputation: f.reputation },
        update: { reputation: f.reputation },
      })
    ),
    ...characters
      .filter((c) => {
        const ex = c.extra as Record<string, unknown> | null
        return ex?.hpCurrent != null && ex?.hpMax != null
      })
      .map((c) => {
        const ex = c.extra as Record<string, unknown>
        return ctx.prisma.characterHPSnapshot.upsert({
          where: { sessionId_characterId: { sessionId, characterId: c.id } },
          create: {
            campaignId: session.campaignId,
            sessionId,
            characterId: c.id,
            hpCurrent: Number(ex.hpCurrent),
            hpMax: Number(ex.hpMax),
          },
          update: { hpCurrent: Number(ex.hpCurrent), hpMax: Number(ex.hpMax) },
        })
      }),
  ])
}

export const analyticsResolvers = {
  Query: {
    rollLogs: (_: unknown, args: { campaignId: string; sessionId?: string; limit?: number }, ctx: Context) => {
      const where: Record<string, unknown> = { campaignId: args.campaignId }
      if (args.sessionId) where.sessionId = args.sessionId
      return ctx.prisma.rollLog.findMany({
        where,
        orderBy: { rolledAt: 'desc' },
        take: args.limit ?? 200,
      })
    },

    analytics: async (_: unknown, args: { campaignId: string }, ctx: Context) => {
      const { campaignId } = args

      const [sessions, rollLogs, factionSnapshots, hpSnapshots, encounterStats, factions, characters] =
        await Promise.all([
          ctx.prisma.session.findMany({
            where: { campaignId, status: 'completed' },
            orderBy: { sessionNumber: 'asc' },
            include: { treasure: true },
          }),
          ctx.prisma.rollLog.findMany({ where: { campaignId } }),
          ctx.prisma.factionRepSnapshot.findMany({
            where: { campaignId },
            include: { session: true },
            orderBy: { snapAt: 'asc' },
          }),
          ctx.prisma.characterHPSnapshot.findMany({
            where: { campaignId },
            include: { session: true, character: true },
            orderBy: { snapAt: 'asc' },
          }),
          ctx.prisma.encounterStat.findMany({
            where: { campaignId },
            include: { encounter: true },
          }),
          ctx.prisma.faction.findMany({ where: { campaignId } }),
          ctx.prisma.character.findMany({ where: { campaignId, status: { not: 'pending' } } }),
        ])

      // Session activity
      const rollsBySession = new Map<string, number>()
      rollLogs.forEach((r) => {
        if (r.sessionId) rollsBySession.set(r.sessionId, (rollsBySession.get(r.sessionId) ?? 0) + 1)
      })
      const completedEncountersBySession = await ctx.prisma.encounter.groupBy({
        by: ['campaignId'],
        where: { campaignId, status: 'completed' },
        _count: true,
      })
      const encounterCount = completedEncountersBySession[0]?._count ?? 0

      const sessionActivity = sessions.map((s) => ({
        sessionNumber: s.sessionNumber,
        playedAt: s.playedAt,
        durationMinutes: s.startedAt && s.endedAt
          ? Math.round((s.endedAt.getTime() - s.startedAt.getTime()) / 60000)
          : 0,
        rollCount: rollsBySession.get(s.id) ?? 0,
        encounterCount,
        xpGained: (s.treasure as { xpGained?: number } | null)?.xpGained ?? 0,
        goldGained: (s.treasure as { goldGained?: number } | null)?.goldGained ?? 0,
      }))

      // Character roll stats
      const statsByChar = new Map<string, { total: number; nat20: number; nat1: number; sum: number }>()
      rollLogs.forEach((r) => {
        const key = r.characterName
        const cur = statsByChar.get(key) ?? { total: 0, nat20: 0, nat1: 0, sum: 0 }
        cur.total++
        cur.sum += r.total
        if (r.critical === 'nat20') cur.nat20++
        if (r.critical === 'nat1') cur.nat1++
        statsByChar.set(key, cur)
      })
      const characterRollStats = [...statsByChar.entries()].map(([name, s]) => ({
        characterName: name,
        totalRolls: s.total,
        nat20s: s.nat20,
        nat1s: s.nat1,
        avgTotal: s.total > 0 ? Math.round((s.sum / s.total) * 10) / 10 : 0,
      }))

      // Faction rep timelines
      const factionMap = new Map(factions.map((f) => [f.id, f]))
      const repByFaction = new Map<string, Array<{ sessionNumber: number; reputation: number }>>()
      factionSnapshots.forEach((snap) => {
        const arr = repByFaction.get(snap.factionId) ?? []
        arr.push({ sessionNumber: snap.session.sessionNumber, reputation: snap.reputation })
        repByFaction.set(snap.factionId, arr)
      })
      const factionRepTimelines = [...repByFaction.entries()].map(([fId, points]) => ({
        factionId: fId,
        factionName: factionMap.get(fId)?.name ?? 'Unknown',
        color: (factionMap.get(fId) as { color?: string } | undefined)?.color ?? null,
        points,
      }))

      // Character HP timelines
      const charMap = new Map(characters.map((c) => [c.id, c]))
      const hpByChar = new Map<string, Array<{ sessionNumber: number; hpCurrent: number; hpMax: number }>>()
      hpSnapshots.forEach((snap) => {
        const arr = hpByChar.get(snap.characterId) ?? []
        arr.push({ sessionNumber: snap.session.sessionNumber, hpCurrent: snap.hpCurrent, hpMax: snap.hpMax })
        hpByChar.set(snap.characterId, arr)
      })
      const characterHPTimelines = [...hpByChar.entries()].map(([cId, points]) => ({
        characterId: cId,
        characterName: charMap.get(cId)?.name ?? 'Unknown',
        points,
      }))

      // Activity heatmap (rolls + sessions per day)
      const dayCount = new Map<string, number>()
      rollLogs.forEach((r) => {
        const d = r.rolledAt.toISOString().slice(0, 10)
        dayCount.set(d, (dayCount.get(d) ?? 0) + 1)
      })
      sessions.forEach((s) => {
        if (s.playedAt) {
          const d = new Date(s.playedAt).toISOString().slice(0, 10)
          dayCount.set(d, (dayCount.get(d) ?? 0) + 1)
        }
      })
      const activityHeatmap = [...dayCount.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count }))

      // Encounter stats
      const encounterStatResults = encounterStats.map((es) => ({
        encounterId: es.encounterId,
        encounterName: (es.encounter as { name: string }).name,
        totalRounds: es.totalRounds,
        damageDealt: es.damageDealt,
        damageTaken: es.damageTaken,
        enemiesKilled: es.enemiesKilled,
      }))

      return {
        sessionActivity,
        characterRollStats,
        factionRepTimelines,
        characterHPTimelines,
        activityHeatmap,
        encounterStats: encounterStatResults,
      }
    },
  },

  Mutation: {
    logRoll: (_: unknown, args: { input: Record<string, unknown> }, ctx: Context) =>
      ctx.prisma.rollLog.create({ data: args.input as never }),

    snapshotSessionEnd: async (_: unknown, args: { sessionId: string }, ctx: Context) => {
      await snapshotSessionEndFn(args.sessionId, ctx)
      return true
    },

    upsertSessionTreasure: async (
      _: unknown,
      args: { sessionId: string; campaignId: string; xpGained: number; goldGained: number },
      ctx: Context
    ) => {
      await ctx.prisma.sessionTreasure.upsert({
        where: { sessionId: args.sessionId },
        create: { sessionId: args.sessionId, campaignId: args.campaignId, xpGained: args.xpGained, goldGained: args.goldGained },
        update: { xpGained: args.xpGained, goldGained: args.goldGained },
      })
      return true
    },

    upsertEncounterStat: async (
      _: unknown,
      args: { encounterId: string; campaignId: string; totalRounds?: number; damageDealt?: number; damageTaken?: number; enemiesKilled?: number },
      ctx: Context
    ) => {
      const data = {
        ...(args.totalRounds != null && { totalRounds: args.totalRounds }),
        ...(args.damageDealt != null && { damageDealt: args.damageDealt }),
        ...(args.damageTaken != null && { damageTaken: args.damageTaken }),
        ...(args.enemiesKilled != null && { enemiesKilled: args.enemiesKilled }),
      }
      await ctx.prisma.encounterStat.upsert({
        where: { encounterId: args.encounterId },
        create: { encounterId: args.encounterId, campaignId: args.campaignId, ...data },
        update: data,
      })
      return true
    },
  },
}
