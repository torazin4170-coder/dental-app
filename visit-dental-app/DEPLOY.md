# 訪問歯科カルテ — デプロイの考え方（手間を減らす）

## 結論（いちばん大事）

| 変更内容 | やること | GAS 手貼り | Vercel URL 変更 |
|----------|----------|------------|-----------------|
| **画面だけ**（`gas-deploy/`） | `git push github main` | **不要** | **不要** |
| **Main.gs だけ** | GAS で新バージョンデプロイ | Main.gs のみ | **通常不要**※ |
| **画面 + Main.gs** | push + GAS デプロイ | Main.gs のみ | 通常不要 |

※ **同じウェブアプリ**の行を ✏️ 編集 → **新バージョン**で再デプロイすれば、`/exec` URL は **ほぼ変わりません**。  
新しいウェブアプリを **別途追加**したときだけ、Vercel の `GAS_WEBAPP_URL` を更新します。

---

## Vercel 版で修正依頼したあと（Cursor 作業後）

```bash
cd d:\ADS\personal-visual-explainers
node scripts/what-to-deploy.mjs   # 何をすべきか自動表示
git push github main              # UI 変更ならこれだけ
```

1〜3 分後、Vercel が自動ビルド。Production URL を Ctrl+Shift+R で開き直す。

**GAS デプロイ → Vercel 貼り替え → Redeploy は UI 変更では不要です。**

---

## 接続が壊れたとき（30秒診断）

ブラウザで開く:

```
（Production URL）/api/gas-check
```

| 結果 | 意味 |
|------|------|
| `"ok":true` | 正常。カルテを強制再読み込み |
| `"ok":false` | 下記「復旧手順」 |

アプリ内: **設定 → 設定タブ** の「接続状態」でも確認できます。

---

## 復旧手順（接続エラー時のみ）

1. GAS → デプロイを管理 → ウェブアプリの **/exec URL** をコピー
2. Vercel → Settings → Environment Variables → `GAS_WEBAPP_URL` の **Value** に貼る
3. Deployments → **Redeploy**
4. `/api/gas-check` が OK になるまで確認

Main.gs に `doGet` の `rpc=1` と `doPost` があること（`AppsScript-Main-差し替え用.gs` 全文）。

---

## 自動チェック（任意）

### ローカル

```bash
cd visit-dental-app
# .env.local に GAS_WEBAPP_URL=...
npm run verify:gas
```

### GitHub Actions（初回だけ設定）

リポジトリ Settings → Secrets:

| Secret | 値 |
|--------|-----|
| `VERCEL_PRODUCTION_URL` | `https://（Visit の URL・末尾スラッシュなし）` |

`main` に push すると `/api/gas-check` を自動実行。失敗時メール通知（GitHub 設定による）。

---

## よくある誤解

- ❌ `dental-app.vercel.app` … 別プロジェクト。Visit の URL を使う
- ❌ UI を直すたび GAS に HTML を貼る … Vercel 版では不要
- ❌ Main.gs を直すたび Vercel URL を変える … 同じウェブアプリ更新なら不要
