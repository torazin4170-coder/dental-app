# 印刷プレビュー一致監査（全帳票）

ユーザーが指摘しなくても、帳票変更時は **この表を全行チェック** する。

## リッチプレビュー帳票（強調・改行あり）

| 帳票 | 印刷関数 | WYSIWYG ヘルパー | 方式 | 自動ガード |
|------|----------|------------------|------|------------|
| FAX日報 | `printFaxDailyReport` | `faxDailyHtmlForPrint_` | プレビュー DOM クローン | ✅ |
| SVリスト | `printSupervisorListReport` | `svListHtmlForPrint_` | 同上 | ✅ |
| 情報共有シート | `issPrint` | `issHtmlForPrint_` | 同上 | ✅ |
| 施設月次報告書 | `printPersonalSheetReport` | `personalSheetHtmlForPrint_` | 同上 | ✅ |

共通: `rptPreviewHtmlForPrint_` → `rptPlainHtmlForFax_` / `rptPlainHtml_`

## テキスト中心帳票（プレビュー＝textarea 等）

| 帳票 | 印刷関数 | 備考 |
|------|----------|------|
| 月次ケア報告 | `printMonthCareReport` | 強調なし・マトリクス/本文 |
| 施設月次（旧テキスト） | `printClinicalMonthlyReport` | textarea 本文 |
| 検診表 | `printKentaiReport` | 歯式 SVG |
| 患者PPS | `printPatientPpsReport` | 歯式 |
| 訪問時間表 | `printVisitTimetableFromEditor` | 表組み |
| 口腔機能 | `printOralFunctionPrecision_` | 専用 CSS |
| 診断書 | `printShindan_` | 専用レイアウト |

変更時は **プレビューと印刷プレビューで改行・強調・表組み** を目視1項目以上。

## 過去に起きた不一致パターン

1. 印刷時にコンテキスト再生成 → マーカー/改行欠落（ISS）
2. `rptRichMultilineToMarkers_` が連続改行を潰す
3. 左フォームでプレビュー内容を上書き（ISS `issCollectFormToContext_`）

## AI の必須動作

- `rptEm*` / `*Print` / `rptRichMultilineToMarkers_` / `rptPreviewHtmlForPrint_` を触ったら **上表4行すべて** を smoke 対象にする（ユーザー指摘を待たない）
- `node scripts/check-regression-guards.mjs --diff` + `npm run regression:e2e` を push 前に実行
