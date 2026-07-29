-- 訪問歯科カルテ — Supabase 試用版スキーマ（Sheets 互換）
-- Supabase Dashboard → SQL Editor で実行、または CLI: supabase db push

create extension if not exists "pgcrypto";

-- 施設
create table if not exists facilities (
  id text primary key,
  name text not null default '',
  short text default '',
  color text default '#94a3b8',
  visit_days text default '',
  fax text default '',
  cm text default '',
  target integer default 10
);

-- 患者
create table if not exists patients (
  id text primary key,
  name text not null default '',
  furi text default '',
  age text default '',
  gender text default '',
  room text default '',
  fac text references facilities(id) on delete set null,
  cm text default '',
  status text default 'active',
  created_at timestamptz default now(),
  notes text default '',
  birth_date text default '',
  coverage_type text default '',
  intake_stage text default '',
  assigned_doctor text default '',
  in_hospital text default '',
  monthly_visit_limit text default '',
  address text default ''
);

create index if not exists idx_patients_status on patients(status);
create index if not exists idx_patients_fac on patients(fac);

-- 診療記録
create table if not exists treatments (
  id text primary key,
  patient_id text not null references patients(id) on delete cascade,
  fac_id text references facilities(id) on delete set null,
  visit_date text not null default '',
  treatments text default '',
  notes text default '',
  next_date text default '',
  next_content text default '',
  doctor text default '',
  visit_time_start text default '',
  visit_time_end text default '',
  notes_tones text default '',
  exam_data text default ''
);

create index if not exists idx_treatments_patient on treatments(patient_id);
create index if not exists idx_treatments_visit_date on treatments(visit_date);
create index if not exists idx_treatments_fac on treatments(fac_id);

-- 歯式（履歴付き append）
create table if not exists teeth_data (
  id bigserial primary key,
  patient_id text not null references patients(id) on delete cascade,
  date text not null default '',
  json text not null default '{}',
  created_at timestamptz default now()
);

create index if not exists idx_teeth_data_patient on teeth_data(patient_id, id desc);

-- 医療情報
create table if not exists patient_medical (
  patient_id text primary key references patients(id) on delete cascade,
  conditions jsonb not null default '[]'::jsonb,
  medications jsonb not null default '[]'::jsonb,
  allergies jsonb not null default '[]'::jsonb,
  care_level text default '',
  independence text default '',
  dementia_level text default '',
  updated_at timestamptz default now()
);

-- 設定（key-value）
create table if not exists settings (
  key text primary key,
  value text not null default '',
  description text default ''
);

-- 写真メタ（試用 v0 では API 未実装だがスキーマのみ）
create table if not exists photos (
  id bigserial primary key,
  patient_id text not null references patients(id) on delete cascade,
  storage_path text default '',
  file_url text default '',
  filename text default '',
  category text default '',
  date_taken text default '',
  uploaded_at timestamptz default now()
);

create index if not exists idx_photos_patient on photos(patient_id);

-- 確定保存帳票メタ（将来用）
create table if not exists generated_documents (
  doc_id text primary key,
  kind text default '',
  slot_key text default '',
  patient_id text default '',
  fac_id text default '',
  period_key text default '',
  title text default '',
  saved_at timestamptz default now(),
  save_mode text default '',
  version integer default 1,
  storage_path text default '',
  status text default '',
  is_primary boolean default false
);

-- RLS: 試用版は API が service role でアクセス（Auth なし）
alter table facilities enable row level security;
alter table patients enable row level security;
alter table treatments enable row level security;
alter table teeth_data enable row level security;
alter table patient_medical enable row level security;
alter table settings enable row level security;
alter table photos enable row level security;
alter table generated_documents enable row level security;
