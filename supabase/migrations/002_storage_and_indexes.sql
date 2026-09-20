-- 訪問歯科カルテ — Supabase 拡張（性能・帳票下書き）
-- 001 実行後に SQL Editor で Run

-- FAX 日報・月次集計の高速化
create index if not exists idx_treatments_fac_visit on treatments(fac_id, visit_date);

-- 帳票プレビュー下書き（GAS Drive JSON の Supabase 版）
create table if not exists report_preview_drafts (
  kind text not null,
  draft_id text not null,
  envelope text not null default '',
  saved_at bigint not null default 0,
  updated_at timestamptz default now(),
  primary key (kind, draft_id)
);

-- 大きな下書きのチャンク受信（GAS CacheService 代替、600 秒 TTL）
create table if not exists upload_chunks (
  cache_key text not null,
  chunk_index integer not null,
  chunk_data text not null default '',
  chunk_total integer,
  expires_at timestamptz not null,
  primary key (cache_key, chunk_index)
);

create index if not exists idx_upload_chunks_expires on upload_chunks(expires_at);

-- photos: Drive file_id 列（Sheets の file_id 互換）
alter table photos add column if not exists drive_file_id text default '';

create index if not exists idx_photos_drive_file on photos(drive_file_id);

-- generated_documents: Drive file_id（第1版は Drive 継続）
alter table generated_documents add column if not exists drive_file_id text default '';
alter table generated_documents add column if not exists envelope text default '';

alter table report_preview_drafts enable row level security;
alter table upload_chunks enable row level security;
