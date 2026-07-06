/**
 * ============================================================
 *  【致命・よくある誤り】このファイル（.gs の JavaScript）を Page.html に貼らないでください。
 *  貼るとウェブアプリ起動時に例外「形式が正しくない HTML コンテンツ」と、
 *  このコメントや const SS_ID = ... などの先頭がエラー文に混ざり、アプリが開けません。
 *  Page.html には必ず「Page-差し替え用.html」からコピーした <!DOCTYPE html> から始まる HTML のみを貼ります。
 * ------------------------------------------------------------
 *  【手順1・Main.gs を全文で上書きするとき】
 *  1. このファイルを Cursor で開く → Ctrl+A → Ctrl+C（すべてコピー）
 *  2. script.google.com → 該当プロジェクト → 左の「Main.gs」を開く
 *  3. Main.gs の中身を Ctrl+A → Ctrl+V（このファイルの内容で全部置き換え）
 *  4. Ctrl+S で保存
 *  5. デプロイ → デプロイを管理 → ウェブアプリ → 編集 → バージョン「新バージョン」→ デプロイ
 *  ※ Page.html はこのファイルに含まれません。手順2で直した Page.html はそのまま。
 *  ※ 以前 Main.gs にだけ書いた独自の変更は消えます。必要なら貼る前に Main.gs をバックアップ。
 * ============================================================
 *  訪問歯科カルテ & 書類自動化ツール — Google Apps Script
 *  Main.gs 用（バックエンド全機能・元 Code.gs と同内容）
 *  ※ GAS で Ctrl+F → BUILD_WEBAPP_HTML_V6 が見つかれば最新版です
 *  ※ 画面用 HTML は gas-deploy フォルダの 4 ファイル（UiShell 等）を GAS に追加
 *  ※ クラウド AI（Gemini 等）は使用しません。GEMINI_API_KEY は不要です。
 * ============================================================
 *  【スプレッドシート構成】（setupSheets で一括作成）
 *   - patients         : 患者マスター（coverage_type=帳票用保険区分 等）
 *   - facilities       : 施設マスター
 *   - treatments       : 診療記録（visit_time_start / visit_time_end = 任意・月報用）
 *   - teeth_data       : 歯式データ（JSON）
 *   - patient_medical  : 既往・服薬・アレルギー・要介護度など
 *   - photos           : 写真メタデータ（実体はDrive）
 *   - settings             : システム設定・カスタム病名/薬名マスタ
 *   - generated_documents  : 確定保存した帳票の索引（本文はDrive）
 * ============================================================
 */

// ─────────────────────────────────────────
//  定数
// ─────────────────────────────────────────
const SS_ID = PropertiesService.getScriptProperties().getProperty("SS_ID");

function getSheet(name) {
  if (!SS_ID) {
    throw new Error("データ用スプレッドシート（SS_ID）が未設定です。GASで diagnoseDataConnection を実行し、registerSpreadsheetId または setSpreadsheetIdManual で接続してください。");
  }
  return SpreadsheetApp.openById(SS_ID).getSheetByName(name);
}

/** スプレッドシート URL または ID から ID 部分だけ取り出す */
function extractSpreadsheetId_(raw) {
  var s = String(raw || "").trim();
  if (!s) return "";
  var m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(s)) return s;
  return "";
}

/**
 * データ接続の診断（関数一覧に無くてもエディタで diagnoseDataConnection を選んで実行）
 * 患者0件＝別プロジェクト／別スプレッドシートを見ている可能性大
 */
function diagnoseDataConnection() {
  var ssId = PropertiesService.getScriptProperties().getProperty("SS_ID");
  var lines = [];
  lines.push("【データ接続診断】");
  if (!ssId) {
    lines.push("SS_ID: 未設定（これがデータが空に見える主な原因です）");
    lines.push("");
    lines.push("復旧手順:");
    lines.push("1) 以前使っていた Google スプレッドシートを Drive で開く");
    lines.push("2) URL の /d/ と /edit の間の文字列がスプレッドシートID");
    lines.push("3) setSpreadsheetIdManual を実行し、そのIDを入力");
    lines.push("または patients シートがあるブックを開き registerSpreadsheetId を実行");
  } else {
    lines.push("SS_ID: " + ssId);
    try {
      var ss = SpreadsheetApp.openById(ssId);
      lines.push("ブック名: " + ss.getName());
      lines.push("URL: " + ss.getUrl());
      var names = ["patients", "facilities", "treatments", "settings"];
      names.forEach(function (nm) {
        var sh = ss.getSheetByName(nm);
        var n = sh ? Math.max(0, sh.getLastRow() - 1) : 0;
        lines.push("  " + nm + " データ行(概算): " + n);
      });
    } catch (e) {
      lines.push("スプレッドシートを開けません: " + (e && e.message ? e.message : e));
      lines.push("SS_ID が間違っているか、権限がありません。");
    }
  }
  var text = lines.join("\n");
  Logger.log(text);
  try {
    SpreadsheetApp.getUi().alert("データ接続診断", text, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (uiErr) {}
  return text;
}

/** いま開いているスプレッドシートをデータ元に登録（ブックから拡張機能→Apps Script で実行） */
function registerSpreadsheetId() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error("スプレッドシートを開いた状態で実行してください");
  }
  PropertiesService.getScriptProperties().setProperty("SS_ID", ss.getId());
  return diagnoseDataConnection();
}

/** スタンドアロン GAS 用：ID をダイアログで登録 */
function setSpreadsheetIdManual() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.prompt(
    "スプレッドシートIDの登録",
    "データが入っているスプレッドシートのURL、または /d/ と /edit の間のIDを貼り付け",
    ui.ButtonSet.OK_CANCEL
  );
  if (resp.getSelectedButton() !== ui.Button.OK) return "キャンセルしました";
  var id = extractSpreadsheetId_(resp.getResponseText());
  if (!id) throw new Error("IDを認識できませんでした");
  PropertiesService.getScriptProperties().setProperty("SS_ID", id);
  return diagnoseDataConnection();
}

/** patients シートに birth_date 列が無ければ右端に追加（既存ブック向け） */
function ensurePatientsBirthColumn_(sh) {
  const nc = sh.getLastColumn();
  if (nc < 1) return;
  const headers = sh.getRange(1, 1, 1, nc).getValues()[0];
  if (headers.indexOf("birth_date") !== -1) return;
  sh.insertColumnAfter(nc);
  const c = nc + 1;
  sh.getRange(1, c).setValue("birth_date");
  sh.getRange(1, c).setFontWeight("bold").setBackground("#1e3a5f").setFontColor("white").setHorizontalAlignment("center");
  sh.setColumnWidth(c, 110);
}

/** patients シートに notes 列が無ければ created_at の直後に追加（既存ブック向け・setupSheets の列順に合わせる） */
function ensurePatientsNotesColumn_(sh) {
  const nc = sh.getLastColumn();
  if (nc < 1) return;
  const headers = sh.getRange(1, 1, 1, nc).getValues()[0].map(function (h) {
    return String(h || "").trim();
  });
  if (headers.indexOf("notes") !== -1) return;
  const createdIdx = headers.indexOf("created_at");
  var c;
  if (createdIdx !== -1) {
    sh.insertColumnAfter(createdIdx + 1);
    c = createdIdx + 2;
  } else {
    sh.insertColumnAfter(nc);
    c = nc + 1;
  }
  sh.getRange(1, c).setValue("notes");
  sh.getRange(1, c).setFontWeight("bold").setBackground("#1e3a5f").setFontColor("white").setHorizontalAlignment("center");
  sh.setColumnWidth(c, 200);
}

/** patients シートに coverage_type 列（帳票用・保険区分）が無ければ右端に追加 */
function ensurePatientsCoverageColumn_(sh) {
  const nc = sh.getLastColumn();
  if (nc < 1) return;
  const headers = sh.getRange(1, 1, 1, nc).getValues()[0];
  if (headers.indexOf("coverage_type") !== -1) return;
  sh.insertColumnAfter(nc);
  const c = nc + 1;
  sh.getRange(1, c).setValue("coverage_type");
  sh.getRange(1, c).setFontWeight("bold").setBackground("#1e3a5f").setFontColor("white").setHorizontalAlignment("center");
  sh.setColumnWidth(c, 130);
}

/** 性別保存値の正規化（男 / 女 / 空） */
function normalizePatientGenderForSheet_(v) {
  var s = String(v != null ? v : "").trim();
  if (s === "男" || s === "男性" || s === "M" || s === "m" || s === "male") return "男";
  if (s === "女" || s === "女性" || s === "F" || s === "f" || s === "female") return "女";
  return "";
}

/** patients シートに gender 列が無ければ age の直後に追加（既存ブック向け） */
function ensurePatientsGenderColumn_(sh) {
  const nc = sh.getLastColumn();
  if (nc < 1) return;
  const headers = sh.getRange(1, 1, 1, nc).getValues()[0].map(function (h) {
    return String(h || "").trim();
  });
  if (headers.indexOf("gender") !== -1) return;
  const ageIdx = headers.indexOf("age");
  var c;
  if (ageIdx !== -1) {
    sh.insertColumnAfter(ageIdx + 1);
    c = ageIdx + 2;
  } else {
    sh.insertColumnAfter(nc);
    c = nc + 1;
  }
  sh.getRange(1, c).setValue("gender");
  sh.getRange(1, c).setFontWeight("bold").setBackground("#1e3a5f").setFontColor("white").setHorizontalAlignment("center");
  sh.setColumnWidth(c, 48);
  sh.getRange(1, c).setNote("男 / 女（検診票に自動反映）");
}

/** intake_stage 保存値の正規化（旧2値は無料検診1カテゴリーへ統合） */
function normalizeIntakeStageForSheet_(v) {
  var s = String(v != null ? v : "").trim();
  if (s === "kentai_target" || s === "kentai_done_waiting") return "musho_kenshin";
  return s;
}

/**
 * patients に intake_stage（無料検診フロー用）列を確保。
 * 空または standard=通常、musho_kenshin=無料検診（旧 kentai_target / kentai_done_waiting はデータ上 musho_kenshin に統合）
 */
function ensurePatientsIntakeStageColumn_(sh) {
  const nc = sh.getLastColumn();
  if (nc < 1) return;
  const headers = sh.getRange(1, 1, 1, nc).getValues()[0].map(function (h) {
    return String(h || "").trim();
  });
  var c = headers.indexOf("intake_stage") + 1;
  if (c < 1) {
    sh.insertColumnAfter(nc);
    c = nc + 1;
    sh.getRange(1, c).setValue("intake_stage");
    sh.getRange(1, c).setFontWeight("bold").setBackground("#1e3a5f").setFontColor("white").setHorizontalAlignment("center");
    sh.setColumnWidth(c, 140);
  }
  sh.getRange(1, c).setNote("空または standard=通常 / musho_kenshin=無料検診（旧2値は開くたびに musho_kenshin へ置換）");
  const lastRow = sh.getLastRow();
  if (lastRow > 1) {
    const rg = sh.getRange(2, c, lastRow, c);
    const vals = rg.getValues();
    for (var i = 0; i < vals.length; i++) {
      var cell = String(vals[i][0] != null ? vals[i][0] : "").trim();
      if (cell === "kentai_target" || cell === "kentai_done_waiting") vals[i][0] = "musho_kenshin";
    }
    rg.setValues(vals);
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(["", "standard", "musho_kenshin"], true)
      .build();
    rg.setDataValidation(rule);
  }
}

/** patients に in_hospital（入院中ラベル用：1 または空）列を確保 */
function ensurePatientsInHospitalColumn_(sh) {
  const nc = sh.getLastColumn();
  if (nc < 1) return;
  const headers = sh.getRange(1, 1, 1, nc).getValues()[0].map(function (h) {
    return String(h || "").trim();
  });
  if (headers.indexOf("in_hospital") !== -1) return;
  sh.insertColumnAfter(nc);
  const c = nc + 1;
  sh.getRange(1, c).setValue("in_hospital");
  sh.getRange(1, c).setFontWeight("bold").setBackground("#1e3a5f").setFontColor("white").setHorizontalAlignment("center");
  sh.setColumnWidth(c, 72);
  sh.getRange(1, c).setNote("1=入院中（患者リストにラベル表示）／空=通常");
}

/** patients に assigned_doctor（稲毛など・担当ドクター区分 1/2/3）列を確保 */
function ensurePatientsAssignedDoctorColumn_(sh) {
  const nc = sh.getLastColumn();
  if (nc < 1) return;
  const headers = sh.getRange(1, 1, 1, nc).getValues()[0].map(function (h) {
    return String(h || "").trim();
  });
  if (headers.indexOf("assigned_doctor") !== -1) return;
  sh.insertColumnAfter(nc);
  const c = nc + 1;
  sh.getRange(1, c).setValue("assigned_doctor");
  sh.getRange(1, c).setFontWeight("bold").setBackground("#1e3a5f").setFontColor("white").setHorizontalAlignment("center");
  sh.setColumnWidth(c, 110);
  sh.getRange(1, c).setNote("施設名にサニーライフ稲毛を含む施設向け：担当 1 / 2 / 3（空は未設定）");
}

/** patients に address（診断書等の住所）列を確保 */
function ensurePatientsAddressColumn_(sh) {
  const nc = sh.getLastColumn();
  if (nc < 1) return;
  const headers = sh.getRange(1, 1, 1, nc).getValues()[0].map(function (h) {
    return String(h || "").trim();
  });
  if (headers.indexOf("address") !== -1) return;
  sh.insertColumnAfter(nc);
  const c = nc + 1;
  sh.getRange(1, c).setValue("address");
  sh.getRange(1, c).setFontWeight("bold").setBackground("#1e3a5f").setFontColor("white").setHorizontalAlignment("center");
  sh.setColumnWidth(c, 220);
  sh.getRange(1, c).setNote("患者住所（診断書など。任意）");
}

/** patients に monthly_visit_limit（月の受診回数上限・空は制限なし）列を確保 */
function ensurePatientsMonthlyVisitLimitColumn_(sh) {
  const nc = sh.getLastColumn();
  if (nc < 1) return;
  const headers = sh.getRange(1, 1, 1, nc).getValues()[0].map(function (h) {
    return String(h || "").trim();
  });
  if (headers.indexOf("monthly_visit_limit") !== -1) return;
  sh.insertColumnAfter(nc);
  const c = nc + 1;
  sh.getRange(1, c).setValue("monthly_visit_limit");
  sh.getRange(1, c).setFontWeight("bold").setBackground("#1e3a5f").setFontColor("white").setHorizontalAlignment("center");
  sh.setColumnWidth(c, 100);
  sh.getRange(1, c).setNote("月の受診回数上限（例: 2）。空=制限なし。帳票・リストのタグ表示に使用");
}

/** treatments に visit_date 列が無ければ右端に追加 */
function ensureTreatmentVisitDateColumn_(sh) {
  const nc = sh.getLastColumn();
  if (nc < 1) return;
  const headers = sh.getRange(1, 1, 1, nc).getValues()[0].map(function (h) {
    return String(h || "").trim();
  });
  if (headers.indexOf("visit_date") !== -1) return;
  sh.insertColumnAfter(nc);
  const c = nc + 1;
  sh.getRange(1, c).setValue("visit_date");
  sh.getRange(1, c).setFontWeight("bold").setBackground("#1e3a5f").setFontColor("white").setHorizontalAlignment("center");
  sh.getRange(1, c).setNote("診療日（yyyy-MM-dd・履歴・カレンダー用）");
  sh.setColumnWidth(c, 90);
}

function ensureTreatmentNotesTonesColumn_(sh) {
  const nc = sh.getLastColumn();
  if (nc < 1) return;
  const headers = sh.getRange(1, 1, 1, nc).getValues()[0].map(function (h) {
    return String(h || "").trim();
  });
  if (headers.indexOf("notes_tones") !== -1) return;
  sh.insertColumnAfter(nc);
  const c = nc + 1;
  sh.getRange(1, c).setValue("notes_tones");
  sh.getRange(1, c).setFontWeight("bold").setBackground("#1e3a5f").setFontColor("white").setHorizontalAlignment("center");
  sh.getRange(1, c).setNote("所見トーン：stable,change,observe をカンマ区切り（報告書生成用）");
  sh.setColumnWidth(c, 140);
}

/** treatments に診療時間列（月報・居宅向け）が無ければ右端に追加 */
function ensureTreatmentTimeColumns_(sh) {
  ensureTreatmentVisitDateColumn_(sh);
  ensureTreatmentNotesTonesColumn_(sh);
  function headerNames_() {
    const nc = sh.getLastColumn();
    if (nc < 1) return [];
    return sh.getRange(1, 1, 1, nc).getValues()[0].map(function (h) {
      return String(h || "").trim();
    });
  }
  function has_(names, key) {
    return names.indexOf(key) !== -1;
  }
  let names = headerNames_();
  if (!names.length) return;
  if (!has_(names, "visit_time_start")) {
    const nc = sh.getLastColumn();
    sh.insertColumnAfter(nc);
    const c = nc + 1;
    sh.getRange(1, c).setValue("visit_time_start");
    sh.getRange(1, c).setFontWeight("bold").setBackground("#1e3a5f").setFontColor("white").setHorizontalAlignment("center");
    sh.getRange(1, c).setNote("診療開始時刻（HH:mm・任意・月報用）");
    sh.setColumnWidth(c, 82);
    names = headerNames_();
  }
  if (!has_(names, "visit_time_end")) {
    const nc2 = sh.getLastColumn();
    sh.insertColumnAfter(nc2);
    const c2 = nc2 + 1;
    sh.getRange(1, c2).setValue("visit_time_end");
    sh.getRange(1, c2).setFontWeight("bold").setBackground("#1e3a5f").setFontColor("white").setHorizontalAlignment("center");
    sh.getRange(1, c2).setNote("診療終了時刻（HH:mm・任意・月報用）");
    sh.setColumnWidth(c2, 82);
  }
  ensureTreatmentExamDataColumn_(sh);
}

/** treatments に exam_data 列（定期検査 JSON）が無ければ右端に追加 */
function ensureTreatmentExamDataColumn_(sh) {
  const nc = sh.getLastColumn();
  if (nc < 1) return;
  const headers = sh.getRange(1, 1, 1, nc).getValues()[0].map(function (h) {
    return String(h || "").trim();
  });
  if (headers.indexOf("exam_data") !== -1) return;
  sh.insertColumnAfter(nc);
  const c = nc + 1;
  sh.getRange(1, c).setValue("exam_data");
  sh.getRange(1, c).setFontWeight("bold").setBackground("#1e3a5f").setFontColor("white").setHorizontalAlignment("center");
  sh.getRange(1, c).setNote("定期検査JSON（舌圧・湿潤度・F局歯番号）");
  sh.setColumnWidth(c, 220);
}

/** スプレッドシートの時刻セル・文字列を HH:mm 表示用に正規化 */
function formatTimeValueForClient_(v) {
  if (v == null || v === "") return "";
  if (Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v.getTime())) {
    return Utilities.formatDate(v, "JST", "HH:mm");
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) {
    const h = parseInt(m[1], 10);
    const mi = parseInt(m[2], 10);
    if (h >= 0 && h <= 23 && mi >= 0 && mi <= 59) {
      const pad = function (n) { return n < 10 ? "0" + n : String(n); };
      return pad(h) + ":" + pad(mi);
    }
  }
  return s.length >= 5 ? s.slice(0, 5) : s;
}

function normalizeTreatmentTimesForClient_(t) {
  const o = {};
  Object.keys(t).forEach(function (k) { o[k] = t[k]; });
  o.visit_time_start = formatTimeValueForClient_(t.visit_time_start);
  o.visit_time_end = formatTimeValueForClient_(t.visit_time_end);
  var vd = visitDateYMD_(t.visit_date);
  if (vd) o.visit_date = vd;
  if (t.next_date != null && String(t.next_date).trim() !== "") {
    var nd = visitDateYMD_(t.next_date);
    if (nd) o.next_date = nd;
  }
  return o;
}

