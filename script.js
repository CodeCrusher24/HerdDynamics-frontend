/* ═══════════════════════════════════════════
   HERDDYNAMICS — script.js
   Goat Farm Simulator & Forecasting System
═══════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────
   CONFIG & STATE
───────────────────────────────────────── */
const API = 'http://localhost:8080/api/auth';

let state = {
  user: null,
  config: {
    females: 10, males: 10,
    duration: 5, interval: 7,
    repro: 2, sellAge: 8,
    ratio: 20
  },
  simResult: null,
  feedResult: null,
  houseResult: null,
  valResult: null,
};

/* ─────────────────────────────────────────
   PANEL META
───────────────────────────────────────── */
const PANELS = {
  dashboard:  { title: 'Dashboard',            crumb: 'Overview' },
  herdconfig: { title: 'Herd Configuration',   crumb: 'Modules / Herd Config' },
  simulation: { title: 'Herd Simulation',      crumb: 'Modules / Simulation' },
  feed:       { title: 'Feed Forecasting',     crumb: 'Modules / Feed' },
  housing:    { title: 'Housing Planning',     crumb: 'Modules / Housing' },
  valuation:  { title: 'Enterprise Valuation', crumb: 'Modules / Valuation' },
  financial:  { title: 'Financial Analysis',   crumb: 'Modules / Financial' },
  reports:    { title: 'Reports',              crumb: 'Reports / Export' },
  settings:   { title: 'Settings',             crumb: 'Account / Settings' },
};

/* ─────────────────────────────────────────
   INIT
───────────────────────────────────────── */
// AFTER
document.addEventListener('DOMContentLoaded', async () => {
  const saved = safeGet('hd_user');
  const token = localStorage.getItem('token');

  if (saved && token) {
    try {
      const res = await fetch(`${API}/validate`, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (res.ok) {
        state.user = saved;
        enterApp(saved);
      } else {
        // Token rejected — another device took over this session
        localStorage.removeItem('token');
        localStorage.removeItem('hd_user');
        showMsg('loginMsg', 'You were signed out because this account logged in on another device.', 'error');
      }
    } catch {
      // Server unreachable — don't auto-login, force fresh login
      localStorage.removeItem('token');
      localStorage.removeItem('hd_user');
    }
  }

  document.querySelectorAll('.stat-card[data-target]').forEach(card => {
    card.addEventListener('click', () => {
      const target = card.getAttribute('data-target');
      const btn = document.querySelector(`.nav-btn[data-panel="${target}"]`);
      if (btn) navigate(btn);
    });
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const lc = document.getElementById('loginCard');
    const sc = document.getElementById('signupCard');
    if (lc && lc.style.display !== 'none') doLogin();
    else if (sc && sc.style.display !== 'none') doSignup();
  });
});

/* ─────────────────────────────────────────
   AUTH
───────────────────────────────────────── */
function showSignup() {
  document.getElementById('loginCard').style.display = 'none';
  document.getElementById('signupCard').style.display = 'block';
}
function showLogin() {
  document.getElementById('signupCard').style.display = 'none';
  document.getElementById('loginCard').style.display = 'block';
}

function showMsg(id, text, type) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = `msg-bar show ${type}`;
}
function clearMsg(id) {
  document.getElementById(id).className = 'msg-bar';
}

