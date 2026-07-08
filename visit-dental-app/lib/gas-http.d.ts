export function normalizeGasWebAppUrl(raw: string): { url: string; error: string | null }

export function parseGasText(res: Response): Promise<{ ok: boolean; result?: unknown; error?: string }>

export function callGasRpc(
  gasUrl: string,
  func: string,
  args: unknown[],
): Promise<{ ok: boolean; result?: unknown; error?: string }>
