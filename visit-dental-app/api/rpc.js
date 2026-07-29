import { forwardSupabaseRpc } from '../lib/forward-supabase-rpc.js'

function readJsonBody(req) {
  const body = req.body
  if (body == null) return {}
  if (typeof body === 'string') {
    try {
      return JSON.parse(body)
    } catch {
      return {}
    }
  }
  if (typeof body === 'object') return body
  return {}
}

export default async function handler(req, res) {
  try {
    if (req.method === 'OPTIONS') {
      res.status(204).end()
      return
    }
    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'Method not allowed' })
      return
    }

    const body = readJsonBody(req)
    const func = String(body.func || '').trim()
    if (!func) {
      res.status(400).json({ ok: false, error: 'Missing func' })
      return
    }

    const out = await forwardSupabaseRpc(body)
    res.status(out.ok ? 200 : 502).json(out)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    res.status(500).json({ ok: false, error: 'Vercel API 内部エラー: ' + msg })
  }
}