// ─────────────────────────────────────────
//  Web App エントリポイント
// ─────────────────────────────────────────
// 手順 A のみ: PWA_ICON_URL = https で始まる画像の直リンク（例: GitHub raw）。
// 注意: HtmlService は HTML 内の <link rel="icon|manifest|apple-touch-icon"> を無視する。
//       ファビコンは setFaviconUrl、manifest は Page 先頭のスクリプトで head に追加する。
function getPwaIconUrl_() {
  var url = String(PropertiesService.getScriptProperties().getProperty("PWA_ICON_URL") || "").trim();
  return url.indexOf("https://") === 0 ? url : "";
}

function getWebAppBaseUrl_() {
  try {
    return String(ScriptApp.getService().getUrl() || "").replace(/\?.*$/, "");
  } catch (err) {
    return "";
  }
}

/** manifest の scope（未指定だと ?manifest=1 の解釈で start_url と不整合になり得る） */
function getManifestScope_(base) {
  var b = String(base || "").replace(/\?.*$/, "");
  if (!b) return "./";
  if (/\/exec$/i.test(b)) return b.replace(/\/exec$/i, "/");
  var i = b.lastIndexOf("/");
  return i > 8 ? b.slice(0, i + 1) : b + "/";
}

/**
 * Drive 画像をウェブアプリ経由で返す（<img> 用）。
 * Drive の直リンクはログイン・ウイルススキャン等で表示されないことがあるため、
 * デプロイ「実行ユーザー」の Drive 権限で Blob を返す。
 * 例: …/exec?driveimg=ファイルID
 */
function driveImageResponse_(fileId, debug) {
  var id = String(fileId || "").trim();
  if (!id) {
    return HtmlService.createHtmlOutput("bad request");
  }
  try {
    var file = DriveApp.getFileById(id);
    var blob = file.getBlob();
    var mt = blob.getContentType();
    if (!mt || mt.indexOf("image/") !== 0) {
      mt = "image/jpeg";
    }
    return ContentService.createBlobOutput(blob).setMimeType(mt);
  } catch (err) {
    var msg = String(err && err.message ? err.message : err);
    Logger.log("driveImageResponse_ id=" + id + " :: " + msg);
    if (debug) {
      return ContentService.createTextOutput("driveimg error: " + msg)
        .setMimeType(ContentService.MimeType.PLAIN_TEXT);
    }
    return HtmlService.createHtmlOutput("not found");
  }
}

function manifestJsonResponse_() {
  var base = getWebAppBaseUrl_();
  var icon = getPwaIconUrl_();
  var o = {
    name: "訪問歯科カルテ",
    short_name: "訪問歯科",
    id: base || undefined,
    start_url: base || "./",
    scope: getManifestScope_(base),
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#2563eb",
    orientation: "portrait-primary"
  };
  if (icon) {
    o.icons = [
      { src: icon, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: icon, sizes: "512x512", type: "image/png", purpose: "any" }
    ];
  }
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}

/** HTML ファイル先頭を取得（無い・読めないとき null） */
function peekHtmlFileHead_(fileName) {
  try {
    var raw = HtmlService.createTemplateFromFile(fileName).getRawContent();
    return String(raw).replace(/^\uFEFF/, "").trim().slice(0, 160);
  } catch (e1) {
    try {
      var raw2 = HtmlService.createHtmlOutputFromFile(fileName).getContent();
      return String(raw2).replace(/^\uFEFF/, "").trim().slice(0, 160);
    } catch (e2) {
      return null;
    }
  }
}

/** 画面用 HTML か（Main.gs 誤貼り・CSSだけの途中貼り付けは false） */
function htmlFileLooksValid_(head) {
  if (!head) return false;
  if (/^\/\*\*|^\s*(:root|const\s+SS_ID)/m.test(head)) return false;
  return /^(<!DOCTYPE|<html)/i.test(head);
}

/** DOCTYPE より前の HTML コメントを除去（GAS が弾くことがある） */
function normalizeWebAppHtmlRaw_(raw) {
  var s = String(raw).replace(/^\uFEFF/, "");
  while (/^\s*<!--/.test(s)) {
    s = s.replace(/^\s*<!--[\s\S]*?-->\s*/, "");
  }
  return s.trim();
}

/** 分割 HTML（UiShell）を最優先。無いときだけ従来の UiPage / Page */
function getWebAppHtmlTemplateName_() {
  if (peekHtmlFileHead_("UiShell") !== null) return "UiShell";
  var uiHead = peekHtmlFileHead_("UiPage");
  if (htmlFileLooksValid_(uiHead)) return "UiPage";
  var pageHead = peekHtmlFileHead_("Page");
  if (htmlFileLooksValid_(pageHead)) return "Page";
  if (uiHead !== null) return "UiPage";
  return "Page";
}

/** 分割 HTML 断片（google.script.run で返す・GAS の HTML 検証を受けない） */
function getAppStylesContent() {
  return HtmlService.createTemplateFromFile("AppStyles").getRawContent();
}
function getAppBodyHtml() {
  return HtmlService.createTemplateFromFile("AppBody").getRawContent();
}
function getAppScriptContent() {
  return HtmlService.createTemplateFromFile("AppScript").getRawContent();
}

/** CSS+HTML+JS を1回で返す（起動時の google.script.run を3回→1回に） */
function getAppBundle() {
  return {
    v: 3,
    css: getAppStylesContent(),
    body: getAppBodyHtml(),
    script: getAppScriptContent()
  };
}

/**
 * スクリプトエディタで diagnosePageHtmlFiles を選んで「実行」。
 * Page.html / UiPage.html のどちらが正しいかダイアログで確認できます。
 */
function diagnosePageHtmlFiles() {
  var names = ["UiShell", "AppStyles", "AppBody", "AppScript", "UiPage", "Page"];
  var lines = [];
  for (var i = 0; i < names.length; i++) {
    var n = names[i];
    var h = peekHtmlFileHead_(n);
    if (h === null) {
      lines.push(n + ".html … なし（または読めません）");
    } else if (htmlFileLooksValid_(h)) {
      lines.push(n + ".html … OK（HTML）\n  " + h.split("\n")[0].slice(0, 70));
    } else {
      lines.push(n + ".html … NG（Main.gs が入っている可能性）\n  " + h.split("\n")[0].slice(0, 70));
    }
  }
  lines.push("\nウェブアプリが使うファイル: " + getWebAppHtmlTemplateName_() + ".html");
  var text = lines.join("\n\n");
  Logger.log(text);
  try {
    SpreadsheetApp.getUi().alert("HTML ファイル診断", text, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (uiErr) {
    /* スプレッドシート未連携時は Logger のみ */
  }
  return text;
}

/** PWA 用 head 注入（evaluate せず文字列差し替えで使う） */
function buildPwaHeadInjectionScripts_() {
  var base = getWebAppBaseUrl_();
  var icon = getPwaIconUrl_();
  var mh = base ? base + "?manifest=1" : "";
  var manifestScript = "";
  if (mh) {
    var m = Utilities.base64Encode(mh, Utilities.Charset.UTF_8);
    manifestScript =
      "<script>(function(){try{var m=atob('" + m + "');var l=document.createElement('link');" +
      "l.rel='manifest';l.href=m;l.crossOrigin='anonymous';" +
      "(document.head||document.documentElement).appendChild(l);}catch(e){}})();</script>";
  }
  var iconScript = "";
  if (icon) {
    var u = Utilities.base64Encode(icon, Utilities.Charset.UTF_8);
    iconScript =
      "<script>(function(){try{var u=atob('" + u + "');var l=document.createElement('link');" +
      "l.rel='apple-touch-icon';l.href=u;" +
      "(document.head||document.documentElement).appendChild(l);}catch(e){}})();</script>";
  }
  return { manifestScript: manifestScript, iconScript: iconScript };
}

/** BUILD_WEBAPP_HTML_V6 — この文字列が Main.gs に無い場合は Main.gs が古いです */
/**
 * UiShell は小さな起動ページのみ配信。CSS/HTML/JS は getApp* でクライアントへ渡す。
 */
function buildWebAppHtmlOutput_(tplName) {
  var inj = buildPwaHeadInjectionScripts_();
  var out = HtmlService.createHtmlOutputFromFile("UiShell")
    .setTitle("訪問歯科カルテ")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag("viewport", "width=device-width, initial-scale=1, viewport-fit=cover");
  if (inj.manifestScript) {
    out.append(inj.manifestScript);
  }
  if (inj.iconScript) {
    out.append(inj.iconScript);
  }
  var icon = getPwaIconUrl_();
  if (icon) {
    out.setFaviconUrl(icon);
  }
  return out;
}

/** Main.gs が最新か（関数一覧に無くてもエディタで実行できる） */
function checkMainGsIsLatest_() {
  var ok = typeof buildWebAppHtmlOutput_ === "function";
  var msg = ok
    ? "Main.gs は最新版です（buildWebAppHtmlOutput_ あり）。BUILD_WEBAPP_HTML_V3 も確認してください。"
    : "Main.gs が古いです。AppsScript-Main-差し替え用.gs を Main.gs に全文コピーして保存してください。";
  Logger.log(msg);
  try {
    SpreadsheetApp.getUi().alert("Main.gs バージョン確認", msg, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (uiErr) {}
  return msg;
}

/** エディタから実行：HTML 組み立てが通るか確認（数秒で終わる・ダイアログは出さない） */
function testWebAppHtmlBuild_() {
  if (peekHtmlFileHead_("UiShell") === null) {
    throw new Error("UiShell.html がありません。gas-deploy フォルダの4ファイルを GAS に HTML として追加してください。");
  }
  var t0 = Date.now();
  var bundle = getAppBundle();
  var cssLen = String(bundle.css).length;
  var bodyLen = String(bundle.body).length;
  var jsLen = String(bundle.script).length;
  var bodyStr = String(bundle.body || "");
  var scriptStr = String(bundle.script || "");
  if (bodyLen < 50000 || jsLen < 100000) {
    throw new Error("AppBody/AppScript が短すぎます。全文貼り付けを確認してください。");
  }
  if (typeof getAppBundle !== "function") {
    throw new Error("getAppBundle がありません。Main.gs を最新版に貼り直してください。");
  }
  var hasPsBtn = bodyStr.indexOf("施設月次報告書") >= 0;
  var hasPsFn = scriptStr.indexOf("buildPersonalSheetGridDocumentHtml_") >= 0;
  var hasPsApi = typeof getFacilityClinicalMonthlyReportData === "function";
  var warn = [];
  if (!hasPsBtn) warn.push("AppBody に「施設月次報告書」がありません（⑥ボタン未更新）");
  if (!hasPsFn) warn.push("AppScript に buildPersonalSheetGridDocumentHtml_ がありません");
  if (!hasPsApi) warn.push("Main.gs に getFacilityClinicalMonthlyReportData がありません");
  var ms = Date.now() - t0;
  var msg = "V8 OK・1回取得（CSS " + cssLen + " / Body " + bodyLen + " / JS " + jsLen + " 文字・" + ms + " ms）";
  if (warn.length) msg += "\n※要確認: " + warn.join(" / ");
  else msg += "\n⑥ 施設月次報告書 … OK";
  Logger.log(msg);
  return msg;
}

/** 関数一覧用エイリアス */
function testWebAppHtmlBuild() {
  return testWebAppHtmlBuild_();
}

function htmlFileDiagSnippet_(fileName) {
  var h = peekHtmlFileHead_(fileName);
  if (h === null) return fileName + ".html … 読めません";
  var ok = htmlFileLooksValid_(h);
  var line = (h.split("\n")[0] || h).slice(0, 80).replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return fileName + ".html … " + (ok ? "OK" : "NG") + "（先頭: " + line + "）";
}

/** Page.html に Main.gs を誤貼りしたときの案内ページ */
function pageMisconfigHtmlOutput_(detail, triedName) {
  var head = String(detail || "").slice(0, 120).replace(/</g, "&lt;").replace(/>/g, "&gt;");
  var tried = String(triedName || getWebAppHtmlTemplateName_());
  var html =
    "<!DOCTYPE html><html lang=\"ja\"><head><meta charset=\"UTF-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
    "<title>HTML の設定ミス</title></head>" +
    "<body style=\"font-family:'Hiragino Sans',Meiryo,sans-serif;padding:20px;max-width:560px;line-height:1.65;color:#1e293b\">" +
    "<h1 style=\"font-size:20px;color:#b91c1c;margin:0 0 12px\">HTML ファイルの中身が間違っています</h1>" +
    "<p>読み込もうとしたファイル: <strong>" + tried + ".html</strong></p>" +
    "<p><strong>UiShell.html</strong> と <strong>AppStyles / AppBody / AppScript</strong> の4ファイルが必要です（gas-deploy フォルダ）。Main.gs に <code>BUILD_WEBAPP_HTML_V5</code> を入れて <strong>新バージョンでデプロイ</strong> してください。</p>" +
    "<p><strong>データが空</strong>に見えるときは <code>SS_ID</code> 未設定です。GAS で <code>diagnoseDataConnection</code> → <code>setSpreadsheetIdManual</code> を実行してください（データは消えていないことが多いです）。</p>" +
    "<ol style=\"padding-left:1.2em;margin:0 0 16px\">" +
    "<li>Cursor で <strong>Page-差し替え用.html</strong> → Ctrl+A → Ctrl+C</li>" +
    "<li>GAS の <strong>UiPage.html</strong> と <strong>Page.html</strong> の両方に同じ内容を貼る（Ctrl+A→Ctrl+V）→ 保存</li>" +
    "<li><strong>Main.gs</strong> を AppsScript-Main-差し替え用.gs で上書き → 保存</li>" +
    "<li>デプロイ → <strong>新バージョン</strong></li>" +
    "</ol>" +
    "<p style=\"font-size:12px;background:#f1f5f9;padding:10px;border-radius:8px;margin:0 0 12px\">" +
    htmlFileDiagSnippet_("UiPage") + "<br>" + htmlFileDiagSnippet_("Page") +
    "</p>" +
    "<p style=\"font-size:13px;color:#64748b\">正しい先頭は <code>&lt;!DOCTYPE html&gt;</code> です（その前に長いコメントを置かない）。" +
    (head ? "<p style=\"font-size:12px;word-break:break-all;background:#fef2f2;padding:10px;border-radius:8px\">エラー詳細：<br>" + head + "</p>" : "") +
    "</body></html>";
  return HtmlService.createHtmlOutput(html).setTitle("HTML の設定ミス");
}

/** Vercel フロントから fetch 経由で呼べる RPC（doPost）。許可関数のみ実行 */
var RPC_ALLOWLIST_ = {
  getPatients: getPatients,
  addPatient: addPatient,
  updatePatient: updatePatient,
  updatePatientStatus: updatePatientStatus,
  deletePatient: deletePatient,
  getFacilities: getFacilities,
  addFacility: addFacility,
  updateFacility: updateFacility,
  deleteFacility: deleteFacility,
  getTreatmentsByPatient: getTreatmentsByPatient,
  getMonthlyRecords: getMonthlyRecords,
  saveTreatmentRecord: saveTreatmentRecord,
  updateTreatmentRecord: updateTreatmentRecord,
  deleteTreatmentRecord: deleteTreatmentRecord,
  getPatientMonthlyReportData: getPatientMonthlyReportData,
  getFacilityClinicalMonthlyReportData: getFacilityClinicalMonthlyReportData,
  getPatientPersonalSheetData: getPatientPersonalSheetData,
  getTeethData: getTeethData,
  saveTeethData: saveTeethData,
  getTeethDataHistory: getTeethDataHistory,
  getFacilityDailyReportData: getFacilityDailyReportData,
  getSupervisorDailyListData: getSupervisorDailyListData,
  getTreatmentsForFacilityDate: getTreatmentsForFacilityDate,
  appendFaxStyleMemory: appendFaxStyleMemory,
  generateFaxDailyFacilityComment: generateFaxDailyFacilityComment,
  getDashboardData: getDashboardData,
  getMedicalInfo: getMedicalInfo,
  saveMedicalInfo: saveMedicalInfo,
  getCustomMasterItems: getCustomMasterItems,
  addCustomMasterItem: addCustomMasterItem,
  savePhoto: savePhoto,
  getPhotos: getPhotos,
  deletePhoto: deletePhoto,
  getSettings: getSettings,
  saveSettings: saveSettings,
  saveReportPreviewDraftSimple: saveReportPreviewDraftSimple,
  saveReportPreviewDraftChunk: saveReportPreviewDraftChunk,
  saveReportPreviewDraftChunkFinish: saveReportPreviewDraftChunkFinish,
  loadReportPreviewDraftInfo: loadReportPreviewDraftInfo,
  loadReportPreviewDraftChunk: loadReportPreviewDraftChunk,
  clearReportPreviewDraft: clearReportPreviewDraft,
  saveGeneratedDocumentSimple: saveGeneratedDocumentSimple,
  saveGeneratedDocumentChunk: saveGeneratedDocumentChunk,
  saveGeneratedDocumentChunkFinish: saveGeneratedDocumentChunkFinish,
  listGeneratedDocuments: listGeneratedDocuments,
  loadGeneratedDocument: loadGeneratedDocument,
  loadGeneratedDocumentChunk: loadGeneratedDocumentChunk,
  deleteGeneratedDocument: deleteGeneratedDocument,
  getDiagnosisCertificateData: getDiagnosisCertificateData
};

function invokeRpc_(funcName, args) {
  var fn = RPC_ALLOWLIST_[funcName];
  if (!fn) {
    throw new Error("Unknown function: " + funcName);
  }
  var list = Array.isArray(args) ? args : [];
  return fn.apply(null, list);
}

function rpcJsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : "";
    if (!raw) {
      return rpcJsonOutput_({ ok: false, error: "Empty request body" });
    }
    var payload = JSON.parse(raw);
    var funcName = String(payload.func || "").trim();
    var args = payload.args;
    if (!funcName) {
      return rpcJsonOutput_({ ok: false, error: "Missing func" });
    }
    var result = invokeRpc_(funcName, args);
    return rpcJsonOutput_({ ok: true, result: result });
  } catch (err) {
    var msg = err && err.message ? String(err.message) : String(err);
    return rpcJsonOutput_({ ok: false, error: msg });
  }
}

function doGet(e) {
  var q = (e && e.parameter) || {};
  if (String(q.rpc || "") === "1") {
    return rpcJsonOutput_({ ok: false, error: "Use POST for RPC" });
  }
  if (String(q.manifest || "") === "1") {
    return manifestJsonResponse_();
  }
  var driveImgRaw = q.driveimg;
  if (Array.isArray(driveImgRaw)) {
    driveImgRaw = driveImgRaw[0];
  }
  var driveImg = String(driveImgRaw || "").trim();
  try {
    driveImg = decodeURIComponent(driveImg);
  } catch (decErr) {
    /* そのまま */
  }
  driveImg = String(driveImg || "").trim();
  if (driveImg) {
    return driveImageResponse_(driveImg, String(q.driveimgdebug || "") === "1");
  }
  var tplName = getWebAppHtmlTemplateName_();
  try {
    return buildWebAppHtmlOutput_(tplName);
  } catch (pageErr) {
    var msg = String(pageErr && pageErr.message ? pageErr.message : pageErr);
    if (msg.indexOf("形式が正しくない HTML") !== -1 || msg.indexOf("Invalid HTML") !== -1) {
      return pageMisconfigHtmlOutput_(msg, tplName);
    }
    throw pageErr;
  }
}

// ─────────────────────────────────────────
//  患者 CRUD
// ─────────────────────────────────────────

/**
 * 全患者を返す（任意でステータスフィルタ）
 * @param {string|null} statusFilter  "active"|"left"|"deceased"|null(全件)
 */
function getPatients(statusFilter) {
  const sh = getSheet("patients");
  ensurePatientsNotesColumn_(sh);
  ensurePatientsBirthColumn_(sh);
  ensurePatientsGenderColumn_(sh);
  ensurePatientsCoverageColumn_(sh);
  ensurePatientsIntakeStageColumn_(sh);
  ensurePatientsAssignedDoctorColumn_(sh);
  ensurePatientsInHospitalColumn_(sh);
  ensurePatientsMonthlyVisitLimitColumn_(sh);
  ensurePatientsAddressColumn_(sh);
  const rows = sh.getDataRange().getValues();
  const header = rows[0];
  const result = rows.slice(1)
    .map(r => rowToObj(header, r))
    .filter(p => !statusFilter || p.status === statusFilter);
  return JSON.stringify(result);
}

/**
 * 患者を追加する
 * @param {string} json  Patient オブジェクト (JSON文字列)
 */
function addPatient(json) {
  const p = JSON.parse(json);
  const sh = getSheet("patients");
  ensurePatientsNotesColumn_(sh);
  ensurePatientsBirthColumn_(sh);
  ensurePatientsGenderColumn_(sh);
  ensurePatientsCoverageColumn_(sh);
  ensurePatientsIntakeStageColumn_(sh);
  ensurePatientsAssignedDoctorColumn_(sh);
  ensurePatientsInHospitalColumn_(sh);
  ensurePatientsMonthlyVisitLimitColumn_(sh);
  ensurePatientsAddressColumn_(sh);
  const hdr = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const id = "P" + Utilities.formatDate(new Date(), "JST", "yyyyMMddHHmmss");
  const intake = normalizeIntakeStageForSheet_(
    p.intake_stage != null && String(p.intake_stage).trim() !== "" ? String(p.intake_stage).trim() : ""
  );
  const inHosp = p.in_hospital != null && String(p.in_hospital).trim() !== "" ? "1" : "";
  const base = {
    id: id,
    name: p.name,
    furi: p.furi || "",
    age: p.age != null && p.age !== "" ? p.age : "",
    gender: normalizePatientGenderForSheet_(p.gender),
    room: p.room || "",
    fac: p.fac,
    cm: p.cm || "",
    status: "active",
    created_at: new Date(),
    notes: p.notes || "",
    birth_date: p.birth_date || "",
    coverage_type: p.coverage_type != null ? String(p.coverage_type) : "",
    intake_stage: intake,
    assigned_doctor: p.assigned_doctor != null ? String(p.assigned_doctor).trim() : "",
    in_hospital: inHosp,
    monthly_visit_limit:
      p.monthly_visit_limit != null && String(p.monthly_visit_limit).trim() !== ""
        ? String(p.monthly_visit_limit).trim()
        : "",
    address: p.address != null ? String(p.address).trim() : ""
  };
  const row = hdr.map(function (h) {
    if (!h) return "";
    var k = String(h);
    return base[k] !== undefined ? base[k] : "";
  });
  sh.appendRow(row);
  return id;
}

/**
 * 患者情報を更新する
 * @param {string} json  id を含む Patient オブジェクト
 */
function updatePatient(json) {
  const p = JSON.parse(json);
  const sh = getSheet("patients");
  ensurePatientsNotesColumn_(sh);
  ensurePatientsBirthColumn_(sh);
  ensurePatientsGenderColumn_(sh);
  ensurePatientsCoverageColumn_(sh);
  ensurePatientsIntakeStageColumn_(sh);
  ensurePatientsAssignedDoctorColumn_(sh);
  ensurePatientsInHospitalColumn_(sh);
  ensurePatientsMonthlyVisitLimitColumn_(sh);
  ensurePatientsAddressColumn_(sh);
  const hdr = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const col = {};
  hdr.forEach(function (h, i) { if (h) col[String(h)] = i + 1; });
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === p.id) {
      var r = i + 1;
      if (col.name && p.name !== undefined) sh.getRange(r, col.name).setValue(p.name);
      if (col.furi && p.furi !== undefined) sh.getRange(r, col.furi).setValue(p.furi);
      if (col.age !== undefined && p.age !== undefined) sh.getRange(r, col.age).setValue(p.age);
      if (col.gender && p.gender !== undefined) sh.getRange(r, col.gender).setValue(normalizePatientGenderForSheet_(p.gender));
      if (col.room && p.room !== undefined) sh.getRange(r, col.room).setValue(p.room);
      if (col.fac && p.fac !== undefined) sh.getRange(r, col.fac).setValue(p.fac);
      if (col.cm && p.cm !== undefined) sh.getRange(r, col.cm).setValue(p.cm);
      if (col.status && p.status !== undefined) sh.getRange(r, col.status).setValue(p.status);
      if (col.birth_date && p.birth_date !== undefined) sh.getRange(r, col.birth_date).setValue(p.birth_date);
      if (col.coverage_type && p.coverage_type !== undefined) sh.getRange(r, col.coverage_type).setValue(p.coverage_type || "");
      if (col.intake_stage && p.intake_stage !== undefined) {
        sh.getRange(r, col.intake_stage).setValue(normalizeIntakeStageForSheet_(p.intake_stage));
      }
      if (col.notes && p.notes !== undefined) sh.getRange(r, col.notes).setValue(p.notes);
      if (col.assigned_doctor && p.assigned_doctor !== undefined) {
        sh.getRange(r, col.assigned_doctor).setValue(String(p.assigned_doctor || "").trim());
      }
      if (col.in_hospital && p.in_hospital !== undefined) {
        sh.getRange(r, col.in_hospital).setValue(String(p.in_hospital).trim() !== "" ? "1" : "");
      }
      if (col.monthly_visit_limit && p.monthly_visit_limit !== undefined) {
        sh.getRange(r, col.monthly_visit_limit).setValue(
          p.monthly_visit_limit != null && String(p.monthly_visit_limit).trim() !== ""
            ? String(p.monthly_visit_limit).trim()
            : ""
        );
      }
      if (col.address && p.address !== undefined) {
        sh.getRange(r, col.address).setValue(p.address != null ? String(p.address).trim() : "");
      }
      return "ok";
    }
  }
  return "not_found";
}

