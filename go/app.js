// app.js — City Making 메인 로직
// 의존: config.js, Chart.js (CDN), Material Icons (CDN)

'use strict';

/* ─────────────────────────────────────────
   Material Icons 탭 아이콘 정의
   아이콘명 변경 시 여기서만 수정
───────────────────────────────────────── */
const TAB_ICONS = {
  tab1: 'add_circle',
  tab2: 'pie_chart',
  tab3: 'receipt_long',
  tab4: 'analytics',
  tab5: 'error',
};

const TAB_LABELS = {
  tab1: '거래 입력',
  tab2: '포트폴리오',
  tab3: '거래 이력',
  tab4: 'AI 분석',
  tab5: '오류',
};

/* ─────────────────────────────────────────
   캐시
───────────────────────────────────────── */
const Cache = {
  _store: {},
  set(key, data) { this._store[key] = { data, ts: Date.now() }; },
  get(key) { return this._store[key]?.data ?? null; },
  invalidate(key) { delete this._store[key]; },
};

/* ─────────────────────────────────────────
   오류 로거 (탭 5)
───────────────────────────────────────── */
const ErrorLog = {
  _entries: [],

  add(location, message, type = 'API 수집 실패') {
    const entry = {
      id: Date.now(),
      timestamp: new Date().toLocaleString('ko-KR', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
      }).replace(/\. /g, '.').replace('.', ''),
      location,
      message,
      type,
      resolved: false,
    };
    this._entries.unshift(entry);
    this._updateBadge();
    Tab5.render();
  },

  resolve(id) {
    const entry = this._entries.find(e => e.id === id);
    if (entry) { entry.resolved = true; this._updateBadge(); Tab5.render(); }
  },

  _updateBadge() {
    const count = this._entries.filter(e => !e.resolved).length;
    const badge = document.getElementById('tab5-badge');
    if (!badge) return;
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  },

  getAll() { return this._entries; },
};

