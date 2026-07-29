export type SupabaseRpcRequest = {
  func: string
  args?: unknown[]
}

export type SupabaseRpcResponse = {
  ok: boolean
  result?: unknown
  error?: string
}

export function forwardSupabaseRpc(body: SupabaseRpcRequest): Promise<SupabaseRpcResponse>
