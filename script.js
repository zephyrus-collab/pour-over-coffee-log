import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import { getFirestore, collection, doc, getDocs, setDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

/* ===== Firebase ===== */
const firebaseConfig = {
  apiKey: "AIzaSyDOy3zhSNK_dHGkNBsFxIeepGpvVUIzGLE",
  authDomain: "pour-over-coffee-log.firebaseapp.com",
  projectId: "pour-over-coffee-log",
  storageBucket: "pour-over-coffee-log.firebasestorage.app",
  messagingSenderId: "740164646088",
  appId: "1:740164646088:web:4a6bd1c515a501deb761fd"
};
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const provider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    console.error(e);
    App.showAlert('登入失敗，請再試一次');
  }
}

export async function signOutUser() {
  DB.clearCache();
  await signOut(auth);
}

onAuthStateChanged(auth, user => {
  if (user) {
    DB.clearCache();
    const el = document.getElementById('home-user-name');
    if (el) el.textContent = user.displayName || user.email;
    const active = document.querySelector('.page.active');
    if (!active || active.id === 'page-login') {
      showPage('page-home');
    }
  } else {
    DB.clearCache();
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-login')?.classList.add('active');
    history.replaceState({ page: 'page-login' }, '');
  }
});

/* ===== Storage (Firestore) ===== */
const DB = {
  _cache: null,

  _uid() { return auth.currentUser?.uid; },

  async load() {
    if (this._cache) return [...this._cache];
    const uid = this._uid();
    if (!uid) return [];
    const snap = await getDocs(collection(db, 'users', uid, 'records'));
    this._cache = snap.docs.map(d => d.data());
    return [...this._cache];
  },

  async add(record) {
    const uid = this._uid();
    if (!uid) return;
    await setDoc(doc(db, 'users', uid, 'records', record.id), record);
    if (this._cache) this._cache.push(record);
  },

  async update(id, data) {
    const uid = this._uid();
    if (!uid) return;
    await setDoc(doc(db, 'users', uid, 'records', id), data);
    if (this._cache) {
      const idx = this._cache.findIndex(r => r.id === id);
      if (idx !== -1) this._cache[idx] = { ...this._cache[idx], ...data };
    }
  },

  async remove(id) {
    const uid = this._uid();
    if (!uid) return;
    await deleteDoc(doc(db, 'users', uid, 'records', id));
    if (this._cache) this._cache = this._cache.filter(r => r.id !== id);
  },

  clearCache() { this._cache = null; },
};

/* ===== Timer ===== */
const Timer = {
  startTime: null,
  rafId: null,
  displays: [],

  start() {
    this.startTime = Date.now();
    this.displays = document.querySelectorAll('[id^="timer-display-"]');
    this._tick();
  },
  stop() {
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
  },
  elapsed() {
    if (this.startTime === null) return 0;
    return Math.floor((Date.now() - this.startTime) / 1000);
  },
  fmt(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  },
  _tick() {
    const val = this.fmt(this.elapsed());
    this.displays.forEach(d => { d.textContent = val; });
    this.rafId = requestAnimationFrame(() => this._tick());
  },
};

/* ===== State ===== */
const State = {
  rec: null,
  currentStep: null,
  pendingPourIndex: null,
  currentRecordId: null,
  isEditing: false,
  editData: null,
  _numpadVal: '',
  _pendingPourTime: null,
};

/* ===== Helpers ===== */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function beanLabel(r) {
  return `${r.origin} · ${r.region} · ${r.variety}`;
}

function fmtDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function fmtSec(sec) {
  if (sec == null) return '—';
  if (typeof sec === 'string') return sec;
  return Timer.fmt(sec);
}

function ratio(dose, yld) {
  if (!dose || !yld || yld <= 0) return '—';
  return `1 : ${(yld / dose).toFixed(2)}`;
}

function strSimilarity(a, b) {
  a = a.trim().toLowerCase();
  b = b.trim().toLowerCase();
  if (a === b) return 1;
  const la = a.length, lb = b.length;
  if (la === 0 || lb === 0) return 0;
  const dp = Array.from({ length: la + 1 }, (_, i) => [i, ...Array(lb).fill(0)]);
  for (let j = 1; j <= lb; j++) dp[0][j] = j;
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return 1 - dp[la][lb] / Math.max(la, lb);
}

