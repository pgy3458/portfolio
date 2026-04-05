"""
Phase 2 — Google Sheets 포트폴리오 시트 구조 초기화
참조: excelsheets.md, phase2_codegen.md
"""

import os
import gspread
from google.oauth2.service_account import Credentials

# ── 인증 ──────────────────────────────────────────────────────────────────────
CREDS_PATH = os.environ.get(
    "GOOGLE_APPLICATION_CREDENTIALS",
    "/Users/ppaggiyong/Desktop/auto_project/project-7ff16c93-2c73-41dd-a0a-6e6fa533e088.json",
)
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]
creds = Credentials.from_service_account_file(CREDS_PATH, scopes=SCOPES)
gc = gspread.authorize(creds)

# ── 스프레드시트 열기 ─────────────────────────────────────────────────────────
SPREADSHEET_ID = "1NAWrJnOMiPcuZOZN_k7OkyFxTA81jw8f0pAJkKUlfDE"
print(f"[1/4] 스프레드시트 열기: {SPREADSHEET_ID}")
ss = gc.open_by_key(SPREADSHEET_ID)
print(f"      URL: https://docs.google.com/spreadsheets/d/{ss.id}")

# 기존 시트 초기화 (중복 방지) — 마지막 시트 삭제 불가 제약 우회
all_ws = ss.worksheets()
existing_titles = [ws.title for ws in all_ws]

# 임시 시트 하나 먼저 만들어두고 나머지 전부 삭제
temp_ws = ss.add_worksheet(title="_INIT_TEMP_", rows=1, cols=1)
for ws in all_ws:
    ss.del_worksheet(ws)
    if ws.title in ["RAW_DATA", "PORTFOLIO", "AI_ANALYSIS"]:
        print(f"      기존 '{ws.title}' 삭제")

# ── 헬퍼 ──────────────────────────────────────────────────────────────────────
BLACK_HEADER = {"backgroundColor": {"red": 0.114, "green": 0.114, "blue": 0.122}}  # #1D1D1F
WHITE_BOLD   = {"foregroundColor": {"red": 1, "green": 1, "blue": 1}, "bold": True}

def header_format_request(sheet_id: int, num_cols: int) -> list:
    """1행 헤더 서식 요청 (배경 #1D1D1F, 텍스트 흰색 굵게)"""
    return [
        {
            "repeatCell": {
                "range": {
                    "sheetId": sheet_id,
                    "startRowIndex": 0,
                    "endRowIndex": 1,
                    "startColumnIndex": 0,
                    "endColumnIndex": num_cols,
                },
                "cell": {
                    "userEnteredFormat": {
                        **BLACK_HEADER,
                        "textFormat": WHITE_BOLD,
                        "horizontalAlignment": "CENTER",
                    }
                },
                "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
            }
        }
    ]

def freeze_row_request(sheet_id: int) -> dict:
    return {
        "updateSheetProperties": {
            "properties": {"sheetId": sheet_id, "gridProperties": {"frozenRowCount": 1}},
            "fields": "gridProperties.frozenRowCount",
        }
    }

def col_width_request(sheet_id: int, num_cols: int, pixel: int = 120) -> dict:
    return {
        "updateDimensionProperties": {
            "range": {"sheetId": sheet_id, "dimension": "COLUMNS", "startIndex": 0, "endIndex": num_cols},
            "properties": {"pixelSize": pixel},
            "fields": "pixelSize",
        }
    }

def section_header_request(sheet_id: int, row: int, label: str, num_cols: int) -> list:
    """섹션 구분 행 (진한 회색 배경)"""
    return [
        {
            "mergeCells": {
                "range": {"sheetId": sheet_id, "startRowIndex": row, "endRowIndex": row+1,
                           "startColumnIndex": 0, "endColumnIndex": num_cols},
                "mergeType": "MERGE_ALL",
            }
        },
        {
            "repeatCell": {
                "range": {"sheetId": sheet_id, "startRowIndex": row, "endRowIndex": row+1,
                           "startColumnIndex": 0, "endColumnIndex": num_cols},
                "cell": {
                    "userEnteredValue": {"stringValue": label},
                    "userEnteredFormat": {
                        "backgroundColor": {"red": 0.18, "green": 0.18, "blue": 0.2},
                        "textFormat": {"foregroundColor": {"red": 0.9, "green": 0.9, "blue": 0.9}, "bold": True},
                        "horizontalAlignment": "LEFT",
                    },
                },
                "fields": "userEnteredValue,userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
            }
        },
    ]

