// ============================================================
// City Making — Google Apps Script (Phase 6)
// 역할: Frontend(index.html) ↔ Google Sheets 중간 레이어
// ============================================================

const SPREADSHEET_ID  = '1NAWrJnOMiPcuZOZN_k7OkyFxTA81jw8f0pAJkKUlfDE';
const SHEET_RAW       = 'RAW_DATA';
const SHEET_DASHBOARD = 'PORTFOLIO';
const SHEET_AI        = 'AI_ANALYSIS';

// RAW_DATA 컬럼 인덱스
// 0:date 1:name 2:ticker 3:market 4:asset 5:type
// 6:qty  7:price 8:total 9:- 10:-
// 11:usd_krw 12:usd_jpy 13:kr_rate 14:us_rate 15:jp_rate
// 16:kospi 17:nasdaq 18:nikkei 19:memo

// ── 진입점 ────────────────────────────────────────────────
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action  = payload.action;
    let result;
    switch (action) {
      case 'write':          result = writeTrade(payload);          break;
      case 'saveAIAnalysis': result = saveAIAnalysis(payload.data); break;
      default: result = { success: false, error: 'Unknown action: ' + action };
    }
    return buildResponse(result);
  } catch (err) {
    return buildResponse({ success: false, error: err.message });
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    let result;
    switch (action) {
      case 'portfolio':    result = getPortfolio(); break;
      case 'history':      result = getHistory();   break;
      case 'analysis':     result = getAnalysis();  break;
      case 'macro':        result = getMacro();     break;
      // 구버전 호환
      case 'getPortfolio': result = getPortfolio(); break;
      case 'getTrades':    result = getHistory();   break;
      case 'getHistory':   result = getHistory();   break;
      case 'getAIAnalysis':result = getAnalysis();  break;
      default: result = { success: false, error: 'Unknown action: ' + action };
    }
    return buildResponse(result);
  } catch (err) {
    return buildResponse({ success: false, error: err.message });
  }
}

// ── POST: write (거래 저장) ────────────────────────────────
// Frontend payload: { action, date, name, ticker, qty, price, total, type, asset, memo }
function writeTrade(data) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_RAW);
  if (!sheet) return { success: false, error: 'Sheet "' + SHEET_RAW + '" not found' };

  if (isDuplicate(sheet, data)) return { success: false, error: 'Duplicate trade detected' };

  const row = [
    data.date   || '',
    data.name   || '',
    data.ticker || '',
    '',                     // market
    data.asset  || '주식',
    data.type   || '',
    data.qty    || 0,
    data.price  || 0,
    data.total  || 0,
    '', '',                 // 누적보유/평균단가 (Sheet 수식)
    '', '', '', '', '',     // usd_krw, usd_jpy, kr_rate, us_rate, jp_rate
    '', '', '',             // kospi, nasdaq, nikkei
    data.memo   || '',
  ];

  sheet.appendRow(row);
  SpreadsheetApp.flush();
  return { success: true, rowIndex: sheet.getLastRow() };
}

// ── POST: saveAIAnalysis (AI 분석 저장) ───────────────────
function saveAIAnalysis(data) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_AI);
  if (!sheet) return { success: false, error: 'Sheet "' + SHEET_AI + '" not found' };

  const row = [
    data.timestamp  || new Date().toISOString(),
    data.mdd        || '',
    data.volatility || '',
    data.sharpe     || '',
    data.correlation  ? JSON.stringify(data.correlation)  : '',
    data.warnings     ? JSON.stringify(data.warnings)     : '',
    data.rebalancing  ? JSON.stringify(data.rebalancing)  : '',
    data.behavioral   ? JSON.stringify(data.behavioral)   : '',
    data.ai_comment || '',
  ];

  sheet.appendRow(row);
  SpreadsheetApp.flush();
  return { success: true };
}