function isSameBean(a, b) {
  return a.origin.trim().toLowerCase() === b.origin.trim().toLowerCase()
    && a.variety.trim().toLowerCase() === b.variety.trim().toLowerCase()
    && strSimilarity(a.region, b.region) >= 0.6;
}

/* ===== Page routing ===== */
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pg = document.getElementById(id);
  if (pg) pg.classList.add('active');
  history.pushState({ page: id }, '');
}

window.addEventListener('popstate', e => {
  const active = document.querySelector('.page.active')?.id;
  if (active === 'page-new') {
    history.pushState({ page: 'page-new' }, '');
    App.confirmDiscard();
    return;
  }
  const target = e.state?.page || 'page-login';
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pg = document.getElementById(target);
  if (pg) pg.classList.add('active');
});

/* ===== Step management ===== */
function showStep(n) {
  document.querySelectorAll('#page-new .step').forEach(s => s.classList.add('hidden'));
  const s = document.getElementById(`step-${n}`);
  if (s) s.classList.remove('hidden');
  State.currentStep = n;
}

/* ===== App ===== */
const App = {

  /* ----- Navigation ----- */
  goHome() {
    Timer.stop();
    showPage('page-home');
  },

  goNewRecord() {
    State.rec = {
      id: uid(),
      brewer: '', origin: '', region: '', variety: '',
      roastDate: '', equipment: '',
      grind: '', temp: '', dryAroma: '', dose: '',
      preheatTime: null, preheatWater: null,
      pours: [],
      extractionTime: null,
      yld: '', wetAroma: '', brewRatio: '',
      tasting: {}, notes: '',
      createdAt: null,
    };
    ['f-brewer','f-origin','f-region','f-variety','f-roast-date',
     'f-equipment','f-grind','f-temp','f-dry-aroma','f-dose'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('btn-step1-next').disabled = true;
    showPage('page-new');
    showStep(1);
    this._bindStep1Validation();
  },

  async goHistory() {
    await this._populateBeanFilter();
    document.getElementById('filter-brewer').value = '';
    document.getElementById('filter-date-from').value = '';
    document.getElementById('filter-date-to').value = '';
    document.getElementById('filter-date-from').onchange = () => {
      const to = document.getElementById('filter-date-to');
      if (!to.value) to.value = document.getElementById('filter-date-from').value;
    };
    await this.searchHistory();
    showPage('page-history');
  },

  goDetail() {
    showPage('page-detail');
  },

  async goCompare() {
    await this._renderCompare();
    showPage('page-compare');
  },

  /* ----- Step 1 ----- */
  _bindStep1Validation() {
    const required = ['f-brewer','f-origin','f-region','f-variety','f-grind','f-temp','f-dry-aroma','f-dose'];
    const btn = document.getElementById('btn-step1-next');
    const check = () => {
      btn.disabled = !required.every(id => document.getElementById(id).value.trim() !== '');
    };
    required.forEach(id => {
      const el = document.getElementById(id);
      el.oninput = check;
      el.onchange = check;
    });
  },

  step1Next() {
    const r = State.rec;
    r.brewer    = document.getElementById('f-brewer').value.trim();
    r.origin    = document.getElementById('f-origin').value.trim();
    r.region    = document.getElementById('f-region').value.trim();
    r.variety   = document.getElementById('f-variety').value.trim();
    r.roastDate = document.getElementById('f-roast-date').value;
    r.equipment = document.getElementById('f-equipment').value.trim();
    r.grind     = document.getElementById('f-grind').value;
    r.temp      = document.getElementById('f-temp').value;
    r.dryAroma  = document.getElementById('f-dry-aroma').value.trim();
    r.dose      = document.getElementById('f-dose').value;
    showStep(2);
  },

  /* ----- Step 2 ----- */
  startTimer() {
    Timer.start();
    State._numpadVal = '';
    document.getElementById('preheat-water-display').textContent = '—';
    document.getElementById('btn-preheat-done').disabled = true;
    showStep(3);
  },

  /* ----- Step 3 numpad ----- */
  numpadPress(key) {
    let v = State._numpadVal || '';
    if (key === 'del') {
      v = v.slice(0, -1);
    } else if (key === '.') {
      if (v.includes('.') || v === '') return;
      v += '.';
    } else {
      if (v === '0') v = key;
      else v += key;
      if (v.length > 7) return;
    }
    State._numpadVal = v;
    const display = document.getElementById('preheat-water-display');
    display.textContent = v === '' ? '—' : v;
    const num = parseFloat(v);
    document.getElementById('btn-preheat-done').disabled = !(num > 0);
  },

  /* ----- Step 3 ----- */
  preheatDone() {
    State.rec.preheatTime  = Timer.elapsed();
    State.rec.preheatWater = parseFloat(State._numpadVal || '0');
    showStep(4);
  },

  /* ----- Steps 4-6: pour management ----- */
  pourEnd(pourIndex) {
    const t = Timer.elapsed();
    State.pendingPourIndex = pourIndex;
    document.getElementById('water-modal-title').textContent = `第${['一','二','三'][pourIndex-1]}注水量（克）`;
    document.getElementById('water-modal-input').value = '';
    document.getElementById('water-modal-confirm').disabled = true;
    document.getElementById('water-modal').classList.remove('hidden');
    const inp = document.getElementById('water-modal-input');
    inp.oninput = () => {
      const v = parseFloat(inp.value);
      document.getElementById('water-modal-confirm').disabled = !(v > 0);
    };
    inp.focus();
    State._pendingPourTime = t;
  },

  confirmWater() {
    const water = parseFloat(document.getElementById('water-modal-input').value);
    if (!(water > 0)) return;
    document.getElementById('water-modal').classList.add('hidden');
    const idx = State.pendingPourIndex;
    while (State.rec.pours.length < idx) State.rec.pours.push(null);
    State.rec.pours[idx - 1] = { time: State._pendingPourTime, water };
    if (idx === 1) { showStep(5); }
    else if (idx === 2) { showStep(6); }
    else if (idx === 3) { showStep(7); }
  },

  /* ----- Extraction end ----- */
  extractionEnd() {
    State.rec.extractionTime = Timer.elapsed();
    Timer.stop();
    document.getElementById('f-yield').value = '';
    document.getElementById('f-wet-aroma').value = '';
    document.getElementById('brew-ratio-display').textContent = '— 填入淨重後自動計算';
    document.getElementById('btn-step8-next').disabled = true;
    this._bindStep8Validation();
    showStep(8);
  },

  /* ----- Step 8 ----- */
  _bindStep8Validation() {
    const yieldEl  = document.getElementById('f-yield');
    const aromaEl  = document.getElementById('f-wet-aroma');
    const ratioEl  = document.getElementById('brew-ratio-display');
    const btn      = document.getElementById('btn-step8-next');

    yieldEl.oninput = () => {
      const v = parseFloat(yieldEl.value);
      if (v > 0) {
        ratioEl.textContent = ratio(parseFloat(State.rec.dose), v);
        ratioEl.style.color = 'var(--text)';
      } else {
        ratioEl.textContent = '— 填入淨重後自動計算';
        ratioEl.style.color = '';
      }
      check();
    };
    aromaEl.oninput = check;

    function check() {
      const y = parseFloat(yieldEl.value);
      btn.disabled = !(y > 0 && aromaEl.value.trim() !== '');
    }
  },

  step8Next() {
    const r = State.rec;
    r.yld      = document.getElementById('f-yield').value;
    r.wetAroma = document.getElementById('f-wet-aroma').value.trim();
    r.brewRatio = ratio(parseFloat(r.dose), parseFloat(r.yld));
    document.querySelectorAll('.tasting-input').forEach(el => { el.value = ''; });
    document.querySelectorAll('.tasting-slider').forEach(el => {
      el.value = 3;
      el.nextElementSibling.textContent = '3.0';
    });
    document.querySelectorAll('.tasting-note').forEach(el => { el.value = ''; });
    document.getElementById('f-notes').value = '';
    this._bindTastingSliders();
    showStep(9);
  },

  _bindTastingSliders() {
    document.querySelectorAll('.tasting-slider').forEach(slider => {
      slider.oninput = () => {
        slider.nextElementSibling.textContent = parseFloat(slider.value).toFixed(1);
      };
    });
  },

  /* ----- Step 9 ----- */
  step9Next() {
    const r   = State.rec;
    const cols = ['hot', 'warm', 'cool'];
    const rows = ['flavor', 'finish', 'acidity', 'sweetness', 'body'];
    r.tasting  = {};
    rows.forEach(row => {
      r.tasting[row] = {};
      cols.forEach(col => {
        if (row === 'acidity' || row === 'sweetness') {
          const slider = document.querySelector(`.tasting-slider[data-row="${row}"][data-col="${col}"]`);
          const note   = document.querySelector(`.tasting-note[data-row="${row}"][data-col="${col}"]`);
          r.tasting[row][col] = { score: parseFloat(slider.value).toFixed(1), note: note.value.trim() };
        } else {
          const ta = document.querySelector(`.tasting-input[data-row="${row}"][data-col="${col}"]`);
          r.tasting[row][col] = ta.value.trim();
        }
      });
    });
    r.notes = document.getElementById('f-notes').value.trim();
    this._renderPreview(r, true);
    showStep(10);
  },

  /* ----- Step 10: Preview ----- */
  _renderPreview(r, editMode) {
    const el = document.getElementById('preview-content');
    el.innerHTML = this._buildRecordHTML(r, editMode);
    if (editMode) this._bindPreviewRecalc();
  },

  _buildRecordHTML(r, editMode) {
    const infoRows = [
      ['沖煮人',   r.brewer],
      ['沖煮日期', r.createdAt ? fmtDate(r.createdAt) : '（送出後記錄）'],
      ['產國',     r.origin],
      ['產區',     r.region],
      ['品種',     r.variety],
      ['烘焙日期', r.roastDate || '—'],
      ['器具',     r.equipment || '—'],
      ['粉重 (g)', r.dose],
      ['研磨刻度', r.grind],
      ['水溫 (°C)',r.temp],
      ['乾香',     r.dryAroma],
    ];

    const pourRows = [];
    pourRows.push({ label: '預熱時間',     value: fmtSec(r.preheatTime),      key: 'preheatTime' });
    pourRows.push({ label: '預熱水量 (g)', value: r.preheatWater ?? '—',       key: 'preheatWater' });
    if (r.pours?.[0]) {
      pourRows.push({ label: '第一注時間',     value: fmtSec(r.pours[0].time), key: 'pour0time' });
      pourRows.push({ label: '第一注水量 (g)', value: r.pours[0].water,        key: 'pour0water' });
    }
    if (r.pours?.[1]) {
      pourRows.push({ label: '第二注時間',     value: fmtSec(r.pours[1].time), key: 'pour1time' });
      pourRows.push({ label: '第二注水量 (g)', value: r.pours[1].water,        key: 'pour1water' });
    }
    if (r.pours?.[2]) {
      pourRows.push({ label: '第三注時間',     value: fmtSec(r.pours[2].time), key: 'pour2time' });
      pourRows.push({ label: '第三注水量 (g)', value: r.pours[2].water,        key: 'pour2water' });
    }
    pourRows.push({ label: '總萃取時間', value: fmtSec(r.extractionTime), key: 'extractionTime' });

    const afterRows = [
      ['咖啡液淨重 (g)', r.yld],
      ['粉液比',         r.brewRatio],
      ['濕香',           r.wetAroma],
    ];

    const rowHtml = (label, value, editable, dataKey) => {
      const editAttr = editable ? `contenteditable="true" data-key="${dataKey}"` : '';
      const cls = editable ? '' : ' readonly';
      return `<div class="preview-row">
        <div class="preview-label">${label}</div>
        <div class="preview-value${cls}" ${editAttr}>${value ?? ''}</div>
      </div>`;
    };

    const infoKeys = ['brewer','_date','origin','region','variety','roastDate','equipment','dose','grind','temp','dryAroma'];
    let infoHtml = infoRows.map((row, i) => {
      const key = infoKeys[i];
      const editable = editMode && key !== '_date';
      return rowHtml(row[0], row[1], editable, key);
    }).join('');

    let pourHtml = pourRows.map(({ label, value, key }) =>
      rowHtml(label, value, editMode, key)
    ).join('');

    const afterKeys = ['yld','brewRatio','wetAroma'];
    let afterHtml = afterRows.map((row, i) => {
      const key = afterKeys[i];
      const editable = editMode && key !== 'brewRatio';
      return rowHtml(row[0], row[1], editable, key);
    }).join('');

    const cols = ['hot','warm','cool'];
    const rows = ['flavor','finish','acidity','sweetness','body'];
    const rowNames = { flavor: '風味', finish: '餘韻', acidity: '酸質', sweetness: '甜感', body: '口感' };

    let tastingRows = rows.map(row => {
      const cells = cols.map(col => {
        let val = '';
        const td = r.tasting?.[row]?.[col];
        if (row === 'acidity' || row === 'sweetness') {
          const score = td?.score ?? '—';
          const note  = td?.note  ? ` (${td.note})` : '';
          val = `${score}${note}`;
        } else {
          val = td ?? '';
        }
        const editAttr = editMode ? `contenteditable="true" data-trow="${row}" data-tcol="${col}"` : '';
        return `<td ${editAttr}>${val}</td>`;
      }).join('');
      return `<tr><td class="row-label">${rowNames[row]}</td>${cells}</tr>`;
    }).join('');

    const notesEditAttr = editMode ? 'contenteditable="true" data-key="notes"' : '';

    const tastingHtml = `<div class="preview-tasting">
      <table>
        <thead><tr><th></th><th>高溫</th><th>中低溫</th><th>放涼後</th></tr></thead>
        <tbody>${tastingRows}</tbody>
      </table>
    </div>`;

    return `
      <div class="preview-section">
        <div class="preview-section-title">基本資訊</div>
        ${infoHtml}
      </div>
      <div class="preview-section">
        <div class="preview-section-title">沖煮過程</div>
        ${pourHtml}
      </div>
      <div class="preview-section">
        <div class="preview-section-title">萃取後</div>
        ${afterHtml}
      </div>
      <div class="preview-section">
        <div class="preview-section-title">品測</div>
        ${tastingHtml}
      </div>
      <div class="preview-section">
        <div class="preview-section-title">整體備註</div>
        <div class="preview-notes" ${notesEditAttr}>${r.notes || ''}</div>
      </div>`;
  },

  _bindPreviewRecalc() {
    document.querySelectorAll('[data-key]').forEach(el => {
      el.oninput = () => this._recalcRatioFromPreview();
    });
  },

  _recalcRatioFromPreview() {
    const doseEl = document.querySelector('[data-key="dose"]');
    const yldEl  = document.querySelector('[data-key="yld"]');
    const ratioEl = document.querySelector('[data-key="brewRatio"]');
    if (!doseEl || !yldEl || !ratioEl) return;
    const d = parseFloat(doseEl.textContent);
    const y = parseFloat(yldEl.textContent);
    ratioEl.textContent = ratio(d, y);
  },

  async submitRecord() {
    const r = State.rec;
    this._collectPreviewEdits(r);
    r.createdAt = Date.now();
    await DB.add(r);
    this.goHome();
  },

  _collectPreviewEdits(r) {
    const pourMap = {
      pour0time: [0, 'time'], pour0water: [0, 'water'],
      pour1time: [1, 'time'], pour1water: [1, 'water'],
      pour2time: [2, 'time'], pour2water: [2, 'water'],
    };

    document.querySelectorAll('[data-key]').forEach(el => {
      const key = el.dataset.key;
      if (key === 'brewRatio' || key === '_date') return;
      const val = el.textContent.trim();
      if (pourMap[key]) {
        const [idx, field] = pourMap[key];
        if (r.pours[idx]) r.pours[idx][field] = val;
      } else {
        r[key] = val;
      }
    });

    document.querySelectorAll('[data-trow]').forEach(el => {
      const row = el.dataset.trow;
      const col = el.dataset.tcol;
      if (!r.tasting[row]) r.tasting[row] = {};
      if (row === 'acidity' || row === 'sweetness') {
        const text = el.textContent.trim();
        const m = text.match(/^([\d.—]+)(?:\s*\((.+)\))?$/);
        r.tasting[row][col] = { score: m ? m[1] : text, note: m ? (m[2] || '') : '' };
      } else {
        r.tasting[row][col] = el.textContent.trim();
      }
    });

    const d = parseFloat(r.dose);
    const y = parseFloat(r.yld);
    r.brewRatio = ratio(d, y);
  },

  /* ----- Discard ----- */
  confirmDiscard() {
    document.getElementById('discard-modal').classList.remove('hidden');
  },
  cancelDiscard() {
    document.getElementById('discard-modal').classList.add('hidden');
  },
  doDiscard() {
    document.getElementById('discard-modal').classList.add('hidden');
    Timer.stop();
    document.getElementById('water-modal').classList.add('hidden');
    this.goHome();
  },

  /* ----- History ----- */
  async _populateBeanFilter() {
    const records = await DB.load();
    const beans = [...new Set(records.map(r => beanLabel(r)))].sort();
    const sel = document.getElementById('filter-bean');
    sel.innerHTML = '<option value="">全部</option>' +
      beans.map(b => `<option value="${b}">${b}</option>`).join('');
  },

  async searchHistory() {
    const brewer   = document.getElementById('filter-brewer').value.trim().toLowerCase();
    const bean     = document.getElementById('filter-bean').value;
    const dateFrom = document.getElementById('filter-date-from').value;
    const dateTo   = document.getElementById('filter-date-to').value;

    let records = await DB.load();
    if (brewer) records = records.filter(r => r.brewer.toLowerCase().includes(brewer));
    if (bean)   records = records.filter(r => beanLabel(r) === bean);
    if (dateFrom) {
      const from = new Date(dateFrom).setHours(0,0,0,0);
      records = records.filter(r => r.createdAt >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo).setHours(23,59,59,999);
      records = records.filter(r => r.createdAt <= to);
    }

    records.sort((a, b) => b.createdAt - a.createdAt);
    this._renderHistoryList(records);
  },

  _renderHistoryList(records) {
    const el = document.getElementById('history-list');
    if (!records.length) {
      el.innerHTML = '<p class="empty-msg">沒有符合條件的紀錄</p>';
      return;
    }
    el.innerHTML = records.map(r => `
      <div class="history-item" onclick="App.openDetail('${r.id}')">
        <div class="history-item-bean">${beanLabel(r)}</div>
        <div class="history-item-meta">
          <span>👤 ${r.brewer}</span>
          <span>📅 ${fmtDate(r.createdAt)}</span>
          <span>⚖️ ${r.brewRatio}</span>
        </div>
      </div>`).join('');
  },

  /* ----- Detail ----- */
  async openDetail(id) {
    State.currentRecordId = id;
    State.isEditing = false;
    const records = await DB.load();
    const r = records.find(x => x.id === id);
    if (!r) return;
    document.getElementById('detail-content').innerHTML = this._buildRecordHTML(r, false);
    document.getElementById('btn-edit').classList.remove('hidden');
    document.getElementById('btn-save').classList.add('hidden');
    showPage('page-detail');
  },

  async toggleEdit() {
    State.isEditing = true;
    const records = await DB.load();
    const r = records.find(x => x.id === State.currentRecordId);
    if (!r) return;
    document.getElementById('detail-content').innerHTML = this._buildRecordHTML(r, true);
    this._bindDetailRecalc(r);
    document.getElementById('btn-edit').classList.add('hidden');
    document.getElementById('btn-save').classList.remove('hidden');
  },

  _bindDetailRecalc(r) {
    document.querySelectorAll('[data-key="dose"],[data-key="yld"]').forEach(el => {
      el.oninput = () => {
        const doseEl  = document.querySelector('[data-key="dose"]');
        const yldEl   = document.querySelector('[data-key="yld"]');
        const ratioEl = document.querySelector('[data-key="brewRatio"]');
        if (!doseEl || !yldEl || !ratioEl) return;
        ratioEl.textContent = ratio(parseFloat(doseEl.textContent), parseFloat(yldEl.textContent));
      };
    });
  },

  async saveEdit() {
    const records = await DB.load();
    const r = records.find(x => x.id === State.currentRecordId);
    if (!r) return;
    this._collectPreviewEdits(r);
    await DB.update(State.currentRecordId, r);
    document.getElementById('detail-content').innerHTML = this._buildRecordHTML(r, false);
    document.getElementById('btn-edit').classList.remove('hidden');
    document.getElementById('btn-save').classList.add('hidden');
    State.isEditing = false;
  },

  /* ----- Delete ----- */
  confirmDelete() {
    document.getElementById('delete-modal').classList.remove('hidden');
  },
  cancelDelete() {
    document.getElementById('delete-modal').classList.add('hidden');
  },
  async doDelete() {
    document.getElementById('delete-modal').classList.add('hidden');
    await DB.remove(State.currentRecordId);
    this.goHistory();
  },

  /* ----- Compare ----- */
  async _renderCompare() {
    const records = await DB.load();
    const current = records.find(x => x.id === State.currentRecordId);
    if (!current) return;
    document.getElementById('compare-bean-label').textContent = beanLabel(current);
    const matches = [...records].sort((a, b) => b.createdAt - a.createdAt)
      .filter(r => isSameBean(r, current));

    const el = document.getElementById('compare-content');
    if (matches.length <= 1) {
      el.innerHTML = '<p class="empty-msg">目前沒有其他相同咖啡豆的紀錄可以比較。</p>';
      return;
    }

    const fields = [
      ['沖煮日期',     r => fmtDate(r.createdAt)],
      ['沖煮人',       r => r.brewer],
      ['粉重 (g)',     r => r.dose],
      ['研磨刻度',     r => r.grind],
      ['水溫 (°C)',    r => r.temp],
      ['粉液比',       r => r.brewRatio],
      ['預熱時間',     r => fmtSec(r.preheatTime)],
      ['預熱水量 (g)', r => r.preheatWater ?? '—'],
      ['第一注時間',   r => r.pours[0] ? fmtSec(r.pours[0].time) : '—'],
      ['第一注水量 (g)',r=> r.pours[0] ? r.pours[0].water : '—'],
      ['第二注時間',   r => r.pours[1] ? fmtSec(r.pours[1].time) : '—'],
      ['第二注水量 (g)',r=> r.pours[1] ? r.pours[1].water : '—'],
      ['第三注時間',   r => r.pours[2] ? fmtSec(r.pours[2].time) : '—'],
      ['第三注水量 (g)',r=> r.pours[2] ? r.pours[2].water : '—'],
      ['總萃取時間',   r => fmtSec(r.extractionTime)],
      ['咖啡液淨重 (g)',r=> r.yld],
      ['乾香',         r => r.dryAroma],
      ['濕香',         r => r.wetAroma],
      ['風味（高溫）',   r => r.tasting?.flavor?.hot ?? ''],
      ['風味（中低溫）', r => r.tasting?.flavor?.warm ?? ''],
      ['風味（放涼後）', r => r.tasting?.flavor?.cool ?? ''],
      ['餘韻（高溫）',   r => r.tasting?.finish?.hot ?? ''],
      ['餘韻（中低溫）', r => r.tasting?.finish?.warm ?? ''],
      ['餘韻（放涼後）', r => r.tasting?.finish?.cool ?? ''],
      ['酸質（高溫）',   r => { const t = r.tasting?.acidity?.hot; return t ? `${t.score}${t.note?' ('+t.note+')':''}` : ''; }],
      ['酸質（中低溫）', r => { const t = r.tasting?.acidity?.warm; return t ? `${t.score}${t.note?' ('+t.note+')':''}` : ''; }],
      ['酸質（放涼後）', r => { const t = r.tasting?.acidity?.cool; return t ? `${t.score}${t.note?' ('+t.note+')':''}` : ''; }],
      ['甜感（高溫）',   r => { const t = r.tasting?.sweetness?.hot; return t ? `${t.score}${t.note?' ('+t.note+')':''}` : ''; }],
      ['甜感（中低溫）', r => { const t = r.tasting?.sweetness?.warm; return t ? `${t.score}${t.note?' ('+t.note+')':''}` : ''; }],
      ['甜感（放涼後）', r => { const t = r.tasting?.sweetness?.cool; return t ? `${t.score}${t.note?' ('+t.note+')':''}` : ''; }],
      ['口感（高溫）',   r => r.tasting?.body?.hot ?? ''],
      ['口感（中低溫）', r => r.tasting?.body?.warm ?? ''],
      ['口感（放涼後）', r => r.tasting?.body?.cool ?? ''],
      ['整體備註',     r => r.notes],
    ];

    const thead = `<tr><th>欄位</th>${matches.map(r => `<th>${fmtDate(r.createdAt)}<br><small>${r.brewer}</small></th>`).join('')}</tr>`;
    const tbody = fields.map(([label, fn]) =>
      `<tr><td class="field-label">${label}</td>${matches.map(r => `<td>${fn(r) ?? ''}</td>`).join('')}</tr>`
    ).join('');

    el.innerHTML = `<div class="compare-table-wrapper">
      <table class="compare-table">
        <thead>${thead}</thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>`;
  },

  /* ----- Alert ----- */
  showAlert(msg) {
    document.getElementById('alert-message').textContent = msg;
    document.getElementById('alert-modal').classList.remove('hidden');
  },
  closeAlert() {
    document.getElementById('alert-modal').classList.add('hidden');
  },
};

window.App = App;
window.signInWithGoogle = signInWithGoogle;
window.signOutUser = signOutUser;

history.replaceState({ page: 'page-login' }, '');
