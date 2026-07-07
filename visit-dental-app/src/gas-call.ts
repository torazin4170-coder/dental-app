declare global {
  interface Window {
    __gasCallFetch?: (funcName: string, ...args: unknown[]) => Promise<unknown>
  }
}

export function installGasCallFetch(): void {
  const rpcPath = import.meta.env.VITE_GAS_RPC_PATH || '/api/gas-rpc'

  window.__gasCallFetch = async (funcName: string, ...args: unknown[]) => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 45_000)
    let res: Response
    try {
      res = await fetch(rpcPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ func: funcName, args }),
        signal: controller.signal,
      })
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        throw new Error(
          'サーバー応答がタイムアウトしました。Vercel の /api/ping と GAS_WEBAPP_URL を確認してください。',
        )
      }
      throw e
    } finally {
      clearTimeout(timeoutId)
    }
    const text = await res.text()
    let body: { ok?: boolean; result?: unknown; error?: string }
    try {
      body = JSON.parse(text) as typeof body
    } catch {
      throw new Error(
        `サーバー応答が読めません (${res.status}): ${text.slice(0, 160)}`,
      )
    }
    if (!body.ok) {
      throw new Error(body.error || `RPC failed (${res.status})`)
    }
    return body.result
  }
}
