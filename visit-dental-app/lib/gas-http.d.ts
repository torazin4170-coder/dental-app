export function normalizeGasWebAppUrl(raw: string): { url: string; error: string | null }

export function parseGasText(res: Response): Promise<{ ok: boolean; result?: unknown; error?: string }>

export function buildGasGetRpcUrl_(gasUrl: string, func: string, args: unknown[]): string

export function callGasRpc(
  gasUrl: string,
  func: string,
  args: unknown[],
): Promise<{ ok: boolean; result?: unknown; error?: string }>

export function describeGasDeployment_(url: string): { ok: boolean; preview: string | null }

export function probeGasWebAppReachable_(
  gasUrl: string,
): Promise<{ reachable: boolean; status: number; detail: string }>

export const GAS_CHECK_FIX_STEPS_: string[]
