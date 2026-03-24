import 'dotenv/config'
import http from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import { ApolloServer } from '@apollo/server'
import { expressMiddleware } from '@apollo/server/express4'
import { typeDefs } from './schema/typeDefs'
import { resolvers } from './schema/resolvers'
import { createLoaders } from './loaders'
import { prisma } from './db/client'
import { getUserFromToken } from './auth/jwt'
import { parseDdbCharacter, type DdbCharacterData } from './ddb/characterImport'

async function main() {
  const server = new ApolloServer({ typeDefs, resolvers, csrfPrevention: false })
  await server.start()

  const app = express()

  const corsOptions = cors<cors.CorsRequest>({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })

  // R2 map upload
  const r2 = process.env.R2_ENDPOINT
    ? new S3Client({
        region: 'auto',
        endpoint: process.env.R2_ENDPOINT,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
        },
      })
    : null

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } })

  // Generic image upload (portraits, etc.)
  app.options('/api/upload/image', corsOptions)
  app.post('/api/upload/image', corsOptions, (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        res.status(413).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 100 MB)' : err.message }); return
      }
      if (err) { res.status(500).json({ error: 'Upload failed' }); return }
      next()
    })
  }, async (req, res) => {
    if (!r2) { res.status(503).json({ error: 'R2 not configured' }); return }
    if (!req.file) { res.status(400).json({ error: 'No file' }); return }
    const folder = typeof req.query.folder === 'string' && /^[a-z0-9-]+$/.test(req.query.folder) ? req.query.folder : 'uploads'
    const ext = req.file.originalname.split('.').pop() ?? 'bin'
    const key = `${folder}/${randomUUID()}.${ext}`
    await r2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }))
    const url = `${process.env.R2_PUBLIC_URL}/${key}`
    res.json({ url, key })
  })

  app.options('/api/upload/map', corsOptions)
  app.post('/api/upload/map', corsOptions, (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        res.status(413).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 100 MB)' : err.message })
        return
      }
      if (err) { res.status(500).json({ error: 'Upload failed' }); return }
      next()
    })
  }, async (req, res) => {
    if (!r2) { res.status(503).json({ error: 'R2 not configured' }); return }
    if (!req.file) { res.status(400).json({ error: 'No file' }); return }

    const ext = req.file.originalname.split('.').pop() ?? 'bin'
    const key = `maps/${randomUUID()}.${ext}`

    await r2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }))

    const url = `${process.env.R2_PUBLIC_URL}/${key}`
    res.json({ url, key })
  })

  // PDF proxy — only allows D&D Beyond sheet-pdf URLs to prevent SSRF
  app.options('/api/proxy-pdf', corsOptions)
  app.post('/api/proxy-pdf', corsOptions, express.json(), async (req, res) => {
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

  // D&D Beyond character import — fetches public character data by ID
  app.options('/api/dndbeyond-character', corsOptions)
  app.post('/api/dndbeyond-character', corsOptions, express.json(), async (req, res) => {
    const { characterId } = req.body ?? {}
    if (!characterId) {
      res.status(400).json({ error: 'characterId is required' })
      return
    }
    const id = String(characterId).replace(/\D/g, '')
    if (!id) {
      res.status(400).json({ error: 'Invalid character ID' })
      return
    }
    try {
      const upstream = await fetch(
        `https://character-service.dndbeyond.com/character/v5/character/${id}?includeCustomItems=true`,
        {
          headers: {
            Origin: 'https://www.dndbeyond.com',
            Referer: 'https://www.dndbeyond.com/',
            'User-Agent': 'Mozilla/5.0 (compatible; DnDCompanion/1.0)',
          },
        }
      )
      if (!upstream.ok) {
        res.status(upstream.status).json({ error: `D&D Beyond responded ${upstream.status}` })
        return
      }
      const json = (await upstream.json()) as { success: boolean; message: string; data: DdbCharacterData }
      if (!json.success || !json.data) {
        res.status(404).json({ error: json.message ?? 'Character not found or not public' })
        return
      }
      const sheet = parseDdbCharacter(json.data)
      res.json({ success: true, data: sheet })
    } catch {
      res.status(500).json({ error: 'Failed to fetch character from D&D Beyond.' })
    }
  })

  app.use(
    '/graphql',
    corsOptions,
    express.json(),
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
  const httpServer = http.createServer(app)

  // Deepgram proxy WebSocket — browser sends audio, we forward to Deepgram and return transcripts
  const wss = new WebSocketServer({ server: httpServer, path: '/transcribe' })
  wss.on('connection', (browserWs, req) => {
    const lang = new URL(req.url ?? '', 'http://x').searchParams.get('lang') ?? 'es'
    const dgWs = new WebSocket(
      `wss://api.deepgram.com/v1/listen?model=nova-2&language=${lang}&diarize=true&punctuate=true&interim_results=true&vad_events=true&endpointing=1000&encoding=linear16&sample_rate=16000`,
      { headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` } },
    )

    // Send KeepAlive every 8s so Deepgram doesn't close idle connections
    const keepAlive = setInterval(() => {
      if (dgWs.readyState === WebSocket.OPEN) {
        dgWs.send(JSON.stringify({ type: 'KeepAlive' }))
      }
    }, 8000)

    dgWs.on('open', () => browserWs.send(JSON.stringify({ type: 'Connected' })))
    dgWs.on('message', (data) => {
      if (browserWs.readyState === WebSocket.OPEN) browserWs.send(data.toString())
    })
    dgWs.on('error', (err) => console.error('Deepgram WS error:', err))
    dgWs.on('close', (code, reason) => {
      console.log(`Deepgram closed: ${code} ${reason}`)
      clearInterval(keepAlive)
      if (browserWs.readyState === WebSocket.OPEN) browserWs.close()
    })

    browserWs.on('message', (data) => {
      if (dgWs.readyState === WebSocket.OPEN) dgWs.send(data)
    })
    browserWs.on('close', () => { clearInterval(keepAlive); dgWs.close() })
    browserWs.on('error', () => { clearInterval(keepAlive); dgWs.close() })
  })

  httpServer.listen(port, () => {
    console.log(`🚀 Server ready at http://localhost:${port}/graphql`)
  })
}

main().catch(console.error)
