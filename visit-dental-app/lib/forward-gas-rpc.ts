export type GasRpcRequest = {
  func: string
  args?: unknown[]
}

export type GasRpcResponse = {
  ok: boolean
  result?: unknown
  error?: string
}

/** 大きなデータは POST 必須 */
const POST_ONLY_FUNCS = new Set([
  'savePhoto',
  'saveReportPreviewDraftSimple',
  'saveReportPreviewDraftChunk',
  'saveGeneratedDocumentSimple',
  'saveGeneratedDocumentChunk',
])

function shouldUsePost(func: string, args: unknown[]): boolean {
  if (POST_ONLY_FUNCS.has(func)) return true
  try {
    return JSON.stringify(args).length > 6000
  } catch {
    return true
  }
}

async function callGasViaGet(
  gasUrl: string,
  func: string,
  args: unknown[],
): Promise<GasRpcResponse> {
  const url = new URL(gasUrl)
  url.searchParams.set('rpc', '1')
  url.searchParams.set('func', func)
  url.searchParams.set('args', JSON.stringify(args))

  const res = await fetch(url.toString(), { method: 'GET', redirect: 'follow' })
  return parseGasResponse(res)
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
    const hint = text.includes('Page Not Found')
      ? ' GAS URL が /exec か、doPost/doGet RPC が入った Main.gs を新バージョンでデプロイ済みか確認してください。'
      : text.includes('Authorization')
        ? ' GAS のアクセスを「全員」にしてください。'
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
  const url = String(gasUrl || '').trim()
  if (!url) {
    return { ok: false, error: 'GAS_WEBAPP_URL が未設定です（Vercel の Environment Variables を確認）' }
  }
  const func = String(body?.func || '').trim()
  if (!func) {
    return { ok: false, error: 'Missing func' }
  }
  const args = Array.isArray(body.args) ? body.args : []

  try {
    if (shouldUsePost(func, args)) {
      return await callGasViaPost(url, func, args)
    }
    return await callGasViaGet(url, func, args)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `GAS への接続失敗: ${msg}` }
  }
}
