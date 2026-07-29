import { invokeSupabaseRpc } from './rpc-handlers.js'

export async function forwardSupabaseRpc(body) {
  const func = String(body?.func || '').trim()
  if (!func) {
    return { ok: false, error: 'Missing func' }
  }
  const args = Array.isArray(body.args) ? body.args : []
  try {
    const result = await invokeSupabaseRpc(func, args)
    return { ok: true, result }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}
