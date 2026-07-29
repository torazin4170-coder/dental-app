# Supabase 試用版 — セットアップ手順

現行 GAS 版（`https://dental-app-liart-five.vercel.app`）は**そのまま**。
試用版は **別 URL（Vercel Preview）** で Supabase に接続します。

## 1. Supabase プロジェクト（無料）

1. [supabase.com](https://supabase.com) → New project（Free）
2. **Project Settings → API** から控える:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` key（secret）→ `SUPABASE_SERVICE_ROLE_KEY`

## 2. データベース作成

Supabase Dashboard → **SQL Editor** → 次のファイルを貼って Run:

```
supabase/migrations/001_initial_schema.sql
```

## 3. 既存データのコピー（任意）

Spreadsheet 各シートを **CSV** でダウンロードし、

```
visit-dental-app/import-data/
  facilities.csv
  patients.csv
  treatments.csv
  teeth_data.csv
  patient_medical.csv
  settings.csv
```

`.env.local` に Supabase の URL / service_role を設定して:

```bash
cd visit-dental-app
npm run import:supabase
```

## 4. ローカルで試用版

`visit-dental-app/.env.local`:

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
VITE_RPC_BACKEND=supabase
```

```bash
npm run dev
```

- 接続確認: http://localhost:5173/api/supabase-check
- 画面は GAS 版と同じ（gas-deploy をそのまま使用）

## 5. Vercel Preview（試用 URL）

Vercel → プロジェクト **dental-app** → Settings → Environment Variables

**Preview 環境のみ** に追加:

| 名前 | 値 |
|------|-----|
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
| `VITE_RPC_BACKEND` | `supabase` |

**Production** は変更しない（`GAS_WEBAPP_URL` + `VITE_RPC_BACKEND=gas` のまま）。

`git push` → Preview デプロイ URL を開く。

## 試用版で使える機能（v0）

- 起動（患者・施設・月次・設定の読み込み）
- 診療記録の保存・更新・削除
- 歯式・医療情報・患者・施設・設定

## まだ未対応（エラー表示）

- 写真（savePhoto / getPhotos）
- 帳票・FAX・確定保存アーカイブ など

→ 本番 GAS URL で従来どおり利用可能。

## 無料枠の注意

- DB 500MB / Storage 1GB
- **1週間未使用でプロジェクト一時停止** → 試用中は週1回 URL を開く
- 自動バックアップなし → GAS 版を正本バックアップとして残す

## 調整のしかた（実装後）

| 変更 | 触る場所 | 反映 |
|------|----------|------|
| 画面・ボタン・印刷 | `gas-deploy/` | `git push` |
| 保存・読み取り | `visit-dental-app/lib/rpc-handlers.js` | `git push` |
| DB 列追加 | `supabase/migrations/` | SQL Editor で実行 |

本番 GAS URL を壊さず、Preview URL だけで試せます。