/** ステータスのみ更新（退去・逝去など）*/
function updatePatientStatus(id, status) {
  const sh = getSheet("patients");
  ensurePatientsNotesColumn_(sh);
  ensurePatientsBirthColumn_(sh);
  ensurePatientsGenderColumn_(sh);
  ensurePatientsCoverageColumn_(sh);
  ensurePatientsIntakeStageColumn_(sh);
  ensurePatientsAssignedDoctorColumn_(sh);
  ensurePatientsInHospitalColumn_(sh);
  ensurePatientsMonthlyVisitLimitColumn_(sh);
  const hdr = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const statusCol = hdr.indexOf("status") + 1;
  if (statusCol < 1) throw new Error("patients シートに status 列がありません");
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      sh.getRange(i + 1, statusCol).setValue(status);
      return "ok";
    }
  }
  return "not_found";
}

// ─────────────────────────────────────────
//  施設 CRUD
// ─────────────────────────────────────────

function getFacilities() {
  const sh = getSheet("facilities");
  const rows = sh.getDataRange().getValues();
  const header = rows[0];
  return JSON.stringify(rows.slice(1).map(r => rowToObj(header, r)));
}

function addFacility(json) {
  const f = JSON.parse(json);
  const sh = getSheet("facilities");
  const id = "F" + Utilities.formatDate(new Date(), "JST", "yyyyMMddHHmmss");
  sh.appendRow([id, f.name, f.short, f.color, f.visitDays, f.fax, f.cm, f.target || 10]);
  return id;
}

function updateFacility(json) {
  const f = JSON.parse(json);
  const sh = getSheet("facilities");
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === f.id) {
      sh.getRange(i + 1, 2).setValue(f.name);
      if (f.short != null) sh.getRange(i + 1, 3).setValue(String(f.short));
      sh.getRange(i + 1, 5).setValue(f.visitDays);
      sh.getRange(i + 1, 6).setValue(f.fax);
      sh.getRange(i + 1, 7).setValue(f.cm);
      if (f.target != null && f.target !== "") sh.getRange(i + 1, 8).setValue(Number(f.target) || f.target);
      return "ok";
    }
  }
  return "not_found";
}

// ─────────────────────────────────────────
//  診療記録 CRUD
// ─────────────────────────────────────────

/** 特定患者の診療記録一覧（降順）*/
function getTreatmentsByPatient(patientId) {
  const sh = getSheet("treatments");
  ensureTreatmentTimeColumns_(sh);
  const rows = sh.getDataRange().getValues();
  const header = rows[0];
  const result = rows.slice(1)
    .map(r => rowToObj(header, r))
    .filter(function (t) { return String(t.patient_id) === String(patientId); })
    .map(normalizeTreatmentTimesForClient_)
    .reverse();
  return JSON.stringify(result);
}

/** 診療日を yyyy-MM-dd に正規化（Date / ISO / スラッシュ区切り対応） */
function visitDateYMD_(vd) {
  if (vd == null || vd === "") return "";
  if (Object.prototype.toString.call(vd) === "[object Date]" && !isNaN(vd.getTime())) {
    return Utilities.formatDate(vd, "JST", "yyyy-MM-dd");
  }
  const s = String(vd).trim();
  var m = s.match(/^(\d{4})[-/.／](\d{1,2})[-/.／](\d{1,2})/);
  if (m) {
    const pad = function (n) {
      const x = parseInt(n, 10);
      return x < 10 ? "0" + x : String(x);
    };
    return m[1] + "-" + pad(m[2]) + "-" + pad(m[3]);
  }
  m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

function visitDateYM_(vd) {
  const ymd = visitDateYMD_(vd);
  return ymd.length >= 7 ? ymd.slice(0, 7) : "";
}

/**
 * 指定月の診療記録を返す
 * @param {string} [ymOpt] "yyyy-MM"（省略時は JST の今月）。ymOpt が "*" または "__all__" のときは全件
 */
function getMonthlyRecords(ymOpt) {
  const sh = getSheet("treatments");
  ensureTreatmentTimeColumns_(sh);
  const rows = sh.getDataRange().getValues();
  const header = rows[0];
  const sOpt = ymOpt != null ? String(ymOpt).trim() : "";
  const wantAll = sOpt === "*" || sOpt === "__all__" || sOpt.toLowerCase() === "all";
  const now = new Date();
  const ymDefault = Utilities.formatDate(now, "JST", "yyyy-MM-dd").slice(0, 7);
  const ym = wantAll
    ? null
    : (sOpt && /^\d{4}-\d{2}$/.test(sOpt) ? sOpt : ymDefault);
  const mapped = rows.slice(1).map(function (r) { return rowToObj(header, r); });
  const filtered = wantAll
    ? mapped
    : mapped.filter(function (t) { return visitDateYM_(t.visit_date) === ym; });
  const result = filtered.map(normalizeTreatmentTimesForClient_);
  return JSON.stringify(result);
}

/** 診療日＋開始時刻の重複判定用キー */
function treatmentVisitSlotKey_(visitDate, visitTimeStart) {
  var d = visitDateYMD_(visitDate) || "";
  var t = formatTimeValueForClient_(visitTimeStart) || "";
  return d + "\t" + t;
}

/**
 * 同一患者・同一診療日・同一開始時刻の既存行を探す
 * @param {string} excludeId 更新時は自分の id を除外
 * @return {string|null} 重複行の id
 */
function findDuplicateTreatmentSlot_(patientId, visitDate, visitTimeStart, excludeId) {
  var pid = String(patientId || "").trim();
  if (!pid) return null;
  var key = treatmentVisitSlotKey_(visitDate, visitTimeStart);
  if (!key || key.indexOf("\t") === 0) return null;
  var sh = getSheet("treatments");
  ensureTreatmentTimeColumns_(sh);
  var rows = sh.getDataRange().getValues();
  if (rows.length < 2) return null;
  var hdr = rows[0];
  var col = {};
  hdr.forEach(function (h, i) {
    var k = String(h || "").trim();
    if (k) col[k] = i;
  });
  if (col.patient_id == null || col.visit_date == null) return null;
  var ex = excludeId != null ? String(excludeId) : "";
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var rid = col.id != null ? String(r[col.id] || "") : "";
    if (ex && rid === ex) continue;
    if (String(r[col.patient_id] || "").trim() !== pid) continue;
    var vk = treatmentVisitSlotKey_(
      r[col.visit_date],
      col.visit_time_start != null ? r[col.visit_time_start] : ""
    );
    if (vk === key) return rid || String(i);
  }
  return null;
}

/**
 * 診療記録を保存する
 * @param {string} json  TreatmentRecord (JSON文字列)
 */
function saveTreatmentRecord(json) {
  const t = JSON.parse(json);
  const sh = getSheet("treatments");
  ensureTreatmentTimeColumns_(sh);
  const hdr = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const id = "T" + Utilities.formatDate(new Date(), "JST", "yyyyMMddHHmmss");
  const base = {
    id: id,
    patient_id: t.patient_id,
    fac_id: t.fac_id,
    visit_date: visitDateYMD_(t.visit_date) || Utilities.formatDate(new Date(), "JST", "yyyy-MM-dd"),
    treatments: t.treatments || "",
    notes: t.notes || "",
    next_date: t.next_date || "",
    next_content: t.next_content || "",
    doctor: t.doctor || "",
    visit_time_start: t.visit_time_start != null ? String(t.visit_time_start) : "",
    visit_time_end: t.visit_time_end != null ? String(t.visit_time_end) : "",
    notes_tones: t.notes_tones != null ? String(t.notes_tones) : "",
    exam_data: t.exam_data != null ? String(t.exam_data) : ""
  };
  var dupId = findDuplicateTreatmentSlot_(base.patient_id, base.visit_date, base.visit_time_start, null);
  if (dupId) {
    throw new Error(
      "同じ診療日・開始時刻の記録が既にあります。治療履歴で確認するか、日付・時間を変えてから保存してください。"
    );
  }
  const row = hdr.map(function (h) {
    if (!h) return "";
    const k = String(h).trim();
    return base[k] !== undefined ? base[k] : "";
  });
  sh.appendRow(row);
  return id;
}

/** 既存診療記録の更新（処置・メモ・次回・診療日・診療時間・所見トーン） */
function updateTreatmentRecord(json) {
  const t = JSON.parse(json);
  const sh = getSheet("treatments");
  ensureTreatmentTimeColumns_(sh);
  const hdr = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const colMap = {};
  hdr.forEach(function (h, i) {
    const key = String(h || "").trim();
    if (key) colMap[key] = i + 1;
  });
  var idCol0 = 0;
  hdr.forEach(function (h, j) {
    if (String(h || "").trim() === "id") idCol0 = j;
  });
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idCol0]) === String(t.id)) {
      const cur = rowToObj(hdr, rows[i]);
      const newDate =
        t.visit_date !== undefined
          ? visitDateYMD_(t.visit_date) || visitDateYMD_(cur.visit_date)
          : visitDateYMD_(cur.visit_date);
      const newStart =
        t.visit_time_start !== undefined
          ? String(t.visit_time_start)
          : String(cur.visit_time_start != null ? cur.visit_time_start : "");
      var dupId = findDuplicateTreatmentSlot_(cur.patient_id, newDate, newStart, t.id);
      if (dupId) {
        throw new Error(
          "同じ診療日・開始時刻の記録が既にあります。治療履歴で確認するか、日付・時間を変えてから保存してください。"
        );
      }
      const rowIdx = i + 1;
      if (colMap.treatments) sh.getRange(rowIdx, colMap.treatments).setValue(t.treatments || "");
      if (colMap.notes) sh.getRange(rowIdx, colMap.notes).setValue(t.notes || "");
      if (colMap.next_date) sh.getRange(rowIdx, colMap.next_date).setValue(t.next_date || "");
      if (colMap.next_content) sh.getRange(rowIdx, colMap.next_content).setValue(t.next_content || "");
      if (colMap.doctor && t.doctor !== undefined) sh.getRange(rowIdx, colMap.doctor).setValue(t.doctor || "");
      if (colMap.visit_time_start && t.visit_time_start !== undefined) {
        sh.getRange(rowIdx, colMap.visit_time_start).setValue(t.visit_time_start != null ? String(t.visit_time_start) : "");
      }
      if (colMap.visit_time_end && t.visit_time_end !== undefined) {
        sh.getRange(rowIdx, colMap.visit_time_end).setValue(t.visit_time_end != null ? String(t.visit_time_end) : "");
      }
      if (colMap.visit_date && t.visit_date !== undefined) {
        var nv = visitDateYMD_(t.visit_date);
        if (nv) sh.getRange(rowIdx, colMap.visit_date).setValue(nv);
      }
      if (colMap.notes_tones && t.notes_tones !== undefined) {
        sh.getRange(rowIdx, colMap.notes_tones).setValue(t.notes_tones != null ? String(t.notes_tones) : "");
      }
      if (colMap.exam_data && t.exam_data !== undefined) {
        sh.getRange(rowIdx, colMap.exam_data).setValue(t.exam_data != null ? String(t.exam_data) : "");
      }
      return "ok";
    }
  }
  return "not_found";
}

/**
 * 患者1名・指定月の月次ケア報告用データ（診療記録一覧＋施設様式フラグ）
 * @param {string} patientId
 * @param {string} ymOpt "yyyy-MM"
 * @return {string} JSON
 */
function getPatientMonthlyReportData(patientId, ymOpt) {
  const pid = String(patientId || "").trim();
  if (!pid) throw new Error("患者IDを指定してください");
  const sh = getSheet("treatments");
  ensureTreatmentTimeColumns_(sh);
  const rows = sh.getDataRange().getValues();
  if (rows.length < 2) {
    return JSON.stringify({
      ym: "",
      patient_id: pid,
      visits: [],
      omit_visit_time: false,
      report_title: "居宅療養管理指導報告書 （歯科医師）",
      time_fallback_phrase: "おおむね20分以上診療いたしました"
    });
  }
  const header = rows[0];
  const now = new Date();
  const ymDefault = Utilities.formatDate(now, "JST", "yyyy-MM-dd").slice(0, 7);
  const ym = (ymOpt && /^\d{4}-\d{2}$/.test(String(ymOpt).trim()))
    ? String(ymOpt).trim()
    : ymDefault;
  const patients = JSON.parse(getPatients(null));
  const facilities = JSON.parse(getFacilities());
  const settings = JSON.parse(getSettings());
  const p = patients.find(function (x) { return String(x.id) === pid; }) || {};
  const fac = facilities.find(function (f) { return String(f.id) === String(p.fac); }) || {};
  const facName = fac.name ? String(fac.name) : "";
  const hideSubstr = (settings.month_report_hide_time_facility_substr != null && String(settings.month_report_hide_time_facility_substr).trim())
    ? String(settings.month_report_hide_time_facility_substr).trim()
    : "サニーライフ稲毛";
  const omitVisitTime = hideSubstr.length > 0 && facName.indexOf(hideSubstr) !== -1;
  const timeFb = (settings.month_report_time_fallback != null && String(settings.month_report_time_fallback).trim())
    ? String(settings.month_report_time_fallback).trim()
    : "おおむね20分以上診療いたしました";
  const reportTitle = omitVisitTime
    ? "歯科訪問診療報告書 （歯科医師）"
    : "居宅療養管理指導報告書 （歯科医師）";
  const visits = rows.slice(1)
    .map(function (r) { return rowToObj(header, r); })
    .filter(function (t) { return String(t.patient_id) === pid && visitDateYM_(t.visit_date) === ym; })
    .sort(function (a, b) {
      const da = visitDateYMD_(a.visit_date);
      const db = visitDateYMD_(b.visit_date);
      if (da !== db) return da.localeCompare(db);
      return String(formatTimeValueForClient_(a.visit_time_start)).localeCompare(String(formatTimeValueForClient_(b.visit_time_start)));
    })
    .map(function (t) {
      return {
        id: t.id,
        visit_date: visitDateYMD_(t.visit_date),
        treatments: String(t.treatments || ""),
        notes: String(t.notes || ""),
        next_date: t.next_date ? visitDateYMD_(t.next_date) : "",
        next_content: String(t.next_content || ""),
        visit_time_start: formatTimeValueForClient_(t.visit_time_start),
        visit_time_end: formatTimeValueForClient_(t.visit_time_end),
        notes_tones: String(t.notes_tones || "")
      };
    });
  return JSON.stringify({
    ym: ym,
    patient_id: pid,
    patient_name: p.name || "",
    room: p.room != null ? String(p.room) : "",
    facility_id: String(p.fac || ""),
    facility_name: facName,
    facility_short: (fac.short != null && String(fac.short).trim()) ? String(fac.short).trim() : facName,
    care_manager: p.cm != null ? String(p.cm) : "",
    doctor_name: settings.doctor_name != null ? String(settings.doctor_name) : "",
    clinic_name: settings.clinic_name != null ? String(settings.clinic_name) : "",
    omit_visit_time: omitVisitTime,
    omit_visit_time_pattern: hideSubstr,
    report_title: reportTitle,
    time_fallback_phrase: timeFb,
    visits: visits
  });
}

