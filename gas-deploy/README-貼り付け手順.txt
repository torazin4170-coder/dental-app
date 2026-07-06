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