// ── GET: portfolio ─────────────────────────────────────────
// 응답 구조: Tab2._render 가 기대하는 { summary, market, allocation, holdings, riskSafe, rebalancing, quant }
function getPortfolio() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_RAW);
  if (!sheet) return { success: false, error: 'Sheet "' + SHEET_RAW + '" not found' };

  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return buildEmptyPortfolio();

  // 보유 종목 누적 계산
  var holdingsMap = {};
  var latestMacro = {};

  for (var i = 1; i < rows.length; i++) {
    var r      = rows[i];
    var name   = r[1], ticker = r[2], market = r[3], asset = r[4];
    var type   = normalizeType(r[5]);
    var qty    = Number(r[6]) || 0;
    var price  = Number(r[7]) || 0;

    if (!ticker) continue;
    if (!holdingsMap[ticker]) {
      holdingsMap[ticker] = { name: name, ticker: ticker, asset: asset, market: market, qty: 0, cost: 0 };
    }

    if (type === '매수') {
      holdingsMap[ticker].qty  += qty;
      holdingsMap[ticker].cost += qty * price;
    } else if (type === '매도') {
      var avgCost = holdingsMap[ticker].qty > 0 ? holdingsMap[ticker].cost / holdingsMap[ticker].qty : 0;
      holdingsMap[ticker].qty  -= qty;
      holdingsMap[ticker].cost -= qty * avgCost;
      if (holdingsMap[ticker].qty <= 0) { holdingsMap[ticker].qty = 0; holdingsMap[ticker].cost = 0; }
    }

    // 최신 거시경제 데이터 수집
    if (r[16] || r[11]) {
      latestMacro.kospi  = r[16]  || latestMacro.kospi;
      latestMacro.nasdaq = r[17]  || latestMacro.nasdaq;
      latestMacro.nikkei = r[18]  || latestMacro.nikkei;
      latestMacro.usdkrw = r[11]  || latestMacro.usdkrw;
    }
  }

  // 현재 보유 종목 (qty > 0)
  var active = Object.values(holdingsMap).filter(function(h) { return h.qty > 0; });

  var totalKRW = 0;
  active.forEach(function(h) { totalKRW += h.cost; });

  // holdings 행 변환
  var holdingRows = active.map(function(h) {
    var avgPrice = h.qty > 0 ? Math.round(h.cost / h.qty) : 0;
    var weight   = totalKRW > 0 ? (h.cost / totalKRW) * 100 : 0;
    return {
      name:   h.name,
      ticker: h.ticker,
      cur:    avgPrice,   // 현재가 미수집 → 평단가로 표시
      avg:    avgPrice,
      pnl:    0,
      ret:    0,
      wgt:    Math.round(weight * 10) / 10,
    };
  });

  // 국가별 배분
  var countryMap = {};
  active.forEach(function(h) {
    var country = h.market || guessCountry(h.ticker);
    if (!countryMap[country]) countryMap[country] = { amt: 0, count: 0 };
    countryMap[country].amt   += h.cost;
    countryMap[country].count += 1;
  });
  var countryLabels      = Object.keys(countryMap);
  var countryAmtValues   = countryLabels.map(function(c) { return Math.round(countryMap[c].amt); });
  var countryCountValues = countryLabels.map(function(c) { return countryMap[c].count; });

  // 위험/안전 배분
  var RISK_ASSETS = ['주식', '국내주식', '해외주식', 'ETF'];
  var riskAmt = 0, safeAmt = 0;
  active.forEach(function(h) {
    if (RISK_ASSETS.indexOf(h.asset) !== -1) riskAmt += h.cost;
    else safeAmt += h.cost;
  });
  var totalAlloc = riskAmt + safeAmt || 1;

  return {
    success: true,
    summary: {
      totalKrw:       Math.round(totalKRW),
      totalReturn:    0,
      totalPnl:       0,
      returnPositive: false,
    },
    market: fetchMarketData(),
    chart: {
      labels: countryLabels,
      values: countryAmtValues,
      counts: countryCountValues,
    },
    holdings: holdingRows,
    alloc: {
      risk: Math.round((riskAmt / totalAlloc) * 1000) / 10,
      safe: Math.round((safeAmt / totalAlloc) * 1000) / 10,
    },
    rebalance: getLatestRebalancing(),
    quant:     getLatestQuant(),
  };
}

// ── GET: history ───────────────────────────────────────────
// 응답 구조: Tab3._allRows 가 기대하는 { rows: [{id, date, name, ticker, asset, type, qty, price, total, macro, memo, hasError}] }
function getHistory() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_RAW);
  if (!sheet) return { success: false, error: 'Sheet "' + SHEET_RAW + '" not found' };

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    var macroStr = buildMacroString(r[16], r[17], r[18], r[11]);
    rows.push({
      id:       i,
      date:     formatDate(r[0]),
      name:     r[1]  || '',
      ticker:   r[2]  || '',
      market:   r[3]  || '',
      asset:    r[4]  || '',
      type:     normalizeType(r[5]),
      qty:      Number(r[6])  || 0,
      price:    Number(r[7])  || 0,
      total:    Number(r[8])  || 0,
      macro:    macroStr,
      memo:     r[19] || '',
      hasError: false,
    });
  }

  rows.reverse(); // 최신 순
  return rows;
}

