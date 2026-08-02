【訪問歯科カルテ】GAS への貼り付け（分割版・これで画面が開きます）

■ 用意するもの（このフォルダ内）
  1. UiShell.html      … 約 1KB（骨組みだけ）
  2. AppStyles.html    … CSS
  3. AppBody.html      … 画面の HTML
  4. AppScript.html    … JavaScript

■ Main.gs
  Cursor の「AppsScript-Main-差し替え用.gs」を GAS の Main.gs に全文コピー。
  Ctrl+F で「BUILD_WEBAPP_HTML_V6」が見つかること。

■ クラウド AI（Gemini）
  本ツールはクラウド AI を使用しません。GEMINI-設定手順.txt を参照（キー不要）。

■ GAS への追加手順
  1. script.google.com → プロジェクトを開く
  2. 左の「＋」→ HTML → 名前を「UiShell」→ UiShell.html の全文を貼る → 保存
  3. 同様に HTML を追加：AppStyles / AppBody / AppScript（各ファイル全文）
  4. Main.gs を貼り直して保存
  5. 関数 testWebAppHtmlBuild を実行 →「V6 OK」と出ること
  ※ UiShell だけ差し替え直す場合：gas-deploy/UiShell.html を GAS の UiShell に上書き
  6. デプロイ → 新バージョン
  7. スマホ・PCでカルテを開き直す（古い画面が残るときはブラウザの更新／タブを閉じて開き直す）

※ UiShell のキャッシュ名は v3 です。①FAXが古いままのときは UiShell も貼り替えてください。
※ 古い UiPage.html / Page.html は残しても構いませんが、使うのは UiShell 方式です。
※ データはスプレッドシートにあります。diagnoseDataConnection で患者件数を確認できます。

■ Vercel 版（段階1・任意）
  フロントを Vercel に載せる場合は visit-dental-app/README.md を参照。
  UI の正は引き続き gas-deploy/。Vercel は git push で自動反映。
  API 用に Main.gs に doPost（RPC_ALLOWLIST_）が必要。GAS を新バージョンで再デプロイし、
  Vercel の環境変数 GAS_WEBAPP_URL に /exec URL を設定してください。

■ 速度改善版（2026-08）— Main.gs 必須
  帳票プレビューの一括取得 API が追加されています。Vercel だけ更新しても
  ④月次（五香）は旧 GAS だと並列フォールバック程度の改善にとどまります。
  フル効果には Main.gs（AppsScript-Main-差し替え用.gs）の反映が必要です。

  追加 RPC（RPC_ALLOWLIST_ に含まれていること）:
    - getFacilityMonthlyCareReportData  … ④月次報告（全患者を1回で取得）
    - getFaxDailyBatchData              … ①FAX日報（全施設を1回で取得）
    - getOfpiFormData                   … ⑨口腔機能精密（歯式＋履歴を1回で取得）

  反映手順:
    1. AppsScript-Main-差し替え用.gs → Main.gs 全文上書き → 保存
    2. AppScript.html → GAS の AppScript に上書き（gas-deploy から）
    3. testWebAppHtmlBuild 実行 →「V6 OK」
    4. デプロイ → 新バージョン
    5. git push（Vercel 本番）→ https://dental-app-liart-five.vercel.app/api/gas-check が ok
    6. カルテを開き直し → ④「下書きを再生成」で体感確認

  プロジェクト ID: 1h1GWK76q79j3aGeMsXfwTsrIeks9pNjADGQPIoHBzxGbJ-O9FRxBeQi5
  （clasp 利用時: gas-clasp/ から clasp push → 上記 ID のプロジェクト）