/* ─────────────────────────────────────────
   Apps Script API 호출
───────────────────────────────────────── */
const API = {
  async get(endpoint) {
    const url = `${CONFIG.APPS_SCRIPT_URL}?action=${endpoint}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async post(payload) {
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
};

/* ─────────────────────────────────────────
   인증 모듈
───────────────────────────────────────── */
const Auth = {
  async sha256(text) {
    const buf = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(text)
    );
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  },

  isAuthenticated() {
    return sessionStorage.getItem(CONFIG.SESSION_KEY) === 'true';
  },

  async verify(password) {
    const hash = await this.sha256(password);
    return hash === CONFIG.PASSWORD_HASH;
  },

  login() {
    sessionStorage.setItem(CONFIG.SESSION_KEY, 'true');
    TabManager.showAuthenticatedUI();
    TabManager.switchTo('tab2');
  },

  logout() {
    sessionStorage.removeItem(CONFIG.SESSION_KEY);
    location.reload();
  },
};

/* ─────────────────────────────────────────
   탭 매니저
───────────────────────────────────────── */
const TabManager = {
  current: null,

  init() {
    this._renderTabBar();
    if (Auth.isAuthenticated()) {
      this.showAuthenticatedUI();
      this.switchTo('tab2');
    } else {
      this.showLoginUI();
    }
  },

  _renderTabBar() {
    const bar = document.getElementById('tab-bar');
    if (!bar) return;
    bar.innerHTML = CONFIG.TABS.filter(t => t !== 'tab0').map(tabId => `
      <button class="tab-btn" id="btn-${tabId}" onclick="TabManager.switchTo('${tabId}')">
        <span class="material-icons">${TAB_ICONS[tabId]}</span>
        <span>${TAB_LABELS[tabId]}</span>
        ${tabId === 'tab5' ? '<span id="tab5-badge" class="error-badge" style="display:none">0</span>' : ''}
      </button>
    `).join('');
  },

  switchTo(tabId) {
    // 인증 필요 탭 접근 차단
    if (tabId !== 'tab0' && !Auth.isAuthenticated()) return;

    CONFIG.TABS.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = id === tabId ? 'block' : 'none';
      const btn = document.getElementById(`btn-${id}`);
      if (btn) btn.classList.toggle('active', id === tabId);
    });

    this.current = tabId;

    // 탭 진입 시 자동 갱신
    const loaders = {
      tab2: () => Tab2.load(),
      tab3: () => Tab3.load(),
      tab4: () => Tab4.load(),
    };
    loaders[tabId]?.();
  },

  showAuthenticatedUI() {
    const tabBar = document.getElementById('tab-bar');
    if (tabBar) tabBar.style.display = 'flex';
    const tab0 = document.getElementById('tab0');
    if (tab0) tab0.style.display = 'none';
  },

  showLoginUI() {
    const tabBar = document.getElementById('tab-bar');
    if (tabBar) tabBar.style.display = 'none';
    CONFIG.TABS.filter(t => t !== 'tab0').forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    const tab0 = document.getElementById('tab0');
    if (tab0) tab0.style.display = 'flex';
  },
};

/* ─────────────────────────────────────────
   탭 0 — 비밀번호 화면
───────────────────────────────────────── */
const Tab0 = {
  init() {
    const input = document.getElementById('pw-input');
    const btn = document.getElementById('pw-btn');

    input?.addEventListener('input', () => {
      if (btn) btn.style.backgroundColor = input.value ? '#0071E3' : '#E5E5EA';
    });

    input?.addEventListener('keydown', e => {
      if (e.key === 'Enter') this.submit();
    });

    btn?.addEventListener('click', () => this.submit());
  },

  async submit() {
    const input = document.getElementById('pw-input');
    const errMsg = document.getElementById('pw-error');
    if (!input) return;

    const ok = await Auth.verify(input.value);
    if (ok) {
      Auth.login();
    } else {
      input.value = '';
      input.style.borderBottomColor = '#FF3B30';
      if (errMsg) errMsg.style.display = 'block';
      ErrorLog.add('탭0 > 인증', '비밀번호 불일치', '인증 실패');
    }
  },
};

/* ─────────────────────────────────────────
   탭 1 — 거래 입력 (4단계)
───────────────────────────────────────── */
const Tab1 = {
  step: 1,
  parsed: null,

  init() {
    const input = document.getElementById('trade-input');
    const btn = document.getElementById('trade-btn');

    input?.addEventListener('input', () => {
      if (btn) btn.style.backgroundColor = input.value.trim() ? '#0071E3' : '#E5E5EA';
    });

    input?.addEventListener('keydown', e => {
      if (e.key === 'Enter') this.submitInput();
    });

    btn?.addEventListener('click', () => this.submitInput());
    this.setStep(1);
  },

  setStep(n) {
    this.step = n;
    // 진행바 업데이트 (3px, 4단계)
    const bar = document.getElementById('tab1-progress');
    if (bar) bar.style.width = `${(n / 4) * 100}%`;

    // 단계별 섹션 표시
    [1, 2, 3, 4].forEach(i => {
      const el = document.getElementById(`tab1-step${i}`);
      if (el) el.style.display = i === n ? 'block' : 'none';
    });
  },

  resolveDate(text) {
    const today = new Date();
    const fmt = d => d.toISOString().slice(0, 10);
    return text
      .replace(/오늘/g, fmt(today))
      .replace(/어제/g, fmt(new Date(today - 864e5)))
      .replace(/(\d+)일\s*전/g, (_, n) => fmt(new Date(today - n * 864e5)));
  },

  validateParsed(obj) {
    const required = ['date', 'name', 'market', 'action', 'qty', 'price'];
    for (const f of required) {
      if (obj[f] == null || obj[f] === '') throw new Error(`${f} 누락`);
    }
  },

  async submitInput() {
    const input = document.getElementById('trade-input');
    const text = input?.value.trim();
    if (!text) return;

    this.setStep(2);
    const resolved = this.resolveDate(text);

    try {
      this.parsed = await this._callGemini(resolved);
      this.validateParsed(this.parsed);
      this._renderConfirmCard(this.parsed);
      this.setStep(3);
    } catch (err) {
      ErrorLog.add('탭1 > AI 파싱', err.message, 'AI 파싱 오류');
      this._showParseError(err.message);
      this.setStep(1);
    }
  },

  async _callGemini(text) {
    const prompt = `다음 거래 문장을 JSON으로 파싱하세요.
출력 형식(JSON만):
{"date":"YYYY-MM-DD","name":"종목명","ticker":"티커|UNKNOWN","market":"KR|US|JP","action":"매수|매도","qty":수량,"price":단가,"total":총금액,"asset":"주식|ETF|채권|현금|기타"}

시장 구분 규칙: KR=한국 종목, US=미국 종목, JP=일본 종목
예시: "Apple 10주 $180에 매수" → market:"US", action:"매수", ticker:"AAPL"
예시: "삼성전자 5주 70000원에 매도" → market:"KR", action:"매도", ticker:"005930"
예시: "Toyota 100주 2500엔에 매수" → market:"JP", action:"매수"

입력: "${text}"
오늘 날짜: ${new Date().toISOString().slice(0, 10)}
티커 불명 시 "UNKNOWN". 숫자는 number 타입.`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL}:generateContent?key=${CONFIG.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    );
    if (!res.ok) throw new Error(`Gemini API 오류 ${res.status}`);
    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return JSON.parse(raw);
  },

  _renderConfirmCard(parsed) {
    const card = document.getElementById('tab1-confirm-card');
    if (!card) return;
    card.innerHTML = `
      <div class="confirm-row">
        <label>날짜</label>
        <input id="cf-date" type="date" value="${parsed.date}">
      </div>
      <div class="confirm-row">
        <label>종목명</label>
        <input id="cf-name" type="text" value="${parsed.name}">
      </div>
      <div class="confirm-row">
        <label>티커</label>
        <input id="cf-ticker" type="text" value="${parsed.ticker}">
      </div>
      <div class="confirm-row">
        <label>수량</label>
        <input id="cf-qty" type="number" value="${parsed.qty}">
      </div>
      <div class="confirm-row">
        <label>단가 (₩)</label>
        <input id="cf-price" type="number" value="${parsed.price}">
      </div>
      <div class="confirm-row">
        <label>총금액 (₩)</label>
        <input id="cf-total" type="number" value="${parsed.total}">
      </div>
      <div class="confirm-row">
        <label>시장</label>
        <select id="cf-market">
          ${['KR','US','JP'].map(v =>
            `<option value="${v}" ${parsed.market === v ? 'selected' : ''}>${v}</option>`
          ).join('')}
        </select>
      </div>
      <div class="confirm-row">
        <label>구분</label>
        <select id="cf-action">
          <option value="매수" ${parsed.action === '매수' ? 'selected' : ''}>매수</option>
          <option value="매도" ${parsed.action === '매도' ? 'selected' : ''}>매도</option>
        </select>
      </div>
      <div class="confirm-row">
        <label>자산군</label>
        <select id="cf-asset">
          ${['주식','ETF','채권','현금','기타'].map(v =>
            `<option value="${v}" ${parsed.asset === v ? 'selected' : ''}>${v}</option>`
          ).join('')}
        </select>
      </div>
      <div class="confirm-row macro-row">
        <label>거시경제 스냅샷</label>
        <span id="cf-macro" class="macro-text">불러오는 중...</span>
      </div>
      <div class="confirm-row">
        <label>투자일지 메모</label>
        <textarea id="cf-memo" placeholder="자유 입력" rows="4"></textarea>
      </div>
    `;
    this._loadMacroSnapshot();
  },

  async _loadMacroSnapshot() {
    try {
      const data = await API.get('macro');
      const el = document.getElementById('cf-macro');
      if (el && data) {
        el.textContent = `KOSPI ${data.kospi} / S&P500 ${data.sp500} / USD/KRW ${data.usdkrw}`;
      }
    } catch {
      const el = document.getElementById('cf-macro');
      if (el) el.textContent = '수집 불가';
    }
  },

  async save() {
    const btn = document.getElementById('tab1-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = '저장 중...'; }

    const payload = {
      action: 'write',
      date: document.getElementById('cf-date')?.value,
      name: document.getElementById('cf-name')?.value,
      ticker: document.getElementById('cf-ticker')?.value,
      qty: Number(document.getElementById('cf-qty')?.value),
      price: Number(document.getElementById('cf-price')?.value),
      total: Number(document.getElementById('cf-total')?.value),
      market: document.getElementById('cf-market')?.value,
      action: document.getElementById('cf-action')?.value,
      asset: document.getElementById('cf-asset')?.value,
      memo: document.getElementById('cf-memo')?.value || '',
    };

    try {
      await API.post(payload);
      Cache.invalidate('portfolio');
      this.setStep(4);
    } catch (err) {
      ErrorLog.add('탭1 > 저장', err.message, 'Sheets 쓰기 실패');
      this._showSaveError();
      if (btn) { btn.disabled = false; btn.textContent = '확인 후 저장'; }
    }
  },

  reset() {
    const input = document.getElementById('trade-input');
    if (input) input.value = '';
    const btn = document.getElementById('trade-btn');
    if (btn) btn.style.backgroundColor = '#E5E5EA';
    this.parsed = null;
    this.setStep(1);
  },

  _showParseError(msg) {
    const el = document.getElementById('tab1-parse-error');
    if (!el) return;
    if (msg) el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
  },

  _showSaveError() {
    const el = document.getElementById('tab1-save-error');
    if (el) el.style.display = 'block';
  },
};

/* ─────────────────────────────────────────
   탭 2 — 포트폴리오 현황
───────────────────────────────────────── */
const Tab2 = {
  _charts: {},

  async load() {
    this._showLoading(true);
    try {
      let data = Cache.get('portfolio');
      if (!data) {
        data = await API.get('portfolio');
        Cache.set('portfolio', data);
      }
      this._render(data);
    } catch (err) {
      ErrorLog.add('탭2 > 포트폴리오', err.message);
      this._showCacheFallback();
    } finally {
      this._showLoading(false);
    }
  },

  _render(data) {
    this._renderSummary(data.summary);
    this._renderMarket(data.market);
    this._renderCharts(data.allocation);
    this._renderHoldings(data.holdings);
    this._renderAllocationBar(data.riskSafe);
    this._renderRebalancing(data.rebalancing);
    this._renderQuant(data.quant);
  },

  _renderSummary(s) {
    const el = id => document.getElementById(id);
    if (!s) return;
    setText('port-total-krw', s.totalKRW ? `₩${s.totalKRW.toLocaleString()}` : '—');
    setText('port-total-usd', s.totalUSD ? `$${s.totalUSD.toLocaleString()}` : '—');
    setText('port-return-rate', s.returnRate != null ? `${s.returnRate > 0 ? '+' : ''}${s.returnRate.toFixed(2)}%` : '—');
    const rateEl = document.getElementById('port-return-rate');
    if (rateEl && s.returnRate != null) {
      rateEl.style.color = s.returnRate >= 0 ? '#34C759' : '#FF3B30';
    }
    setText('port-pnl', s.pnl ? `${s.pnl > 0 ? '+' : ''}₩${s.pnl.toLocaleString()}` : '—');
  },

  _renderMarket(m) {
    if (!m) return;
    const indices = [
      { id: 'mkt-kospi', label: 'KOSPI', val: m.kospi, chg: m.kospiChg },
      { id: 'mkt-sp500', label: 'S&P500', val: m.sp500, chg: m.sp500Chg },
      { id: 'mkt-nasdaq', label: 'NASDAQ', val: m.nasdaq, chg: m.nasdaqChg },
      { id: 'mkt-nikkei', label: 'Nikkei', val: m.nikkei, chg: m.nikkeiChg },
      { id: 'mkt-usdkrw', label: 'USD/KRW', val: m.usdkrw, chg: m.usdkrwChg },
      { id: 'mkt-jpykrw', label: 'JPY/KRW', val: m.jpykrw, chg: m.jpykrwChg },
    ];
    indices.forEach(({ id, val, chg }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const chgStr = chg != null ? `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%` : '—';
      el.querySelector('.mkt-val').textContent = val ?? '—';
      const chgEl = el.querySelector('.mkt-chg');
      chgEl.textContent = chgStr;
      chgEl.style.color = chg == null ? '#6E6E73' : chg >= 0 ? '#34C759' : '#FF3B30';
    });
  },

  _renderCharts(alloc) {
    if (!alloc) return;

    const destroy = key => { this._charts[key]?.destroy(); };

    // 국가별 금액비중
    destroy('countryAmt');
    const c1 = document.getElementById('chart-country-amt');
    if (c1) {
      this._charts.countryAmt = new Chart(c1, {
        type: 'doughnut',
        data: {
          labels: alloc.countryAmtLabels,
          datasets: [{ data: alloc.countryAmtValues, backgroundColor: PIE_COLORS }],
        },
        options: { plugins: { legend: { position: 'bottom' } }, cutout: '60%' },
      });
    }

    // 국가별 종목수 비중
    destroy('countryCount');
    const c2 = document.getElementById('chart-country-count');
    if (c2) {
      this._charts.countryCount = new Chart(c2, {
        type: 'doughnut',
        data: {
          labels: alloc.countryCountLabels,
          datasets: [{ data: alloc.countryCountValues, backgroundColor: PIE_COLORS }],
        },
        options: { plugins: { legend: { position: 'bottom' } }, cutout: '60%' },
      });
    }
  },

  _renderHoldings(holdings) {
    const tbody = document.getElementById('holdings-tbody');
    if (!tbody || !holdings) return;
    tbody.innerHTML = holdings.map(h => `
      <tr>
        <td>${h.name}<br><span class="ticker">${h.ticker}</span></td>
        <td>${h.currentPrice ? `₩${h.currentPrice.toLocaleString()}` : '—'}</td>
        <td>${h.avgPrice ? `₩${h.avgPrice.toLocaleString()}` : '—'}</td>
        <td style="color:${h.pnl >= 0 ? '#34C759' : '#FF3B30'}">
          ${h.pnl != null ? `${h.pnl >= 0 ? '+' : ''}₩${h.pnl.toLocaleString()}` : '—'}
        </td>
        <td style="color:${h.returnRate >= 0 ? '#34C759' : '#FF3B30'}">
          ${h.returnRate != null ? `${h.returnRate >= 0 ? '+' : ''}${h.returnRate.toFixed(2)}%` : '—'}
        </td>
        <td>${h.weight != null ? `${h.weight.toFixed(1)}%` : '—'}</td>
      </tr>
    `).join('');
  },

  _renderAllocationBar(riskSafe) {
    if (!riskSafe) return;
    const bar = document.getElementById('alloc-bar-risk');
    if (bar) bar.style.width = `${riskSafe.riskPct}%`;
    setText('alloc-risk-pct', `${riskSafe.riskPct?.toFixed(1)}%`);
    setText('alloc-safe-pct', `${riskSafe.safePct?.toFixed(1)}%`);
  },

  _renderRebalancing(signals) {
    const container = document.getElementById('rebalancing-container');
    if (!container || !signals) return;
    container.innerHTML = signals.map(s => {
      const colors = { 매수: '#34C759', 매도: '#FF3B30', 유지: '#6E6E73' };
      return `
        <div class="rebal-card" style="border-left:3px solid ${colors[s.signal]}">
          <div class="rebal-name">${s.name}</div>
          <div class="rebal-signal" style="color:${colors[s.signal]}">${s.signal}</div>
          <div class="rebal-detail">${s.currentPct?.toFixed(1)}% → ${s.targetPct?.toFixed(1)}%</div>
        </div>
      `;
    }).join('');
  },

  _renderQuant(quant) {
    if (!quant) return;
    [
      ['quant-sharpe', 'Sharpe', quant.sharpe],
      ['quant-sortino', 'Sortino', quant.sortino],
      ['quant-mdd', 'MDD', quant.mdd],
      ['quant-var', 'VaR', quant.var],
    ].forEach(([id, , val]) => {
      const el = document.getElementById(id);
      if (el) el.querySelector('.quant-val').textContent = val ?? '—';
    });
  },

  _showCacheFallback() {
    const banner = document.getElementById('tab2-error-banner');
    if (banner) banner.style.display = 'block';
  },

  _showLoading(on) {
    const el = document.getElementById('tab2-loading');
    if (el) el.style.display = on ? 'flex' : 'none';
  },
};

/* ─────────────────────────────────────────
   탭 3 — 거래 이력
───────────────────────────────────────── */
const Tab3 = {
  _allRows: [],

  async load() {
    try {
      let data = Cache.get('history');
      if (!data) {
        data = await API.get('history');
        Cache.set('history', data);
      }
      this._allRows = data.rows || [];
      this._render(this._allRows);
    } catch (err) {
      ErrorLog.add('탭3 > 거래이력', err.message);
      this._showErrorBanner();
    }
  },

  _render(rows) {
    const tbody = document.getElementById('history-tbody');
    if (!tbody) return;

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#6E6E73">거래 이력이 없습니다</td></tr>';
      return;
    }

    const assetColors = {
      주식: '#0071E3', ETF: '#34C759', 채권: '#FF9500', 현금: '#6E6E73', 기타: '#AF52DE',
    };

    tbody.innerHTML = rows.map(r => `
      <tr class="history-row ${r.hasError ? 'row-error' : ''}"
          onclick="Tab3.openDrawer(${r.id})"
          data-id="${r.id}">
        <td>${r.date}</td>
        <td>${r.name}<br><span class="ticker">${r.ticker}</span></td>
        <td><span class="badge" style="background:${assetColors[r.asset] ?? '#6E6E73'}">${r.asset}</span></td>
        <td>${r.qty?.toLocaleString()}</td>
        <td>₩${r.price?.toLocaleString()}</td>
        <td>₩${r.total?.toLocaleString()}</td>
        <td><span class="badge" style="background:${r.type === '매수' ? '#34C759' : '#FF3B30'}">${r.type}</span></td>
        ${r.hasError ? '<td><span class="material-icons" style="color:#FF3B30;font-size:16px">error</span></td>' : '<td></td>'}
      </tr>
    `).join('');
  },

  filter() {
    const search = document.getElementById('hist-search')?.value.toLowerCase() || '';
    const asset = document.getElementById('hist-asset')?.value || '';
    const type = document.getElementById('hist-type')?.value || '';
    const dateFrom = document.getElementById('hist-date-from')?.value || '';
    const dateTo = document.getElementById('hist-date-to')?.value || '';

    const filtered = this._allRows.filter(r => {
      if (search && !r.name.toLowerCase().includes(search) && !r.ticker.toLowerCase().includes(search)) return false;
      if (asset && r.asset !== asset) return false;
      if (type && r.type !== type) return false;
      if (dateFrom && r.date < dateFrom.replace(/-/g, '.')) return false;
      if (dateTo && r.date > dateTo.replace(/-/g, '.')) return false;
      return true;
    });
    this._render(filtered);
  },

  openDrawer(rowId) {
    const row = this._allRows.find(r => r.id === rowId);
    if (!row) return;

    const drawer = document.getElementById('history-drawer');
    if (!drawer) return;

    drawer.innerHTML = `
      <div class="drawer-header">
        <span>${row.name} (${row.ticker}) — ${row.date}</span>
        <button onclick="Tab3.closeDrawer()" class="drawer-close">
          <span class="material-icons">close</span>
        </button>
      </div>
      <div class="drawer-body">
        <div class="drawer-section">
          <h4>거시경제 스냅샷</h4>
          <p>${row.macro || '기록 없음'}</p>
        </div>
        <div class="drawer-section">
          <h4>투자일지 메모</h4>
          <p>${row.memo || '메모 없음'}</p>
        </div>
      </div>
    `;
    drawer.classList.add('open');
  },

  closeDrawer() {
    document.getElementById('history-drawer')?.classList.remove('open');
  },

  _showErrorBanner() {
    const el = document.getElementById('tab3-error-banner');
    if (el) el.style.display = 'block';
  },
};

/* ─────────────────────────────────────────
   탭 4 — AI 분석
───────────────────────────────────────── */
const Tab4 = {
  async load() {
    try {
      let data = Cache.get('analysis');
      if (!data) {
        data = await API.get('analysis');
        Cache.set('analysis', data);
      }
      this._render(data);
    } catch (err) {
      ErrorLog.add('탭4 > AI분석', err.message);
    }
  },

  _render(data) {
    if (!data) return;
    this._renderQuantSummary(data.quantSummary);
    this._renderQuantTable(data.quantDetail);
    this._renderBehavioralWarnings(data.behavioral);
    this._renderAICards(data.aiAnalysis);
  },

  _renderQuantSummary(q) {
    if (!q) return;
    [
      ['q4-sharpe', q.sharpe],
      ['q4-sortino', q.sortino],
      ['q4-mdd', q.mdd],
      ['q4-var', q.var],
      ['q4-risk-score', q.riskScore],
    ].forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.querySelector('.quant-val').textContent = val ?? '—';
    });
  },

  _renderQuantTable(rows) {
    const tbody = document.getElementById('quant-detail-tbody');
    if (!tbody || !rows) return;
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.ticker}</td>
        <td>${r.volatility != null ? `${r.volatility.toFixed(1)}%` : '—'}</td>
        <td>${r.riskContrib != null ? `${r.riskContrib.toFixed(1)}%` : '—'}</td>
        <td>${r.kellyPct != null ? `${r.kellyPct.toFixed(1)}%` : '—'}</td>
        <td>${r.currentPct != null ? `${r.currentPct.toFixed(1)}%` : '—'}</td>
        <td style="color:${r.judgment === '과다' ? '#FF3B30' : r.judgment === '부족' ? '#FF9500' : '#34C759'}">
          ${r.judgment ?? '—'}
        </td>
      </tr>
    `).join('');
  },

  _renderBehavioralWarnings(beh) {
    const container = document.getElementById('behavioral-container');
    if (!container || !beh) return;

    const levelColors = { 없음: '#6E6E73', 주의: '#FF9500', 경고: '#FF3B30' };
    const warnings = [
      { label: '손실회피 편향', level: beh.lossAversion?.level, desc: beh.lossAversion?.desc },
      { label: '처분 효과', level: beh.dispositionEffect?.level, desc: beh.dispositionEffect?.desc },
      { label: '확증 편향', level: beh.confirmationBias?.level, desc: beh.confirmationBias?.desc },
    ];

    container.innerHTML = warnings.map(w => `
      <div class="behavioral-card">
        <div class="behavioral-header">
          <span class="behavioral-label">${w.label}</span>
          <span class="badge" style="background:${levelColors[w.level] ?? '#6E6E73'}">${w.level ?? '—'}</span>
        </div>
        <p class="behavioral-desc">${w.desc ?? ''}</p>
      </div>
    `).join('');
  },

  _renderAICards(ai) {
    if (!ai) return;
    setText('ai-rebalance', ai.rebalancing ?? '—');
    setText('ai-warning', ai.warnings ?? '—');
    setText('ai-macro-comment', ai.macroComment ?? '—');
    setText('ai-last-updated', ai.lastUpdated ? `최종 분석: ${ai.lastUpdated}` : '');
  },
};

