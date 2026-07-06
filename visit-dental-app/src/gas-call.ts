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
    const body = (await res.json()) as { ok?: boolean; result?: unknown; error?: string }
    if (!body.ok) {
      throw new Error(body.error || `RPC failed (${res.status})`)
    }
    return body.result
  }
}
