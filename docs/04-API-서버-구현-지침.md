# 04. API 및 서버 구현 지침

## 공통 규칙
- 모든 API는 JSON을 주고받는다.
- 성공/실패 응답의 구조를 통일한다.
- 입력 검증과 요청 제한은 서버에서 수행한다.
- 클라이언트에 OpenAI 또는 Supabase 비밀 키를 전달하지 않는다.

## POST /api/analyze
요청:
```json
{ "pokemonName": "피카츄" }
```
성공:
```json
{
  "ok": true,
  "data": {
    "pokemonName": "피카츄",
    "types": ["전기"],
    "weaknesses": [{"type": "땅", "multiplier": 2}],
    "resistances": [{"type": "전기", "multiplier": 0.5}],
    "immunities": [],
    "strategy": ["땅 타입 기술을 고려하세요."],
    "abilityNotes": [],
    "caveat": "게임 버전과 폼에 따라 차이가 있을 수 있습니다."
  }
}
```
실패:
```json
{
  "ok": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "포켓몬 이름을 입력해 주세요."
  }
}
```

## POST /api/feedback
요청:
```json
{
  "displayName": "익명",
  "content": "검색 결과가 이해하기 쉬웠어요."
}
```
성공:
```json
{ "ok": true, "data": { "id": "저장된-ID" } }
```

## GET /api/feedback
- 최신 피드백부터 조회한다.
- 기본 페이지 크기 20개, 최대 50개.
- 전체 목록 요구가 있더라도 한 번에 무제한 조회하지 않는다. “더 보기” 방식으로 확장 가능하게 한다.
- PRD의 “모두 보여줌”은 페이지네이션을 통해 사용자가 전체 항목을 탐색할 수 있다는 의미로 구현한다.

## 오류 코드
- `INVALID_INPUT`: 입력 누락/길이 초과
- `NOT_FOUND`: 포켓몬 데이터 확인 불가
- `NEEDS_CLARIFICATION`: 폼/이름 모호
- `RATE_LIMITED`: 요청 과다
- `AI_UNAVAILABLE`: OpenAI 호출 실패
- `DB_UNAVAILABLE`: Supabase 호출 실패
- `INTERNAL_ERROR`: 예상하지 못한 서버 오류

## 완료 기준
- 잘못된 JSON과 예상하지 못한 입력에 서버가 안전하게 응답한다.
- 오류 응답에 내부 스택, 키, DB 상세 정보가 노출되지 않는다.
- 브라우저 네트워크 탭에서 비밀 키가 보이지 않는다.
