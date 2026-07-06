declare global {
  interface Window {
    __gasCallFetch?: (funcName: string, ...args: unknown[]) => Promise<unknown>
  }
}

export function installGasCallFetch(): void {
  const rpcPath = import.meta.env.VITE_GAS_RPC_PATH || '/api/gas-rpc'

  window.__gasCallFetch = async (funcName: string, ...args: unknown[]) => {
    const res = await fetch(rpcPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ func: funcName, args }),
    })
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
