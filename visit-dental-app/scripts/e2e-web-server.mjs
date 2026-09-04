/**
 * Playwright webServer 用 — build 後に vite preview を起動（Windows 互換）
 */
import { spawn } from 'node:child_process'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const port = process.env.PW_PORT || '4173'

console.log('[e2e-web-server] building…')
execSync('npm run build', { cwd: root, stdio: 'inherit' })

console.log('[e2e-web-server] starting preview on port', port)
const child = spawn('npx', ['vite', 'preview', '--port', port, '--strictPort', '--host', '127.0.0.1'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
})

child.on('exit', (code) => process.exit(code ?? 1))

process.on('SIGINT', () => child.kill())
process.on('SIGTERM', () => child.kill())
