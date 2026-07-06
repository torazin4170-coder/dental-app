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
  const url = String(gasUrl || '').trim()
  if (!url) {
    return { ok: false, error: 'GAS_WEBAPP_URL is not configured' }
  }
  const func = String(body?.func || '').trim()
  if (!func) {
    return { ok: false, error: 'Missing func' }
  }

  const payload = {
    func,
    args: Array.isArray(body.args) ? body.args : [],
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    redirect: 'follow',
  })

  const text = await res.text()
  try {
    const parsed = JSON.parse(text) as GasRpcResponse
    if (typeof parsed.ok !== 'boolean') {
      return { ok: false, error: `Invalid GAS response (${res.status})` }
    }
    return parsed
  } catch {
    return {
      ok: false,
      error: `GAS returned non-JSON (${res.status}): ${text.slice(0, 240)}`,
    }
  }
}
