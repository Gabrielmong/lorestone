import bcrypt from 'bcryptjs'
import { GraphQLError } from 'graphql'
import { signToken } from '../../auth/jwt'
import type { Context } from './types'

export const authResolvers = {
  Query: {
    me: (_: unknown, __: unknown, ctx: Context) => {
      if (!ctx.user) throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } })
      return ctx.user
    },
  },

  Mutation: {
    register: async (_: unknown, args: { email: string; password: string; name: string }, ctx: Context) => {
      const existing = await ctx.prisma.user.findUnique({ where: { email: args.email } })
      if (existing) throw new GraphQLError('Email already in use', { extensions: { code: 'BAD_USER_INPUT' } })

      const passwordHash = await bcrypt.hash(args.password, 10)
      const user = await ctx.prisma.user.create({
        data: { email: args.email, passwordHash, name: args.name },
      })

      return { token: signToken(user.id), user }
    },

    login: async (_: unknown, args: { email: string; password: string }, ctx: Context) => {
      const user = await ctx.prisma.user.findUnique({ where: { email: args.email } })
      if (!user) throw new GraphQLError('Invalid credentials', { extensions: { code: 'UNAUTHENTICATED' } })

      const valid = await bcrypt.compare(args.password, user.passwordHash)
      if (!valid) throw new GraphQLError('Invalid credentials', { extensions: { code: 'UNAUTHENTICATED' } })

      return { token: signToken(user.id), user }
    },

    updateProfile: async (_: unknown, args: { name?: string; dateOfBirth?: string }, ctx: Context) => {
      if (!ctx.user) throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } })
      return ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: {
          ...(args.name !== undefined && { name: args.name }),
          ...(args.dateOfBirth !== undefined && { dateOfBirth: args.dateOfBirth ? new Date(args.dateOfBirth) : null }),
        },
      })
    },

    changePassword: async (_: unknown, args: { currentPassword: string; newPassword: string }, ctx: Context) => {
      if (!ctx.user) throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } })
      const user = await ctx.prisma.user.findUnique({ where: { id: ctx.user.id } })
      if (!user) throw new GraphQLError('User not found')
      const valid = await bcrypt.compare(args.currentPassword, user.passwordHash)
      if (!valid) throw new GraphQLError('Current password is incorrect', { extensions: { code: 'BAD_USER_INPUT' } })
      if (args.newPassword.length < 8) throw new GraphQLError('Password must be at least 8 characters', { extensions: { code: 'BAD_USER_INPUT' } })
      const passwordHash = await bcrypt.hash(args.newPassword, 10)
      await ctx.prisma.user.update({ where: { id: ctx.user.id }, data: { passwordHash } })
      return true
    },
  },

  User: {
    campaigns: (user: { id: string }, _: unknown, ctx: Context) =>
      ctx.prisma.campaign.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
  },
}
