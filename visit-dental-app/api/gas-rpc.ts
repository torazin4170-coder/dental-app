import type { VercelRequest, VercelResponse } from '@vercel/node'
import { forwardGasRpc, type GasRpcRequest } from '../lib/forward-gas-rpc'

function parseBody(req: VercelRequest): GasRpcRequest {
  const raw = req.body
  if (raw == null) return { func: '' }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as GasRpcRequest
    } catch {
      return { func: '' }
    }
  }
  return raw as GasRpcRequest
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'OPTIONS') {
      res.status(204).end()
      return
    }
    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'Method not allowed' })
      return
    }

    const gasUrl = process.env.GAS_WEBAPP_URL || ''
    const body = parseBody(req)
    const out = await forwardGasRpc(body, gasUrl)
    res.status(out.ok ? 200 : 502).json(out)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    res.status(500).json({ ok: false, error: `Vercel API error: ${msg}` })
  }
}