/* ─────────────────────────────────────────
   탭 5 — 오류 로그
───────────────────────────────────────── */
const Tab5 = {
  render() {
    const entries = ErrorLog.getAll();
    const container = document.getElementById('error-log-container');
    if (!container) return;

    if (!entries.length) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="material-icons" style="color:#34C759;font-size:48px">check_circle</span>
          <p>현재 기록된 오류가 없습니다</p>
        </div>
      `;
      return;
    }

    const typeColors = {
      'AI 파싱 오류': '#FF9500',
      'API 수집 실패': '#FF9500',
      'Sheets 쓰기 실패': '#FF3B30',
      '인증 실패': '#6E6E73',
    };

    container.innerHTML = `
      <table class="error-table">
        <thead>
          <tr>
            <th>발생시각</th><th>위치</th><th>오류 내용</th><th>해결 상태</th>
          </tr>
        </thead>
        <tbody>
          ${entries.map(e => `
            <tr style="opacity:${e.resolved ? 0.5 : 1}">
              <td>${e.timestamp}</td>
              <td><span style="color:${typeColors[e.type] ?? '#6E6E73'}">${e.location}</span></td>
              <td>${e.message}</td>
              <td>
                ${e.resolved
                  ? '<span class="badge" style="background:#34C759">해결</span>'
                  : `<span class="badge" style="background:#FF3B30;cursor:pointer"
                      onclick="ErrorLog.resolve(${e.id})">미해결</span>`
                }
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },
};

/* ─────────────────────────────────────────
   유틸
───────────────────────────────────────── */
const PIE_COLORS = [
  '#0071E3', '#34C759', '#FF9500', '#FF3B30',
  '#AF52DE', '#5AC8FA', '#FFCC00', '#FF6B6B',
];

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/* ─────────────────────────────────────────
   초기화
───────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  TabManager.init();
  Tab0.init();
  Tab1.init();
});
