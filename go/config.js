// config.js — City Making 설정 파일
// 비밀번호는 SHA-256 해시값만 저장 (평문 금지)
// 설정 후 이 파일은 .gitignore에 추가 권장

const CONFIG = {
  // 비밀번호 SHA-256 해시 (소문자 hex)
  // 생성: https://emn178.github.io/online-tools/sha256.html
  PASSWORD_HASH: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',

  // Google Apps Script Web App URL
  // 배포 후 "웹 앱 URL" 붙여넣기
  APPS_SCRIPT_URL: '',

  // Gemini API 키
  GEMINI_API_KEY: '',
  GEMINI_MODEL: 'gemini-1.5-flash',

  // 리밸런싱 임계값 (±5% 고정)
  REBALANCE_THRESHOLD: 0.05,

  // 현재가 수집 API (Apps Script 내 처리)
  // 별도 키 불필요 — Apps Script에서 Yahoo Finance 등 호출

  // 탭 ID 목록
  TABS: ['tab0', 'tab1', 'tab2', 'tab3', 'tab4', 'tab5'],

  // 세션 키
  SESSION_KEY: 'cm_auth',
};
