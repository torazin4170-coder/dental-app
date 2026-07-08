# 訪問歯科カルテ（visit-dental-app / gas-deploy）デプロイ規則

## UI 変更（gas-deploy の HTML/JS/CSS）のみ

- `git push github main` のみ。Vercel が自動ビルド。
- **GAS への HTML 手貼りをユーザーに求めない。**
- **Vercel の GAS_WEBAPP_URL 変更・Redeploy をユーザーに求めない。**

## Main.gs（AppsScript-Main-差し替え用.gs）変更のみ

- GAS エディタで Main.gs 全文コピー → **既存ウェブアプリ**を新バージョンで再デプロイ。
- 同じウェブアプリを更新する限り `/exec` URL は変わらない → Vercel 変更不要と案内する。

## 接続トラブル時

- 診断 URL: `（Production URL）/api/gas-check`
- RPC 実装: `visit-dental-app/lib/gas-http.js`（読み取りは GET `?rpc=1`、大きい payload は POST）
- `dental-app.vercel.app` は別アプリ。Vercel ダッシュボードの Visit URL を使う。

## 作業完了時

- `node scripts/what-to-deploy.mjs` の出力をユーザーに簡潔に伝える。
- 変更が gas-deploy のみなら「push だけで完了」と明示する。
