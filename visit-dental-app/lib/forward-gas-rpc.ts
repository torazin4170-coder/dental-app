export type GasRpcRequest = {
  func: string
  args?: unknown[]
}

export type GasRpcResponse = {
  ok: boolean
  result?: unknown
  error?: string
}

/** GAS Web アプリは POST 時 302 リダイレクトする。Location へ同じ POST を繰り返す */
async function postToGas(url: string, payload: object): Promise<Response> {
  const body = JSON.stringify(payload)
  const opts: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    redirect: 'manual',
  }

  let res = await fetch(url, opts)
  for (let i = 0; i < 5; i++) {
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get('location')
      if (!loc) break
      res = await fetch(loc, opts)
      continue
    }
    break
  }
  return res
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

  let res: Response
  try {
    res = await postToGas(url, payload)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `GAS への接続失敗: ${msg}` }
  }

  const text = await res.text()
  try {
    const parsed = JSON.parse(text) as GasRpcResponse
    if (typeof parsed.ok !== 'boolean') {
      return { ok: false, error: `GAS 応答が不正です (${res.status})` }
    }
    if (!parsed.ok && parsed.error) {
      return parsed
    }
    return parsed
  } catch {
    const hint = text.includes('Page Not Found')
      ? ' GAS URL が /exec で終わっているか、新バージョンでデプロイ済みか確認してください。'
      : text.includes('Authorization')
        ? ' GAS のアクセス設定を「全員」にしてください。'
        : ''
    return {
      ok: false,
      error: `GAS が JSON 以外を返しました (${res.status}): ${text.slice(0, 200)}${hint}`,
    }
  }
}