async function doSignup() {
  clearMsg('signupMsg');
  const username = document.getElementById('signupName').value.trim();
  const email    = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  if (!username || !email || !password)
    return showMsg('signupMsg', 'All fields are required.', 'error');
  if (password.length < 8)
    return showMsg('signupMsg', 'Password must be at least 8 characters.', 'error');

  const btn = document.querySelector('#signupCard .btn-auth');
  btn.disabled = true; btn.textContent = 'Creating account…';
  try {
    const res  = await fetch(`${API}/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    const text = await res.text();
    if (text === 'Signup successful') {
      showMsg('signupMsg', '✓ Account created! Signing you in…', 'success');
      setTimeout(() => loginWith(email, password), 800);
    } else {
      showMsg('signupMsg', text || 'Signup failed.', 'error');
    }
  } catch {
    // Demo mode
    showMsg('signupMsg', '✓ (Demo) Account created — signing you in…', 'success');
    setTimeout(() => enterApp({ username, email }), 800);
  } finally {
    btn.disabled = false; btn.textContent = 'Create account';
  }
}

async function doLogin() {
  clearMsg('loginMsg');
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  if (!email || !password)
    return showMsg('loginMsg', 'Email and password are required.', 'error');
  await loginWith(email, password);
}

// Store pending credentials for the force-login modal
let _pendingCreds = null;

async function loginWith(email, password) {
  _pendingCreds = { email, password };

  const btn = document.querySelector('#loginCard .btn-auth');
  if (btn) { btn.disabled = true; btn.textContent = 'Signing in…'; }

  try {
    const res  = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    // ── NEW: session conflict detected ──────────────────────────
    if (data.sessionConflict) {
      document.getElementById('sessionConflictModal').style.display = 'flex';
      return;
    }
    // ────────────────────────────────────────────────────────────

    if (data.message === 'Login successful') {
      localStorage.setItem('token', data.token);
      const user = { username: email.split('@')[0], email };
      localStorage.setItem('hd_user', JSON.stringify(user));
      enterApp(user);
    } else {
      showMsg('loginMsg', data.message || 'Login failed.', 'error');
    }
  } catch (err) {
    console.error(err);
    showMsg('loginMsg', 'Unable to connect to server', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Sign in'; }
  }
}
async function doForceLogin() {
  document.getElementById('sessionConflictModal').style.display = 'none';
  if (!_pendingCreds) return;

  const btn = document.querySelector('#loginCard .btn-auth');
  if (btn) { btn.disabled = true; btn.textContent = 'Signing in…'; }

  try {
    const res  = await fetch(`${API}/login/force`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(_pendingCreds)
    });
    const data = await res.json();

    if (data.message === 'Login successful') {
      localStorage.setItem('token', data.token);
      const user = { username: _pendingCreds.email.split('@')[0], email: _pendingCreds.email };
      localStorage.setItem('hd_user', JSON.stringify(user));
      enterApp(user);
      showToast('Signed in — other device has been logged out');
    } else {
      showMsg('loginMsg', data.message || 'Force login failed.', 'error');
    }
  } catch (err) {
    console.error(err);
    showMsg('loginMsg', 'Unable to connect to server', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Sign in'; }
  }
}

function cancelConflict() {
  document.getElementById('sessionConflictModal').style.display = 'none';
  showMsg('loginMsg', 'Login cancelled — your other session is still active.', 'error');
}


function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + localStorage.getItem('token')
  };
}

function enterApp(user) {
  state.user = user;
  document.getElementById('authPage').style.display = 'none';
  document.getElementById('appShell').style.display = 'flex';
  // Set sidebar user info
  document.getElementById('sbAvatar').textContent = (user.username || '?')[0].toUpperCase();
  document.getElementById('sbName').textContent   = user.username || '—';
  document.getElementById('sbEmail').textContent  = user.email    || '—';
  // Settings
  const sn = document.getElementById('set-name');
  const se = document.getElementById('set-email');
  if (sn) sn.value = user.username || '';
  if (se) se.value = user.email    || '';
  // Render default dashboard charts
  renderDashboardCharts();
  // Navigate to panel from URL if present (must run after appShell is visible)
  const urlPanel = new URLSearchParams(window.location.search).get('panel');
  if (urlPanel && PANELS[urlPanel]) {
    const btn = document.querySelector(`.nav-btn[data-panel="${urlPanel}"]`);
    if (btn) navigate(btn);
  }
}

async function doLogout() {
  const token = localStorage.getItem('token');

  // Tell the server to clear activeSessionId
  if (token) {
    try {
      await fetch(`${API}/logout`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token }
      });
    } catch (e) { /* best-effort — clear local state regardless */ }
  }

  localStorage.removeItem('token');
  localStorage.removeItem('hd_user');
  state.user = null;
  document.getElementById('appShell').style.display = 'none';
  document.getElementById('authPage').style.display = 'flex';
  showLogin();
}

/* ─────────────────────────────────────────
   NAVIGATION
───────────────────────────────────────── */
function navigate(btn) {
  const panel = btn.dataset.panel;
  const INLINE_PANELS = ['dashboard', 'settings'];
  const isModuleTab = new URLSearchParams(window.location.search).has('panel');

  if (!INLINE_PANELS.includes(panel) && !isModuleTab) {
    window.open(`index.html?panel=${panel}`, '_blank');
    closeSidebar();
    return;
  }

  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`panel-${panel}`).classList.add('active');
  const meta = PANELS[panel] || {};
  document.getElementById('tbTitle').textContent = meta.title || panel;
  document.getElementById('tbCrumb').textContent = 'HerdDynamics / ' + (meta.crumb || panel);
  closeSidebar();
}

/* ─────────────────────────────────────────
   SIDEBAR MOBILE
───────────────────────────────────────── */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

/* ─────────────────────────────────────────
   HERD CONFIGURATION
───────────────────────────────────────── */
function readConfig() {
  return {
    females:  +document.getElementById('cfg-females').value  || 10,
    males:    +document.getElementById('cfg-males').value    || 10,
    duration: +document.getElementById('cfg-duration').value || 5,
    interval: +document.getElementById('cfg-interval').value || 7,
    repro:    +document.getElementById('cfg-repro').value    || 2,
    sellAge:  +document.getElementById('cfg-sellage').value  || 8,
    ratio:    +document.getElementById('cfg-ratio').value    || 20,
  };
}

function saveConfig() {
  state.config = readConfig();
  const c = state.config;
  const breeders = Math.max(1, Math.ceil(c.females / c.ratio));
  const market   = Math.max(0, c.males - breeders);
  const reproLbl = c.repro === 1 ? 'Low (×1)' : c.repro === 2 ? 'Medium (×2)' : 'High (×3)';
  setText('cs-f',   c.females);
  setText('cs-m',   c.males);
  setText('cs-bm',  breeders);
  setText('cs-mm',  market);
  setText('cs-dur', `${c.duration} year${c.duration > 1 ? 's' : ''}`);
  setText('cs-int', `${c.interval} months`);
  setText('cs-rep', reproLbl);
  setText('cs-rat', `1 : ${c.ratio}`);
  showToast('Configuration saved');
}

function resetConfig() {
  document.getElementById('cfg-females').value  = 10;
  document.getElementById('cfg-males').value    = 10;
  document.getElementById('cfg-duration').value = 5;
  document.getElementById('cfg-interval').value = 7;
  document.getElementById('cfg-repro').value    = 2;
  document.getElementById('cfg-sellage').value  = 8;
  document.getElementById('cfg-ratio').value    = 20;
  saveConfig();
}

/* ─────────────────────────────────────────
   SIMULATION ENGINE
───────────────────────────────────────── */
function runSimulation() {
  const cfg = readConfig();
  state.config = cfg;

  const years         = cfg.duration;
  const cyclesPerYear = Math.floor(12 / cfg.interval);
  const ratio         = cfg.ratio;
  const repro         = cfg.repro;

  let females = cfg.females;
  let bMales  = Math.max(1, Math.ceil(females / ratio));
  let mMales  = Math.max(0, cfg.males - bMales);

  const yearRows = [];
  let totalKids  = 0;
  let extMales   = 0;
  let blocked    = 0; // simulated inbreeding blocks

  for (let y = 1; y <= years; y++) {
    let newFemales = 0, newMMales = 0, newKids = 0, yearExt = 0;
    for (let c = 0; c < cyclesPerYear; c++) {
      // Each breeder male serves 'ratio' females
      const activePairs = Math.min(bMales * ratio, females);
      const births      = Math.floor(activePairs * repro);
      newKids    += births;
      newFemales += Math.floor(births * 0.5);
      newMMales  += Math.floor(births * 0.5);
      // Simulate ~5% inbreeding blocks per cycle
      const blockEst = Math.floor(activePairs * 0.05);
      blocked += blockEst;
      if (blockEst > 0) { yearExt++; extMales++; }
    }

    females += newFemales;
    const neededBM = Math.max(1, Math.ceil(females / ratio));
    const delta = neededBM - bMales;
    if (delta > 0) { bMales += delta; extMales += delta; yearExt += delta; }
    mMales += newMMales;
    totalKids += newKids;

    yearRows.push({
      year: y, total: females + bMales + mMales,
      females, bMales, mMales, extMales: yearExt, kids: newKids
    });
  }

  state.simResult = { yearRows, totalKids, extMales, blocked, cycles: years * cyclesPerYear };

  // Update stat cards
  const last = yearRows[yearRows.length - 1];
  setText('sim-total',   fmt(last.total));
  setText('sim-females', fmt(last.females));
  setText('sim-bmales',  fmt(last.bMales));
  setText('sim-mmales',  fmt(last.mMales));
  setText('sim-ext',     fmt(extMales));
  setText('sim-cycles',  fmt(years * cyclesPerYear));
  setText('sim-kids',    fmt(totalKids));
  setText('sim-blocked', fmt(blocked));

  // Table
  const tbody = document.getElementById('simTableBody');
  tbody.innerHTML = yearRows.map(r => `
    <tr>
      <td>Year ${r.year}</td>
      <td>${fmt(r.total)}</td>
      <td>${fmt(r.females)}</td>
      <td>${fmt(r.bMales)}</td>
      <td>${fmt(r.mMales)}</td>
      <td>${r.extMales}</td>
      <td>${fmt(r.kids)}</td>
    </tr>
  `).join('');

  // Charts
  drawBarChart('simChartPop', yearRows.map(r => r.total), yearRows.map(r => `Y${r.year}`), '#c9780e');
  drawDonutChart('simChartGender', [
    { label: 'Breeder Females', value: last.females, color: '#3a7d5a' },
    { label: 'Breeder Males',   value: last.bMales,  color: '#2d6fa4' },
    { label: 'Market Males',    value: last.mMales,  color: '#c9780e' },
  ]);

  // Update dashboard stat cards
  updateDashboardStats(last, yearRows);
  showToast('Simulation complete');
}

function updateDashboardStats(last, yearRows) {
  setText('dc-total',   fmt(last.total));
  setText('dc-females', fmt(last.females));
  setText('dc-males',   fmt(last.bMales));
  setText('dc-market',  fmt(last.mMales));
  renderDashboardCharts(yearRows);
}

/* ─────────────────────────────────────────
   FEED FORECASTING
───────────────────────────────────────── */
function calcFeed() {
  const costPerKg = +document.getElementById('feed-cost').value     || 25;
  const fcr       = +document.getElementById('feed-fcr').value      || 2.5;
  const kidFcr    = +document.getElementById('feed-kids-fcr').value || 0.8;
  const maleFcr   = +document.getElementById('feed-male-fcr').value || 3.0;
  const cfg       = state.config;

  const sr      = state.simResult;
  const females = sr ? sr.yearRows[0].females : cfg.females;
  const bMales  = sr ? sr.yearRows[0].bMales  : Math.ceil(cfg.females / cfg.ratio);
  const mMales  = sr ? sr.yearRows[0].mMales  : Math.max(0, cfg.males - bMales);
  const kids    = Math.floor(females * cfg.repro * 0.5 * 0.3); // approx kids at any time

  const dailyKg   = females * fcr + bMales * maleFcr + mMales * fcr + kids * kidFcr;
  const monthlyKg = dailyKg * 30;
  const annualKg  = dailyKg * 365;

  state.feedResult = { costPerKg, dailyKg, monthlyKg, annualKg };

  setText('feed-daily-kg',     `${dailyKg.toFixed(1)} kg`);
  setText('feed-monthly-kg',   `${(monthlyKg/1000).toFixed(2)} t`);
  setText('feed-annual-kg',    `${(annualKg/1000).toFixed(2)} t`);
  setText('feed-daily-cost',   `₹${fmtMoney(dailyKg * costPerKg)}`);
  setText('feed-monthly-cost', `₹${fmtMoney(monthlyKg * costPerKg)}`);
  setText('feed-annual-cost',  `₹${fmtMoney(annualKg * costPerKg)}`);

  // Update dashboard
  setText('dc-feed', `₹${fmtMoney(monthlyKg * costPerKg)}`);

  // Charts
  const years = state.config.duration || 5;
  const sr2   = state.simResult;
  const demandData = sr2
    ? sr2.yearRows.map(r => {
        const f = r.females, bm = r.bMales, mm = r.mMales;
        return f * fcr + bm * maleFcr + mm * fcr;
      })
    : Array.from({length: years}, (_, i) => dailyKg * (1 + i * 0.15));

  drawLineChart('feedChartDemand', demandData,
    Array.from({length: demandData.length}, (_, i) => `Y${i+1}`), '#3a7d5a');

  const costData = demandData.map(d => d * 365 * costPerKg / 100000);
  drawBarChart('feedChartCost', costData,
    Array.from({length: costData.length}, (_, i) => `Y${i+1}`), '#c9780e');

  showToast('Feed calculations updated');
}

/* ─────────────────────────────────────────
   HOUSING PLANNING
───────────────────────────────────────── */
function calcHousing() {
  const costPerSqm = +document.getElementById('house-cost').value || 3500;
  const spKid      = +document.getElementById('hs-kids').value    || 0.5;
  const spFemale   = +document.getElementById('hs-female').value  || 1.5;
  const spBMale    = +document.getElementById('hs-bmale').value   || 2.0;
  const spMMale    = +document.getElementById('hs-mmale').value   || 1.5;

  const sr  = state.simResult;
  const cfg = state.config;

  const calcArea = (row) => {
    const kids = Math.floor(row.females * 0.2);
    return row.females * spFemale + row.bMales * spBMale + row.mMales * spMMale + kids * spKid;
  };

  const currentRow = {
    females: cfg.females,
    bMales:  Math.ceil(cfg.females / cfg.ratio),
    mMales:  Math.max(0, cfg.males - Math.ceil(cfg.females / cfg.ratio))
  };
  const current   = calcArea(currentRow);
  const yr1       = sr ? calcArea(sr.yearRows[0]) : current * 1.18;
  const yr3       = sr && sr.yearRows[2] ? calcArea(sr.yearRows[2]) : current * 1.55;
  const yr5       = sr && sr.yearRows[4] ? calcArea(sr.yearRows[4]) : current * 2.2;
  const expansion = Math.max(0, yr5 - current);

  state.houseResult = { current, yr1, yr3, yr5, costPerSqm };

  setText('hs-current',   `${current.toFixed(0)} m²`);
  setText('hs-1yr',       `${yr1.toFixed(0)} m²`);
  setText('hs-3yr',       `${yr3.toFixed(0)} m²`);
  setText('hs-5yr',       `${yr5.toFixed(0)} m²`);
  setText('hs-expand',    `${expansion.toFixed(0)} m²`);
  setText('hs-buildcost', `₹${fmtMoney(expansion * costPerSqm)}`);
  setText('dc-housing',   `${yr1.toFixed(0)} m²`);

  const labels   = sr ? sr.yearRows.map(r => `Y${r.year}`) : ['Now', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5'];
  const areaData = sr
    ? sr.yearRows.map(r => calcArea(r))
    : [current, yr1, current*1.3, yr3, current*1.85, yr5];

  drawBarChart('houseChartDemand', areaData, labels, '#5c7a5e');
  showToast('Housing calculations updated');
}   

/* ─────────────────────────────────────────
   ENTERPRISE VALUATION
───────────────────────────────────────── */
function calcValuation() {
  const fPrice   = +document.getElementById('val-female').value || 8000;
  const bmPrice  = +document.getElementById('val-bmale').value  || 10000;
  const mmPrice  = +document.getElementById('val-mmale').value  || 5500;
  const kidPrice = +document.getElementById('val-kid').value    || 2500;

  const sr  = state.simResult;
  const cfg = state.config;

  const calcVal = (row) => {
    const kids = Math.floor(row.females * 0.2);
    return row.females * fPrice + row.bMales * bmPrice + row.mMales * mmPrice + kids * kidPrice;
  };

  const currentRow = {
    females: cfg.females,
    bMales:  Math.ceil(cfg.females / cfg.ratio),
    mMales:  Math.max(0, cfg.males - Math.ceil(cfg.females / cfg.ratio))
  };
  const now = calcVal(currentRow);
  const yr1 = sr && sr.yearRows[0] ? calcVal(sr.yearRows[0]) : now * 1.25;
  const yr3 = sr && sr.yearRows[2] ? calcVal(sr.yearRows[2]) : now * 2.0;
  const yr5 = sr && sr.yearRows[4] ? calcVal(sr.yearRows[4]) : now * 3.5;

  state.valResult = { now, yr1, yr3, yr5 };

  setText('vl-now',   `₹${fmtMoney(now)}`);
  setText('vl-1yr',   `₹${fmtMoney(yr1)}`);
  setText('vl-3yr',   `₹${fmtMoney(yr3)}`);
  setText('vl-5yr',   `₹${fmtMoney(yr5)}`);
  setText('dc-value', `₹${shortMoney(now)}`);

  const labels  = sr ? sr.yearRows.map(r => `Y${r.year}`) : ['Now','Y1','Y2','Y3','Y4','Y5'];
  const valData = sr
    ? [now, ...sr.yearRows.map(r => calcVal(r))]
    : [now, yr1, now*1.5, yr3, now*2.8, yr5];

  drawLineChart('valChartGrowth', valData, ['Now', ...labels], '#b08020');
  renderDashboardCharts();
  showToast('Valuation updated');
}

/* ─────────────────────────────────────────
   FINANCIAL ANALYSIS
───────────────────────────────────────── */
function calcFinancial() {
  const sr = state.simResult;
  const fr = state.feedResult;
  const hr = state.houseResult;
  if (!sr) { showToast('Run simulation first'); return; }

  const mmPrice      = +document.getElementById('val-mmale').value || 5500;
  const extMalePrice = 10000;
  const costPerSqm   = hr ? hr.costPerSqm : 3500;
  const fcrCost      = fr ? fr.costPerKg  : 25;
  const fcr          = +(document.getElementById('feed-fcr') && document.getElementById('feed-fcr').value) || 2.5;

  let totalRev = 0, totalExp = 0;
  const tbody = document.getElementById('finTableBody');
  tbody.innerHTML = '';

  const rows = sr.yearRows;
  for (let i = 0; i < rows.length; i++) {
    const r    = rows[i];
    const prev = i === 0
      ? {
          females: state.config.females,
          bMales:  Math.ceil(state.config.females / state.config.ratio),
          mMales:  Math.max(0, state.config.males - Math.ceil(state.config.females / state.config.ratio))
        }
      : rows[i - 1];

    const newMMales   = r.mMales - prev.mMales;
    const revenue     = Math.max(0, newMMales) * mmPrice;
    const feedAnnual  = (r.females * fcr + r.bMales * (fcr + 0.5) + r.mMales * fcr) * 365 * fcrCost;
    const housingCost = (i === 0 ? Math.max(0, (r.females + r.bMales + r.mMales) - (prev.females + prev.bMales + prev.mMales)) * 1.8 * costPerSqm : 0);
    const extCost     = r.extMales * extMalePrice;
    const expenses    = feedAnnual + housingCost + extCost;
    const profit      = revenue - expenses;

    totalRev += revenue;
    totalExp += expenses;

    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td>Year ${r.year}</td>
        <td style="color:var(--green);font-weight:600">₹${fmtMoney(revenue)}</td>
        <td>₹${fmtMoney(feedAnnual)}</td>
        <td>₹${fmtMoney(housingCost)}</td>
        <td>₹${fmtMoney(extCost)}</td>
        <td style="color:var(--rust)">₹${fmtMoney(expenses)}</td>
        <td style="color:${profit >= 0 ? 'var(--green)' : 'var(--rust)'};font-weight:700">
          ${profit >= 0 ? '+' : ''}₹${fmtMoney(Math.abs(profit))}
        </td>
      </tr>
    `);
  }

  const annualRev  = totalRev / rows.length;
  const annualExp  = totalExp / rows.length;
  const annualProf = annualRev - annualExp;
  const margin     = annualRev > 0 ? ((annualProf / annualRev) * 100).toFixed(1) : '0.0';

  setText('fin-revenue',  `₹${shortMoney(annualRev)}`);
  setText('fin-expenses', `₹${shortMoney(annualExp)}`);
  setText('fin-profit',   `₹${shortMoney(annualProf)}`);
  setText('fin-margin',   `${margin}%`);
  setText('dc-profit',    `₹${shortMoney(annualProf)}`);

  // Charts
  const revData = rows.map((r, i) => {
    const prev = i === 0 ? state.config : rows[i - 1];
    return Math.max(0, (r.mMales - (prev.mMales || 0))) * mmPrice / 100000;
  });
  const expData = rows.map(r => (r.females * fcr + r.bMales * (fcr + 0.5) + r.mMales * fcr) * 365 * fcrCost / 100000);
  const labels  = rows.map(r => `Y${r.year}`);

  drawGroupedBarChart('finChartRevExp', revData, expData, labels);
  const profData = rows.map((_, i) => (revData[i] - expData[i]));
  drawLineChart('finChartProfit', profData, labels, '#3a7d5a');

  showToast('Financial analysis updated');
}

