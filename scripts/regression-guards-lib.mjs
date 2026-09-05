/**
 * 訪問歯科カルテ — 回帰ガード共通ロジック
 * check-regression-guards.mjs / what-to-deploy.mjs から利用
 */
import fs from 'node:fs'
import path from 'node:path'

export const EMPHASIS_BAR_IDS = [
  'faxEmphasisBar',
  'svListEmphasisBar',
  'issEmphasisBar',
  'personalSheetEmphasisBar',
  'recordNotesEmBar',
]

export const EMPHASIS_KINDS = ['red', 'hl', 'box', 'boxBlack', 'clear']

/** 強調CSSが必要なスコープ（編集面・プレビュー面の両方があるものは両方列挙） */
export const EMPHASIS_CSS_SCOPES = [
  {
    id: 'fax-doc',
    file: 'AppBody.html',
    label: 'FAX日報プレビュー (.fax-doc)',
    test: (css) =>
      css.includes('.fax-doc .fax-em-red') &&
      css.includes('.fax-doc .fax-em-hl') &&
      css.includes('.fax-doc .fax-em-box') &&
      css.includes('.fax-doc .fax-em-box-black'),
  },
  {
    id: 'sv-doc',
    file: 'AppBody.html',
    label: 'SVリストプレビュー (.sv-doc)',
    test: (css) =>
      css.includes('.sv-doc .fax-em-red') &&
      css.includes('.sv-doc .fax-em-hl') &&
      css.includes('.sv-doc .fax-em-box') &&
      css.includes('.sv-doc .fax-em-box-black'),
  },
  {
    id: 'iss-doc',
    file: 'AppBody.html',
    label: '情報共有シートプレビュー (.iss-doc)',
    test: (css) =>
      css.includes('.iss-doc .iss-notes-rich .fax-em-red') &&
      css.includes('.iss-doc .iss-free-text-rich .fax-em-box') &&
      css.includes('.iss-doc .iss-free-text-rich .fax-em-box-black'),
  },
  {
    id: 'iss-notes-ed',
    file: 'AppBody.html',
    label: '情報共有シート左ペイン (.iss-notes-ed)',
    test: (css) =>
      css.includes('.iss-notes-ed .fax-em-red') &&
      css.includes('.iss-notes-ed .fax-em-box') &&
      css.includes('.iss-notes-ed .fax-em-box-black'),
  },
  {
    id: 'notes-rich-ed',
    file: 'AppBody.html',
    label: '診療記録メモ (.notes-rich-ed)',
    test: (css) =>
      css.includes('.notes-rich-ed .fax-em-red') &&
      css.includes('.notes-rich-ed .fax-em-box') &&
      css.includes('.notes-rich-ed .fax-em-box-black'),
  },
  {
    id: 'personal-sheet',
    file: 'AppStyles.html',
    label: '個別報告書プレビュー (#personalSheetPreviewInner)',
    test: (css) =>
      css.includes('#personalSheetPreviewInner .fax-em-red') &&
      css.includes('#personalSheetPreviewInner .fax-em-box') &&
      css.includes('#personalSheetPreviewInner .fax-em-box-black'),
  },
]

