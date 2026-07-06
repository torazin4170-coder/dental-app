import type { VercelRequest, VercelResponse } from '@vercel/node'
import { forwardGasRpc, type GasRpcRequest } from '../lib/forward-gas-rpc'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  const gasUrl = process.env.GAS_WEBAPP_URL || ''
  const body = (req.body ?? {}) as GasRpcRequest
  const out = await forwardGasRpc(body, gasUrl)
  res.status(out.ok ? 200 : 502).json(out)
}