/* ─────────────────────────────────────────
   REPORTS
───────────────────────────────────────── */
function downloadReport(type) {
  const labels = {
    herd:      'Herd Growth Report',
    feed:      'Feed Forecast Report',
    housing:   'Housing Forecast Report',
    valuation: 'Valuation Report',
    financial: 'Financial Report',
  };
  showToast(`${labels[type] || 'Report'} export — connect backend to enable`);
}

/* ─────────────────────────────────────────
   DASHBOARD CHARTS (initial state)
───────────────────────────────────────── */
function renderDashboardCharts(yearRows) {
  // Population growth
  if (yearRows && yearRows.length) {
    drawBarChart('chartPopulation', yearRows.map(r => r.total), yearRows.map(r => `Y${r.year}`), '#c9780e');
    drawDonutChart('chartComposition', [
      { label: 'Breeder Females', value: yearRows[yearRows.length-1].females, color: '#3a7d5a' },
      { label: 'Breeder Males',   value: yearRows[yearRows.length-1].bMales,  color: '#2d6fa4' },
      { label: 'Market Males',    value: yearRows[yearRows.length-1].mMales,  color: '#c9780e' },
    ]);
  } else {
    // Default demo data
    drawBarChart('chartPopulation', [20,34,58,92,148,210], ['Now','Y1','Y2','Y3','Y4','Y5'], '#c9780e');
    drawDonutChart('chartComposition', [
      { label: 'Breeder Females', value: 142, color: '#3a7d5a' },
      { label: 'Breeder Males',   value: 8,   color: '#2d6fa4' },
      { label: 'Market Males',    value: 76,  color: '#c9780e' },
    ]);
  }

  drawLineChart('chartFeed',      [28000,35000,44000,55000,68000,82000], ['Now','Y1','Y2','Y3','Y4','Y5'], '#a63a1f');
  drawLineChart('chartValuation', [1.8,2.4,3.5,5.2,7.4,10.1],           ['Now','Y1','Y2','Y3','Y4','Y5'], '#b08020');
}