/**
 * 施設単位・指定月の看護・医療従事者向け月次報告用データ（患者一覧＋訪問別記録）
 * @param {string} facId
 * @param {string} ymOpt "yyyy-MM"
 * @return {string} JSON
 */
function getFacilityClinicalMonthlyReportData(facId, ymOpt) {
  var facIdStr = String(facId || "").trim();
  if (!facIdStr) throw new Error("施設を指定してください");
  var now = new Date();
  var ymDefault = Utilities.formatDate(now, "JST", "yyyy-MM-dd").slice(0, 7);
  var ym = (ymOpt && /^\d{4}-\d{2}$/.test(String(ymOpt).trim()))
    ? String(ymOpt).trim()
    : ymDefault;

  var facilities = JSON.parse(getFacilities());
  var fac = facilities.find(function (f) { return String(f.id) === facIdStr; });
  if (!fac) throw new Error("施設が見つかりません");

  var sh = getSheet("treatments");
  ensureTreatmentTimeColumns_(sh);
  var rows = sh.getDataRange().getValues();
  var settings = JSON.parse(getSettings());
  var patients = JSON.parse(getPatients(null));

  var minDateByPid = {};
  if (rows.length >= 2) {
    var headerAll = rows[0];
    for (var j = 1; j < rows.length; j++) {
      var t0 = rowToObj(headerAll, rows[j]);
      var pid0 = String(t0.patient_id);
      var vd0 = visitDateYMD_(t0.visit_date);
      if (!pid0 || !vd0) continue;
      if (!minDateByPid[pid0] || vd0.localeCompare(minDateByPid[pid0]) < 0) {
        minDateByPid[pid0] = vd0;
      }
    }
  }

  if (rows.length < 2) {
    return JSON.stringify({
      facility_id: facIdStr,
      facility_name: fac.name || "",
      ym: ym,
      clinic_name: settings.clinic_name || "",
      doctor_name: settings.doctor_name || "",
      patient_count: 0,
      patients: []
    });
  }

  var header = rows[0];
  var monthRecords = rows.slice(1)
    .map(function (r) { return rowToObj(header, r); })
    .filter(function (t) {
      return String(t.fac_id) === facIdStr && visitDateYM_(t.visit_date) === ym;
    })
    .map(normalizeTreatmentTimesForClient_);

  if (!monthRecords.length) {
    return JSON.stringify({
      facility_id: facIdStr,
      facility_name: fac.name || "",
      ym: ym,
      clinic_name: settings.clinic_name || "",
      doctor_name: settings.doctor_name || "",
      patient_count: 0,
      patients: []
    });
  }

  var byPid = {};
  monthRecords.forEach(function (t) {
    var pid = String(t.patient_id);
    if (!byPid[pid]) byPid[pid] = [];
    byPid[pid].push(t);
  });

  var pids = Object.keys(byPid);
  pids.sort(function (a, b) {
    var pa = patients.find(function (x) { return String(x.id) === a; }) || {};
    var pb = patients.find(function (x) { return String(x.id) === b; }) || {};
    var ra = parseInt(String(pa.room || "").replace(/\D/g, ""), 10);
    var rb = parseInt(String(pb.room || "").replace(/\D/g, ""), 10);
    if (!isNaN(ra) && !isNaN(rb) && ra !== rb) return ra - rb;
    return String(pa.room || "").localeCompare(String(pb.room || ""), "ja");
  });

  var patientRows = pids.map(function (pid) {
    var p = patients.find(function (x) { return String(x.id) === pid; }) || {};
    var visits = byPid[pid].slice().sort(function (a, b) {
      var da = visitDateYMD_(a.visit_date);
      var db = visitDateYMD_(b.visit_date);
      if (da !== db) return da.localeCompare(db);
      return String(formatTimeValueForClient_(a.visit_time_start)).localeCompare(String(formatTimeValueForClient_(b.visit_time_start)));
    }).map(function (t) {
      return {
        id: t.id,
        visit_date: visitDateYMD_(t.visit_date),
        treatments: String(t.treatments || ""),
        notes: String(t.notes || ""),
        next_date: t.next_date ? visitDateYMD_(t.next_date) : "",
        next_content: String(t.next_content || ""),
        visit_time_start: formatTimeValueForClient_(t.visit_time_start),
        visit_time_end: formatTimeValueForClient_(t.visit_time_end)
      };
    });
    return {
      patient_id: pid,
      room: p.room != null ? String(p.room) : "",
      name: p.name || pid,
      coverage_type: p.coverage_type != null ? String(p.coverage_type).trim() : "",
      first_visit_date_ever: minDateByPid[pid] || "",
      visits: visits
    };
  });

  return JSON.stringify({
    facility_id: facIdStr,
    facility_name: fac.name || "",
    ym: ym,
    clinic_name: settings.clinic_name || "",
    doctor_name: settings.doctor_name || "",
    patient_count: patientRows.length,
    patients: patientRows
  });
}

/** PDF用 HTML エスケープ */
function escapeHtmlForPdf_(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** yyyy-MM-dd → 「M月d日（曜）」 */
function formatJpDateLongPdf_(ymd) {
  var ymdStr = visitDateYMD_(ymd);
  if (!ymdStr || !/^\d{4}-\d{2}-\d{2}$/.test(ymdStr)) return String(ymd || "");
  var parts = ymdStr.split("-");
  var y = parseInt(parts[0], 10);
  var mo = parseInt(parts[1], 10) - 1;
  var d = parseInt(parts[2], 10);
  var dt = new Date(y, mo, d);
  if (isNaN(dt.getTime())) return ymdStr;
  var wk = ["日", "月", "火", "水", "木", "金", "土"][dt.getDay()];
  return (dt.getMonth() + 1) + "月" + dt.getDate() + "日（" + wk + "）";
}

function saveMonthlyPdfToDrive_(blob, fileName) {
  var safe = String(fileName || "document.pdf").replace(/[\\/:*?"<>|]+/g, "_");
  if (!/\.pdf$/i.test(safe)) safe += ".pdf";
  var b = blob.setName(safe);
  var settings = JSON.parse(getSettings());
  var folderId = settings.report_drive_folder != null ? String(settings.report_drive_folder).trim() : "";
  if (folderId) {
    try {
      return DriveApp.getFolderById(folderId).createFile(b);
    } catch (ignore) {}
  }
  return DriveApp.createFile(b);
}

/**
 * 施設・対象月に診療のあった患者を居室順に並べ、1名1ページのA4縦PDFにまとめてDriveへ保存する。
 * @param {string} facId 施設ID
 * @param {string} ymOpt "yyyy-MM"
 * @return {string} JSON { ok, downloadUrl, viewUrl, fileName, fileId, patientCount, message } または { ok:false, error }
 */
function generateFacilityMonthlyPatientsPdf(facId, ymOpt) {
  var facIdStr = String(facId || "").trim();
  if (!facIdStr) throw new Error("施設を指定してください");
  var ym = (ymOpt && /^\d{4}-\d{2}$/.test(String(ymOpt).trim()))
    ? String(ymOpt).trim()
    : Utilities.formatDate(new Date(), "JST", "yyyy-MM-dd").slice(0, 7);

  var facilities = JSON.parse(getFacilities());
  var fac = facilities.find(function (f) { return String(f.id) === facIdStr; });
  if (!fac) throw new Error("施設が見つかりません");

  var settings = JSON.parse(getSettings());
  var patients = JSON.parse(getPatients(null));
  var records = JSON.parse(getMonthlyRecords(ym)).filter(function (t) {
    return String(t.fac_id) === facIdStr;
  });

  if (!records.length) {
    return JSON.stringify({ ok: false, error: "この施設・月の診療記録がありません。" });
  }

  var byPid = {};
  records.forEach(function (t) {
    var pid = String(t.patient_id);
    if (!byPid[pid]) byPid[pid] = [];
    byPid[pid].push(t);
  });

  var pids = Object.keys(byPid);
  pids.sort(function (a, b) {
    var pa = patients.find(function (x) { return String(x.id) === a; }) || {};
    var pb = patients.find(function (x) { return String(x.id) === b; }) || {};
    var ra = parseInt(String(pa.room || "").replace(/\D/g, ""), 10);
    var rb = parseInt(String(pb.room || "").replace(/\D/g, ""), 10);
    if (!isNaN(ra) && !isNaN(rb) && ra !== rb) return ra - rb;
    return String(pa.room || "").localeCompare(String(pb.room || ""), "ja");
  });

  var facName = String(fac.name || "");
  var hideSubstr = (settings.month_report_hide_time_facility_substr != null && String(settings.month_report_hide_time_facility_substr).trim())
    ? String(settings.month_report_hide_time_facility_substr).trim()
    : "サニーライフ稲毛";
  var omitVisitTime = hideSubstr.length > 0 && facName.indexOf(hideSubstr) !== -1;
  var timeFb = (settings.month_report_time_fallback != null && String(settings.month_report_time_fallback).trim())
    ? String(settings.month_report_time_fallback).trim()
    : "おおむね20分以上診療いたしました";
  var reportTitle = omitVisitTime
    ? "歯科訪問診療報告書 （歯科医師）"
    : "居宅療養管理指導報告書 （歯科医師）";
  var clinic = escapeHtmlForPdf_(settings.clinic_name || "");
  var doctor = escapeHtmlForPdf_(settings.doctor_name || "");
  var ymDisp = ym.replace(/^(\d{4})-(\d{2})$/, function (_, y, m) {
    return parseInt(y, 10) + "年" + parseInt(m, 10) + "月";
  });

  var pages = [];
  pids.forEach(function (pid) {
    var plist = byPid[pid].slice().sort(function (a, b) {
      var da = visitDateYMD_(a.visit_date);
      var db = visitDateYMD_(b.visit_date);
      if (da !== db) return da.localeCompare(db);
      return String(formatTimeValueForClient_(a.visit_time_start)).localeCompare(String(formatTimeValueForClient_(b.visit_time_start)));
    });
    var p = patients.find(function (x) { return String(x.id) === pid; }) || {};
    var pname = escapeHtmlForPdf_(p.name || pid);
    var room = escapeHtmlForPdf_(p.room != null ? String(p.room) : "");
    var cm = escapeHtmlForPdf_(p.cm != null ? String(p.cm) : "");
    var covRaw = (p.coverage_type != null && String(p.coverage_type).trim()) ? String(p.coverage_type).trim() : "—";
    var cov = escapeHtmlForPdf_(covRaw);

    var thTime = omitVisitTime
      ? ""
      : "<th style=\"border:1px solid #333;padding:4px 6px;font-size:8.5pt\">診療時間</th>";
    var tableRows = plist.map(function (v) {
      var vd = formatJpDateLongPdf_(v.visit_date);
      var timeCell = "";
      if (!omitVisitTime) {
        var a = String(v.visit_time_start || "").trim();
        var b = String(v.visit_time_end || "").trim();
        var ttxt;
        if (a && b) ttxt = a + "〜" + b;
        else if (a) ttxt = a + "〜";
        else ttxt = timeFb;
        timeCell = "<td style=\"padding:4px 6px;border:1px solid #333;vertical-align:top;white-space:nowrap;font-size:8.5pt\">" +
          escapeHtmlForPdf_(ttxt) + "</td>";
      }
      var tr = String(v.treatments || "").replace(/[、,]/g, "・");
      var nt = String(v.notes || "");
      if (nt.length > 140) nt = nt.slice(0, 140) + "…";
      return "<tr><td style=\"padding:4px 6px;border:1px solid #333;vertical-align:top;white-space:nowrap;font-size:9pt\">" +
        escapeHtmlForPdf_(vd) + "</td>" + timeCell +
        "<td style=\"padding:4px 6px;border:1px solid #333;vertical-align:top;font-size:9pt\">" +
        escapeHtmlForPdf_(tr) + "</td>" +
        "<td style=\"padding:4px 6px;border:1px solid #333;vertical-align:top;font-size:8.5pt;line-height:1.4\">" +
        escapeHtmlForPdf_(nt) + "</td></tr>";
    }).join("");

    var last = plist[plist.length - 1];
    var nd = visitDateYMD_(last.next_date);
    var nc = String(last.next_content || "").trim();
    var nextLine = "—";
    if (nd && nc) nextLine = escapeHtmlForPdf_(formatJpDateLongPdf_(nd) + "　" + nc);
    else if (nd) nextLine = escapeHtmlForPdf_(formatJpDateLongPdf_(nd));
    else if (nc) nextLine = escapeHtmlForPdf_(nc);

    pages.push(
      "<div class=\"pdf-page\">" +
      "<div style=\"text-align:center;font-size:12.5pt;font-weight:800;margin-bottom:4px;letter-spacing:0.04em\">" +
      escapeHtmlForPdf_(reportTitle) + "</div>" +
      "<div style=\"text-align:center;font-size:9.5pt;color:#334155;margin-bottom:10px;font-weight:700\">" + clinic + "</div>" +
      "<div style=\"font-size:9.5pt;margin-bottom:10px;line-height:1.55;border-bottom:1px solid #cbd5e1;padding-bottom:8px\">" +
      "<strong>対象月</strong>：" + escapeHtmlForPdf_(ymDisp) +
      "　<strong>施設</strong>：" + escapeHtmlForPdf_(facName) +
      "　<strong>居室</strong>：" + room + "<br>" +
      "<strong>氏名</strong>：" + pname + "　様　<strong>区分</strong>：" + cov +
      (cm ? "　<strong>主担当CM</strong>：" + cm : "") +
      "</div>" +
      "<table style=\"width:100%;border-collapse:collapse;font-size:9pt;margin-bottom:10px;table-layout:fixed\">" +
      "<thead><tr style=\"background:#e2e8f0\">" +
      "<th style=\"border:1px solid #333;padding:4px 6px;width:22%;font-size:8.5pt\">訪問日</th>" + thTime +
      "<th style=\"border:1px solid #333;padding:4px 6px;width:28%;font-size:8.5pt\">処置</th>" +
      "<th style=\"border:1px solid #333;padding:4px 6px;font-size:8.5pt\">メモ・所見（抜粋）</th></tr></thead><tbody>" +
      tableRows +
      "</tbody></table>" +
      "<div style=\"font-size:9pt;font-weight:700;margin:6px 0 3px\">【次回予定（当月最終診療行）】</div>" +
      "<div style=\"font-size:9pt;line-height:1.5;margin-bottom:12px\">" + nextLine + "</div>" +
      "<div style=\"font-size:9pt;padding-top:8px;border-top:1px solid #94a3b8\">担当歯科医師：" + doctor +
      "　<span style=\"color:#64748b\">作成日 " + escapeHtmlForPdf_(Utilities.formatDate(new Date(), "JST", "yyyy/M/d")) + "</span></div>" +
      "</div>"
    );
  });

  var html = "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"/><style>" +
    "@page { size: A4 portrait; margin: 10mm 11mm; }" +
    "body { margin: 0; font-family: 'Hiragino Kaku Gothic ProN','Hiragino Sans',Meiryo,sans-serif; color: #111; }" +
    ".pdf-page { page-break-after: always; box-sizing: border-box; padding: 2mm 0 0 0; }" +
    ".pdf-page:last-of-type { page-break-after: auto; }" +
    "</style></head><body>" + pages.join("") + "</body></html>";

  try {
    var pdfBlob = Utilities.newBlob(html, "text/html", "facility-monthly.html").getAs(MimeType.PDF);
    var baseName = "訪問月報_" + String(fac.short || fac.name || facIdStr).replace(/[\\/:*?"<>|]+/g, "_") + "_" + ym;
    var file = saveMonthlyPdfToDrive_(pdfBlob, baseName + ".pdf");
    var fid = file.getId();
    return JSON.stringify({
      ok: true,
      fileName: file.getName(),
      fileId: fid,
      patientCount: pids.length,
      downloadUrl: "https://drive.google.com/uc?export=download&id=" + fid,
      viewUrl: "https://drive.google.com/file/d/" + fid + "/view",
      message: "PDFをGoogleドライブに保存しました。リンクからダウンロードしてください。"
    });
  } catch (e) {
    return JSON.stringify({
      ok: false,
      error: "PDFの作成に失敗しました（HTML→PDF変換またはDrive保存）。権限・容量をご確認ください: " + String(e.message || e)
    });
  }
}

/** 診療記録1件を削除 */
function deleteTreatmentRecord(treatmentId) {
  const sh = getSheet("treatments");
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === treatmentId) {
      sh.deleteRow(i + 1);
      return "ok";
    }
  }
  return "not_found";
}

/** 患者を削除（診療記録・歯式・既往・写真メタを先に削除） */
function deletePatient(patientId) {
  const pid = String(patientId);
  const delRowsByCol = function (sheet, colIndex0) {
    const rows = sheet.getDataRange().getValues();
    for (let i = rows.length - 1; i >= 1; i--) {
      if (String(rows[i][colIndex0]) === pid) sheet.deleteRow(i + 1);
    }
  };
  delRowsByCol(getSheet("treatments"), 1);
  delRowsByCol(getSheet("teeth_data"), 0);
  delRowsByCol(getSheet("patient_medical"), 0);
  delRowsByCol(getSheet("photos"), 0);
  const psh = getSheet("patients");
  const prows = psh.getDataRange().getValues();
  for (let i = 1; i < prows.length; i++) {
    if (String(prows[i][0]) === pid) {
      psh.deleteRow(i + 1);
      return "ok";
    }
  }
  return "not_found";
}

/** 施設を削除（在籍患者が1人でもいれば不可） */
function deleteFacility(facilityId) {
  const fid = String(facilityId);
  const patients = JSON.parse(getPatients(null));
  const hasActive = patients.some(function (p) {
    return String(p.fac) === fid && (p.status || "active") === "active";
  });
  if (hasActive) return "has_patients";
  const sh = getSheet("facilities");
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === fid) {
      sh.deleteRow(i + 1);
      return "ok";
    }
  }
  return "not_found";
}

// ─────────────────────────────────────────
//  歯式データ
// ─────────────────────────────────────────

/** 患者の最新歯式データを返す（JSON文字列）*/
function getTeethData(patientId) {
  const sh = getSheet("teeth_data");
  const rows = sh.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (rows[i][0] === patientId) return rows[i][2]; // col: patient_id, date, json
  }
  return "{}";
}

/** 歯式データを保存する*/
function saveTeethData(patientId, teethJson) {
  const sh = getSheet("teeth_data");
  sh.appendRow([
    patientId,
    Utilities.formatDate(new Date(), "JST", "yyyy-MM-dd"),
    teethJson
  ]);
  return "ok";
}

/** 患者の歯式スナップショット履歴（日付昇順） */
function getTeethDataHistory(patientId) {
  const pid = String(patientId || "").trim();
  if (!pid) return "[]";
  const sh = getSheet("teeth_data");
  const rows = sh.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0] || "").trim() !== pid) continue;
    const d = visitDateYMD_(rows[i][1]) || String(rows[i][1] || "").slice(0, 10);
    out.push({
      date: d,
      json: rows[i][2] != null ? String(rows[i][2]) : "{}"
    });
  }
  out.sort(function (a, b) {
    return String(a.date || "").localeCompare(String(b.date || ""));
  });
  return JSON.stringify(out);
}

// ─────────────────────────────────────────
//  書類生成
// ─────────────────────────────────────────

/**
 * 日報テキストを生成して Drive に保存
 * @param {string} facId  施設ID
 * @param {string} date   "yyyy-MM-dd"
 */
