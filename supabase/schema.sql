-- ============================================================
-- 포켓몬 상성 알리미 — Supabase 스키마
-- ============================================================
-- 이 SQL을 Supabase 대시보드 → SQL Editor에서 실행하세요.
-- 순서대로 실행하면 feedback 테이블과 보안 정책이 생성됩니다.
-- ============================================================


-- ──────────────────────────────────────────────
-- 1) pgcrypto 확장 활성화
--    gen_random_uuid() 함수를 사용하기 위해 필요합니다.
-- ──────────────────────────────────────────────
create extension if not exists pgcrypto;


-- ──────────────────────────────────────────────
-- 2) feedback 테이블 생성
--    사용자들이 남기는 익명 피드백을 저장하는 테이블입니다.
-- ──────────────────────────────────────────────
create table if not exists public.feedback (

  -- id: 각 피드백의 고유 식별자 (UUID 자동 생성)
  id uuid primary key default gen_random_uuid(),

  -- display_name: 작성자 표시 이름
  --   - 입력하지 않으면 '익명'이 기본값
  --   - 최소 1자, 최대 30자까지 허용
  display_name text not null default '익명'
    check (char_length(display_name) between 1 and 30),

  -- content: 피드백 내용 (필수)
  --   - 최소 1자, 최대 500자까지 허용
  content text not null
    check (char_length(content) between 1 and 500),

  -- created_at: 작성 시각 (자동 기록, 한국 시간대로 표시 가능)
  created_at timestamptz not null default now()
);


-- ──────────────────────────────────────────────
-- 3) RLS(Row Level Security) 활성화
--    테이블에 대한 접근을 정책으로 제어합니다.
--    RLS를 켜지 않으면 anon 키로 모든 데이터에 접근 가능해져 위험합니다.
-- ──────────────────────────────────────────────
alter table public.feedback enable row level security;


-- ──────────────────────────────────────────────
-- 4) RLS 정책: 누구나 피드백 목록을 읽을 수 있음 (SELECT)
--    익명 사용자(anon)도 피드백을 조회할 수 있도록 허용합니다.
-- ──────────────────────────────────────────────
create policy "피드백 읽기 허용"
  on public.feedback
  for select
  to anon
  using (true);


-- ──────────────────────────────────────────────
-- 5) RLS 정책: 누구나 피드백을 작성할 수 있음 (INSERT)
--    익명 사용자(anon)도 피드백을 남길 수 있도록 허용합니다.
--    단, 서버 측에서 입력 검증과 rate limit을 반드시 적용합니다.
-- ──────────────────────────────────────────────
create policy "피드백 쓰기 허용"
  on public.feedback
  for insert
  to anon
  with check (true);


-- ──────────────────────────────────────────────
-- 6) 인덱스: 최신순 정렬 성능 향상
--    피드백 목록을 created_at 내림차순으로 빠르게 조회하기 위한 인덱스
-- ──────────────────────────────────────────────
create index if not exists idx_feedback_created_at
  on public.feedback (created_at desc);


-- ============================================================
-- ✅ 완료!
-- Supabase 대시보드 → Table Editor에서 feedback 테이블이
-- 생성되었는지 확인하세요.
-- ============================================================