/* ─────────────────────────────────────────
   SVG CHART ENGINE
───────────────────────────────────────── */
function drawBarChart(containerId, data, labels, color) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const W = el.clientWidth || 400, H = 130;
  const pad = { t: 10, r: 8, b: 24, l: 36 };
  const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
  const max = Math.max(...data, 1);
  const bW  = Math.floor((cW / data.length) * 0.6);
  const gap = cW / data.length;

  let svg = `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${pad.t + cH}" class="axis-line"/>`;
  svg += `<line x1="${pad.l}" y1="${pad.t + cH}" x2="${W - pad.r}" y2="${pad.t + cH}" class="axis-line"/>`;

  data.forEach((v, i) => {
    const bH = Math.max(2, (v / max) * cH);
    const x  = pad.l + i * gap + (gap - bW) / 2;
    const y  = pad.t + cH - bH;
    svg += `<rect class="chart-bar" x="${x}" y="${y}" width="${bW}" height="${bH}" fill="${color}" rx="3"/>`;
    svg += `<text class="chart-label" x="${x + bW / 2}" y="${H - 6}" text-anchor="middle">${labels[i] || ''}</text>`;
    if (i === 0 || i === data.length - 1) {
      svg += `<text class="chart-label" x="${pad.l - 4}" y="${y + 4}" text-anchor="end">${shortVal(v)}</text>`;
    }
  });

  svg += '</svg>';
  el.innerHTML = svg;
}