// ── GET: analysis ──────────────────────────────────────────
// 응답 구조: Tab4._render 가 기대하는 { quantSummary, quantDetail, behavioral, aiAnalysis }
function getAnalysis() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_AI);
  if (!sheet) return buildEmptyAnalysis();

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return buildEmptyAnalysis();

  var r = data[data.length - 1];
  // cols: 0:timestamp 1:mdd 2:volatility 3:sharpe 4:correlation(JSON)
  //       5:warnings(JSON) 6:rebalancing(JSON) 7:behavioral(JSON) 8:ai_comment

  var parseJson = function(val) { try { return val ? JSON.parse(val) : null; } catch(e) { return null; } };

  var warnings    = parseJson(r[5]);
  var rebalancing = parseJson(r[6]);
  var behavioral  = parseJson(r[7]);
  var quantDetail = parseJson(r[4]); // correlation 필드를 quantDetail 배열로 재사용

  // quant
  var quant = {
    sharpe:  r[3] || '—',
    sortino: '—',
    mdd:     r[1] || '—',
    var:     '—',
    risk:    '—',
  };

  // behavior
  var beh = behavioral || {};
  var behavior = {
    loss:    beh.lossAversion      || { level: '없음', desc: '데이터 없음' },
    dispose: beh.dispositionEffect || { level: '없음', desc: '데이터 없음' },
    confirm: beh.confirmationBias  || { level: '없음', desc: '데이터 없음' },
  };

  // quantDetail 필드명 변환
  var quantDetailOut = [];
  if (Array.isArray(quantDetail)) {
    quantDetailOut = quantDetail.map(function(item) {
      return {
        ticker:      item.ticker      || '',
        vol:         item.volatility  !== undefined ? item.volatility  : (item.vol         || ''),
        riskContrib: item.riskContrib || '',
        kelly:       item.kellyPct    !== undefined ? item.kellyPct    : (item.kelly       || ''),
        weight:      item.currentPct  !== undefined ? item.currentPct  : (item.weight      || ''),
        judgment:    item.judgment    || '',
      };
    });
  }

  // aiComment — 문자열 요약
  var rebalText = '데이터 없음';
  if (Array.isArray(rebalancing) && rebalancing.length) {
    rebalText = rebalancing.map(function(s) {
      return (s.name || s.ticker || '') + ': ' + (s.signal || s.action || '');
    }).join(', ');
  } else if (typeof rebalancing === 'string') {
    rebalText = rebalancing;
  }

  var warnText = '데이터 없음';
  if (Array.isArray(warnings) && warnings.length) {
    warnText = warnings.join(', ');
  } else if (typeof warnings === 'string') {
    warnText = warnings;
  }

  return {
    success:     true,
    quant:       quant,
    quantDetail: quantDetailOut,
    behavior:    behavior,
    aiComment: {
      rebalance: rebalText,
      alert:     warnText,
      macro:     r[8] || '데이터 없음',
      timestamp: formatDate(r[0]),
    },
  };
}

// ── GET: macro ─────────────────────────────────────────────
// 응답 구조: Tab1._loadMacroSnapshot 이 기대하는 { kospi, sp500, usdkrw }
function getMacro() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_RAW);
  if (!sheet) return { success: false, error: 'Sheet "' + SHEET_RAW + '" not found' };

  const data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    var r = data[i];
    if (r[16] || r[11]) {
      return {
        success: true,
        kospi:  r[16] || '—',
        sp500:  '—',
        usdkrw: r[11] || '—',
        nasdaq: r[17] || '—',
        nikkei: r[18] || '—',
      };
    }
  }
  return { success: true, kospi: '—', sp500: '—', usdkrw: '—', nasdaq: '—', nikkei: '—' };
}

// ── 내부 유틸 ─────────────────────────────────────────────

function getLatestQuant() {
  try {
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_AI);
    if (!sheet) return buildEmptyQuant();
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return buildEmptyQuant();
    var r = data[data.length - 1];
    return { sharpe: r[3] || '—', sortino: '—', mdd: r[1] || '—', var: '—' };
  } catch(e) { return buildEmptyQuant(); }
}

