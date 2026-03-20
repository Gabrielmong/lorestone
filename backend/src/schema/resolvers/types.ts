import { PrismaClient } from '@prisma/client'
import { Loaders } from '../../loaders'

export interface Context {
  prisma: PrismaClient
  loaders: Loaders
  user: { id: string; email: string; name: string; passwordHash: string; createdAt: Date; updatedAt: Date } | null
}

export function requireAuth(ctx: Context) {
  if (!ctx.user) throw new Error('Not authenticated')
  return ctx.user
}

export async function requireCampaignOwner(campaignId: string, userId: string, prisma: PrismaClient) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } })
  if (!campaign) throw new Error('Campaign not found')
  if (campaign.userId && campaign.userId !== userId) throw new Error('Forbidden')
  return campaign
}
