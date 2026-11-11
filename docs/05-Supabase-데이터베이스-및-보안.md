# 05. Supabase 데이터베이스 및 보안 지침

## 테이블: feedback
| 컬럼 | 형식 | 규칙 |
|---|---|---|
| id | uuid | 기본값 gen_random_uuid(), 기본키 |
| display_name | text | 기본값 '익명', 최대 30자 |
| content | text | 필수, 1~500자 |
| created_at | timestamptz | 기본값 now() |

## SQL 기준
```sql
create extension if not exists pgcrypto;

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  display_name text not null default '익명'
    check (char_length(display_name) between 1 and 30),
  content text not null
    check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;
```

## 접근 방식
- 브라우저가 Supabase에 직접 쓰기 요청을 보내지 않고 Node.js API를 거친다.
- 서버에서 Supabase SDK로 insert/select 한다.
- 서버 환경 변수에 `SUPABASE_URL`, `SUPABASE_ANON_KEY`를 둔다.
- 서버 측에서 anon key를 사용하는 경우에도 RLS 정책을 명시적으로 설정하고 테스트한다.
- 더 높은 권한이 필요한 설계라면 service role 키를 서버에만 보관하고 절대 클라이언트에 전달하지 않는다.

## RLS 정책 결정
구현자는 실제 접근 방식에 맞는 최소 권한 정책을 추가한다.
- 서버가 anon key로 읽고 쓰는 구조라면 필요한 SELECT/INSERT 정책을 SQL로 명시한다.
- 서버가 service role 키로만 접근한다면 service role은 RLS를 우회하므로 서버 입력 검증과 요청 제한을 반드시 적용한다.
- 정책을 설정하지 않은 채 “보안상 괜찮다”고 가정하지 않는다.

## 개인정보 및 스팸
- 피드백 폼에 개인정보를 적지 말라는 문구를 표시한다.
- IP 주소 등 식별 정보를 불필요하게 저장하지 않는다.
- 중복 제출 및 자동화 요청을 줄이기 위해 서버 측 rate limit 또는 Vercel 환경에 적합한 제한 방식을 적용한다.
- 공개 피드백은 누구나 볼 수 있으므로 욕설·개인정보 신고/삭제 절차는 향후 운영 정책으로 분리한다.

## 완료 기준
- 피드백 생성 후 Supabase 대시보드에서 행을 확인할 수 있다.
- 새로고침 후에도 피드백이 조회된다.
- RLS 정책과 서버 권한 구조가 문서와 일치한다.
- 환경 변수 누락 시 안전한 오류를 반환한다.
