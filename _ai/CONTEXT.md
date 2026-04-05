# CONTEXT
Phase 2 진행 중 — 시트 구조 확정 · 코드 생성 단계

## 완료
- Phase 2 설계 → excelsheets.md 확정
- Phase 3 설계 → DESIGN/ 13개 파일 완료

## 현재 위치
Phase 2 (시트 초기화 코드 생성)
→ phase2_codegen.md 기반으로 Apps Script 작성 예정
→ 완료 후: Phase 3 UI 제작 진입

## 2026-03-29 완료
Phase 2 Python 시트 초기화 완료 — RAW_DATA/PORTFOLIO/AI_ANALYSIS 3개 시트 생성, 서식 적용 (setup_sheets.py)
Phase 3 설계 파일 전체 숙지 완료 (site_01~11.md) — index.html 코드 생성 직전 중단
Phase 3 config.js · app.js 생성 완료 — index.html 제작 단계

## 2026-04-01 완료
Phase 3 (사이트 디자인 + UI — 더미 데이터) 완료
index.html 파일 생성 및 점검 완료

## 2026-04-04 현재
Phase 6 불일치 분석 완료 → 수정 시도 후 오류 발생 → 원본 복귀. go/index.html · Code.gs 수정 보류.

## 2026-04-05 Phase 4 완료
go/app.js NLP 파서 강화: resolveDate(상대날짜→절대), validateParsed(6개 필드), _callGemini 프롬프트 갱신(market/action 추가, KR/US/JP 규칙), _renderConfirmCard market 필드 추가, save() action/market 반영

## 2026-04-05 완료
Code.gs (Phase 6) tlfgod 스펙 적용:
- doGet: 'getHistory' action 추가
- getPortfolio(): summary(totalKrw/totalReturn/totalPnl/returnPositive), chart(labels/values/counts), alloc(risk/safe), rebalance, holdings(cur/avg/ret/wgt) 구조로 변경; fetchMarketData() 연결
- getHistory(): { success, rows } → 배열 직접 반환
- getAnalysis(): quant(risk), behavior(loss/dispose/confirm), aiComment(rebalance/alert/macro/timestamp) 구조로 변경
- fetchMarketData() 신규: Yahoo Finance v8 API, 6개 심볼, { val, chg, dir } 구조, 폴백 처리

