# Supabase 移行（Bプラン）— わかりやすい手順

**いまのシステム（スプレッドシート＋GAS）は削除しません。**
うまくいかなければ、いつでも元に戻せます（保険）。

本番 URL（現行）: `https://dental-app-liart-five.vercel.app`  
→ 切替までは **いつもどおり動きます**。

---

## 用語（ひとこと）

| 言葉 | 意味 |
|------|------|
| Supabase | 新しい「データの置き場」（データベース） |
| GAS / スプレッドシート | 今まで使っている置き場（保険として残す） |
| Preview URL | 試験用の別アドレス。本番は触れない |
| Vercel | アプリをインターネットに出すサービス |

---

## あなたがやること（番号どおり）

### A. データベースの表を作る（初回だけ）

1. ブラウザで [supabase.com](https://supabase.com) を開き、プロジェクトを開く
2. 左メニュー **SQL Editor** をクリック
3. このリポジトリの次の2ファイルを、順にコピーして **Run**:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_storage_and_indexes.sql`

### B. スプレッドシートのデータをコピー（切替前）

1. Google スプレッドシートを開く
2. 各シートを **ファイル → ダウンロード → CSV** で保存
3. 次のフォルダに置く（ファイル名は下のとおり）:

```
visit-dental-app/import-data/
  facilities.csv
  patients.csv
  treatments.csv
  teeth_data.csv
  patient_medical.csv
  settings.csv
  photos.csv              （あれば）
  generated_documents.csv （あれば）
```

4. パソコンでターミナルを開き:

```bash
cd visit-dental-app
npm run import:supabase
npm run compare:counts
```

**写真の画像ファイル自体はコピー不要です**（Google ドライブにそのまま残ります）。

### C. 写真の保存先（案 D・現行）

写真の**ファイル実体**は、従来どおり **あなたの Google ドライブ**（`訪問歯科_写真`）に置きます。  
書き込みは **GAS（あなた本人）経由** で行い、サービスアカウントは使いません（個人 Google では容量 0 で失敗するため）。

必要な環境変数:

| 名前 | 内容 |
|------|------|
| `GAS_WEBAPP_URL` | **必須（写真）** — 従来の GAS ウェブアプリ `/exec` URL |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | 任意（書類アーカイブ等の補助）。写真の新規保存には使わない |

メタデータ（どの患者の写真か等）だけ Supabase の `photos` に記録します。

### D. 試験用 URL（Preview）で確認

Vercel → プロジェクト → **Settings → Environment Variables**

**Preview だけ** に入れる:

| 名前 | 値 |
|------|-----|
| `SUPABASE_URL` | Supabase の Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role キー（秘密） |
| `VITE_RPC_BACKEND` | `supabase` |
| `GAS_WEBAPP_URL` | （写真を使うとき・必須） |

**Production（本番）はまだ触らない**（`VITE_RPC_BACKEND=gas` のまま）。

確認すること:

- [ ] アプリが開く
- [ ] 患者一覧・診療保存
- [ ] 施設日報（FAX）の読み込み・下書き保存・印刷
- [ ] 写真の表示・追加（Drive 設定後）
- [ ] `/api/supabase-check` が `ok: true`

接続確認: Preview URL の末尾に `/api/supabase-check` を付けて開く。

---

## 本番への切替（うまくいったら）

Vercel → **Production** の環境変数:

| 名前 | 値 |
|------|-----|
| `VITE_RPC_BACKEND` | `supabase` |
| `SUPABASE_URL` | （Preview と同じ） |
| `SUPABASE_SERVICE_ROLE_KEY` | （Preview と同じ） |
| `GAS_WEBAPP_URL` | **残す**（保険） |

その後 **Redeploy（再デプロイ）**。

---

## うまくいかないとき（保険で戻す）

1. Vercel → Production → `VITE_RPC_BACKEND` を **`gas`** に戻す
2. Redeploy
3. 本番 URL が **今までのシステム**に戻ります

スプレッドシートや GAS は削除しないでください。

---

## 無料枠を止めない・バックアップ

- **週1回の自動確認**: `vercel.json` に月曜 3:00（UTC）の Cron を設定済み  
  → `/api/supabase-check` が呼ばれ、無料枠の「1週間放置で停止」を防ぎます
- **週次バックアップ**（推奨）:

```bash
cd visit-dental-app
npm run export:supabase
```

→ `export-data/日付/` に CSV が出ます。あわせてスプレッドシートも残してください。

---

## 開発者向け（エージェント用）

| 変更 | 場所 |
|------|------|
| 画面 | `gas-deploy/` |
| 保存・読み取り（新DB） | `visit-dental-app/lib/` |
| RPC 網羅確認 | `npm run check:rpc` |
| 件数突合 | `npm run compare:counts` |

実装済み RPC は GAS の allowlist **54 件すべて**です。
