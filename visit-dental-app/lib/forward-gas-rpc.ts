export type GasRpcRequest = {
  func: string
  args?: unknown[]
}

export type GasRpcResponse = {
  ok: boolean
  result?: unknown
  error?: string
}

function normalizeGasWebAppUrl(raw: string): { url: string; error: string | null } {
  let url = String(raw || '').trim().replace(/^[?=]+/, '')
  if (!url) {
    return { url: '', error: 'GAS_WEBAPP_URL が未設定です（Vercel の Environment Variables を確認）' }
  }
  if (/docs\.google\.com|sheets\.google\.com|drive\.google\.com/i.test(url)) {
    return {
      url: '',
      error: 'GAS_WEBAPP_URL がスプレッドシート/Drive の URL になっています。/exec のウェブアプリ URL を設定してください。',
    }
  }
  if (!/script\.google\.com/i.test(url)) {
    return { url: '', error: 'GAS_WEBAPP_URL は script.google.com の /exec URL である必要があります。' }
  }
  if (/\/dev\/?$/i.test(url)) {
    return { url: '', error: 'GAS_WEBAPP_URL が /dev です。/exec URL を設定してください。' }
  }
  url = url.replace(/\/+$/, '')
  if (!/\/exec$/i.test(url)) {
    url += '/exec'
  }
  return { url, error: null }
}

async function callGasViaPost(
  gasUrl: string,
  func: string,
  args: unknown[],
): Promise<GasRpcResponse> {
  const payload = { func, args }
  const body = JSON.stringify(payload)
  const opts: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    redirect: 'manual',
  }

  let res = await fetch(gasUrl, opts)
  for (let i = 0; i < 5; i++) {
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get('location')
      if (!loc) break
      res = await fetch(loc, opts)
      continue
    }
    break
  }
  return parseGasResponse(res)
}

async function parseGasResponse(res: Response): Promise<GasRpcResponse> {
  const text = await res.text()
  try {
    const parsed = JSON.parse(text) as GasRpcResponse
    if (typeof parsed.ok !== 'boolean') {
      return { ok: false, error: `GAS 応答が不正です (${res.status})` }
    }
    return parsed
  } catch {
    const hint =
      res.status === 404 || text.includes('Page Not Found')
        ? ' GAS_WEBAPP_URL を最新の /exec に更新し Redeploy してください。'
        : text.includes('Authorization')
          ? ' GAS のアクセスを「全員」にしてください。'
          : text.includes('<!DOCTYPE') || text.includes('<html')
            ? ' Main.gs に doPost（RPC_ALLOWLIST_）を入れ、新バージョンでデプロイしてください。'
            : ''
    return {
      ok: false,
      error: `GAS が JSON 以外を返しました (${res.status}): ${text.slice(0, 180)}${hint}`,
    }
  }
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
    return await callGasViaPost(normalized.url, func, args)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `GAS への接続失敗: ${msg}` }
  }
}
