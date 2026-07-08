/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GAS_RPC_PATH?: string
  readonly VITE_BUILD_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare global {
  interface Window {
    __gasCallFetch?: (funcName: string, ...args: unknown[]) => Promise<unknown>
  }
}

export {}