function drawLineChart(containerId, data, labels, color) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const W = el.clientWidth || 400, H = 130;
  const pad = { t: 10, r: 8, b: 24, l: 36 };
  const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => ({
    x: pad.l + (i / Math.max(data.length - 1, 1)) * cW,
    y: pad.t + cH - (v / max) * cH,
  }));

  const lineD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaD = lineD + ` L${pts[pts.length-1].x},${pad.t+cH} L${pts[0].x},${pad.t+cH} Z`;

  let svg = `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${pad.t+cH}" class="axis-line"/>`;
  svg += `<line x1="${pad.l}" y1="${pad.t+cH}" x2="${W-pad.r}" y2="${pad.t+cH}" class="axis-line"/>`;
  svg += `<path d="${areaD}" fill="${color}" class="chart-area-fill"/>`;
  svg += `<path d="${lineD}" stroke="${color}" class="chart-line"/>`;
  pts.forEach((p, i) => {
    svg += `<circle cx="${p.x}" cy="${p.y}" r="3" fill="${color}"/>`;
    svg += `<text class="chart-label" x="${p.x}" y="${H - 6}" text-anchor="middle">${labels[i] || ''}</text>`;
  });
  svg += '</svg>';
  el.innerHTML = svg;
}

function drawGroupedBarChart(containerId, data1, data2, labels) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const W = el.clientWidth || 400, H = 130;
  const pad = { t: 10, r: 8, b: 24, l: 36 };
  const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
  const max  = Math.max(...data1, ...data2, 0.01);
  const gapW = cW / data1.length;
  const bW   = Math.floor(gapW * 0.35);

  let svg = `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${pad.t+cH}" class="axis-line"/>`;
  svg += `<line x1="${pad.l}" y1="${pad.t+cH}" x2="${W-pad.r}" y2="${pad.t+cH}" class="axis-line"/>`;

  data1.forEach((v1, i) => {
    const v2 = data2[i];
    const cx = pad.l + i * gapW + gapW / 2;
    const h1 = Math.max(2, (v1 / max) * cH);
    const h2 = Math.max(2, (v2 / max) * cH);
    svg += `<rect class="chart-bar" x="${cx - bW - 1}" y="${pad.t+cH-h1}" width="${bW}" height="${h1}" fill="#3a7d5a" rx="2"/>`;
    svg += `<rect class="chart-bar" x="${cx + 1}" y="${pad.t+cH-h2}" width="${bW}" height="${h2}" fill="#a63a1f" rx="2"/>`;
    svg += `<text class="chart-label" x="${cx}" y="${H-6}" text-anchor="middle">${labels[i]}</text>`;
  });

  // Legend
  svg += `<circle cx="${pad.l+4}" cy="${pad.t+4}" r="4" fill="#3a7d5a"/>`;
  svg += `<text class="chart-label" x="${pad.l+12}" y="${pad.t+8}">Revenue</text>`;
  svg += `<circle cx="${pad.l+68}" cy="${pad.t+4}" r="4" fill="#a63a1f"/>`;
  svg += `<text class="chart-label" x="${pad.l+76}" y="${pad.t+8}">Expenses</text>`;
  svg += '</svg>';
  el.innerHTML = svg;
}