function getLatestRebalancing() {
  try {
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_AI);
    if (!sheet) return [];
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    var r = data[data.length - 1];
    var parsed = r[6] ? JSON.parse(r[6]) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch(e) { return []; }
}

function fetchMarketData() {
  var symbols = {
    kospi:  '^KS11',
    sp500:  '^GSPC',
    nasdaq: '^IXIC',
    nikkei: '^N225',
    usd:    'USDKRW=X',
    jpy:    'JPYKRW=X',
  };
  var result = {};
  var keys = Object.keys(symbols);
  for (var k = 0; k < keys.length; k++) {
    var key    = keys[k];
    var symbol = symbols[key];
    try {
      var url  = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbol);
      var res  = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      var json = JSON.parse(res.getContentText());
      var meta = json.chart.result[0].meta;
      var price  = meta.regularMarketPrice;
      var change = meta.regularMarketChange;
      var pct    = meta.regularMarketChangePercent;
      var isRate = (key === 'usd' || key === 'jpy');
      var isKospiNikkei = (key === 'kospi' || key === 'nikkei' || key === 'sp500' || key === 'nasdaq');
      var valStr = isRate
        ? price.toFixed(2)
        : (isKospiNikkei ? Math.round(price).toString() : price.toFixed(2));
      var chgStr = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
      var dir    = change > 0 ? 'up' : (change < 0 ? 'down' : 'flat');
      result[key] = { val: valStr, chg: chgStr, dir: dir };
    } catch (e) {
      result[key] = { val: '—', chg: '—', dir: 'flat' };
    }
  }
  return result;
}

function buildMarketData(macro) {
  return {
    kospi:    macro.kospi  || '—', kospiChg:   null,
    sp500:    '—',                 sp500Chg:   null,
    nasdaq:   macro.nasdaq || '—', nasdaqChg:  null,
    nikkei:   macro.nikkei || '—', nikkeiChg:  null,
    usdkrw:   macro.usdkrw || '—', usdkrwChg:  null,
    jpykrw:   '—',                 jpykrwChg:  null,
  };
}

function buildEmptyPortfolio() {
  return {
    success:  true,
    summary:  { totalKrw: 0, totalReturn: 0, totalPnl: 0, returnPositive: false },
    market:   fetchMarketData(),
    chart:    { labels: [], values: [], counts: [] },
    holdings: [],
    alloc:    { risk: 0, safe: 0 },
    rebalance: [],
    quant:    buildEmptyQuant(),
  };
}

function buildEmptyQuant() {
  return { sharpe: '—', sortino: '—', mdd: '—', var: '—' };
}

function buildEmptyAnalysis() {
  return {
    success:     true,
    quant:       { sharpe:'—', sortino:'—', mdd:'—', var:'—', risk:'—' },
    quantDetail: [],
    behavior: {
      loss:    { level:'없음', desc:'데이터 없음' },
      dispose: { level:'없음', desc:'데이터 없음' },
      confirm: { level:'없음', desc:'데이터 없음' },
    },
    aiComment: {
      rebalance: '데이터 없음', alert: '데이터 없음',
      macro: '데이터 없음', timestamp: '',
    },
  };
}

function buildMacroString(kospi, nasdaq, nikkei, usdkrw) {
  var parts = [];
  if (kospi)  parts.push('KOSPI '    + kospi);
  if (nasdaq) parts.push('NASDAQ '   + nasdaq);
  if (usdkrw) parts.push('USD/KRW '  + usdkrw);
  return parts.join(' · ');
}

function guessCountry(ticker) {
  if (!ticker) return '기타';
  if (/^\d+$/.test(ticker))  return '한국';
  if (/^[A-Z]+$/.test(ticker)) return '미국';
  return '기타';
}

function normalizeType(action) {
  if (!action) return '';
  if (action === 'buy'  || action === '매수') return '매수';
  if (action === 'sell' || action === '매도') return '매도';
  return String(action);
}

function formatDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
    var y = val.getFullYear();
    var m = String(val.getMonth() + 1).padStart(2, '0');
    var d = String(val.getDate()).padStart(2, '0');
    return y + '.' + m + '.' + d;
  }
  return String(val);
}

function isDuplicate(sheet, data) {
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (
      String(r[0]) === String(data.date) &&
      r[1] === data.name &&
      normalizeType(r[5]) === normalizeType(data.type) &&
      Number(r[6]) === Number(data.qty) &&
      Number(r[7]) === Number(data.price)
    ) return true;
  }
  return false;
}

function buildResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
