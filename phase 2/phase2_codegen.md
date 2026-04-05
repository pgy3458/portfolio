# Phase 2 — 코드 생성 지침
목표: Google Apps Script로 시트 3개 초기화
참조: excelsheets.md

## 생성할 시트 및 헤더

### RAW_DATA (A~Z 26열)
날짜·종목명·티커·국가/시장·자산유형·자산군·기관명·액션·수량·단가·총금액·통화·투자일지·원문입력·USD/KRW·USD/JPY·USD/CNY·한국금리·미국금리·일본금리·KOSPI·S&P500·NASDAQ·Nikkei·상해종합·오류여부

### PORTFOLIO
섹션순서: 차트(Pie×2) → 마켓지표 → 자산요약 → 기관별계좌 → 보유종목(A~O) → 리밸런싱신호(A~G)

### AI_ANALYSIS
섹션순서: 퀀트요약 → 퀀트심화(A~H) → 행동경제학경고(A~D) → AI종합분석

## 서식 규칙
- 1행 헤더: 배경 #1D1D1F · 텍스트 흰색 · 굵게
- RAW_DATA K열: =I2*J2 수식
- Z열 오류행: 조건부서식 배경 #FF3B30