# ═══════════════════════════════════════════════════════════════════════════════
# SHEET 1 — RAW_DATA
# ═══════════════════════════════════════════════════════════════════════════════
print("[2/4] Sheet1: RAW_DATA 생성")
ws1 = temp_ws
ws1.update_title("RAW_DATA")
ws1.resize(rows=1000, cols=26)

RAW_HEADERS = [
    "날짜", "종목명", "티커", "국가/시장", "자산유형", "자산군",
    "기관명", "액션", "수량", "단가", "총금액", "통화",
    "투자일지/메모", "원문입력",
    "USD/KRW", "USD/JPY", "USD/CNY",
    "한국금리", "미국금리", "일본금리",
    "KOSPI", "S&P500", "NASDAQ", "Nikkei", "상해종합",
    "오류여부",
]  # A~Z = 26열

ws1.append_row(RAW_HEADERS)

# 샘플 데이터 1행 (수식 포함)
sample = [
    "2026-03-29", "삼성전자", "005930", "KR", "주식", "가치주",
    "키움", "매수", 10, 70000, "=I2*J2", "KRW",
    "테스트 거래", "삼성전자 10주 매수",
    1450, 149.5, 7.25,
    3.5, 5.25, 0.1,
    2650, 5200, 16500, 36000, 3350,
    "정상",
]
ws1.append_row(sample)

sid1 = ws1.id
requests = []
requests += header_format_request(sid1, 26)
requests.append(freeze_row_request(sid1))
requests.append(col_width_request(sid1, 26, 110))

# Z열 오류행 조건부 서식 (오류여부 == "오류" → 배경 #FF3B30)
requests.append({
    "addConditionalFormatRule": {
        "rule": {
            "ranges": [{"sheetId": sid1, "startRowIndex": 1, "startColumnIndex": 0, "endColumnIndex": 26}],
            "booleanRule": {
                "condition": {
                    "type": "CUSTOM_FORMULA",
                    "values": [{"userEnteredValue": '=$Z2="오류"'}],
                },
                "format": {"backgroundColor": {"red": 1.0, "green": 0.231, "blue": 0.188}},  # #FF3B30
            },
        },
        "index": 0,
    }
})

ss.batch_update({"requests": requests})

# ═══════════════════════════════════════════════════════════════════════════════
# SHEET 2 — PORTFOLIO
# ═══════════════════════════════════════════════════════════════════════════════
print("[3/4] Sheet2: PORTFOLIO 생성")
ws2 = ss.add_worksheet(title="PORTFOLIO", rows=200, cols=20)
sid2 = ws2.id

# 섹션별 데이터 (row 인덱스 0-based)
portfolio_data = []
row_meta = []   # (row_idx, type)  type: "section" | "header" | "data"

def add_section(label):
    portfolio_data.append([label])
    row_meta.append("section")

def add_header(cols):
    portfolio_data.append(cols)
    row_meta.append("header")

def add_data(cols):
    portfolio_data.append(cols)
    row_meta.append("data")

# 차트 영역 안내
add_section("[ 차트 영역 ] 투자 국가별 보유 현황 (Pie) | 국가별 투자 종목 현황 (Pie)  ← 차트 삽입 위치")
add_data(["※ 섹션D 완성 후 차트 수동 삽입 (국가/시장 열 기반)"])

# 섹션 A
add_section("[ 섹션 A ] 글로벌 마켓 지표")
add_header(["지수/통화", "현재가", "등락률", "52주고가"])
for item in ["KOSPI", "S&P500", "NASDAQ", "Nikkei", "상해종합", "USD/KRW", "USD/JPY", "USD/CNY"]:
    add_data([item, "", "", ""])

# 섹션 B
add_section("[ 섹션 B ] 자산 요약")
add_header(["항목", "값"])
for item in ["총자산 KRW", "총자산 USD", "투자원금", "추정손익", "수익률",
             "보유종목 수", "자산군 수", "KRW자산 비중", "USD자산 비중", "종합리스크점수"]:
    add_data([item, ""])

