# Phase 4 — NLP 파서 개발 설명서

## 수정 대상
`go/app.js` → `Tab1._callGemini()` (line 291), `Tab1.submitInput()` (line 273)

## JSON 스키마 (확정)
```json
{
  "date": "YYYY-MM-DD",   // 필수
  "name": "종목명",        // 필수
  "ticker": "티커|UNKNOWN",
  "market": "KR|US|JP",   // 필수 (신규)
  "action": "매수|매도",   // 필수
  "qty": 수량,             // 필수, number
  "price": 단가,           // 필수, number
  "total": 총금액,         // number
  "asset": "주식|ETF|채권|현금|기타"
}
```

## 날짜 전처리 — `resolveDate(text)`
`submitInput()` 호출 전 실행. "오늘"→today, "어제"→today-1, "N일 전"→today-N 변환 후 Gemini 전달.

## 유효성 검증 — `validateParsed(obj)`
필수 필드(`date/name/market/action/qty/price`) 누락 시 `_showParseError("필드명 누락")` 호출 → Step 1 복귀.

## 오류 분기
| 케이스 | 처리 |
|--------|------|
| API 오류 | `ErrorLog.add` + Step 1 복귀 |
| 필드 누락 | 재입력 요청 메시지 표시 |
| JSON 파싱 실패 | 재시도 1회 후 오류 탭 기록 |

## 프롬프트 강화 포인트
- 한/영 혼용 예시 추가 (예: "Apple 10주 $180에 매수")
- 시장 구분 규칙 명시 (KR: 한국 종목, US: 미국, JP: 일본)
- 상대 날짜는 전처리 후 절대 날짜로 변환하여 전달