/** diff / 変更ファイルから smoke 対象を推定 */
export const SMOKE_TRIGGER_RULES = [
  {
    id: 'emphasis-shared',
    label: 'テキスト強調（共通）',
    surfaces: [
      'FAX日報 — プレビューで赤字・黄・赤枠・黒枠・解除',
      'SVリスト — 同上',
      '情報共有シート — 左サイドバー＋中央プレビュー両方',
      '個別報告書 — 治療内容欄',
      '診療記録メモ — メモ欄',
    ],
    matchFile: (f) => /gas-deploy\/App(SCRIPT|Body|Styles)\.html$/i.test(f.replace(/\\/g, '/')),
    matchDiff: (d) =>
      /rptEm[A-Z_]|fax-em-|faxApplyEmphasis|EmphasisBar|faxMarkersToHtml|faxHtmlToMarkers|rptRichMultilineToMarkers|issRichFieldToMarkers|rptEmSyncIssAfterEdit_/i.test(
        d,
      ),
  },
  {
    id: 'iss-dual',
    label: '情報共有シート（二面同期）',
    surfaces: [
      '左：内容欄・メモ欄で強調 → プレビュー反映',
      '中央プレビューで強調 → 左に反映',
      '強調バーがスクロール後も見える（sticky）',
      '改行をまたぐ選択（1行／複数行）',
    ],
    matchFile: (f) => /gas-deploy\/.*(iss|shareSheet)/i.test(f.replace(/\\/g, '/')),
    matchDiff: (d) => /\biss[A-Z_]|shareSheetModal|issPreviewInner|issRefreshPreview|issCollectFormToContext_/i.test(d),
  },
  {
    id: 'preview-bind',
    label: 'プレビュー編集バインド',
    surfaces: [
      'FAX日報プレビュー — セル編集・保存反映',
      'SVリストプレビュー — 同上',
      '情報共有シートプレビュー — 同上',
      '個別報告書プレビュー — 同上',
    ],
    matchFile: (f) => /gas-deploy\/AppScript\.html$/i.test(f.replace(/\\/g, '/')),
    matchDiff: (d) =>
      /rptBindPreviewEdits_|rptPullEdits_|rptReadPreviewCellValue_|RefreshPreview|SyncPreview/i.test(d),
  },
  {
    id: 'gas-sync',
    label: 'GAS同期・保存・タイムアウト',
    surfaces: [
      '起動同期 — 患者・施設が読める（120秒以内目安）',
      '診療記録保存 — 二重保存なし・失敗時ボタン復帰',
      '写真表示 — driveUrl 経由で表示',
    ],
    matchFile: (f) =>
      /(AppsScript-Main|gas-call|AppScript\.html|visit-dental-app\/src\/gas-call)/i.test(f.replace(/\\/g, '/')),
    matchDiff: (d) =>
      /gasCall|getInitData|readTreatmentBoot|getPhotos|patientPhotoDisplaySrc|handleTreatmentSave|timeout/i.test(d),
  },
  {
    id: 'report-format',
    label: '帳票出力・印刷',
    surfaces: [
      '施設月次 — 初診二重表示なし',
      '各帳票印刷 — 改行・強調が PDF に残る',
    ],
    matchFile: (f) => /gas-deploy\/AppScript\.html$/i.test(f.replace(/\\/g, '/')),
    matchDiff: (d) =>
      /formatTreatmentText|buildShareSheetPrintHtml|buildFax|buildSv|buildPersonal|forPrint/i.test(d),
  },
]

/** リッチプレビュー帳票：印刷はプレビュー DOM クローン（WYSIWYG）必須 */
export const PRINT_WYSIWYG_RULES = [
  {
    id: 'fax-daily',
    label: 'FAX日報',
    printFn: 'printFaxDailyReport',
    htmlFn: 'faxDailyHtmlForPrint_',
    previewInner: 'faxDailyPreviewInner',
    forbidDirectRebuild: 'buildFaxDailyBatchHtml_({ forPrint: true })',
  },
  {
    id: 'sv-list',
    label: 'SVリスト',
    printFn: 'printSupervisorListReport',
    htmlFn: 'svListHtmlForPrint_',
    previewInner: 'svListPreviewInner',
    forbidDirectRebuild: 'buildSupervisorListDocumentHtml_({ forPrint: true })',
  },
  {
    id: 'iss',
    label: '情報共有シート',
    printFn: 'issPrint',
    htmlFn: 'issHtmlForPrint_',
    previewInner: 'issPreviewInner',
    forbidDirectRebuild: null,
  },
  {
    id: 'personal-sheet',
    label: '施設月次報告書',
    printFn: 'printPersonalSheetReport',
    htmlFn: 'personalSheetHtmlForPrint_',
    previewInner: 'personalSheetPreviewInner',
    mustUseHelper: 'rptPreviewHtmlForPrint_',
  },
]

export function extractFunctionSource_(src, name) {
  const token = `function ${name}`
  const start = src.indexOf(token)
  if (start < 0) return ''
  let depth = 0
  let i = src.indexOf('{', start)
  if (i < 0) return ''
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') {
      depth--
      if (depth === 0) return src.slice(start, i + 1)
    }
  }
  return ''
}

export function runPrintParityGuards(script) {
  const errors = []
  if (!script) return errors
  if (!script.includes('function rptPreviewHtmlForPrint_')) {
    errors.push('共通 WYSIWYG 印刷ヘルパー rptPreviewHtmlForPrint_ がありません')
  }
  for (const rule of PRINT_WYSIWYG_RULES) {
    if (!script.includes(`function ${rule.htmlFn}`)) {
      errors.push(`${rule.label}: ${rule.htmlFn} がありません`)
      continue
    }
    const printSrc = extractFunctionSource_(script, rule.printFn)
    if (!printSrc) {
      errors.push(`${rule.label}: ${rule.printFn} が見つかりません`)
      continue
    }
    if (!printSrc.includes(`${rule.htmlFn}(`)) {
      errors.push(`${rule.label}: ${rule.printFn} が ${rule.htmlFn} を呼んでいません`)
    }
    if (rule.forbidDirectRebuild && printSrc.includes(rule.forbidDirectRebuild)) {
      errors.push(`${rule.label}: ${rule.printFn} がプレビュー再生成を直接呼んでいます`)
    }
    if (rule.mustUseHelper) {
      const htmlSrc = extractFunctionSource_(script, rule.htmlFn)
      if (htmlSrc && !htmlSrc.includes(rule.mustUseHelper)) {
        errors.push(`${rule.label}: ${rule.htmlFn} が ${rule.mustUseHelper} を使っていません`)
      }
    }
  }
  return errors
}

