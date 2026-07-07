import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = path.resolve(root, '..', 'gas-deploy')
const destDir = path.join(root, 'vendor', 'gas-deploy')

const files = ['AppStyles.html', 'AppBody.html', 'AppScript.html']

if (!fs.existsSync(srcDir)) {
  console.error('[sync-gas-deploy] gas-deploy が見つかりません:', srcDir)
  process.exit(1)
}

fs.mkdirSync(destDir, { recursive: true })
for (const name of files) {
  const from = path.join(srcDir, name)
  const to = path.join(destDir, name)
  if (!fs.existsSync(from)) {
    console.error('[sync-gas-deploy] ファイルがありません:', from)
    process.exit(1)
  }
  fs.copyFileSync(from, to)
}

const stamp = new Date().toISOString()
fs.writeFileSync(path.join(destDir, 'BUILD_STAMP.txt'), stamp + '\n', 'utf8')
console.log('[sync-gas-deploy] OK', stamp)