function generateDailyReport(facId, date) {
  const ym = String(date || "").slice(0, 7);
  const records = JSON.parse(getMonthlyRecords(ym || undefined))
    .filter(t => t.fac_id === facId && visitDateYMD_(t.visit_date) === date);
  const fac = JSON.parse(getFacilities()).find(f => f.id === facId);

  let body = `【訪問歯科日報】\n`;
  body += `施設：${fac?.name || facId}\n`;
  body += `日付：${date}\n`;
  body += `患者数：${records.length}名\n\n`;
  records.forEach((r, i) => {
    const p = JSON.parse(getPatients(null)).find(x => x.id === r.patient_id);
    body += `[${i+1}] ${p?.name || r.patient_id}（${p?.room || ""}）\n`;
    body += `  処置：${r.treatments}\n`;
    if (r.notes) body += `  メモ：${r.notes}\n`;
    if (r.next_date) body += `  次回：${r.next_date} ${r.next_content}\n`;
    body += "\n";
  });

  const fileName = `日報_${fac?.name || facId}_${date}`;
  const file = DriveApp.createFile(fileName + ".txt", body, MimeType.PLAIN_TEXT);

  const qcResult = "（AI QC は無効です。内容は目視で確認してください。）";
  const qcFile = DriveApp.createFile(fileName + "_QC.txt", qcResult, MimeType.PLAIN_TEXT);

  return JSON.stringify({ reportUrl: file.getUrl(), qcUrl: qcFile.getUrl(), qcSummary: qcResult });
}

/**
 * 施設別FAX日報用データ（指定日・指定施設の診療記録＋患者居室名）
 * @param {string} facId 施設ID
 * @param {string} dateYmd "yyyy-MM-dd"
 * @return {string} JSON { clinic_name, facility_name, rows:[{room,name,treatments,notes,next_date,next_content,patient_id}] }
 */
function getFacilityDailyReportData(facId, dateYmd) {
  const ymd = String(dateYmd || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) throw new Error("日付は yyyy-MM-dd で指定してください");
  const ym = ymd.slice(0, 7);
  const records = JSON.parse(getMonthlyRecords(ym))
    .filter(function (t) {
      return String(t.fac_id) === String(facId) && visitDateYMD_(t.visit_date) === ymd;
    });
  const patients = JSON.parse(getPatients(null));
  const facilities = JSON.parse(getFacilities());
  const fac = facilities.find(function (f) { return String(f.id) === String(facId); });
  const settings = JSON.parse(getSettings());

  const enriched = records.map(function (r) {
    var p = patients.find(function (x) { return x.id === r.patient_id; }) || {};
    return {
      patient_id: r.patient_id,
      room: p.room != null ? String(p.room) : "",
      name: p.name || String(r.patient_id),
      treatments: r.treatments || "",
      notes: r.notes || "",
      next_date: r.next_date ? visitDateYMD_(r.next_date) : "",
      next_content: r.next_content || "",
      coverage_type: p.coverage_type != null ? String(p.coverage_type).trim() : ""
    };
  });
  enriched.sort(function (a, b) {
    var ra = parseInt(String(a.room).replace(/\D/g, ""), 10);
    var rb = parseInt(String(b.room).replace(/\D/g, ""), 10);
    if (!isNaN(ra) && !isNaN(rb) && ra !== rb) return ra - rb;
    return String(a.room).localeCompare(String(b.room), "ja");
  });

  return JSON.stringify({
    clinic_name: settings.clinic_name || settings.clinicName || "医院名（設定で入力）",
    facility_name: fac ? fac.name : String(facId),
    visit_date: ymd,
    rows: enriched
  });
}

function appendFaxStyleMemory(facId, dateYmd, comment) {
  var fid = String(facId || "").trim();
  var text = String(comment || "").trim();
  if (!fid || text.length < 40) return "ok";
  var all = {};
  try {
    var raw = getSettingsValue_("fax_style_memory");
    if (raw) all = JSON.parse(raw) || {};
  } catch (e2) {
    all = {};
  }
  if (!all[fid]) all[fid] = [];
  all[fid].push({ date: String(dateYmd || ""), comment: text.slice(0, 4000) });
  if (all[fid].length > 20) all[fid] = all[fid].slice(-20);
  saveSettings(JSON.stringify({ fax_style_memory: JSON.stringify(all) }));
  return "ok";
}

/**
 * 施設FAX日報：施設向けコメント本文の簡易下書き（ローカル生成・外部 API 不使用）
 * @param {string} facId
 * @param {string} dateYmd yyyy-MM-dd
 * @return {string} JSON { ok, comment?, source?, error? }  source: local
 */
function generateFaxDailyFacilityComment(facId, dateYmd) {
  var data = JSON.parse(getFacilityDailyReportData(facId, dateYmd));
  var comment = buildFaxFacilityCommentFallback_(data.rows || []);
  if (!comment) {
    return JSON.stringify({ ok: false, error: "下書きを生成できませんでした" });
  }
  return JSON.stringify({ ok: true, comment: comment, source: "local" });
}

function buildFaxFacilityCommentFallback_(rows) {
  if (!rows || !rows.length) {
    return "本日の診療記録はありません。\n（必要に応じて、施設への伝達事項を記入してください。）";
  }
  var lines = ["本日は" + rows.length + "名の患者に歯科訪問を行いました。"];
  var withNotes = rows.filter(function (r) { return String(r.notes || "").trim(); });
  if (!withNotes.length) {
    lines.push("\n診療メモに追記がないため、特記の伝達事項はありません。内容をご確認のうえ、必要であれば追記してください。");
    return lines.join("");
  }
  withNotes.forEach(function (r) {
    var nm = String(r.name || "").trim() || "患者";
    var room = String(r.room != null ? r.room : "").trim();
    var head = room ? nm + " 様（居室 " + room + "）について。" : nm + " 様について。";
    var body = String(r.notes || "").trim().replace(/Ext\b/gi, "抜歯予定").replace(/\bCo\b/g, "う蝕");
    lines.push("\n" + head + "\n" + body);
  });
  lines.push("\n※上記は診療メモをもとにした簡易下書きです。施設向けの表現に整えてからご利用ください。");
  return lines.join("");
}

/**
 * 上司向け「全施設・本日の診療リスト」用データ（指定診療日の全記録を施設別にグループ化）
 * @param {string} dateYmd "yyyy-MM-dd"
 * @return {string} JSON { clinic_name, visit_date, row_category_label, groups:[{facility_id,facility_name,facility_short,rows:[{room,name,treatments,notes}]}], summary }
 */
function getSupervisorDailyListData(dateYmd) {
  const ymd = String(dateYmd || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) throw new Error("日付は yyyy-MM-dd で指定してください");
  const ym = ymd.slice(0, 7);
  const records = JSON.parse(getMonthlyRecords(ym))
    .filter(function (t) {
      return visitDateYMD_(t.visit_date) === ymd;
    });
  const patients = JSON.parse(getPatients(null));
  const facilities = JSON.parse(getFacilities());
  const settings = JSON.parse(getSettings());
  const byFac = {};
  records.forEach(function (r) {
    var fid = String(r.fac_id);
    if (!byFac[fid]) byFac[fid] = [];
    var p = patients.find(function (x) { return x.id === r.patient_id; }) || {};
    byFac[fid].push({
      room: p.room != null ? String(p.room) : "",
      name: p.name || String(r.patient_id),
      patient_id: r.patient_id != null ? String(r.patient_id) : "",
      treatment_id: r.id != null ? String(r.id) : "",
      treatments: r.treatments || "",
      notes: r.notes || "",
      coverage_type: p.coverage_type != null ? String(p.coverage_type).trim() : ""
    });
  });
  Object.keys(byFac).forEach(function (fid) {
    byFac[fid].sort(function (a, b) {
      var ra = parseInt(String(a.room).replace(/\D/g, ""), 10);
      var rb = parseInt(String(b.room).replace(/\D/g, ""), 10);
      if (!isNaN(ra) && !isNaN(rb) && ra !== rb) return ra - rb;
      return String(a.room).localeCompare(String(b.room), "ja");
    });
  });
  var groups = [];
  facilities.forEach(function (f) {
    var fid = String(f.id);
    if (!byFac[fid] || !byFac[fid].length) return;
    groups.push({
      facility_id: f.id,
      facility_name: f.name || fid,
      facility_short: (f.short != null && String(f.short).trim()) ? String(f.short).trim() : (f.name || fid),
      rows: byFac[fid]
    });
  });
  Object.keys(byFac).forEach(function (fid) {
    if (groups.some(function (g) { return String(g.facility_id) === fid; })) return;
    groups.push({
      facility_id: fid,
      facility_name: "（施設マスタ未登録）",
      facility_short: fid,
      rows: byFac[fid]
    });
  });
  groups.sort(function (a, b) {
    return String(a.facility_short).localeCompare(String(b.facility_short), "ja");
  });
  var countableRecords = records.filter(function (r) {
    return !svListRecordExcludedFromCount_(r.treatments);
  });
  return JSON.stringify({
    clinic_name: settings.clinic_name || settings.clinicName || "医院名（設定で入力）",
    visit_date: ymd,
    groups: groups,
    summary: { facility_count: groups.length, patient_count: countableRecords.length }
  });
}

/** ②上司向けリスト：合計人数に含めない報告書ステータス */
function svListRecordExcludedFromCount_(treatments) {
  var codes = String(treatments || "").split(/[、,]/).map(function (s) { return s.trim(); }).filter(Boolean);
  var exclude = ["ご逝去", "入院中", "退所", "退去"];
  for (var i = 0; i < codes.length; i++) {
    if (exclude.indexOf(codes[i]) !== -1) return true;
  }
  return false;
}

/**
 * 指定診療日の診療記録をフラット配列で返す（情報共有シートの下書き用）
 * @param {string} dateYmd "yyyy-MM-dd"
 */
function getTreatmentsForDateFlat(dateYmd) {
  const ymd = String(dateYmd || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) throw new Error("日付は yyyy-MM-dd で指定してください");
  const ym = ymd.slice(0, 7);
  const records = JSON.parse(getMonthlyRecords(ym))
    .filter(function (t) {
      return visitDateYMD_(t.visit_date) === ymd;
    });
  const patients = JSON.parse(getPatients(null));
  const facilities = JSON.parse(getFacilities());
  const facOrder = {};
  facilities.forEach(function (f, i) {
    facOrder[String(f.id)] = i;
  });
  const enriched = records.map(function (r) {
    var p = patients.find(function (x) { return x.id === r.patient_id; }) || {};
    var f = facilities.find(function (x) { return String(x.id) === String(r.fac_id); });
    var facLabel = f ? (f.short && String(f.short).trim() ? String(f.short).trim() : f.name) : "";
    var parts = [];
    if (facLabel) parts.push("【" + facLabel + "】");
    if (r.treatments) parts.push(String(r.treatments));
    if (r.notes) parts.push(String(r.notes));
    return {
      patient_id: r.patient_id,
      fac_id: String(r.fac_id || ""),
      room: p.room != null ? String(p.room) : "",
      name: p.name || String(r.patient_id),
      draft_notes: parts.join("\n")
    };
  });
  enriched.sort(function (a, b) {
    var oa = facOrder[a.fac_id];
    var ob = facOrder[b.fac_id];
    if (oa != null && ob != null && oa !== ob) return oa - ob;
    if (oa != null && ob == null) return -1;
    if (oa == null && ob != null) return 1;
    var fa = String(a.room).replace(/\D/g, "");
    var fb = String(b.room).replace(/\D/g, "");
    var na = parseInt(fa, 10), nb = parseInt(fb, 10);
    if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
    return String(a.room).localeCompare(String(b.room), "ja");
  });
  return JSON.stringify(enriched.map(function (x) {
    return {
      patient_id: x.patient_id,
      fac_id: x.fac_id,
      room: x.room,
      name: x.name,
      draft_notes: x.draft_notes
    };
  }));
}

/**
 * 指定診療日・施設の診療記録のみ（情報共有シート③用）
 * @param {string} dateYmd "yyyy-MM-dd"
 * @param {string} facId 施設ID
 */
function getTreatmentsForFacilityDate(dateYmd, facId) {
  var fid = String(facId || "").trim();
  if (!fid) throw new Error("施設を選んでください");
  var all = JSON.parse(getTreatmentsForDateFlat(dateYmd));
  return JSON.stringify(all.filter(function (x) {
    return String(x.fac_id || "") === fid;
  }));
}

// ─────────────────────────────────────────
//  ダッシュボード集計
// ─────────────────────────────────────────

function getDashboardData() {
  const today = Utilities.formatDate(new Date(), "JST", "yyyy-MM-dd");
  const records = JSON.parse(getMonthlyRecords());
  const patients = JSON.parse(getPatients("active"));
  const facilities = JSON.parse(getFacilities());

  // 今日の診療数
  const todayCount = records.filter(r => visitDateYMD_(r.visit_date) === today).length;

  // 施設別の今月診療数と目標
  const facStats = facilities.map(f => {
    const visited = new Set(
      records.filter(r => r.fac_id === f.id).map(r => r.patient_id)
    ).size;
    return { id: f.id, name: f.name, visited, target: f.target || 10, color: f.color };
  });

  // 月2回以上達成患者数
  const countByPatient = {};
  records.forEach(r => {
    countByPatient[r.patient_id] = (countByPatient[r.patient_id] || 0) + 1;
  });
  const twice = Object.values(countByPatient).filter(c => c >= 2).length;

  return JSON.stringify({ todayCount, twice, facStats, totalActive: patients.length });
}

// ─────────────────────────────────────────
//  患者 医療情報（既往歴・服薬・自立度）
// ─────────────────────────────────────────

function getMedicalInfo(patientId) {
  const sh = getSheet("patient_medical");
  const rows = sh.getDataRange().getValues();
  const header = rows[0];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === patientId) {
      const obj = rowToObj(header, rows[i]);
      try { obj.conditions  = JSON.parse(obj.conditions  || "[]"); } catch(e){ obj.conditions  = []; }
      try { obj.medications = JSON.parse(obj.medications || "[]"); } catch(e){ obj.medications = []; }
      try { obj.allergies   = JSON.parse(obj.allergies   || "[]"); } catch(e){ obj.allergies   = []; }
      return JSON.stringify(obj);
    }
  }
  return JSON.stringify({ conditions:[], medications:[], allergies:[], care_level:"", independence:"", dementia_level:"" });
}

function saveMedicalInfo(patientId, json) {
  const data = JSON.parse(json);
  const sh   = getSheet("patient_medical");
  const rows = sh.getDataRange().getValues();
  const updatedAt = Utilities.formatDate(new Date(), "JST", "yyyy-MM-dd HH:mm");
  const rowData = [
    patientId,
    JSON.stringify(data.conditions   || []),
    JSON.stringify(data.medications  || []),
    JSON.stringify(data.allergies    || []),
    data.care_level     || "",
    data.independence   || "",
    data.dementia_level || "",
    updatedAt
  ];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === patientId) {
      sh.getRange(i + 1, 1, 1, rowData.length).setValues([rowData]);
      return "ok";
    }
  }
  sh.appendRow(rowData);
  return "ok";
}

/** 旧形式（文字列配列）を { cat, name } に統一 */
function normalizeCustomDiseaseList_(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(function (x) {
    if (typeof x === "string") return { cat: "その他", name: x.trim() };
    if (x && typeof x === "object" && x.name) {
      return { cat: String(x.cat || "その他").trim() || "その他", name: String(x.name).trim() };
    }
    return null;
  }).filter(function (e) { return e && e.name; });
}

/** 旧形式を { cat, name, brand } に統一 */
function normalizeCustomMedList_(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(function (x) {
    if (typeof x === "string") return { cat: "その他", name: x.trim(), brand: "" };
    if (x && typeof x === "object" && x.name) {
      return {
        cat: String(x.cat || "その他").trim() || "その他",
        name: String(x.name).trim(),
        brand: x.brand != null ? String(x.brand).trim() : ""
      };
    }
    return null;
  }).filter(function (e) { return e && e.name; });
}

/**
 * @param {string} type "diseases"|"meds"
 * @param {string} item 病名・薬品名
 * @param {string} category カテゴリー名（必須）
 * @param {string} [brand] 商品名（服薬のみ）
 */
function addCustomMasterItem(type, item, category, brand) {
  var cat = category ? String(category).trim() : "";
  if (!cat) return "no_category";
  var name = String(item || "").trim();
  if (!name) return "empty";
  var key = type === "diseases" ? "custom_diseases" : "custom_medications";
  var sh = getSheet("settings");
  var rows = sh.getDataRange().getValues();
  var entry = type === "diseases"
    ? { cat: cat, name: name }
    : { cat: cat, name: name, brand: brand ? String(brand).trim() : "" };
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][0] === key) {
      var arr = [];
      try { arr = JSON.parse(rows[i][1] || "[]"); } catch (e) { arr = []; }
      arr = type === "diseases" ? normalizeCustomDiseaseList_(arr) : normalizeCustomMedList_(arr);
      var dup = arr.some(function (e) { return e.name === entry.name && e.cat === entry.cat; });
      if (!dup) arr.push(entry);
      sh.getRange(i + 1, 2).setValue(JSON.stringify(arr));
      return "ok";
    }
  }
  sh.appendRow([key, JSON.stringify([entry])]);
  return "ok";
}

/** マスタからカスタム病名・薬を1件削除 */
function deleteCustomMasterItem(type, name, category) {
  var nm = String(name || "").trim();
  var cat = String(category || "").trim();
  if (!nm || !cat) return "bad_args";
  var key = type === "diseases" ? "custom_diseases" : "custom_medications";
  var sh = getSheet("settings");
  var rows = sh.getDataRange().getValues();
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][0] === key) {
      var arr = [];
      try { arr = JSON.parse(rows[i][1] || "[]"); } catch (e) { arr = []; }
      arr = type === "diseases" ? normalizeCustomDiseaseList_(arr) : normalizeCustomMedList_(arr);
      var next = arr.filter(function (e) { return !(e.name === nm && e.cat === cat); });
      if (next.length === arr.length) return "not_found";
      sh.getRange(i + 1, 2).setValue(JSON.stringify(next));
      return "ok";
    }
  }
  return "not_found";
}

function getCustomMasterItems() {
  var sh = getSheet("settings");
  var rows = sh.getDataRange().getValues();
  var diseases = [];
  var medications = [];
  var diseaseCategories = [];
  var medicationCategories = [];
  var hiddenDiseases = [];
  var hiddenMedications = [];
  var diseaseCategoryRenames = {};
  var medCategoryRenames = {};
  var medMasterRowEdits = [];
  var diseaseMasterRowEdits = [];
  var diseaseCategoryOrder = [];
  var medCategoryOrder = [];
  rows.forEach(function (r) {
    if (r[0] === "custom_diseases") try { diseases = JSON.parse(r[1] || "[]"); } catch (e) { diseases = []; }
    if (r[0] === "custom_medications") try { medications = JSON.parse(r[1] || "[]"); } catch (e) { medications = []; }
    if (r[0] === "custom_disease_categories") try { diseaseCategories = JSON.parse(r[1] || "[]"); } catch (e) { diseaseCategories = []; }
    if (r[0] === "custom_med_categories") try { medicationCategories = JSON.parse(r[1] || "[]"); } catch (e) { medicationCategories = []; }
    if (r[0] === "hidden_disease_master_items") try { hiddenDiseases = JSON.parse(r[1] || "[]"); } catch (e) { hiddenDiseases = []; }
    if (r[0] === "hidden_med_master_items") try { hiddenMedications = JSON.parse(r[1] || "[]"); } catch (e) { hiddenMedications = []; }
    if (r[0] === "disease_category_renames") try { diseaseCategoryRenames = JSON.parse(r[1] || "{}"); } catch (e) { diseaseCategoryRenames = {}; }
    if (r[0] === "med_category_renames") try { medCategoryRenames = JSON.parse(r[1] || "{}"); } catch (e) { medCategoryRenames = {}; }
    if (r[0] === "med_master_row_edits") try { medMasterRowEdits = JSON.parse(r[1] || "[]"); } catch (e) { medMasterRowEdits = []; }
    if (r[0] === "disease_master_row_edits") try { diseaseMasterRowEdits = JSON.parse(r[1] || "[]"); } catch (e) { diseaseMasterRowEdits = []; }
    if (r[0] === "disease_category_order") try { diseaseCategoryOrder = JSON.parse(r[1] || "[]"); } catch (e) { diseaseCategoryOrder = []; }
    if (r[0] === "med_category_order") try { medCategoryOrder = JSON.parse(r[1] || "[]"); } catch (e) { medCategoryOrder = []; }
  });
  return JSON.stringify({
    diseases: normalizeCustomDiseaseList_(diseases),
    medications: normalizeCustomMedList_(medications),
    diseaseCategories: Array.isArray(diseaseCategories) ? diseaseCategories : [],
    medicationCategories: Array.isArray(medicationCategories) ? medicationCategories : [],
    hiddenDiseases: normalizeCustomDiseaseList_(hiddenDiseases),
    hiddenMedications: normalizeCustomMedList_(hiddenMedications),
    diseaseCategoryRenames: diseaseCategoryRenames && typeof diseaseCategoryRenames === "object" && !Array.isArray(diseaseCategoryRenames) ? diseaseCategoryRenames : {},
    medCategoryRenames: medCategoryRenames && typeof medCategoryRenames === "object" && !Array.isArray(medCategoryRenames) ? medCategoryRenames : {},
    medMasterRowEdits: Array.isArray(medMasterRowEdits) ? medMasterRowEdits : [],
    diseaseMasterRowEdits: Array.isArray(diseaseMasterRowEdits) ? diseaseMasterRowEdits : [],
    diseaseCategoryOrder: Array.isArray(diseaseCategoryOrder) ? diseaseCategoryOrder : [],
    medCategoryOrder: Array.isArray(medCategoryOrder) ? medCategoryOrder : []
  });
}

