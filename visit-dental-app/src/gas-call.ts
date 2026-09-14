declare global {
  interface Window {
    __gasCallFetch?: (funcName: string, ...args: unknown[]) => Promise<unknown>
    __APP_BUILD_ID__?: string
    __RPC_BACKEND__?: string
  }
}

/** 読み取り系だけ自動リトライ（保存系は二重送信リスクがあるためリトライしない） */
function shouldAutoRetryRpc(funcName: string): boolean {
  return /^(get|load|list)/i.test(funcName)
}

function resolveRpcPath(): string {
  const explicit = import.meta.env.VITE_RPC_PATH
  if (explicit && String(explicit).trim()) return String(explicit).trim()
  const backend = String(import.meta.env.VITE_RPC_BACKEND || 'gas').trim().toLowerCase()
  if (backend === 'supabase') return '/api/rpc'
  return import.meta.env.VITE_GAS_RPC_PATH || '/api/gas-rpc'
}

function resolveRpcTimeoutMs(funcName: string): number {
  // Vercel maxDuration(120s) より少し短くし、Abort→事後確認ルートに寄せる
  if (funcName === 'savePhoto') return 110_000
  if (/^save(ReportPreviewDraft|GeneratedDocument)/.test(funcName)) return 110_000
  if (/^loadReportPreviewDraft/.test(funcName)) return 90_000
  if (/^(save|update|add|delete|clear|append|generate)/i.test(funcName)) return 110_000
  if (/^get/i.test(funcName)) return 110_000
  return 45_000
}

function sanitizeRpcErrorMessage(raw: string, status: number): string {
  const text = String(raw || '').trim()
  if (!text) return `サーバー応答が不正です (${status})`
  // 実 HTML / GAS 画面だけを検知（「GAS_WEBAPP」という設定エラー文言まで潰さない）
  if (/<!doctype html|<html[\s>]|<script[\s>]|nonce=|window\[|ppConfig|boot-loading|訪問歯科カルテ/i.test(text)) {
    return 'サーバー通信が不安定でした（HTML応答）。設定→接続状態を確認し、一覧を開き直して保存済みか確かめてください。'
  }
  if (text.length > 180) return text.slice(0, 180) + '…'
  return text
}

async function gasRpcOnce(rpcPath: string, funcName: string, args: unknown[], signal: AbortSignal) {
  const res = await fetch(rpcPath, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ func: funcName, args }),
    signal,
  })
  const text = await res.text()
  let body: { ok?: boolean; result?: unknown; error?: string }
  try {
    body = JSON.parse(text) as typeof body
  } catch {
    throw new Error(sanitizeRpcErrorMessage(text, res.status))
  }
  if (!body.ok) {
    throw new Error(sanitizeRpcErrorMessage(body.error || `RPC failed (${res.status})`, res.status))
  }
  return body.result
}

export function installGasCallFetch(): void {
  const rpcPath = resolveRpcPath()
  const backend = rpcPath.includes('/api/rpc') ? 'supabase' : 'gas'
  window.__RPC_BACKEND__ = backend

  window.__gasCallFetch = async (funcName: string, ...args: unknown[]) => {
    const timeoutMs = resolveRpcTimeoutMs(funcName)
    const runOnce = async () => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
      try {
        return await gasRpcOnce(rpcPath, funcName, args, controller.signal)
      } finally {
        clearTimeout(timeoutId)
      }
    }
    try {
      try {
        return await runOnce()
      } catch (first) {
        if (!shouldAutoRetryRpc(funcName)) throw first
        await new Promise(r => setTimeout(r, 2000))
        return await runOnce()
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        const hint =
          backend === 'supabase'
            ? '設定→接続状態、または /api/supabase-check を確認してください。'
            : '設定→接続状態、または /api/gas-check を確認してください。'
        throw new Error('サーバー応答がタイムアウトしました。' + hint)
      }
      throw e
    } finally {
      /* timeout cleared in runOnce */
    }
  }
}
