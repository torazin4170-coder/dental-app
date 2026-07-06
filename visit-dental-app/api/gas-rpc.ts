import { forwardGasRpc, type GasRpcRequest } from '../lib/forward-gas-rpc'

export const runtime = 'edge'

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 })
  }
  if (req.method !== 'POST') {
    return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 })
  }

  const gasUrl = process.env.GAS_WEBAPP_URL || ''
  let body: GasRpcRequest
  try {
    body = (await req.json()) as GasRpcRequest
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const out = await forwardGasRpc(body, gasUrl)
  return Response.json(out, { status: out.ok ? 200 : 502 })
}