// ─────────────────────────────────────────
//  写真・X線 管理
// ─────────────────────────────────────────

/**
 * 【診断】実行ボタンで起動し、photos の file_id を1つ貼り付けて実行。
 * 成功なら JSON でファイル名・MIME が返る。失敗なら Google のエラーメッセージ。
 */
function diagnoseDrivePhotoById(fileId) {
  var id = String(fileId || "").trim();
  var out;
  if (!id) {
    out = JSON.stringify({ ok: false, message: "fileId が空です" });
  } else {
    try {
      var f = DriveApp.getFileById(id);
      out = JSON.stringify({
        ok: true,
        name: f.getName(),
        mime: f.getMimeType(),
        size: f.getSize()
      });
    } catch (err) {
      out = JSON.stringify({
        ok: false,
        message: String(err && err.message ? err.message : err)
      });
    }
  }
  Logger.log(out);
  return out;
}

/** パラメータ不要。photos の2行目（先頭データ行）の file_id を自動で試す。 */
function diagnoseDrivePhotoFirstRow() {
  var sh = getSheet("photos");
  var rows = sh.getDataRange().getValues();
  if (rows.length < 2) {
    var emptyOut = JSON.stringify({ ok: false, message: "photos にデータ行がありません" });
    Logger.log(emptyOut);
    return emptyOut;
  }
  var header = rows[0];
  var ic = header.indexOf("file_id");
  var id = ic >= 0 ? rows[1][ic] : rows[1][1];
  return diagnoseDrivePhotoById(id);
}

/** クライアントの <img src> 用。ウェブアプリが取れる URL（doGet ?driveimg=）を優先 */
function photoWebAppViewUrl_(fileId) {
  var id = String(fileId || "").trim();
  if (!id) return "";
  var base = getWebAppBaseUrl_();
  if (base) {
    return base + "?driveimg=" + encodeURIComponent(id);
  }
  return "https://drive.google.com/uc?export=view&id=" + encodeURIComponent(id);
}

/** 写真ルートの Google ドライブフォルダ名（直下に「施設名」サブフォルダを自動作成して保存） */
var VISIT_DENTAL_PHOTO_ROOT_FOLDER_NAME_ = "訪問歯科_写真";

/** 「訪問歯科_写真」フォルダを取得または作成する */
function getVisitDentalPhotoRootFolder_() {
  var it = DriveApp.getFoldersByName(VISIT_DENTAL_PHOTO_ROOT_FOLDER_NAME_);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(VISIT_DENTAL_PHOTO_ROOT_FOLDER_NAME_);
}

/** 施設サブフォルダ名として使えるよう整形（空ならルート保存扱い） */
function sanitizeDriveSubfolderName_(raw) {
  var s = String(raw || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return "";
  if (s.length > 200) s = s.substring(0, 200).trim();
  return s;
}

/** 親直下に同名フォルダがあれば返し、なければ作成 */
function getOrCreateChildFolderByName_(parentFolder, folderName) {
  var n = sanitizeDriveSubfolderName_(folderName);
  if (!n) return parentFolder;
  var it = parentFolder.getFoldersByName(n);
  if (it.hasNext()) return it.next();
  return parentFolder.createFolder(n);
}

/**
 * 患者に紐づく施設のサブフォルダ（訪問歯科_写真／施設名）。施設未設定・施設不明時はルート。
 * 施設名は facilities の name（空なら short）。
 */
function getPhotoSaveFolderForPatientId_(rootFolder, patientId) {
  var pid = String(patientId || "").trim();
  if (!pid) return rootFolder;
  var patients = JSON.parse(getPatients(null));
  var p = null;
  for (var i = 0; i < patients.length; i++) {
    if (String(patients[i].id || "") === pid) {
      p = patients[i];
      break;
    }
  }
  if (!p || !p.fac || String(p.fac).trim() === "") return rootFolder;
  var facilities = JSON.parse(getFacilities());
  var fac = null;
  for (var j = 0; j < facilities.length; j++) {
    if (String(facilities[j].id || "") === String(p.fac)) {
      fac = facilities[j];
      break;
    }
  }
  if (!fac) return rootFolder;
  var label = String(fac.name || fac.short || "").trim();
  if (!label) return rootFolder;
  return getOrCreateChildFolderByName_(rootFolder, label);
}

/** Drive 保存用のファイル名（患者ID・日時を付与して同一フォルダ内の衝突を避ける） */
function buildUniquePhotoDriveFileName_(patientId, filename) {
  var pid = String(patientId || "").trim().replace(/[\\/:*?"<>|]+/g, "_");
  if (!pid) throw new Error("patientId が空です");
  var fn = String(filename || "photo.jpg").trim().replace(/[\\/:*?"<>|]+/g, "_");
  if (!/\.\w{2,4}$/i.test(fn)) fn += ".jpg";
  var stamp = Utilities.formatDate(new Date(), "JST", "yyyyMMddHHmmss");
  return pid + "_" + stamp + "_" + fn;
}

/**
 * 写真をGoogle Driveに保存してphotosシートに記録する
 * @param {string} patientId
 * @param {string} base64Data  圧縮済みJPEGのbase64
 * @param {string} filename
 * @param {string} category  口腔内/顔貌/義歯/X線/書類
 * @param {string} dateTaken  "YYYY-MM-DD"
 */
function savePhoto(patientId, base64Data, filename, category, dateTaken) {
  const root = getVisitDentalPhotoRootFolder_();
  const folder = getPhotoSaveFolderForPatientId_(root, patientId);
  const driveName = buildUniquePhotoDriveFileName_(patientId, filename);

  const blob = Utilities.newBlob(
    Utilities.base64Decode(base64Data),
    "image/jpeg",
    driveName
  );
  const file = folder.createFile(blob);
  /**
   * Webアプリの <img> は Google ログイン付きで読めないため、埋め込み用に「リンクを知っている人は閲覧可」にする。
   * （URL＝file_id を知る必要があり、スプレッドシート運用前提のトレードオフ。厳密に院内のみにしたい場合は
   *  Workspace の「ドメイン内のみ」共有や別配信方式への変更を検討してください。）
   */
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const viewUrl = photoWebAppViewUrl_(file.getId());

  // photosシートに記録
  const sh = getSheet("photos");
  const uploadedAt = Utilities.formatDate(new Date(), "JST", "yyyy-MM-dd HH:mm");
  sh.appendRow([patientId, file.getId(), viewUrl, filename, category, dateTaken, uploadedAt]);

  return JSON.stringify({ fileId: file.getId(), url: viewUrl });
}

/**
 * 既存の写真ファイル（photos シートの file_id）を「リンクを知っている人は閲覧可」に揃える。
 * 一度だけスクリプトエディタから実行してください（アップロード済みの灰色サムネイル対策）。
 */
function repairPhotoSharingForWebDisplay() {
  const sh = getSheet("photos");
  const rows = sh.getDataRange().getValues();
  if (rows.length <= 1) return "no_rows";
  const header = rows[0];
  const ic = header.indexOf("file_id");
  const uc = header.indexOf("file_url");
  if (ic < 0) throw new Error("photos シートに file_id 列がありません");
  let n = 0;
  for (var r = 1; r < rows.length; r++) {
    var id = rows[r][ic];
    if (!id) continue;
    try {
      var f = DriveApp.getFileById(String(id));
      f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      if (uc >= 0) {
        sh.getRange(r + 1, uc + 1).setValue(photoWebAppViewUrl_(String(id)));
      }
      n++;
    } catch (e) {
      // 権限・削除済みなどはスキップ
    }
  }
  return "updated_" + n;
}

/**
 * 患者の写真一覧を返す
 * 返却JSONの file_url は file_id から組み立て（シート上の値は変更しない）。
 * inline_data_url: Drive から読んだ画像を data:URL で返す。<img> が外部URLを読めない環境向け。
 * （1枚あたり最大 INLINE_PHOTO_MAX_BYTES。超過・非画像・失敗時は空文字）
 */
var INLINE_PHOTO_MAX_BYTES = 2.5 * 1024 * 1024;

function getPhotos(patientId) {
  const sh = getSheet("photos");
  const rows = sh.getDataRange().getValues();
  if (rows.length <= 1) return JSON.stringify([]);
  const header = rows[0];
  const pid = String(patientId);
  const list = rows
    .slice(1)
    .map(function (r) {
      var o = rowToObj(header, r);
      if (!o.file_id && !o.fileId && r[1]) {
        o.file_id = r[1];
      }
      if (!o.patient_id && r[0]) {
        o.patient_id = r[0];
      }
      return o;
    })
    .filter(function (r) {
      return String(r.patient_id || r.patientId || "") === pid;
    })
    .reverse(); // 新しい順

  list.forEach(function (r) {
    var fid = r.file_id || r.fileId;
    if (!fid) return;
    fid = String(fid).trim();
    r.file_url = photoWebAppViewUrl_(fid);
    r.inline_data_url = "";
    try {
      var file = DriveApp.getFileById(fid);
      var sz = file.getSize();
      if (sz > 0 && sz <= INLINE_PHOTO_MAX_BYTES) {
        var blob = file.getBlob();
        var mt = blob.getContentType() || "image/jpeg";
        if (String(mt).indexOf("image/") !== 0) {
          mt = "image/jpeg";
        }
        r.inline_data_url = "data:" + mt + ";base64," + Utilities.base64Encode(blob.getBytes());
      }
    } catch (inlineErr) {
      /* 権限・削除済みなどは空のまま */
    }
  });

  return JSON.stringify(list);
}

/**
 * 写真を削除する（Driveファイル + シート行）
 */
function deletePhoto(fileId) {
  try {
    DriveApp.getFileById(fileId).setTrashed(true);
  } catch(e) {}
  const sh = getSheet("photos");
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] === fileId) { sh.deleteRow(i + 1); break; }
  }
  return "ok";
}

// ─────────────────────────────────────────
//  無料検診票・LLM 下書き（匿名ペイロード）
// ─────────────────────────────────────────

/** settings に無ければ追加（値は空でよい＝コード内フォールバック使用） */
function ensureKentaiLlmSettingsRows_() {
  const sh = getSheet("settings");
  const rows = sh.getDataRange().getValues();
  function hasKey(k) {
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === k) return true;
    }
    return false;
  }
  if (!hasKey("kentai_llm_default_instructions")) {
    sh.appendRow([
      "kentai_llm_default_instructions",
      KENTAI_LLM_DEFAULT_INSTRUCTIONS_FALLBACK_,
      "（未使用）無料検診票の旧LLM指示。AI機能は無効です。"
    ]);
  }
}

function getSettingsValue_(key) {
  const sh = getSheet("settings");
  const rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === key) return rows[i][1];
  }
  return "";
}

/** 年齢から10歳刻み帯（LLM匿名化用）。数値でなければ空 */
function ageDecadeBand_(ageVal) {
  const a = parseInt(String(ageVal), 10);
  if (isNaN(a) || a < 0 || a > 130) return "";
  if (a >= 100) return "100歳以上";
  const d = Math.floor(a / 10) * 10;
  return d + "代";
}

/** 歯式JSON文字列を位置付き要約テキストに（個人名なし） */
function summarizeTeethDataForKentai_(jsonStr) {
  let o;
  try {
    o = JSON.parse(String(jsonStr || "{}"));
  } catch (e) {
    return "";
  }
  if (!o || typeof o !== "object") return "";
  const lines = [];
  const keys = Object.keys(o).filter(function (k) {
    return /^(upper|lower)_[LR][1-8]$/.test(k) && !k.endsWith("_miss") && !k.endsWith("_red");
  });
  keys.sort();
  keys.forEach(function (k) {
    const v = o[k];
    const miss = o[k + "_miss"];
    const red = o[k + "_red"];
    if (!v && !miss && !red) return;
    const bits = [];
    if (miss) bits.push("欠損");
    if (v) bits.push(String(v).slice(0, 120));
    if (red) bits.push("赤:" + String(red).slice(0, 80));
    if (bits.length) lines.push(k + ": " + bits.join(" / "));
  });
  ["fd_upper", "pd_upper", "fd_lower", "pd_lower"].forEach(function (fk) {
    if (o[fk]) lines.push(fk + ": あり");
  });
  return lines.join("\n");
}

/** 医療情報を匿名テキスト化（patient_id は含めない） */
function summarizeMedicalForKentai_(medJsonStr) {
  let m;
  try {
    m = JSON.parse(String(medJsonStr || "{}"));
  } catch (e) {
    return {};
  }
  if (!m || typeof m !== "object") return {};
  function listNames(arr) {
    if (!Array.isArray(arr)) return "";
    return arr
      .map(function (x) {
        if (typeof x === "string") return x;
        if (x && x.name) {
          var dn = x.displayName != null ? String(x.displayName).trim() : "";
          var nm = String(x.name);
          return dn && dn !== nm ? dn : nm;
        }
        return "";
      })
      .filter(Boolean)
      .join("、");
  }
  return {
    care_level: String(m.care_level || ""),
    independence: String(m.independence || ""),
    dementia_level: String(m.dementia_level || ""),
    conditions: listNames(m.conditions),
    medications: listNames(m.medications),
    allergies: listNames(m.allergies)
  };
}

/**
 * settings の kentai_llm_default_instructions が空ならコード内フォールバック
 */
function getKentaiDefaultInstructionsText_() {
  ensureKentaiLlmSettingsRows_();
  const v = String(getSettingsValue_("kentai_llm_default_instructions") || "").trim();
  if (v) return v;
  return KENTAI_LLM_DEFAULT_INSTRUCTIONS_FALLBACK_;
}

/**
 * 無料検診票の AI 下書き（無効 — 手入力のみ）
 * @return {string} JSON { ok: false, error }
 */
function generateKentaiScreeningDraft(patientId, checkupDateYmd, optionalExtraInstruction) {
  return JSON.stringify({ ok: false, error: "AI下書きは無効です。各項目を手入力してください。" });
}

/** settings が空のときの既定（ユーザー提供文を要約同梱。医院は settings で上書き推奨） */
var KENTAI_LLM_DEFAULT_INSTRUCTIONS_FALLBACK_ =
  "あなたは訪問診療を専門とする歯科医師です。本日、無料検診を行いました。\n" +
  "患者情報をいくつか挙げますので、患者さんのご家族に対して、現状と訪問歯科受診を勧める文章を専門家として考えてください。\n\n" +
  "条件\n" +
  "・四項目（口腔ケア、義歯、歯周病、虫歯）と全体のまとめの文章を書く。\n" +
  "・四項目にはそれぞれ治療の必要あり・なしを記入し、短いコメントを書く。\n" +
  "・まとめ文には100～180文字程度のコメントを書き、歯科受診の必要性を伝える流れとする。" +
  "（～が必要です。〇〇が推奨されます。～をお勧め致します。口腔機能低下を防ぐため～。～が懸念されます。～を行なう方が望ましいです。～と思われます。～の処置を検討する必要があります。～の治療が必要と考えられます。～な状況になる可能性があります。将来的に～（悪い未来）が予想されます。などの語尾バリエーションを適宜使う）\n\n" +
  "出力JSONのキーは oral_care, denture, periodontal, caries（各 needs は「あり」または「なし」、comments は文字列の配列）、overall（1文字列）。";

// ─────────────────────────────────────────
//  設定
// ─────────────────────────────────────────

function getSettings() {
  const sh = getSheet("settings");
  const rows = sh.getDataRange().getValues();
  const obj = {};
  rows.forEach(r => { if (r[0]) obj[r[0]] = r[1]; });
  return JSON.stringify(obj);
}

function saveSettings(json) {
  const data = JSON.parse(json);
  const sh = getSheet("settings");
  Object.entries(data).forEach(([k, v]) => {
    const rows = sh.getDataRange().getValues();
    let found = false;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === k) { sh.getRange(i+1, 2).setValue(v); found = true; break; }
    }
    if (!found) sh.appendRow([k, v]);
  });
  return "ok";
}

// ─────────────────────────────────────────
//  スプレッドシート初期セットアップ
//  （初回のみ実行してください）
//
//  実行すると以下をすべて自動作成します：
//   - 7シート（patients / facilities / treatments / teeth_data / patient_medical / photos / settings）
//   - ヘッダー行（太字・紺色背景）
//   - 施設マスター（施設A〜E + 居宅）
//   - 患者サンプルデータ（あとから自由に編集可）
//   - 設定（担当医名・医院名など）
// ─────────────────────────────────────────

