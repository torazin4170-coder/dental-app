import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { forwardGasRpc, type GasRpcRequest } from './lib/forward-gas-rpc'
import { forwardSupabaseRpc } from './lib/forward-supabase-rpc'
import { getSupabaseConfig } from './lib/supabase-admin.js'
import { IMPLEMENTED_RPC } from './lib/rpc-handlers.js'

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

async function handleApiPost(
  req: IncomingMessage,
  res: ServerResponse,
  handler: (body: GasRpcRequest) => Promise<{ ok: boolean; result?: unknown; error?: string }>,
) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return true
  }
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end()
    return true
  }
  let body: GasRpcRequest
  try {
    const raw = await readBody(req)
    body = raw ? (JSON.parse(raw) as GasRpcRequest) : { func: '' }
  } catch {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: false, error: 'Invalid JSON body' }))
    return true
  }
  try {
    const out = await handler(body)
    res.statusCode = out.ok ? 200 : 502
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(out))
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown'
    res.statusCode = 502
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: false, error: message.slice(0, 240) }))
  }
  return true
}

function apiDevPlugin(): Plugin {
  return {
    name: 'visit-dental-api-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? ''

        if (url.startsWith('/api/gas-rpc')) {
          const gasUrl = process.env.GAS_WEBAPP_URL || ''
          if (!gasUrl) {
            res.statusCode = 503
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(
              JSON.stringify({
                ok: false,
                error: 'GAS_WEBAPP_URL is not set',
                hint: 'visit-dental-app/.env.local に GAS_WEBAPP_URL=... を書き、dev サーバーを再起動してください。',
              }),
            )
            return
          }
          const handled = await handleApiPost(req, res, (body) => forwardGasRpc(body, gasUrl))
          if (handled) return
        }

        if (url.startsWith('/api/rpc')) {
          const handled = await handleApiPost(req, res, (body) => forwardSupabaseRpc(body))
          if (handled) return
        }

        if (url.startsWith('/api/supabase-check') && req.method === 'GET') {
          const cfg = getSupabaseConfig()
          if (cfg.error) {
            res.statusCode = 502
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ ok: false, step: 'env', error: cfg.error }))
            return
          }
          try {
            const { getSupabaseAdmin } = await import('./lib/supabase-admin.js')
            const supabase = getSupabaseAdmin()
            const { error } = await supabase.from('settings').select('key').limit(1)
            if (error) throw new Error(error.message)
            const { count } = await supabase.from('facilities').select('*', { count: 'exact', head: true })
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(
              JSON.stringify({
                ok: true,
                step: 'supabase',
                message: 'Supabase 接続 OK',
                backend: 'supabase',
                facilitiesCount: count ?? 0,
                implementedRpcCount: IMPLEMENTED_RPC.size,
              }),
            )
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e)
            res.statusCode = 502
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ ok: false, step: 'supabase', error: message }))
          }
          return
        }

        next()
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  for (const [key, value] of Object.entries(env)) {
    if (value && !process.env[key]) process.env[key] = value
  }

  return {
  base: './',
  define: {
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)
        || new Date().toISOString().slice(0, 16).replace('T', ' '),
    ),
  },
  server: {
    fs: {
      allow: ['..'],
    },
  },
  plugins: [
    apiDevPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '訪問歯科カルテ',
        short_name: '訪問歯科',
        description: '訪問歯科カルテ（Vercel フロント + GAS / Supabase API）',
        theme_color: '#2563eb',
        background_color: '#f8fafc',
        display: 'standalone',
        lang: 'ja',
        start_url: './',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  }
})