function drawDonutChart(containerId, segments) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const SIZE = 120, cx = 60, cy = 60, R = 48, r = 28;
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  let angle = -Math.PI / 2;

  let paths = '', legendItems = '';
  segments.forEach(seg => {
    const theta = (seg.value / total) * 2 * Math.PI;
    const x1 = cx + R * Math.cos(angle);
    const y1 = cy + R * Math.sin(angle);
    const x2 = cx + R * Math.cos(angle + theta);
    const y2 = cy + R * Math.sin(angle + theta);
    const x3 = cx + r * Math.cos(angle + theta);
    const y3 = cy + r * Math.sin(angle + theta);
    const x4 = cx + r * Math.cos(angle);
    const y4 = cy + r * Math.sin(angle);
    const large = theta > Math.PI ? 1 : 0;
    const d = `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${r} ${r} 0 ${large} 0 ${x4} ${y4} Z`;
    paths += `<path d="${d}" fill="${seg.color}" class="donut-slice"/>`;
    angle += theta;
  });

  let svg = `<svg viewBox="0 0 ${SIZE} ${SIZE}" style="width:${SIZE}px;height:${SIZE}px;flex-shrink:0" xmlns="http://www.w3.org/2000/svg">`;
  svg += paths;
  svg += `<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="11" font-weight="600" fill="#3a2c10">${fmt(total)}</text>`;
  svg += `<text x="${cx}" y="${cy + 8}" text-anchor="middle" font-family="Sora,sans-serif" font-size="7" fill="#9a8460">total</text>`;
  svg += '</svg>';

  legendItems = segments.map(seg => `
    <div style="display:flex;align-items:center;gap:6px;font-size:0.72rem;color:#7a6040;margin-bottom:5px">
      <div style="width:10px;height:10px;border-radius:3px;background:${seg.color};flex-shrink:0"></div>
      <span>${seg.label}</span>
    </div>
  `).join('');

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:1.25rem">
      ${svg}
      <div>${legendItems}</div>
    </div>`;
}

/* ─────────────────────────────────────────
   UTILITIES
───────────────────────────────────────── */
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function fmt(n)        { return Number(n).toLocaleString('en-IN'); }
function fmtMoney(n)   { return Number(Math.round(n)).toLocaleString('en-IN'); }
function shortMoney(n) {
  if (Math.abs(n) >= 1e7) return (n / 1e7).toFixed(2) + ' Cr';
  if (Math.abs(n) >= 1e5) return (n / 1e5).toFixed(1) + 'L';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return fmtMoney(n);
}
function shortVal(n) {
  if (n >= 10000) return (n / 1000).toFixed(0) + 'k';
  if (n >= 1000)  return (n / 1000).toFixed(1) + 'k';
  return n;
}

function safeGet(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ─────────────────────────────────────────
   AUTO-CALCULATE on module visit
   (runs calcFeed/calcHousing/calcValuation/calcFinancial
    if sim has been run, so numbers aren't blank)
───────────────────────────────────────── */
document.addEventListener('click', e => {
  const btn = e.target.closest('.nav-btn');
  if (!btn) return;
  const panel = btn.dataset.panel;
  if (!state.simResult) return;
  if (panel === 'feed'      && !state.feedResult)  setTimeout(calcFeed,      50);
  if (panel === 'housing'   && !state.houseResult) setTimeout(calcHousing,   50);
  if (panel === 'valuation' && !state.valResult)   setTimeout(calcValuation, 50);
  if (panel === 'financial') setTimeout(calcFinancial, 80);
});