function setupSheets() {
  const ss = SpreadsheetApp.openById(SS_ID);
  const today = Utilities.formatDate(new Date(), "JST", "yyyy-MM-dd");

  // ── シート定義 ──────────────────────────
  const SHEET_DEFS = {
    facilities: {
      headers: ["id","name","short","color","visitDays","fax","cm","target"],
      colWidths: [80, 150, 40, 80, 100, 130, 100, 60]
    },
    patients: {
      headers: ["id","name","furi","age","gender","room","fac","cm","status","created_at","notes","birth_date","coverage_type","intake_stage","assigned_doctor","in_hospital","monthly_visit_limit","address"],
      colWidths: [80, 120, 120, 40, 48, 60, 80, 100, 60, 100, 200, 110, 130, 140, 110, 72, 100, 220]
    },
    treatments: {
      headers: ["id","patient_id","fac_id","visit_date","treatments","notes","next_date","next_content","doctor","visit_time_start","visit_time_end","notes_tones","exam_data"],
      colWidths: [120, 80, 80, 90, 200, 200, 90, 150, 100, 82, 82, 140, 220]
    },
    teeth_data: {
      headers: ["patient_id","date","json"],
      colWidths: [80, 90, 400]
    },
    patient_medical: {
      headers: ["patient_id","conditions","medications","allergies","care_level","independence","dementia_level","updated_at"],
      colWidths: [80, 200, 200, 150, 80, 80, 80, 130]
    },
    photos: {
      headers: ["patient_id","file_id","file_url","filename","category","date_taken","uploaded_at"],
      colWidths: [80, 150, 250, 150, 60, 90, 130]
    },
    settings: {
      headers: ["key","value","description"],
      colWidths: [150, 200, 250]
    },
    generated_documents: {
      headers: ["doc_id","kind","slot_key","patient_id","fac_id","period_key","title","saved_at","save_mode","version","drive_file_id","status","is_primary"],
      colWidths: [140, 90, 120, 80, 80, 100, 220, 130, 80, 50, 150, 60, 70]
    }
  };

  // ── シート作成・ヘッダー設定 ──────────────
  Object.entries(SHEET_DEFS).forEach(([name, def]) => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);

    // ヘッダーは空シートのときだけ一括書き込み（既存データがある patients は列追加のみで上書きしない）
    if (sh.getLastRow() === 0) {
      sh.appendRow(def.headers);
    } else if (name !== "patients") {
      sh.getRange(1, 1, 1, def.headers.length).setValues([def.headers]);
    }
    const headerRange = sh.getRange(1, 1, 1, def.headers.length);
    headerRange
      .setFontWeight("bold")
      .setBackground("#1e3a5f")
      .setFontColor("white")
      .setHorizontalAlignment("center");

    // 列幅設定
    def.colWidths.forEach((w, i) => sh.setColumnWidth(i + 1, w));

    // 行の高さ統一、枠線
    sh.setFrozenRows(1);
  });

  // ── 施設マスター ──────────────────────────
  const fsh = ss.getSheetByName("facilities");
  if (fsh.getLastRow() <= 1) {
    // id / name / short / color / visitDays / fax / cm（ケアマネ） / target（月目標人数）
    // ※ FAX番号・ケアマネ名は実際のものに書き換えてください
    const facilities = [
      ["F001","施設A","A","#2563eb","月・木","03-XXXX-0001","担当ケアマネ名を入力",40],
      ["F002","施設B","B","#16a34a","火・金","03-XXXX-0002","担当ケアマネ名を入力",10],
      ["F003","施設C","C","#9333ea","水",    "03-XXXX-0003","担当ケアマネ名を入力",5],
      ["F004","施設D","D","#dc2626","月",    "03-XXXX-0004","担当ケアマネ名を入力",2],
      ["F005","施設E","E","#0891b2","木",    "03-XXXX-0005","担当ケアマネ名を入力",8],
      ["F006","居宅①","居①","#f59e0b","応相談","—","担当ケアマネ名を入力",1],
      ["F007","居宅②","居②","#ec4899","応相談","—","担当ケアマネ名を入力",1],
    ];
    fsh.getRange(2, 1, facilities.length, facilities[0].length).setValues(facilities);
    // 色列に背景色プレビュー（視認性向上）
    facilities.forEach((row, i) => {
      fsh.getRange(i + 2, 4).setBackground(row[3]).setFontColor("white");
    });
    colorRows_(fsh, facilities.length);
  }

  // ── 患者マスター（サンプル） ─────────────
  // ※ 実際の患者名に書き換えてください
  // ※ fac列には上記のid（F001〜F007）を入力してください
  const psh = ss.getSheetByName("patients");
  if (psh.getLastRow() <= 1) {
    // id / name / furi / age / gender / room / fac / cm / status / created_at / notes / birth_date / coverage_type / intake_stage / assigned_doctor
    const patients = [
      // 施設A（目標40名）— ここでは代表5名のみ。残りは追加してください
      ["P001","田中 花子","タナカ ハナコ",82,"","101","F001","担当CM名",  "active",today,"","","介護+医療","",""],
      ["P002","山田 一郎","ヤマダ イチロウ",79,"","102","F001","担当CM名",  "active",today,"","","介護+医療","",""],
      ["P003","佐藤 洋子","サトウ ヨウコ", 88,"","201","F001","担当CM名",  "active",today,"義歯使用","","医療のみ","",""],
      ["P004","鈴木 正夫","スズキ マサオ", 75,"","202","F001","担当CM名",  "active",today,"","","介護+医療","",""],
      ["P005","高橋 幸子","タカハシ サチコ",91,"","203","F001","担当CM名",  "active",today,"","","生保","",""],
      // 施設B（目標10名）
      ["P101","伊藤 健二","イトウ ケンジ", 80,"","101","F002","担当CM名",  "active",today,"","","介護+医療","",""],
      ["P102","渡辺 美子","ワタナベ ヨシコ",85,"","102","F002","担当CM名",  "active",today,"","","介護+医療","",""],
      ["P103","中村 隆",  "ナカムラ タカシ",77,"","103","F002","担当CM名",  "active",today,"","","介護+医療","",""],
      // 施設C（目標5名）
      ["P201","小林 節子","コバヤシ セツコ",83,"","201","F003","担当CM名",  "active",today,"","","介護+医療","",""],
      ["P202","加藤 博",  "カトウ ヒロシ", 90,"","202","F003","担当CM名",  "active",today,"","","介護+医療","",""],
      // 施設D（目標2名）
      ["P301","吉田 誠一","ヨシダ セイイチ",78,"","301","F004","担当CM名",  "active",today,"","","医療のみ","",""],
      ["P302","山口 典子","ヤマグチ ノリコ",86,"","302","F004","担当CM名",  "active",today,"","","介護+医療","",""],
      // 施設E（目標8名）
      ["P401","松本 康雄","マツモト ヤスオ",81,"","101","F005","担当CM名",  "active",today,"","","介護+医療","",""],
      ["P402","井上 文子","イノウエ フミコ",87,"","102","F005","担当CM名",  "active",today,"","","介護+医療","",""],
      ["P403","木村 浩二","キムラ コウジ",  73,"","103","F005","担当CM名",  "active",today,"","","介護+医療","",""],
      // 居宅①②
      ["P501","林 太郎",  "ハヤシ タロウ", 76,"","—", "F006","担当CM名",  "active",today,"","","医療のみ","",""],
      ["P601","清水 春子","シミズ ハルコ", 84,"","—", "F007","担当CM名",  "active",today,"","","介護+医療","",""],
    ];
    psh.getRange(2, 1, patients.length, patients[0].length).setValues(patients);

    // status列に入力規則（プルダウン）
    const statusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(["active","left","deceased"], true).build();
    psh.getRange(2, 8, patients.length).setDataValidation(statusRule);
    colorRows_(psh, patients.length);
  }

  // ── 設定 ─────────────────────────────────
  const sSh = ss.getSheetByName("settings");
  if (sSh.getLastRow() <= 1) {
    const settings = [
      ["doctor_name", "山本 歯科医師",  "担当医の氏名（日報・月報に出力）"],
      ["clinic_name", "山本歯科医院",   "医院名"],
      ["visit_time",  "10:00〜17:00",   "通常の訪問時間帯"],
      ["report_drive_folder", "",       "日報保存先のGoogleドライブフォルダID（空欄=マイドライブ直下）"],
      ["monthly_target", "2",           "月の最低目標診療回数（この回数以上で患者名を緑色表示）"],
      ["month_report_hide_time_facility_substr", "サニーライフ稲毛", "施設名にこの文字列が含まれる場合、月報の訪問行から診療時刻を省略（稲毛様式）"],
      ["month_report_time_fallback", "おおむね20分以上診療いたしました", "診療時刻未入力時に訪問行へ入れる文言（居宅月報）"],
      ["kentai_openai_model", "gpt-4o-mini", "無料検診票LLM用 OpenAI モデル名"],
      ["kentai_llm_default_instructions", "", "無料検診票のLLM既定指示（長文）。空ならスクリプト内フォールバック"],
      ["facility_groups_config", "{\"groups\":[],\"assignments\":{}}", "施設グループ（JSON）。groups=任意名のグループ、assignments=施設ID→グループID"],
    ];
    sSh.getRange(2, 1, settings.length, settings[0].length).setValues(settings);
    // description列を斜体グレーに
    sSh.getRange(2, 3, settings.length).setFontColor("#94a3b8").setFontStyle("italic");
  }

  // 既存 patients シート：不足列だけ追加（ヘッダー行の上書きはしない）
  const pshEnsure = ss.getSheetByName("patients");
  if (pshEnsure && pshEnsure.getLastRow() > 0) {
    ensurePatientsNotesColumn_(pshEnsure);
    ensurePatientsBirthColumn_(pshEnsure);
    ensurePatientsGenderColumn_(pshEnsure);
    ensurePatientsCoverageColumn_(pshEnsure);
    ensurePatientsIntakeStageColumn_(pshEnsure);
    ensurePatientsAssignedDoctorColumn_(pshEnsure);
    ensurePatientsInHospitalColumn_(pshEnsure);
    ensurePatientsMonthlyVisitLimitColumn_(pshEnsure);
    ensurePatientsAddressColumn_(pshEnsure);
  }

  // ── treatments シートに列ヘッダーの説明コメントを追加 ──
  const tsh = ss.getSheetByName("treatments");
  ensureTreatmentTimeColumns_(tsh);
  const thLast = tsh.getLastColumn();
  const treatHeaders = tsh.getRange(1, 1, 1, thLast).getValues()[0];
  const comments = [
    "自動採番","患者ID（P001等）","施設ID（F001等）","診療日（yyyy-MM-dd）",
    "処置内容（カンマ区切り）","特記事項・所見","次回予定日","次回予定内容","担当医名",
    "診療開始時刻（HH:mm・任意・月報用）","診療終了時刻（HH:mm・任意・月報用）"
  ];
  treatHeaders.forEach((_, i) => {
    if (i < comments.length) tsh.getRange(1, i + 1).setNote(comments[i]);
  });

  ss.toast("✅ セットアップ完了！施設A〜E・居宅の患者サンプルデータを作成しました。「患者名」「ケアマネ名」「FAX番号」を実際のものに書き換えてください。", "セットアップ完了", 10);
  try { ensureGeneratedDocumentsSheet_(); } catch (e) {}
  return "セットアップ完了！全シートとサンプルデータを作成しました。";
}

/** 交互行背景色（視認性向上）*/
function colorRows_(sh, numRows) {
  for (let i = 0; i < numRows; i++) {
    const bg = i % 2 === 0 ? "#ffffff" : "#f8fafc";
    sh.getRange(i + 2, 1, 1, sh.getLastColumn()).setBackground(bg);
  }
}

// ─────────────────────────────────────────
//  ユーティリティ
// ─────────────────────────────────────────

function rowToObj(header, row) {
  const obj = {};
  header.forEach(function (h, i) {
    const key = String(h || "").trim();
    if (key) obj[key] = row[i];
  });
  return obj;
}

// ─────────────────────────────────────────
//  報告書プレビュー下書き（Drive・端末間共有）
// ─────────────────────────────────────────

var RPT_DRAFT_FOLDER_NAME_ = "訪問歯科_報告プレビュー下書き";
var RPT_DRAFT_VER_ = 1;
var RPT_DRAFT_CLOUD_CHUNK_ = 35000;

function reportDraftFileName_(kind, id) {
  var safeKind = String(kind || "").replace(/[^\w\-]/g, "_");
  var safeId = String(id || "").replace(/[^\w\-_.]/g, "_");
  return "rptDraft_v" + RPT_DRAFT_VER_ + "_" + safeKind + "_" + safeId + ".json";
}

function reportDraftUploadCacheKey_(kind, id) {
  return "rpt_draft_up_" + reportDraftFileName_(kind, id);
}

function ensureReportDraftFolder_() {
  var propKey = "RPT_DRAFT_FOLDER_ID";
  var id = PropertiesService.getScriptProperties().getProperty(propKey);
  if (id) {
    try {
      return DriveApp.getFolderById(id);
    } catch (e) {}
  }
  var it = DriveApp.getFoldersByName(RPT_DRAFT_FOLDER_NAME_);
  var folder = it.hasNext() ? it.next() : DriveApp.createFolder(RPT_DRAFT_FOLDER_NAME_);
  PropertiesService.getScriptProperties().setProperty(propKey, folder.getId());
  return folder;
}

function findReportDraftFile_(kind, id) {
  var folder = ensureReportDraftFolder_();
  var fname = reportDraftFileName_(kind, id);
  var files = folder.getFilesByName(fname);
  return files.hasNext() ? files.next() : null;
}

function writeReportDraftEnvelope_(kind, id, envelopeJson) {
  var folder = ensureReportDraftFolder_();
  var fname = reportDraftFileName_(kind, id);
  var existing = folder.getFilesByName(fname);
  while (existing.hasNext()) existing.next().setTrashed(true);
  var blob = Utilities.newBlob(String(envelopeJson), "application/json", fname);
  return folder.createFile(blob);
}

function readReportDraftEnvelope_(kind, id) {
  var file = findReportDraftFile_(kind, id);
  if (!file) return null;
  return file.getBlob().getDataAsString("UTF-8");
}

function parseReportDraftEnvelope_(envelopeJson) {
  var o = JSON.parse(String(envelopeJson));
  return {
    savedAt: o.savedAt || 0,
    payload: o.payload != null ? o.payload : null
  };
}

/** 小さな下書きを一括保存 */
function saveReportPreviewDraftSimple(kind, id, envelopeJson) {
  kind = String(kind || "").trim();
  id = String(id || "").trim();
  if (!kind || !id) return JSON.stringify({ ok: false, error: "kind/id required" });
  try {
    writeReportDraftEnvelope_(kind, id, envelopeJson);
    return JSON.stringify({ ok: true });
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e) });
  }
}

/** 大きな下書き：チャンク受信 */
function saveReportPreviewDraftChunk(kind, id, chunkIndex, chunkTotal, chunkData) {
  kind = String(kind || "").trim();
  id = String(id || "").trim();
  chunkIndex = Number(chunkIndex);
  chunkTotal = Number(chunkTotal);
  if (!kind || !id || chunkTotal < 1 || chunkIndex < 0 || chunkIndex >= chunkTotal) {
    return JSON.stringify({ ok: false, error: "invalid chunk" });
  }
  try {
    var cache = CacheService.getScriptCache();
    var baseKey = reportDraftUploadCacheKey_(kind, id);
    cache.put(baseKey + "_part_" + chunkIndex, String(chunkData || ""), 600);
    cache.put(baseKey + "_meta", String(chunkTotal), 600);
    return JSON.stringify({ ok: true });
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e) });
  }
}

/** 大きな下書き：Driveへ確定 */
function saveReportPreviewDraftChunkFinish(kind, id) {
  kind = String(kind || "").trim();
  id = String(id || "").trim();
  if (!kind || !id) return JSON.stringify({ ok: false, error: "kind/id required" });
  try {
    var cache = CacheService.getScriptCache();
    var baseKey = reportDraftUploadCacheKey_(kind, id);
    var totalRaw = cache.get(baseKey + "_meta");
    var chunkTotal = Number(totalRaw);
    if (!chunkTotal || chunkTotal < 1) return JSON.stringify({ ok: false, error: "upload not found" });
    var envelopeJson = "";
    for (var i = 0; i < chunkTotal; i++) {
      var part = cache.get(baseKey + "_part_" + i);
      if (part == null) return JSON.stringify({ ok: false, error: "missing chunk " + i });
      envelopeJson += part;
    }
    writeReportDraftEnvelope_(kind, id, envelopeJson);
    for (var j = 0; j < chunkTotal; j++) {
      cache.remove(baseKey + "_part_" + j);
    }
    cache.remove(baseKey + "_meta");
    return JSON.stringify({ ok: true });
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e) });
  }
}

/** 下書きの有無・小さい場合は本文込み */
function loadReportPreviewDraftInfo(kind, id) {
  kind = String(kind || "").trim();
  id = String(id || "").trim();
  if (!kind || !id) return JSON.stringify({ ok: true, exists: false });
  try {
    var envelopeJson = readReportDraftEnvelope_(kind, id);
    if (!envelopeJson) return JSON.stringify({ ok: true, exists: false });
    if (envelopeJson.length <= RPT_DRAFT_CLOUD_CHUNK_) {
      var parsed = parseReportDraftEnvelope_(envelopeJson);
      return JSON.stringify({
        ok: true,
        exists: true,
        savedAt: parsed.savedAt,
        payload: parsed.payload
      });
    }
    var chunkTotal = Math.ceil(envelopeJson.length / RPT_DRAFT_CLOUD_CHUNK_);
    var parsedLarge = parseReportDraftEnvelope_(envelopeJson);
    return JSON.stringify({
      ok: true,
      exists: true,
      savedAt: parsedLarge.savedAt,
      chunkTotal: chunkTotal
    });
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e), exists: false });
  }
}

/** 大きな下書き：チャンク取得 */
function loadReportPreviewDraftChunk(kind, id, chunkIndex) {
  kind = String(kind || "").trim();
  id = String(id || "").trim();
  chunkIndex = Number(chunkIndex);
  try {
    var envelopeJson = readReportDraftEnvelope_(kind, id);
    if (!envelopeJson) return JSON.stringify({ ok: false, error: "not found" });
    var start = chunkIndex * RPT_DRAFT_CLOUD_CHUNK_;
    if (start >= envelopeJson.length) return JSON.stringify({ ok: false, error: "chunk out of range" });
    var data = envelopeJson.substring(start, start + RPT_DRAFT_CLOUD_CHUNK_);
    return JSON.stringify({ ok: true, data: data });
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e) });
  }
}

/** 下書き削除（他端末からも消える） */
function clearReportPreviewDraft(kind, id) {
  kind = String(kind || "").trim();
  id = String(id || "").trim();
  if (!kind || !id) return JSON.stringify({ ok: false, error: "kind/id required" });
  try {
    var file = findReportDraftFile_(kind, id);
    if (file) file.setTrashed(true);
    var cache = CacheService.getScriptCache();
    var baseKey = reportDraftUploadCacheKey_(kind, id);
    var metaRaw = cache.get(baseKey + "_meta");
    var chunkTotal = Number(metaRaw);
    if (chunkTotal > 0) {
      for (var i = 0; i < chunkTotal; i++) cache.remove(baseKey + "_part_" + i);
      cache.remove(baseKey + "_meta");
    }
    return JSON.stringify({ ok: true });
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e) });
  }
}

// ─────────────────────────────────────────
//  確定保存書類アーカイブ（スプレッドシート索引＋Drive本文）
// ─────────────────────────────────────────

var DOC_ARCHIVE_FOLDER_NAME_ = "訪問歯科_書類アーカイブ";
var DOC_ARCHIVE_VER_ = 1;
var DOC_ARCHIVE_CHUNK_ = 35000;

function docArchiveFileName_(docId) {
  return "docArchive_v" + DOC_ARCHIVE_VER_ + "_" + String(docId || "").replace(/[^\w\-_.]/g, "_") + ".json";
}

function docArchiveUploadCacheKey_(docId) {
  return "doc_arc_up_" + docArchiveFileName_(docId);
}

function ensureGeneratedDocumentsSheet_() {
  if (!SS_ID) throw new Error("SS_ID未設定");
  var ss = SpreadsheetApp.openById(SS_ID);
  var sh = ss.getSheetByName("generated_documents");
  var headers = ["doc_id", "kind", "slot_key", "patient_id", "fac_id", "period_key", "title", "saved_at", "save_mode", "version", "drive_file_id", "status", "is_primary"];
  if (!sh) {
    sh = ss.insertSheet("generated_documents");
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#1e3a5f").setFontColor("white").setHorizontalAlignment("center");
    sh.setFrozenRows(1);
  } else if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#1e3a5f").setFontColor("white");
    sh.setFrozenRows(1);
  }
  return sh;
}

function ensureDocArchiveFolder_() {
  var propKey = "DOC_ARCHIVE_FOLDER_ID";
  var id = PropertiesService.getScriptProperties().getProperty(propKey);
  if (id) {
    try {
      return DriveApp.getFolderById(id);
    } catch (e) {}
  }
  var it = DriveApp.getFoldersByName(DOC_ARCHIVE_FOLDER_NAME_);
  var folder = it.hasNext() ? it.next() : DriveApp.createFolder(DOC_ARCHIVE_FOLDER_NAME_);
  PropertiesService.getScriptProperties().setProperty(propKey, folder.getId());
  return folder;
}

function newDocArchiveId_() {
  return "DOC_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
}

function parseDocArchiveMeta_(metaJson) {
  var o = JSON.parse(String(metaJson || "{}"));
  return {
    kind: String(o.kind || "").trim(),
    slot_key: String(o.slot_key || "").trim(),
    patient_id: String(o.patient_id || "").trim(),
    fac_id: String(o.fac_id || "").trim(),
    period_key: String(o.period_key || "").trim(),
    title: String(o.title || "").trim(),
    save_mode: String(o.save_mode || "overwrite").trim(),
    status: String(o.status || "final").trim()
  };
}

function findPrimaryDocRowIndex_(sh, kind, slotKey) {
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) === kind && String(rows[i][2]) === slotKey && String(rows[i][12]) === "1") {
      return i + 1;
    }
  }
  return 0;
}

function maxDocVersionForSlot_(sh, kind, slotKey) {
  var rows = sh.getDataRange().getValues();
  var maxV = 0;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) === kind && String(rows[i][2]) === slotKey) {
      var v = Number(rows[i][9]) || 0;
      if (v > maxV) maxV = v;
    }
  }
  return maxV;
}

