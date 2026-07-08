import { callGasRpc, normalizeGasWebAppUrl } from './gas-http.js'

export type GasRpcRequest = {
  func: string
  args?: unknown[]
}

export type GasRpcResponse = {
  ok: boolean
  result?: unknown
  error?: string
}

export async function forwardGasRpc(
  body: GasRpcRequest,
  gasUrl: string,
): Promise<GasRpcResponse> {
  const normalized = normalizeGasWebAppUrl(gasUrl)
  if (normalized.error) {
    return { ok: false, error: normalized.error }
  }
  const func = String(body?.func || '').trim()
  if (!func) {
    return { ok: false, error: 'Missing func' }
  }
  const args = Array.isArray(body.args) ? body.args : []

  try {
    return (await callGasRpc(normalized.url, func, args)) as GasRpcResponse
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `GAS への接続失敗: ${msg}` }
  }
}
