#!/usr/bin/env node
/**
 * 訪問歯科カルテ — 静的回帰ガード
 * 用法: node scripts/check-regression-guards.mjs [--diff]
 */
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  detectSmokeTargets,
  formatSmokeReport,
  runStaticGuards,
} from './regression-guards-lib.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const withDiff = process.argv.includes('--diff')

function git(args) {
  try {
    return execSync(`git ${args}`, { cwd: root, encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

function collectChangedFiles() {
  const lines = new Set()
  for (const cmd of [
    'diff --name-only HEAD',
    'diff --name-only --cached',
    'diff --name-only github/main...HEAD',
  ]) {
    for (const f of git(cmd).split('\n').map((s) => s.trim()).filter(Boolean)) {
      lines.add(f)
    }
  }
  return [...lines]
}

function collectDiffText() {
  const parts = []
  for (const cmd of [
    'diff HEAD -- gas-deploy visit-dental-app AppsScript-Main',
    'diff --cached -- gas-deploy visit-dental-app AppsScript-Main',
  ]) {
    const d = git(cmd)
    if (d) parts.push(d)
  }
  return parts.join('\n')
}

console.log('')
console.log('━━ 訪問歯科カルテ：回帰ガード（静的チェック） ━━')
console.log('')

const guard = runStaticGuards(root)
if (guard.warnings.length) {
  console.log('⚠️  警告:')
  guard.warnings.forEach((w) => console.log('  · ' + w))
  console.log('')
}

if (guard.errors.length) {
  console.log('❌ 失敗 (' + guard.errors.length + '):')
  guard.errors.forEach((e) => console.log('  · ' + e))
  console.log('')
  process.exit(1)
}

console.log('✅ 静的ガード OK（強調バー・CSSスコープ・必須関数）')
console.log('')

if (withDiff) {
  const files = collectChangedFiles()
  const diff = collectDiffText()
  const triggered = detectSmokeTargets(files, diff)
  console.log('━━ 推奨 smoke 対象 ━━')
  console.log('')
  formatSmokeReport(triggered).forEach((l) => console.log(l))
  console.log('')
  console.log('実行: node scripts/check-regression-guards.mjs --diff')
  console.log('      cd visit-dental-app && npm run regression:e2e')
  console.log('')
}

process.exit(0)