function clearPrimaryFlagForSlot_(sh, kind, slotKey, exceptDocId) {
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) === kind && String(rows[i][2]) === slotKey && String(rows[i][12]) === "1") {
      if (exceptDocId && String(rows[i][0]) === exceptDocId) continue;
      sh.getRange(i + 1, 13).setValue("0");
    }
  }
}

function writeDocArchiveFile_(docId, envelopeJson) {
  var folder = ensureDocArchiveFolder_();
  var fname = docArchiveFileName_(docId);
  var existing = folder.getFilesByName(fname);
  while (existing.hasNext()) existing.next().setTrashed(true);
  return folder.createFile(Utilities.newBlob(String(envelopeJson), "application/json", fname));
}

function readDocArchiveEnvelope_(docId) {
  var folder = ensureDocArchiveFolder_();
  var fname = docArchiveFileName_(docId);
  var files = folder.getFilesByName(fname);
  if (!files.hasNext()) return null;
  return files.next().getBlob().getDataAsString("UTF-8");
}

function upsertGeneratedDocumentRow_(meta, docId, driveFileId, savedAt, version, isPrimary) {
  var sh = ensureGeneratedDocumentsSheet_();
  var kind = meta.kind;
  var slotKey = meta.slot_key;
  var saveMode = meta.save_mode;
  var rowValues = [
    docId, kind, slotKey, meta.patient_id, meta.fac_id, meta.period_key, meta.title,
    savedAt, saveMode, version, driveFileId, meta.status, isPrimary ? "1" : "0"
  ];
  if (saveMode === "overwrite") {
    clearPrimaryFlagForSlot_(sh, kind, slotKey, docId);
    var rowIdx = findPrimaryDocRowIndex_(sh, kind, slotKey);
    if (rowIdx > 0 && String(sh.getRange(rowIdx, 1).getValue()) === docId) {
      sh.getRange(rowIdx, 1, rowIdx, rowValues.length).setValues([rowValues]);
      return docId;
    }
    if (rowIdx > 0) {
      var oldDocId = String(sh.getRange(rowIdx, 1).getValue());
      try {
        var oldFid = String(sh.getRange(rowIdx, 11).getValue());
        if (oldFid) DriveApp.getFileById(oldFid).setTrashed(true);
      } catch (ignore) {}
      sh.getRange(rowIdx, 1, rowIdx, rowValues.length).setValues([rowValues]);
      return oldDocId || docId;
    }
    sh.appendRow(rowValues);
    return docId;
  }
  sh.appendRow(rowValues);
  return docId;
}

function finalizeGeneratedDocumentSave_(metaJson, envelopeJson) {
  var meta = parseDocArchiveMeta_(metaJson);
  if (!meta.kind || !meta.slot_key) throw new Error("kind/slot_key required");
  var parsed = JSON.parse(String(envelopeJson));
  var savedAt = Number(parsed.savedAt) || Date.now();
  var sh = ensureGeneratedDocumentsSheet_();
  var saveMode = meta.save_mode === "new" ? "new" : "overwrite";
  meta.save_mode = saveMode;
  var version = maxDocVersionForSlot_(sh, meta.kind, meta.slot_key) + 1;
  var docId = saveMode === "overwrite" ? (function () {
    var idx = findPrimaryDocRowIndex_(sh, meta.kind, meta.slot_key);
    return idx > 0 ? String(sh.getRange(idx, 1).getValue()) : newDocArchiveId_();
  })() : newDocArchiveId_();
  var isPrimary = saveMode === "overwrite";
  if (isPrimary) clearPrimaryFlagForSlot_(sh, meta.kind, meta.slot_key, docId);
  var file = writeDocArchiveFile_(docId, envelopeJson);
  upsertGeneratedDocumentRow_(meta, docId, file.getId(), savedAt, version, isPrimary);
  return { docId: docId, version: version, savedAt: savedAt };
}

/** 確定保存（小さい本文を一括） */
function saveGeneratedDocumentSimple(metaJson, envelopeJson) {
  try {
    var result = finalizeGeneratedDocumentSave_(metaJson, envelopeJson);
    return JSON.stringify({ ok: true, docId: result.docId, version: result.version, savedAt: result.savedAt });
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e) });
  }
}

/** 確定保存：チャンク受信 */
function saveGeneratedDocumentChunk(docId, chunkIndex, chunkTotal, chunkData) {
  docId = String(docId || "").trim();
  chunkIndex = Number(chunkIndex);
  chunkTotal = Number(chunkTotal);
  if (!docId || chunkTotal < 1 || chunkIndex < 0 || chunkIndex >= chunkTotal) {
    return JSON.stringify({ ok: false, error: "invalid chunk" });
  }
  try {
    var cache = CacheService.getScriptCache();
    var baseKey = docArchiveUploadCacheKey_(docId);
    cache.put(baseKey + "_part_" + chunkIndex, String(chunkData || ""), 600);
    cache.put(baseKey + "_meta", String(chunkTotal), 600);
    return JSON.stringify({ ok: true });
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e) });
  }
}

/** 確定保存：チャンク確定 */
function saveGeneratedDocumentChunkFinish(metaJson, docId) {
  docId = String(docId || "").trim();
  if (!docId) return JSON.stringify({ ok: false, error: "docId required" });
  try {
    var cache = CacheService.getScriptCache();
    var baseKey = docArchiveUploadCacheKey_(docId);
    var chunkTotal = Number(cache.get(baseKey + "_meta"));
    if (!chunkTotal || chunkTotal < 1) return JSON.stringify({ ok: false, error: "upload not found" });
    var envelopeJson = "";
    for (var i = 0; i < chunkTotal; i++) {
      var part = cache.get(baseKey + "_part_" + i);
      if (part == null) return JSON.stringify({ ok: false, error: "missing chunk " + i });
      envelopeJson += part;
    }
    var result = finalizeGeneratedDocumentSave_(metaJson, envelopeJson);
    for (var j = 0; j < chunkTotal; j++) cache.remove(baseKey + "_part_" + j);
    cache.remove(baseKey + "_meta");
    return JSON.stringify({ ok: true, docId: result.docId, version: result.version, savedAt: result.savedAt });
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e) });
  }
}

/** 書類一覧（filterJson: kind, patient_id, fac_id, period_key, limit） */
function listGeneratedDocuments(filterJson) {
  try {
    var sh = ensureGeneratedDocumentsSheet_();
    var filter = {};
    try {
      filter = JSON.parse(String(filterJson || "{}"));
    } catch (ignore) {}
    var kindF = String(filter.kind || "").trim();
    var pidF = String(filter.patient_id || "").trim();
    var facF = String(filter.fac_id || "").trim();
    var periodF = String(filter.period_key || "").trim();
    var limit = Math.min(Math.max(Number(filter.limit) || 80, 1), 200);
    var rows = sh.getDataRange().getValues();
    var out = [];
    for (var i = rows.length - 1; i >= 1 && out.length < limit; i--) {
      var r = rows[i];
      if (kindF && String(r[1]) !== kindF) continue;
      if (pidF && String(r[3]) !== pidF) continue;
      if (facF && String(r[4]) !== facF) continue;
      if (periodF && String(r[5]).indexOf(periodF) !== 0) continue;
      out.push({
        doc_id: String(r[0]),
        kind: String(r[1]),
        slot_key: String(r[2]),
        patient_id: String(r[3]),
        fac_id: String(r[4]),
        period_key: String(r[5]),
        title: String(r[6]),
        saved_at: Number(r[7]) || 0,
        save_mode: String(r[8]),
        version: Number(r[9]) || 0,
        status: String(r[11]),
        is_primary: String(r[12]) === "1"
      });
    }
    return JSON.stringify({ ok: true, items: out });
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e), items: [] });
  }
}

/** 書類読込（小さい場合は本文込み） */
function loadGeneratedDocument(docId) {
  docId = String(docId || "").trim();
  if (!docId) return JSON.stringify({ ok: false, error: "docId required" });
  try {
    ensureGeneratedDocumentsSheet_();
    var envelopeJson = readDocArchiveEnvelope_(docId);
    if (!envelopeJson) return JSON.stringify({ ok: false, error: "not found" });
    var parsed = JSON.parse(envelopeJson);
    if (envelopeJson.length <= DOC_ARCHIVE_CHUNK_) {
      return JSON.stringify({
        ok: true,
        docId: docId,
        savedAt: parsed.savedAt || 0,
        meta: parsed.meta || null,
        payload: parsed.payload != null ? parsed.payload : null
      });
    }
    var chunkTotal = Math.ceil(envelopeJson.length / DOC_ARCHIVE_CHUNK_);
    return JSON.stringify({
      ok: true,
      docId: docId,
      savedAt: parsed.savedAt || 0,
      meta: parsed.meta || null,
      chunkTotal: chunkTotal
    });
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e) });
  }
}

/** 大きな書類：チャンク取得 */
function loadGeneratedDocumentChunk(docId, chunkIndex) {
  docId = String(docId || "").trim();
  chunkIndex = Number(chunkIndex);
  try {
    var envelopeJson = readDocArchiveEnvelope_(docId);
    if (!envelopeJson) return JSON.stringify({ ok: false, error: "not found" });
    var start = chunkIndex * DOC_ARCHIVE_CHUNK_;
    if (start >= envelopeJson.length) return JSON.stringify({ ok: false, error: "chunk out of range" });
    return JSON.stringify({
      ok: true,
      data: envelopeJson.substring(start, start + DOC_ARCHIVE_CHUNK_)
    });
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e) });
  }
}

/** 書類削除（Driveファイルごと） */
function deleteGeneratedDocument(docId) {
  docId = String(docId || "").trim();
  if (!docId) return JSON.stringify({ ok: false, error: "docId required" });
  try {
    var sh = ensureGeneratedDocumentsSheet_();
    var rows = sh.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === docId) {
        try {
          var fid = String(rows[i][10]);
          if (fid) DriveApp.getFileById(fid).setTrashed(true);
        } catch (ignore) {}
        sh.deleteRow(i + 1);
        break;
      }
    }
    var file = readDocArchiveEnvelope_(docId);
    if (file) {
      var folder = ensureDocArchiveFolder_();
      var fname = docArchiveFileName_(docId);
      var files = folder.getFilesByName(fname);
      while (files.hasNext()) files.next().setTrashed(true);
    }
    return JSON.stringify({ ok: true });
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e) });
  }
}

// ─────────────────────────────────────────
//  ⑥ 患者パーソナルシート（歯科治療・管理計画書）
// ─────────────────────────────────────────

function formatPersonalSheetMedList_(arr) {
  if (!Array.isArray(arr)) return "";
  return arr.map(function (x) {
    if (typeof x === "string") return String(x).trim();
    if (x && x.name) {
      var line = String(x.name).trim();
      if (x.cat) line = "[" + String(x.cat).trim() + "] " + line;
      if (x.brand) line += "（" + String(x.brand).trim() + "）";
      return line;
    }
    return "";
  }).filter(function (s) { return s; }).join("\n");
}

function computeAgeFromBirthDate_(birthYmd) {
  var s = String(birthYmd || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  var parts = s.split("-");
  var y = parseInt(parts[0], 10);
  var m = parseInt(parts[1], 10);
  var d = parseInt(parts[2], 10);
  if (!y) return "";
  var now = new Date();
  var age = now.getFullYear() - y;
  var md = (now.getMonth() + 1) * 100 + now.getDate();
  var bd = m * 100 + d;
  if (bd > md) age--;
  return age >= 0 ? String(age) : "";
}

function formatBirthDateKanji_(birthYmd) {
  var s = String(birthYmd || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  var p = s.split("-");
  return parseInt(p[0], 10) + "年" + parseInt(p[1], 10) + "月" + parseInt(p[2], 10) + "日";
}

/** yyyy-MM-dd → 和暦（例: 平成14年5月4日） */
function formatDateWareki_(ymd) {
  var s = String(ymd || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  var p = s.split("-");
  var y = parseInt(p[0], 10);
  var m = parseInt(p[1], 10);
  var d = parseInt(p[2], 10);
  var era, ey;
  if (y > 2019 || (y === 2019 && (m > 5 || (m === 5 && d >= 1)))) {
    era = "令和";
    ey = y - 2018;
  } else if (y > 1989 || (y === 1989 && (m > 1 || (m === 1 && d >= 8)))) {
    era = "平成";
    ey = y - 1988;
  } else if (y >= 1926) {
    if (y === 1926 && (m < 12 || (m === 12 && d < 25))) return "";
    era = "昭和";
    ey = y - 1925;
  } else {
    return "";
  }
  return era + ey + "年" + m + "月" + d + "日";
}

function buildPersonalSheetNotesSummary_(records) {
  var lines = [];
  (records || []).slice().sort(function (a, b) {
    return String(b.visit_date || "").localeCompare(String(a.visit_date || ""));
  }).slice(0, 6).forEach(function (r) {
    var n = String(r.notes || "").trim();
    if (!n) return;
    var d = String(r.visit_date || "").slice(0, 10);
    lines.push((d ? d + "：" : "") + n);
  });
  return lines.join("\n");
}

function formatPersonalSheetBulletBlock_(text) {
  if (!text || !String(text).trim()) return "";
  return String(text).split(/\n+/).map(function (line) {
    var t = String(line).trim();
    if (!t) return "";
    if (/^[・•\-]/.test(t) || /^\d+\.\s/.test(t)) return t;
    return "・" + t;
  }).filter(function (s) { return s; }).join("\n");
}

function buildPersonalSheetPlanCategoriesHint_(records) {
  var sorted = (records || []).slice().sort(function (a, b) {
    return String(b.visit_date || "").localeCompare(String(a.visit_date || ""));
  });
  for (var i = 0; i < sorted.length; i++) {
    var tones = String(sorted[i].notes_tones || "").trim();
    if (tones) return tones;
  }
  return "";
}

function buildPersonalSheetTreatmentPlanHint_(records) {
  var parts = [];
  (records || []).slice().sort(function (a, b) {
    return String(a.visit_date || "").localeCompare(String(b.visit_date || ""));
  }).forEach(function (r) {
    var d = String(r.visit_date || "").slice(0, 10);
    var t = String(r.treatments || "").trim();
    var nx = String(r.next_content || "").trim();
    var nd = r.next_date ? String(r.next_date).slice(0, 10) : "";
    if (t) parts.push((d ? "【" + d + "】" : "") + "処置：" + t);
    if (nx || nd) parts.push("  次回：" + (nd || "—") + (nx ? " " + nx : ""));
  });
  return parts.join("\n");
}

/**
 * 患者パーソナルシート用データ（歯科治療・管理計画書）
 * @param {string} patientId
 * @param {string} ymOpt "yyyy-MM"
 * @return {string} JSON
 */
function getPatientPersonalSheetData(patientId, ymOpt) {
  var pid = String(patientId || "").trim();
  if (!pid) return JSON.stringify({ ok: false, error: "患者IDが必要です" });
  var ym = (ymOpt && /^\d{4}-\d{2}$/.test(String(ymOpt).trim()))
    ? String(ymOpt).trim()
    : Utilities.formatDate(new Date(), "JST", "yyyy-MM-dd").slice(0, 7);
  try {
    var patients = JSON.parse(getPatients(null));
    var p = patients.find(function (x) { return String(x.id) === pid; });
    if (!p) return JSON.stringify({ ok: false, error: "患者が見つかりません" });
    var facilities = JSON.parse(getFacilities());
    var fac = facilities.find(function (f) { return String(f.id) === String(p.fac); });
    var settings = JSON.parse(getSettings());
    var medRaw = JSON.parse(getMedicalInfo(pid));
    var teethJson = getTeethData(pid);
    var records = JSON.parse(getMonthlyRecords(ym)).filter(function (t) {
      return String(t.patient_id) === pid;
    });
    var today = Utilities.formatDate(new Date(), "JST", "yyyy-MM-dd");
    var tp = today.split("-");
    var birth = p.birth_date ? String(p.birth_date).slice(0, 10) : "";
    var age = computeAgeFromBirthDate_(birth);
    if (!age && p.age != null && String(p.age).trim() !== "") age = String(p.age).trim();
    var condText = formatPersonalSheetMedList_(medRaw.conditions);
    var medText = formatPersonalSheetMedList_(medRaw.medications);
    var allergyText = formatPersonalSheetMedList_(medRaw.allergies);
    var genParts = [];
    if (medRaw.care_level) genParts.push("要介護度：" + medRaw.care_level);
    if (medRaw.independence) genParts.push("自立度：" + medRaw.independence);
    if (medRaw.dementia_level) genParts.push("認知症自立度：" + medRaw.dementia_level);
    if (medText) genParts.push("服薬：\n" + medText);
    var specialParts = [];
    if (condText) specialParts.push("【既往歴・病名】\n" + condText);
    if (allergyText) specialParts.push("【アレルギー】\n" + allergyText);
    if (p.notes && String(p.notes).trim()) specialParts.push("【患者メモ】\n" + String(p.notes).trim());
    var specialBullet = formatPersonalSheetBulletBlock_(specialParts.join("\n\n"));
    var generalBullet = formatPersonalSheetBulletBlock_(genParts.join("\n"));
    var planCatHint = buildPersonalSheetPlanCategoriesHint_(records);
    var planAuto = buildPersonalSheetTreatmentPlanHint_(records);
    return JSON.stringify({
      ok: true,
      patient_id: pid,
      facility_id: p.fac ? String(p.fac) : "",
      facility_name: fac ? String(fac.name) : "",
      clinic_name: settings.clinic_name || "",
      doctor_name: settings.doctor_name || "",
      room: p.room != null ? String(p.room) : "",
      name: p.name || "",
      birth_date: birth,
      birth_date_kanji: formatBirthDateKanji_(birth),
      age: age,
      entry_year: tp[0],
      entry_month: String(parseInt(tp[1], 10)),
      entry_day: String(parseInt(tp[2], 10)),
      entry_date_ymd: today,
      special_notes: specialBullet,
      general_condition: generalBullet,
      medical_history: condText,
      medications: medText,
      plan_categories_hint: planCatHint,
      plan_comment_hint: planAuto,
      treatment_plan_auto: planAuto,
      teeth_json: teethJson || "{}",
      ym: ym
    });
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e) });
  }
}

/**
 * ⑩診断書用データ
 * @param {string} patientId
 * @param {string} issueDateYmdOpt yyyy-MM-dd（省略時は今日）
 * @return {string} JSON
 */
function getDiagnosisCertificateData(patientId, issueDateYmdOpt) {
  var pid = String(patientId || "").trim();
  if (!pid) return JSON.stringify({ ok: false, error: "患者IDが必要です" });
  var issueYmd = String(issueDateYmdOpt || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issueYmd)) {
    issueYmd = Utilities.formatDate(new Date(), "JST", "yyyy-MM-dd");
  }
  try {
    var patients = JSON.parse(getPatients(null));
    var p = patients.find(function (x) { return String(x.id) === pid; });
    if (!p) return JSON.stringify({ ok: false, error: "患者が見つかりません" });
    var settings = JSON.parse(getSettings());
    var medRaw = JSON.parse(getMedicalInfo(pid));
    var birth = p.birth_date ? String(p.birth_date).slice(0, 10) : "";
    var age = computeAgeFromBirthDate_(birth);
    if (!age && p.age != null && String(p.age).trim() !== "") age = String(p.age).trim();
    var birthWareki = formatDateWareki_(birth);
    var ageParen = age ? "(" + age + "歳)" : "";
    var condText = formatPersonalSheetMedList_(medRaw.conditions);
    return JSON.stringify({
      ok: true,
      patient_id: pid,
      facility_id: p.fac ? String(p.fac) : "",
      issue_date_ymd: issueYmd,
      issue_date_wareki: formatDateWareki_(issueYmd),
      title: "診　断　書",
      address: p.address != null ? String(p.address).trim() : "",
      name: p.name || "",
      birth_date_wareki: birthWareki,
      age_paren: ageParen,
      disease_names: "",
      diagnosis_body: "",
      clinic_name: settings.clinic_name || "",
      clinic_address: settings.clinic_address || "",
      clinic_location_detail: settings.clinic_location_detail || "",
      clinic_tel: settings.clinic_tel || "",
      doctor_name: settings.doctor_name || "",
      medical_history_hint: condText || ""
    });
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e) });
  }
}
