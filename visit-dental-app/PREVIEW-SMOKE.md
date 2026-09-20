# Preview 手動スモーク（Bプラン切替前）

本番は触らず、**Preview URL** だけで確認してください。

## 事前

1. Supabase で `001` と `002` の SQL を実行済み
2. `npm run import:supabase` でデータ投入済み
3. Vercel Preview に `VITE_RPC_BACKEND=supabase` が入っている
4. Preview URL の `/api/supabase-check` が `ok: true`・`implementedRpcCount: 54`

## チェックリスト

- [ ] アプリが開く（患者・施設が見える）
- [ ] 診療記録の保存・更新
- [ ] 施設日報（FAX）の読み込み
- [ ] 施設日報の下書き保存・履歴
- [ ] 印刷 / PDF
- [ ] 上司向け日次リスト
- [ ] 月次報告書（患者 or 施設）を1つ以上
- [ ] 写真の一覧表示（Drive 設定後は追加も）
- [ ] 確定保存・履歴

1つでも失敗したら **本番は切替えない**。`VITE_RPC_BACKEND=gas` のまま運用を続けてください。
