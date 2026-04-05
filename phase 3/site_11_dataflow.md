# 데이터 흐름 설계
> Sheets → Apps Script → 사이트 탭 매핑

## 탭별 매핑
| 탭 | 방향 | Apps Script | Sheets 소스 |
|----|------|-------------|------------|
| 탭 1 | 쓰기 | POST /write | RAW_DATA |
| 탭 2 | 읽기 | GET /portfolio | PORTFOLIO |
| 탭 3 | 읽기 | GET /history | RAW_DATA |
| 탭 4 | 읽기 | GET /analysis | AI_ANALYSIS |
| 탭 5 | 로컬 | — | — |

## 갱신 주기
- 탭 진입 시 자동 1회 호출 (확정)
- 수동 새로고침 (탭 2·3·4 우상단 버튼)
- 탭 1 저장 완료 시 → 탭 2 캐시 무효화
- 현재가: API 자동 수집 (탭 2 진입 시 호출)

## 오류 시 처리
API 실패 → 이전 캐시 표시 + 경고 배너 + 탭 5 자동 기록
수집 불가 항목 → "—" 표시 (시스템 중단 없음)
