import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { ApolloServer } from '@apollo/server'
import { expressMiddleware } from '@apollo/server/express4'
import { typeDefs } from './schema/typeDefs'
import { resolvers } from './schema/resolvers'
import { createLoaders } from './loaders'
import { prisma } from './db/client'
import { getUserFromToken } from './auth/jwt'

async function main() {
  const server = new ApolloServer({ typeDefs, resolvers })
  await server.start()

  const app = express()

  app.use(
    cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    })
  )

  app.use(express.json())

  // PDF proxy — only allows D&D Beyond sheet-pdf URLs to prevent SSRF
  app.post('/api/proxy-pdf', async (req, res) => {
    const { url } = req.body ?? {}
    if (typeof url !== 'string') {
      res.status(400).json({ error: 'url is required' })
      return
    }
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`
    try {
      const parsed = new URL(normalized)
      if (
        !parsed.hostname.endsWith('dndbeyond.com') ||
        !parsed.pathname.startsWith('/sheet-pdfs/')
      ) {
        res.status(403).json({ error: 'Only D&D Beyond sheet-pdf URLs are allowed.' })
        return
      }
    } catch {
      res.status(400).json({ error: 'Invalid URL.' })
      return
    }
    try {
      const upstream = await fetch(normalized, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DnDCompanion/1.0)' },
      })
      if (!upstream.ok) {
        res.status(upstream.status).json({ error: `Upstream responded ${upstream.status}` })
        return
      }
      const contentType = upstream.headers.get('content-type') ?? 'application/pdf'
      res.setHeader('Content-Type', contentType)
      const buffer = await upstream.arrayBuffer()
      res.send(Buffer.from(buffer))
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch PDF.' })
    }
  })

  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: async ({ req }) => {
        const token = req.headers.authorization?.replace('Bearer ', '') ?? ''
        const user = token ? await getUserFromToken(token) : null
        return {
          prisma,
          loaders: createLoaders(prisma),
          user,
        }
      },
    })
  )

  const port = Number(process.env.PORT) || 4000
  app.listen(port, () => {
    console.log(`🚀 Server ready at http://localhost:${port}/graphql`)
  })
}

main().catch(console.error)