export function readText(root, relPath) {
  const p = path.join(root, relPath)
  if (!fs.existsSync(p)) return ''
  return fs.readFileSync(p, 'utf8')
}

export function runStaticGuards(root) {
  const errors = []
  const warnings = []
  const bodyPath = path.join(root, 'gas-deploy', 'AppBody.html')
  const stylesPath = path.join(root, 'gas-deploy', 'AppStyles.html')
  const scriptPath = path.join(root, 'gas-deploy', 'AppScript.html')

  if (!fs.existsSync(bodyPath)) {
    errors.push('gas-deploy/AppBody.html が見つかりません')
    return { ok: false, errors, warnings }
  }

  const body = fs.readFileSync(bodyPath, 'utf8')
  const styles = fs.existsSync(stylesPath) ? fs.readFileSync(stylesPath, 'utf8') : ''
  const script = fs.existsSync(scriptPath) ? fs.readFileSync(scriptPath, 'utf8') : ''

  for (const id of EMPHASIS_BAR_IDS) {
    if (!body.includes(`id="${id}"`)) {
      errors.push(`強調バー #${id} が AppBody.html にありません`)
    }
  }

  for (const barId of EMPHASIS_BAR_IDS) {
    const re = new RegExp(`id="${barId}"[\\s\\S]*?data-fax-em="boxBlack"`, 'i')
    if (!re.test(body)) {
      errors.push(`#${barId} に黒枠ボタン (data-fax-em="boxBlack") がありません`)
    }
  }

  for (const scope of EMPHASIS_CSS_SCOPES) {
    const css = scope.file === 'AppStyles.html' ? styles : body
    if (!css) {
      warnings.push(`${scope.label}: ${scope.file} が未読込のためスキップ`)
      continue
    }
    if (!scope.test(css)) {
      errors.push(`強調CSS不足: ${scope.label}（${scope.file}）`)
    }
  }

  const requiredFns = [
    'function rptEmApply_',
    'function rptBindEmphasisBarButtons_',
    'function issRefreshPreview',
    'function rptEmSyncIssAfterEdit_',
    'function rptPreviewHtmlForPrint_',
  ]
  for (const sig of requiredFns) {
    if (!script.includes(sig)) {
      errors.push(`AppScript.html に ${sig.replace('function ', '')} がありません`)
    }
  }

  if (!script.includes('container.id === "issPreviewInner"')) {
    warnings.push('issPreviewInner が rptIsRichPreviewContainer_ に含まれているか要確認')
  }

  const printErrors = runPrintParityGuards(script)
  errors.push(...printErrors)

  return { ok: errors.length === 0, errors, warnings }
}

export function detectSmokeTargets(changedFiles, diffText = '') {
  const triggered = []
  const normalized = changedFiles.map((f) => f.replace(/\\/g, '/'))

  for (const rule of SMOKE_TRIGGER_RULES) {
    const fileHit = normalized.some((f) => rule.matchFile(f))
    const diffHit = diffText && rule.matchDiff(diffText)
    if (fileHit && (diffHit || !diffText)) {
      triggered.push(rule)
    } else if (diffHit) {
      triggered.push(rule)
    }
  }

  const seen = new Set()
  return triggered.filter((r) => {
    if (seen.has(r.id)) return false
    seen.add(r.id)
    return true
  })
}

export function formatSmokeReport(triggered) {
  if (!triggered.length) {
    return ['今回の diff から必須 smoke は特定されませんでした（共通関数変更時は手動で smoke-matrix を確認）。']
  }
  const lines = []
  for (const rule of triggered) {
    lines.push(`■ ${rule.label}`)
    for (const s of rule.surfaces) lines.push(`  · ${s}`)
  }
  lines.push('')
  lines.push('詳細: .cursor/skills/dental-app-regression/references/smoke-matrix.md')
  lines.push('手動5分: .cursor/skills/dental-app-regression/references/user-smoke-5min.md')
  return lines
}
