#!/usr/bin/env node
/**
 * 変更内容から「何をデプロイすべきか」と「推奨 smoke」を表示する。
 * 用法: node scripts/what-to-deploy.mjs
 */
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { detectSmokeTargets, formatSmokeReport, runStaticGuards } from './regression-guards-lib.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function git(args) {
  try {
    return execSync(`git ${args}`, { cwd: root, encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

const lines = new Set()
for (const cmd of [
  'diff --name-only HEAD',
  'diff --name-only --cached',
  'diff --name-only github/main...HEAD',
]) {
  for (const f of git(cmd).split('\n').map(s => s.trim()).filter(Boolean)) {
    lines.add(f)
  }
}

const files = [...lines]
if (!files.length) {
  console.log('変更ファイルはありません（作業ツリーはクリーン）。')
  process.exit(0)
}

const diffParts = []
for (const cmd of [
  'diff HEAD -- gas-deploy visit-dental-app AppsScript-Main',
  'diff --cached -- gas-deploy visit-dental-app AppsScript-Main',
]) {
  const d = git(cmd)
  if (d) diffParts.push(d)
}
const diffText = diffParts.join('\n')

const uiOnly = files.every(
  f => f.startsWith('gas-deploy/') || f.startsWith('visit-dental-app/'),
)
const mainGs = files.some(f => /AppsScript-Main|Main\.gs/i.test(f))
const vercelOnly = files.every(f => f.startsWith('visit-dental-app/'))
const gasHtml = files.some(
  f => f.startsWith('gas-deploy/') && /\.html$/i.test(f),
)

console.log('')
console.log('━━ 訪問歯科カルテ：デプロイ要否 ━━')
console.log('')
console.log('変更ファイル (' + files.length + '):')
files.slice(0, 12).forEach(f => console.log('  · ' + f))
if (files.length > 12) console.log('  … 他 ' + (files.length - 12) + ' 件')
console.log('')

if (uiOnly && !mainGs) {
  console.log('✅ UI のみの変更 → 次の1手だけ')
  console.log('   git add gas-deploy visit-dental-app')
  console.log('   git commit -m "…"')
  console.log('   git push github main')
  console.log('')
  console.log('   ※ GAS への HTML 手貼り不要')
  console.log('   ※ Vercel の GAS_WEBAPP_URL 変更不要')
  console.log('   ※ Vercel Redeploy 不要（push で自動ビルド）')
} else if (mainGs && !gasHtml) {
  console.log('📌 バックエンド（Main.gs）のみ')
  console.log('   1. AppsScript-Main-差し替え用.gs → GAS の Main.gs に全文コピー')
  console.log('   2. デプロイ → デプロイを管理 → 既存ウェブアプリ ✏️ → 新バージョン → デプロイ')
  console.log('   ※ 同じウェブアプリを更新すれば /exec URL は通常そのまま（Vercel 変更不要）')
} else if (mainGs && gasHtml) {
  console.log('📌 UI + バックエンド両方')
  console.log('   A. git push github main（Vercel 画面）')
  console.log('   B. Main.gs を GAS に貼り替え → 新バージョンでデプロイ')
  console.log('   C. GAS 単体も使う場合のみ gas-deploy の HTML 4ファイルを GAS に貼り替え')
} else if (vercelOnly) {
  console.log('✅ Vercel 配信まわりのみ → git push github main')
} else {
  console.log('⚠️  対象外のファイルも含まれます。内容を確認してから push してください。')
}

console.log('')
console.log('━━ 回帰ガード ━━')
console.log('')

const guard = runStaticGuards(root)
if (guard.errors.length) {
  console.log('❌ 静的ガード失敗 — push 前に修正:')
  guard.errors.forEach(e => console.log('  · ' + e))
  console.log('')
  console.log('   確認: node scripts/check-regression-guards.mjs')
} else {
  console.log('✅ 静的ガード OK')
  if (guard.warnings.length) {
    guard.warnings.forEach(w => console.log('  ⚠ ' + w))
  }
}

const triggered = detectSmokeTargets(files, diffText)
if (triggered.length) {
  console.log('')
  console.log('━━ 推奨 smoke（push 前） ━━')
  console.log('')
  formatSmokeReport(triggered).forEach(l => console.log(l))
}

console.log('')
console.log('push 前: node scripts/check-regression-guards.mjs --diff')
console.log('E2E:     cd visit-dental-app && npm run regression:e2e')
console.log('接続確認: （Vercel URL）/api/gas-check')
console.log('')
