---
name: dental-app-adjustments
description: 訪問歯科カルテ（gas-deploy / visit-dental-app）のUI・挙動調整依頼時に従う。gas-deploy 変更後は回帰ガード通過後に git commit と github main への push まで行い Vercel 反映まで完了させる。
---

# 訪問歯科カルテ — アプリ調整ワークフlow

## いつ使うか

- `gas-deploy/` の HTML / JS / CSS を変更する依頼
- 帳票・診療記録・設定画面など Vercel 本番 UI の調整
- 「アプリを直して」「反映して」など、本番に載せたい変更全般

## ソースの正

| 種類 | 正の場所 | 本番反映 |
|------|----------|----------|
| UI | `gas-deploy/` | `git push github main` → Vercel 自動ビルド |
| データ API | `AppsScript-Main-差し替え用.gs` → GAS Main.gs | GAS 再デプロイ（UI だけの変更では不要） |

**GAS への HTML 手貼りは不要。**

## 作業完了時（必須）

UI 変更を入れたら、ユーザーが「コミットして」と言わなくても次まで実施する:

1. **回帰ガード（push 前必須）** — `.cursor/skills/dental-app-regression/SKILL.md` に従う:
   ```bash
   node scripts/check-regression-guards.mjs --diff
   ```
   失敗時は push しない。smoke-matrix の該当行と **print-parity-audit.md 全4帳票** を ✅/❌/⏭ で報告。
2. `gas-deploy/`（と e2e 変更時は `visit-dental-app/`）のみをステージ
3. 日本語で簡潔な commit message（why 中心）
4. `git push github main`
5. **`npm run regression:e2e`（visit-dental-app）を push 前に実行**
6. ユーザーに **コミット hash**、「1〜3分後に Ctrl+Shift+R」、大変更時は [user-smoke-5min.md](dental-app-regression/references/user-smoke-5min.md) を伝える

## 注意

- Main.gs だけ変えた場合は push ではなく GAS 再デプロイを案内する
- `.env` や秘密情報は commit しない
- 破壊的 git 操作（force push 等）はユーザー明示がない限り禁止

## 参照

- 回帰 smoke: `.cursor/skills/dental-app-regression/SKILL.md`
- 詳細デプロイ規則: `.cursor/rules/visit-dental-deploy.md`
- 本番 URL: https://dental-app-liart-five.vercel.app
