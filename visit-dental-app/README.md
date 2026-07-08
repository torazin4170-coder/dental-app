# 訪問歯科カルテ — Vercel 版（段階1）

**デプロイの手間を減らす一覧 → [DEPLOY.md](./DEPLOY.md)**（UI 変更は `git push` のみ）

GAS Web アプリの**フロントのみ** Vercel に載せ、データ/API は従来どおり **Google Apps Script（Main.gs）** に置く構成です。

- UI ソース: `../gas-deploy/`（AppStyles / AppBody / AppScript）をビルド時に取り込み
- API: ブラウザ → Vercel `/api/gas-rpc` → GAS `doPost`（JSON-RPC）
- GAS 単体版: 従来どおり `google.script.run`（`gasCall` が自動切替）

## 前提

1. GAS に **最新の Main.gs**（`AppsScript-Main-差し替え用.gs`）を貼り、`doPost` / `RPC_ALLOWLIST_` が入っていること
2. GAS ウェブアプリを **新バージョンで再デプロイ**（`/exec` URL を控える）
3. アクセス設定は **現状の GAS 設定のまま**（「全員」推奨。Google アカウント限定だとサーバー経由 POST が通らない場合あり）

## ローカル開発

```bash
cd visit-dental-app
npm install
cp .env.example .env.local
# .env.local に GAS_WEBAPP_URL=https://script.google.com/macros/s/....../exec
npm run dev
```

ブラウザで表示された URL（例: `http://localhost:5173`）を開く。

## Vercel デプロイ

1. [Vercel](https://vercel.com/) → Import → このリポジトリ
2. **Root Directory** を `visit-dental-app` に設定
3. **Environment Variables**
   - `GAS_WEBAPP_URL` … GAS ウェブアプリの `/exec` URL（Production / Preview 両方）
4. Deploy

Production URL が新しいカルテの入口になります。

**重要:** `https://dental-app.vercel.app` は別の古いアプリです。必ず Vercel ダッシュボード → プロジェクト **dental-app**（Root Directory = `visit-dental-app`）→ **Visit** の URL を使ってください。タイトルが「訪問歯科カルテ」、起動画面が「読み込み中…」（日本語）であれば正しい版です。

診断:
- `https://（Production URL）/api/ping` → `{"ok":true,"message":"API is running"}`
- `https://（Production URL）/api/gas-check` → `{"ok":true,"message":"GAS 接続 OK"}`（GAS 設定の確認用）

**GAS 404 エラーが出る場合:** Vercel → Settings → Environment Variables の `GAS_WEBAPP_URL` を、GAS エディタ → デプロイを管理 → ウェブアプリの **`/exec` URL** に更新し、**Redeploy** してください（スプレッドシートの URL では動きません）。

## GAS への手貼りは必要？

| 使い方 | UI（画面）の更新 | バックエンド（Main.gs） |
|--------|------------------|-------------------------|
| **Vercel 版だけ使う** | **不要**（git push で自動） | GAS で新バージョンデプロイ |
| **GAS 単体版も使う** | gas-deploy 4ファイルを GAS に貼り替え | 同上 |

今回の変更（タイムテーブル・検診票など）は **UI の変更** です。Vercel 版だけ使うなら **GAS への HTML 手貼りは不要** です。

| 配信先 | やること |
|--------|----------|
| **Vercel** | `git push` → 自動ビルド（HTML/JS/CSS の手貼り不要） |
| **GAS 単体** | 従来どおり gas-deploy 4 ファイル + Main.gs を GAS に貼り替え |

## 制約（段階1）

- **写真アップロード**: Vercel 関数経由の POST にはサイズ上限（約 4.5MB）あり。大きい写真は GAS 版を使うか、将来の直接アップロード対応が必要
- **Drive 画像表示**: `getPhotos` が返す `?driveimg=` URL は GAS の `/exec` を指す（GAS URL が変わらなければそのまま動く）
- **起動時の一括読込**（`getPatients` + `getMonthlyRecords` 等）は GAS 側のボトルネックのまま

## ファイル構成

```
visit-dental-app/
  index.html          … 起動シェル
  src/main.ts         … gas-deploy を注入
  src/gas-call.ts     … fetch 版 gasCall
  api/gas-rpc.ts      … Vercel サーバーレス → GAS 転送
  lib/forward-gas-rpc.ts
```

## トラブルシュート

| 症状 | 確認 |
|------|------|
| 503 GAS_WEBAPP_URL is not set | Vercel の環境変数 / `.env.local` |
| 502 GAS が JSON 以外 (404) | `GAS_WEBAPP_URL` が古い/誤り（スプレッドシート URL 等）。`/api/gas-check` で確認 → `/exec` URL に更新して Redeploy |
| データ空 | GAS の `SS_ID` / スプレッドシート接続 |
| 502 HTML が返る | GAS URL が `/dev` ではなく `/exec` か、デプロイ権限 |
