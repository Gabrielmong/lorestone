import DataLoader from 'dataloader'
import { PrismaClient } from '@prisma/client'

export function createLoaders(prisma: PrismaClient) {
  const characterById = new DataLoader(async (ids: readonly string[]) => {
    const characters = await prisma.character.findMany({
      where: { id: { in: ids as string[] } },
    })
    const map = new Map(characters.map((c) => [c.id, c]))
    return ids.map((id) => map.get(id) ?? null)
  })

  const branchesByDecisionId = new DataLoader(async (decisionIds: readonly string[]) => {
    const branches = await prisma.decisionBranch.findMany({
      where: { decisionId: { in: decisionIds as string[] } },
      orderBy: { orderIndex: 'asc' },
    })
    return decisionIds.map((id) => branches.filter((b) => b.decisionId === id))
  })

  const characterStatesByBranchId = new DataLoader(async (branchIds: readonly string[]) => {
    const states = await prisma.characterDecisionState.findMany({
      where: { branchId: { in: branchIds as string[] } },
    })
    return branchIds.map((id) => states.filter((s) => s.branchId === id))
  })

  const itemsByHolderId = new DataLoader(async (holderIds: readonly string[]) => {
    const items = await prisma.item.findMany({
      where: { holderId: { in: holderIds as string[] } },
    })
    return holderIds.map((id) => items.filter((i) => i.holderId === id))
  })

  const decisionStatesByCharacterId = new DataLoader(async (characterIds: readonly string[]) => {
    const states = await prisma.characterDecisionState.findMany({
      where: { characterId: { in: characterIds as string[] } },
    })
    return characterIds.map((id) => states.filter((s) => s.characterId === id))
  })

  const sessionsByChapterId = new DataLoader(async (chapterIds: readonly string[]) => {
    const sessions = await prisma.session.findMany({
      where: { chapterId: { in: chapterIds as string[] } },
    })
    return chapterIds.map((id) => sessions.filter((s) => s.chapterId === id))
  })

  const charactersByChapterId = new DataLoader(async (chapterIds: readonly string[]) => {
    const characters = await prisma.character.findMany({
      where: { chapterIntroducedId: { in: chapterIds as string[] } },
    })
    return chapterIds.map((id) => characters.filter((c) => c.chapterIntroducedId === id))
  })

  const missionsByChapterId = new DataLoader(async (chapterIds: readonly string[]) => {
    const missions = await prisma.mission.findMany({
      where: { chapterId: { in: chapterIds as string[] } },
      orderBy: { orderIndex: 'asc' },
    })
    return chapterIds.map((id) => missions.filter((m) => m.chapterId === id))
  })

  const decisionsByChapterId = new DataLoader(async (chapterIds: readonly string[]) => {
    const decisions = await prisma.decision.findMany({
      where: { chapterId: { in: chapterIds as string[] } },
      orderBy: { orderIndex: 'asc' },
    })
    return chapterIds.map((id) => decisions.filter((d) => d.chapterId === id))
  })

  return {
    characterById,
    branchesByDecisionId,
    characterStatesByBranchId,
    itemsByHolderId,
    decisionStatesByCharacterId,
    sessionsByChapterId,
    charactersByChapterId,
    missionsByChapterId,
    decisionsByChapterId,
  }
}

export type Loaders = ReturnType<typeof createLoaders>
