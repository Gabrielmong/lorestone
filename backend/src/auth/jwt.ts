import jwt from 'jsonwebtoken'
import { prisma } from '../db/client'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'

export function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' })
}

export async function getUserFromToken(token: string) {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string }
    return await prisma.user.findUnique({ where: { id: payload.userId } })
  } catch {
    return null
  }
}
