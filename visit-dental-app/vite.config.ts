import type { IncomingMessage } from 'node:http'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { forwardGasRpc, type GasRpcRequest } from './lib/forward-gas-rpc'

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function gasRpcDevPlugin(): Plugin {
  return {
    name: 'gas-rpc-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? ''
        if (!url.startsWith('/api/gas-rpc')) {
          next()
          return
        }
        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.end()
          return
        }
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }

        let body: GasRpcRequest
        try {
          const raw = await readBody(req)
          body = raw ? (JSON.parse(raw) as GasRpcRequest) : { func: '' }
        } catch {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ ok: false, error: 'Invalid JSON body' }))
          return
        }

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

        try {
          const out = await forwardGasRpc(body, gasUrl)
          res.statusCode = out.ok ? 200 : 502
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(out))
        } catch (e) {
          const message = e instanceof Error ? e.message : 'unknown'
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ ok: false, error: message.slice(0, 240) }))
        }
      })
    },
  }
}

export default defineConfig({
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
    gasRpcDevPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '訪問歯科カルテ',
        short_name: '訪問歯科',
        description: '訪問歯科カルテ（Vercel フロント + GAS API）',
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
})
