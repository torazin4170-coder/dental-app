---
name: dental-app-regression
description: 訪問歯科カルテ（gas-deploy）の push 前・大変更後の回帰 smoke。静的ガード実行、smoke-matrix に沿った確認、incidents 照合。gas-deploy 変更、帳票・強調・ISS・保存・同期の修正後に使用する。
---

# 訪問歯科カルテ — 回帰 smoke

## いつ使うか

- `gas-deploy/` または `AppsScript-Main-差し替え用.gs` を変更した **push 前**
- 共通関数（`rptEm*` / `issRefreshPreview` / `gasCall*` / `*Print*` / `rptPreviewHtmlForPrint_*` 等）を触った後
- **ユーザーが言わなくても** 帳票・印刷・強調の変更後は必ず実行
- `dental-app-adjustments` スキルで commit する直前（**必須**）

## push 前フロー（必須）

1. **インシデント照合** — [references/incidents.md](references/incidents.md) を読み、今回の diff が再発条件に当たるか確認
2. **静的ガード** — リポジトリルートで実行:
   ```bash
   node scripts/check-regression-guards.mjs --diff
   ```
   失敗したら **push しない**。直してから再実行。
3. **smoke 対象決定** — コマンド出力と [references/smoke-matrix.md](references/smoke-matrix.md) の「変更種別 → 必須行」
4. **動作確認** — 該当行を ✅/❌/⏭ で報告（「問題なし」のみは **禁止**）
5. **印刷一致（必須）** — [references/print-parity-audit.md](references/print-parity-audit.md) のリッチプレビュー4帳票を確認。ユーザー指摘を **待たない**
6. **E2E（必須）** — `cd visit-dental-app && npm run regression:e2e`
7. ユーザー向け — 大変更なら [references/user-smoke-5min.md](references/user-smoke-5min.md) を提示

## 二面テスト（ISS 等）

フォーム＋プレビュー構造がある機能は **両方** を必ず試す:

- 左（入力ペイン）→ プレビュー反映
- プレビュー → 左（または保存データ）反映

「プレビューだけ OK」は **不合格**。

## サブエージェントを使う場合

- [smoke-matrix.md](references/smoke-matrix.md) の並列割当に従う
- 各エージェントは担当 ID を列挙して返す
- 親エージェントは未確認 ID を漏れなく集約

## 新インシデントの記録

重大不具合を直したら `references/incidents.md` に1件追加（症状・原因・再発条件・必須確認）。

## 参照

- 変更種別マトリクス: [references/smoke-matrix.md](references/smoke-matrix.md)
- 印刷一致監査: [references/print-parity-audit.md](references/print-parity-audit.md)
- 過去の事故: [references/incidents.md](references/incidents.md)
- ユーザー5分: [references/user-smoke-5min.md](references/user-smoke-5min.md)
- デプロイ: `.cursor/skills/dental-app-adjustments/SKILL.md`