# 섹션 C
add_section("[ 섹션 C ] 기관별 계좌")
add_header(["기관명", "자산분류", "종목 수", "평가금액 KRW", "평가금액 USD", "평균환율"])

# 섹션 D
add_section("[ 섹션 D ] 보유 종목 메인 테이블")
add_header(["자산군", "티커", "종목명", "국가/시장", "기관명",
            "수량", "평단가", "현재가", "평가금액", "평가손익",
            "수익률", "비중", "목표비중", "최근7일흐름", "리스크등급"])

# 섹션 E
add_section("[ 섹션 E ] 리밸런싱 신호")
add_header(["티커", "현재평가액", "현재비중", "목표비중", "괴리", "신호", "조치금액"])

# 시트에 쓰기
ws2.update(portfolio_data, "A1")

# 서식 요청
requests2 = []
requests2.append(col_width_request(sid2, 20, 130))

for i, mtype in enumerate(row_meta):
    if mtype == "section":
        requests2 += section_header_request(sid2, i, portfolio_data[i][0], 20)
    elif mtype == "header":
        requests2 += header_format_request(sid2, 15)
        # 정확한 행 위치로 덮어쓰기
        requests2[-1]["repeatCell"]["range"].update({"startRowIndex": i, "endRowIndex": i+1})

ss.batch_update({"requests": requests2})

# ═══════════════════════════════════════════════════════════════════════════════
# SHEET 3 — AI_ANALYSIS
# ═══════════════════════════════════════════════════════════════════════════════
print("[4/4] Sheet3: AI_ANALYSIS 생성")
ws3 = ss.add_worksheet(title="AI_ANALYSIS", rows=100, cols=10)
sid3 = ws3.id

ai_data = []
ai_meta = []

def ai_section(label):
    ai_data.append([label])
    ai_meta.append("section")

def ai_header(cols):
    ai_data.append(cols)
    ai_meta.append("header")

def ai_row(cols):
    ai_data.append(cols)
    ai_meta.append("data")

# 섹션 A — 퀀트 요약
ai_section("[ 섹션 A ] 퀀트 요약 (포트폴리오 전체)")
ai_header(["항목", "값"])
for item in ["총수익률", "Sharpe Ratio", "Sortino Ratio", "MDD 추정", "95% VaR", "종합리스크점수 (0~100)"]:
    ai_row([item, ""])

# 섹션 B — 퀀트 심화
ai_section("[ 섹션 B ] 퀀트 심화 (종목별)")
ai_header(["티커", "연간변동성", "위험기여도", "Kelly최적비중", "현재비중", "비중판단", "VaR(95%)", "MDD추정"])

# 섹션 C — 행동경제학
ai_section("[ 섹션 C ] 행동경제학 경고")
ai_header(["손실회피 편향", "처분효과 경고", "확증편향 체크", "경고레벨"])
ai_row(["", "", "", "없음"])

# 섹션 D — AI 종합
ai_section("[ 섹션 D ] AI 종합 분석")
ai_header(["항목", "내용"])
for item in ["리밸런싱 상세 제안", "자동 경고 내용", "거시경제 기반 AI 코멘트", "마지막 분석 시점"]:
    ai_row([item, ""])

ws3.update(ai_data, "A1")

requests3 = []
requests3.append(col_width_request(sid3, 10, 180))

for i, mtype in enumerate(ai_meta):
    if mtype == "section":
        requests3 += section_header_request(sid3, i, ai_data[i][0], 10)
    elif mtype == "header":
        req = header_format_request(sid3, 10)
        req[-1]["repeatCell"]["range"].update({"startRowIndex": i, "endRowIndex": i+1})
        requests3 += req

ss.batch_update({"requests": requests3})

# ── 서비스 계정이므로 소유자에게 공유 ─────────────────────────────────────────
print("\n[완료]")
print(f"  스프레드시트명: {ss.title}")
print(f"  URL: https://docs.google.com/spreadsheets/d/{ss.id}")
print(f"\n  ※ 서비스 계정으로 생성되었습니다.")
print(f"  ※ 아래 명령으로 본인 계정에 공유하세요:")
print(f"     ss.share('YOUR_EMAIL@gmail.com', perm_type='user', role='owner')")
print(f"\n  시트 ID: {ss.id}")
