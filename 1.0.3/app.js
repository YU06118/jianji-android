/* 简记 Android · 应用层
 * 结构：单页四 Tab（首页 / 明细 / 统计 / 我的）+ 底部弹层
 * 数据：localStorage（键 jianji.android.v1），金额以「分」存整数
 */
(function () {
  'use strict';

  var JJ = window.JJ;
  var KEY = 'jianji.android.v1';
  var VERSION = '1.0.3';
  var HOT_KEY = 'jianji.hot.pkg.v1';
  var HOT_MANIFEST = [
    'https://raw.githubusercontent.com/YU06118/jianji-android/hot/latest.json',
    'https://cdn.jsdelivr.net/gh/YU06118/jianji-android@hot/latest.json'
  ];
  var MODE_LABEL = { system: '跟随系统', light: '浅色', dark: '深色' };
  var DEFAULT_SETTINGS = { mode: 'dark', accent: 'blue', budget: 600000, goal: { name: '', target: 0 } };

  /* ---------------- 工具 ---------------- */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(cents) { return '¥' + JJ.fmtCents(cents); }
  function signed(cents) { return (cents < 0 ? '-¥' : '+¥') + JJ.fmtCents(Math.abs(cents)); }
  function isoOffset(n) {
    var d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function dayDiff(iso) {
    var p = iso.split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12);
    var t = new Date(); t.setHours(12, 0, 0, 0);
    return Math.round((d - t) / 86400000);
  }
  function catIcon(cat, extra) {
    var key = cat.key === 'rest' ? 'other' : cat.key;
    var big = extra && extra.indexOf('64px') >= 0;
    return '<span class="cat-ico" style="background:' + cat.color + '1F;' + (extra || '') + '">' +
      '<img src="assets/icons/' + key + '.svg" alt=""' + (big ? ' style="width:32px;height:32px"' : '') + ' />' +
      '</span>';
  }
  function emptyBlock(title, sub) {
    return '<div class="empty">' +
      '<span class="e-ico"><svg viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg></span>' +
      '<b>' + esc(title) + '</b><small>' + esc(sub) + '</small>' +
      '</div>';
  }
  function hexA(hex, a) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function shade(hex, k) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    var r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * (1 + k))));
    var g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * (1 + k))));
    var b = Math.max(0, Math.min(255, Math.round((n & 255) * (1 + k))));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  /* ---------------- 状态 ---------------- */
  var state = load();
  var ui = {
    tab: 'home',
    sheet: null,
    pushed: false,
    type: 'expense',
    cat: 'food',
    amount: '',
    date: JJ.todayISO(),
    catTouched: false,
    detailYm: JJ.ymOf(JJ.todayISO()),
    detailFilter: 'all',
    statsYm: JJ.ymOf(JJ.todayISO()),
    statsType: 'expense',
    entryId: null,
    confirmCb: null
  };

  function load() {
    var fallback = { entries: [], settings: clone(DEFAULT_SETTINGS) };
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return fallback;
      var d = JSON.parse(raw);
      var s = clone(DEFAULT_SETTINGS);
      if (d.settings) {
        if (MODE_LABEL[d.settings.mode]) s.mode = d.settings.mode;
        if (JJ.ACCENTS[d.settings.accent]) s.accent = d.settings.accent;
        if (typeof d.settings.budget === 'number' && d.settings.budget >= 0) s.budget = Math.round(d.settings.budget);
        if (d.settings.goal) {
          s.goal.name = String(d.settings.goal.name || '');
          s.goal.target = Math.max(0, Math.round(Number(d.settings.goal.target) || 0));
        }
      }
      return { entries: normalizeEntries(d.entries), settings: s };
    } catch (e) {
      return fallback;
    }
  }

  function normalizeEntries(list) {
    if (!Array.isArray(list)) return [];
    var out = [];
    list.forEach(function (e) {
      if (!e) return;
      var amount = Math.round(Number(e.amount));
      var date = String(e.date || '');
      var type = e.type === 'income' ? 'income' : 'expense';
      if (!isFinite(amount) || amount <= 0) return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      if (!JJ.CAT_MAP[e.cat]) return;
      out.push({
        id: e.id || JJ.uid(),
        type: type,
        cat: e.cat,
        amount: amount,
        date: date,
        note: String(e.note || '').slice(0, 60),
        ts: Number(e.ts) || Date.now()
      });
    });
    return out;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        app: 'jianji-android',
        v: 1,
        entries: state.entries,
        settings: state.settings
      }));
    } catch (e) {
      toast('本机存储不可用');
    }
  }

  /* ---------------- 主题 ---------------- */
  function isDark() {
    var mode = state.settings.mode;
    if (mode === 'dark') return true;
    if (mode === 'light') return false;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function applyTheme() {
    var dark = isDark();
    document.documentElement.classList.toggle('theme-dark', dark);
    var a = JJ.ACCENTS[state.settings.accent] || JJ.ACCENTS.blue;
    var root = document.documentElement.style;
    var solid = dark ? a.solidDark : a.solidLight;
    var accent = dark ? a.dark : a.light;
    root.setProperty('--accent', accent);
    root.setProperty('--accent-solid', solid);
    root.setProperty('--accent-soft', hexA(accent, dark ? .16 : .10));
    root.setProperty('--accent-mist', hexA(accent, dark ? .08 : .06));
    root.setProperty('--grad-a', dark ? solid : a.solidLight);
    root.setProperty('--grad-b', dark ? shade(solid, -.16) : shade(a.solidLight, -.14));
    root.setProperty('--hero-a', root.getPropertyValue('--grad-a'));
    root.setProperty('--hero-b', root.getPropertyValue('--grad-b'));
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#202020' : '#F5F5F7');
    var label = $('meTheme');
    if (label) label.textContent = MODE_LABEL[state.settings.mode];
  }

  /* ---------------- 渲染：首页 ---------------- */
  function renderHome() {
    var ym = JJ.ymOf(JJ.todayISO());
    var s = JJ.summarize(state.entries, ym);
    var budget = state.settings.budget;

    $('heroAmount').textContent = JJ.fmtCents(Math.abs(s.balance));
    document.querySelector('#hero .cur').textContent = s.balance < 0 ? '-¥' : '¥';
    $('heroIncome').textContent = money(s.income);
    $('heroExpense').textContent = money(s.expense);
    $('homeExpense').textContent = money(s.expense);
    $('homeIncome').textContent = money(s.income);
    $('homeCount').textContent = String(s.count);

    var pct = budget > 0 ? Math.round(s.expense / budget * 100) : 0;
    var pctText = budget > 0 ? (s.expense > 0 && pct === 0 ? '<1' : String(pct)) : '';
    $('heroPill').textContent = budget > 0 ? '预算 ' + pctText + '%' : '未设预算';
    $('heroProgress').style.width = (pct > 0 && s.expense > 0 ? Math.min(Math.max(pct, 1), 100) : 0) + '%';

    var leftDays = JJ.daysInMonth(ym) - Number(JJ.todayISO().slice(8, 10)) + 1;
    var hint;
    if (budget > 0) {
      var remain = budget - s.expense;
      hint = remain >= 0
        ? '预算 ' + money(budget) + ' · 剩余 ' + money(remain) + ' · 本月还剩 ' + leftDays + ' 天'
        : '已超预算 ' + money(-remain) + ' · 本月还剩 ' + leftDays + ' 天';
      if (pct > 100) $('heroPill').textContent = '超支 ' + (pct - 100) + '%';
    } else {
      hint = '尚未设置月度预算，可在「我的」中设置';
    }
    $('heroHint').textContent = hint;

    var rows = JJ.sortCats(s.byCat, 'expense', 5);
    var rankEl = $('homeRanks');
    if (!rows.length) {
      rankEl.innerHTML = emptyBlock('本月还没有支出', '记第一笔，月底就有答案');
    } else {
      var max = rows[0].value || 1;
      rankEl.innerHTML = rows.map(function (r) {
        return '<div class="rank-row">' + catIcon(r.cat) +
          '<div class="rank-main">' +
          '<div class="rank-top"><span class="name">' + esc(r.cat.name) + '</span><span class="amt num">' + money(r.value) + '</span></div>' +
          '<div class="bar"><i style="width:' + Math.max(4, r.value / max * 100).toFixed(1) + '%;background:' + r.cat.color + '"></i></div>' +
          '</div></div>';
      }).join('');
    }

    var recent = state.entries.slice().sort(function (a, b) {
      return a.date === b.date ? b.ts - a.ts : (a.date < b.date ? 1 : -1);
    }).slice(0, 6);
    var recentEl = $('homeRecent');
    if (!recent.length) {
      recentEl.innerHTML = emptyBlock('还没有记录', '点底部 + 记第一笔');
    } else {
      recentEl.innerHTML = recent.map(entryRow).join('');
    }
  }

  function entryRow(e) {
    var cat = JJ.CAT_MAP[e.cat] || { name: '其他', color: '#A79DA2', key: 'other' };
    var sub = JJ.fmtDateCN(e.date, true) + (e.note ? ' · ' + e.note : '');
    return '<button class="entry" type="button" data-entry="' + e.id + '">' + catIcon(cat) +
      '<span class="meta"><b>' + esc(cat.name) + '</b><small>' + esc(sub) + '</small></span>' +
      '<span class="amt num" style="color:' + (e.type === 'income' ? 'var(--mint)' : 'var(--ink)') + '">' +
      (e.type === 'income' ? '+' : '-') + money(e.amount) + '</span>' +
      '</button>';
  }

  /* ---------------- 渲染：明细 ---------------- */
  function renderDetail() {
    $('detailMonthLabel').textContent = JJ.ymLabel(ui.detailYm);
    var chips = $('detailChips').children;
    for (var i = 0; i < chips.length; i++) {
      chips[i].classList.toggle('on', chips[i].getAttribute('data-filter') === ui.detailFilter);
    }

    var list = state.entries.filter(function (e) {
      if (JJ.ymOf(e.date) !== ui.detailYm) return false;
      return ui.detailFilter === 'all' || e.type === ui.detailFilter;
    });
    var body = $('detailBody');
    if (!list.length) {
      body.innerHTML = emptyBlock('这个月还没有记录', '换个筛选条件或记一笔');
      return;
    }
    var groups = JJ.groupByDay(list);
    body.innerHTML = groups.map(function (g) {
      var head = '<div class="day-head"><b>' + esc(JJ.fmtDateCN(g.date, true)) + '</b><span class="num">' +
        (g.expense ? '支出 ' + money(g.expense) : '') +
        (g.expense && g.income ? ' · ' : '') +
        (g.income ? '收入 ' + money(g.income) : '') + '</span></div>';
      return head + '<div class="list-card">' + g.items.map(entryRow).join('') + '</div>';
    }).join('');
  }

  /* ---------------- 渲染：统计 ---------------- */
  function renderStats() {
    $('statsMonthLabel').textContent = JJ.ymLabel(ui.statsYm);
    var seg = $('statsSeg').children;
    for (var i = 0; i < seg.length; i++) {
      seg[i].classList.toggle('on', seg[i].getAttribute('data-stats-type') === ui.statsType);
    }

    var s = JJ.summarize(state.entries, ui.statsYm);
    var rows = JJ.sortCats(s.byCat, ui.statsType, 6);
    var total = rows.reduce(function (a, r) { return a + r.value; }, 0);
    var isExpense = ui.statsType === 'expense';

    $('donutLabel').textContent = isExpense ? '支出合计' : '收入合计';
    $('donutValue').textContent = money(total);

    var R = 82, C = 2 * Math.PI * R, off = 0;
    var svg = '<circle cx="105" cy="105" r="' + R + '" stroke="var(--bg-2)" stroke-width="16"/>';
    rows.forEach(function (r) {
      var len = total ? r.value / total * C : 0;
      var draw = Math.max(len - 2.5, 0);
      svg += '<circle cx="105" cy="105" r="' + R + '" stroke="' + r.cat.color + '" stroke-width="16" ' +
        'stroke-dasharray="' + draw.toFixed(2) + ' ' + C.toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '"/>';
      off += len;
    });
    $('donutSvg').innerHTML = svg;

    var legend = $('statsLegend');
    if (!rows.length) {
      legend.innerHTML = '<p class="muted" style="text-align:center;font-size:13px;padding:6px 0 10px">' +
        (isExpense ? '本月暂无支出' : '本月暂无收入') + '</p>';
    } else {
      legend.innerHTML = rows.map(function (r) {
        var pct = total ? r.value / total * 100 : 0;
        return '<div class="legend-row">' +
          '<i class="dot" style="background:' + r.cat.color + '"></i>' +
          '<span class="name">' + esc(r.cat.name) + '</span>' +
          '<span class="track"><i style="width:' + Math.max(2, pct).toFixed(1) + '%;background:' + r.cat.color + '"></i></span>' +
          '<span class="pct num">' + pct.toFixed(0) + '%</span>' +
          '<span class="amt num">' + money(r.value) + '</span>' +
          '</div>';
      }).join('');
    }

    var typed = state.entries.filter(function (e) {
      return JJ.ymOf(e.date) === ui.statsYm && e.type === (isExpense ? 'expense' : 'income');
    });
    var max = typed.reduce(function (m, e) { return Math.max(m, e.amount); }, 0);
    $('statAvg').textContent = money(Math.round(total / JJ.daysInMonth(ui.statsYm)));
    $('statCount').textContent = String(typed.length);
    $('statMax').textContent = money(max);
  }

  /* ---------------- 渲染：我的 ---------------- */
  function renderMe() {
    $('meTheme').textContent = MODE_LABEL[state.settings.mode];
    $('meBudget').textContent = state.settings.budget > 0 ? money(state.settings.budget) + '/月' : '未设置';
    var g = state.settings.goal;
    $('meGoal').textContent = g.target > 0 ? (g.name || '目标') + ' ' + money(g.target) : '未设置';
    $('meCount').textContent = state.entries.length + ' 笔';
  }

  function renderAll() {
    renderHome();
    renderDetail();
    renderStats();
    renderMe();
  }

  /* ---------------- Tab ---------------- */
  function switchTab(name) {
    ui.tab = name;
    ['home', 'detail', 'stats', 'me'].forEach(function (k) {
      $('view-' + k).classList.toggle('hidden', k !== name);
    });
    var tabs = document.querySelectorAll('.tabbar .tab[data-tab]');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('on', tabs[i].getAttribute('data-tab') === name);
    }
    var view = $('view-' + name);
    if (view) view.scrollTop = 0;
    if (state.settings.accent) applyTheme();
  }

  /* ---------------- 弹层 ---------------- */
  function showSheet(id) {
    if (ui.sheet === id) return;
    if (ui.sheet) {
      var prev = $(ui.sheet);
      prev.classList.remove('open');
      (function (node) {
        setTimeout(function () { if (!node.classList.contains('open')) node.hidden = true; }, 300);
      })(prev);
    }
    var sheet = $(id);
    sheet.hidden = false;
    $('scrim').hidden = false;
    requestAnimationFrame(function () {
      sheet.classList.add('open');
      $('scrim').classList.add('on');
    });
    ui.sheet = id;
    if (!ui.pushed) {
      ui.pushed = true;
      try { history.pushState({ jjSheet: id }, ''); } catch (e) { /* 忽略 */ }
    }
  }

  function closeSheet(fromPop) {
    if (ui.sheet) {
      var sheet = $(ui.sheet);
      sheet.classList.remove('open');
      (function (node) {
        setTimeout(function () { if (!node.classList.contains('open')) node.hidden = true; }, 300);
      })(sheet);
      ui.sheet = null;
    }
    $('scrim').classList.remove('on');
    setTimeout(function () { if (!ui.sheet) $('scrim').hidden = true; }, 300);
    if (!fromPop && ui.pushed) {
      ui.pushed = false;
      try { history.back(); } catch (e) { /* 忽略 */ }
    } else if (fromPop) {
      ui.pushed = false;
    }
  }

  function openConfirm(title, body, okText, cb) {
    $('confirmTitle').textContent = title;
    $('confirmBody').textContent = body;
    $('confirmOk').textContent = okText || '确认';
    ui.confirmCb = cb;
    showSheet('sheet-confirm');
  }

  /* ---------------- Toast ---------------- */
  var toastTimer = null;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('on'); }, 1900);
  }

  /* ---------------- 记账弹层 ---------------- */
  function openAdd() {
    ui.type = 'expense';
    ui.cat = 'food';
    ui.amount = '';
    ui.note = '';
    ui.date = JJ.todayISO();
    ui.catTouched = false;
    $('noteInput').value = '';
    $('datePick').value = '';
    renderAdd();
    showSheet('sheet-add');
  }

  function renderAdd() {
    var typeBtns = $('addType').children;
    for (var i = 0; i < typeBtns.length; i++) {
      typeBtns[i].classList.toggle('on', typeBtns[i].getAttribute('data-add-type') === ui.type);
    }

    var cats = ui.type === 'income' ? JJ.INCOME : JJ.EXPENSE;
    var strip = $('catStrip');
    strip.innerHTML = cats.map(function (c) {
      var key = c.key === 'rest' ? 'other' : c.key;
      return '<button class="cat-cell' + (c.key === ui.cat ? ' on' : '') + '" type="button" data-cat="' + c.key + '">' +
        '<img src="assets/icons/' + key + '.svg" alt="" /><span>' + esc(c.name) + '</span></button>';
    }).join('');

    var amt = $('amountText');
    amt.textContent = ui.amount === '' ? '0.00' : ui.amount;
    amt.classList.toggle('empty', ui.amount === '');

    var diff = dayDiff(ui.date);
    var chips = $('dateChips').querySelectorAll('button');
    for (var j = 0; j < chips.length; j++) {
      chips[j].classList.toggle('on', Number(chips[j].getAttribute('data-day')) === diff);
    }

    $('saveEntry').disabled = JJ.parseAmount(ui.amount) <= 0;
  }

  function pressKey(key) {
    if (key === 'del') {
      ui.amount = ui.amount.slice(0, -1);
    } else if (key === '.') {
      if (ui.amount.indexOf('.') < 0) ui.amount = (ui.amount || '0') + '.';
    } else {
      if (ui.amount.length >= 10) return;
      var dot = ui.amount.indexOf('.');
      if (dot >= 0 && ui.amount.length - dot > 2) return;
      if (ui.amount === '0') ui.amount = key;
      else ui.amount += key;
    }
    renderAdd();
  }

  function pickCat(key) {
    ui.cat = key;
    ui.catTouched = true;
    renderAdd();
  }

  function saveEntry() {
    var cents = JJ.parseAmount(ui.amount);
    if (cents <= 0) return;
    var note = String($('noteInput').value || '').trim().slice(0, 60);
    state.entries.push({
      id: JJ.uid(),
      type: ui.type,
      cat: ui.cat,
      amount: cents,
      date: ui.date,
      note: note,
      ts: Date.now()
    });
    save();
    ui.detailYm = JJ.ymOf(ui.date);
    ui.statsYm = JJ.ymOf(ui.date);
    renderAll();
    closeSheet(false);
    toast('已记 ' + money(cents));
  }

  /* ---------------- 记录详情 ---------------- */
  function findEntry(id) {
    for (var i = 0; i < state.entries.length; i++) if (state.entries[i].id === id) return state.entries[i];
    return null;
  }

  function openEntry(id) {
    var e = findEntry(id);
    if (!e) return;
    ui.entryId = id;
    var cat = JJ.CAT_MAP[e.cat] || { name: '其他', color: '#A79DA2', key: 'other' };
    $('entryBody').innerHTML =
      '<div style="display:flex;flex-direction:column;align-items:center;padding:6px 0 20px">' +
      catIcon(cat, 'width:64px;height:64px;border-radius:20px;flex:0 0 64px;') +
      '<p style="font-size:13px;color:var(--ink-3);margin-top:10px">' + esc(cat.name) + ' · ' + (e.type === 'income' ? '收入' : '支出') + '</p>' +
      '<div class="num" style="font-size:36px;font-weight:700;letter-spacing:-1px;margin-top:2px;color:' + (e.type === 'income' ? 'var(--mint)' : 'var(--ink)') + '">' +
      signed(e.type === 'income' ? e.amount : -e.amount) + '</div>' +
      '<p class="muted" style="font-size:13px;margin-top:6px">' + esc(JJ.fmtDateCN(e.date, true)) + '</p>' +
      (e.note ? '<p style="font-size:14px;margin-top:10px;text-align:center">' + esc(e.note) + '</p>' : '') +
      '</div>' +
      '<button class="btn-ghost btn-danger" type="button" data-act="delete">删除这笔</button>';
    showSheet('sheet-entry');
  }

  function deleteEntry() {
    var e = findEntry(ui.entryId);
    if (!e) return;
    openConfirm('删除记录', '将删除「' + (JJ.CAT_MAP[e.cat] || {}).name + ' ' + money(e.amount) + '」这笔记录，操作不可撤销。', '删除', function () {
      state.entries = state.entries.filter(function (x) { return x.id !== ui.entryId; });
      save();
      renderAll();
      closeSheet(false);
      toast('已删除');
    });
  }

  /* ---------------- 外观 ---------------- */
  function renderThemeSheet() {
    var modes = $('themeModes').children;
    for (var i = 0; i < modes.length; i++) {
      modes[i].classList.toggle('on', modes[i].getAttribute('data-mode') === state.settings.mode);
    }
    $('accentRow').innerHTML = Object.keys(JJ.ACCENTS).map(function (k) {
      var a = JJ.ACCENTS[k];
      return '<button class="swatch' + (state.settings.accent === k ? ' on' : '') + '" type="button" data-accent="' + k + '">' +
        '<i style="background:linear-gradient(145deg,' + a.light + ',' + a.solidLight + ')"></i>' +
        '<span>' + esc(a.name) + '</span></button>';
    }).join('');
  }

  function setMode(mode) {
    if (!MODE_LABEL[mode]) return;
    state.settings.mode = mode;
    save();
    applyTheme();
    renderThemeSheet();
    renderMe();
  }

  function setAccent(k) {
    if (!JJ.ACCENTS[k]) return;
    state.settings.accent = k;
    save();
    applyTheme();
    renderThemeSheet();
    renderMe();
  }

  /* ---------------- 预算 / 目标 / 数据 ---------------- */
  function openBudget() {
    $('budgetInput').value = state.settings.budget > 0 ? String(state.settings.budget / 100) : '';
    showSheet('sheet-budget');
  }

  function saveBudget() {
    var v = Number($('budgetInput').value);
    state.settings.budget = isFinite(v) && v > 0 ? Math.round(v * 100) : 0;
    save();
    renderAll();
    closeSheet(false);
    toast(state.settings.budget > 0 ? '预算已保存' : '已取消预算');
  }

  function openGoal() {
    var g = state.settings.goal;
    $('goalName').value = g.name || '';
    $('goalTarget').value = g.target > 0 ? String(g.target / 100) : '';
    var saved = JJ.summarize(state.entries).balance;
    $('goalProgress').textContent = g.target > 0
      ? '当前结余 ' + money(saved) + ' / 目标 ' + money(g.target) + '（' + Math.max(0, Math.round(saved / g.target * 100)) + '%）'
      : '当前结余 ' + money(saved) + ' · 尚未设置目标';
    showSheet('sheet-goal');
  }

  function saveGoal() {
    var name = String($('goalName').value || '').trim().slice(0, 16);
    var t = Number($('goalTarget').value);
    state.settings.goal = {
      name: t > 0 ? (name || '存钱目标') : name,
      target: isFinite(t) && t > 0 ? Math.round(t * 100) : 0
    };
    save();
    renderAll();
    closeSheet(false);
    toast('目标已保存');
  }

  function openData() {
    $('dataArea').value = '';
    showSheet('sheet-data');
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = $('dataArea');
        ta.value = text;
        ta.select();
        var ok = document.execCommand('copy');
        ok ? resolve() : reject(new Error('copy failed'));
      } catch (e) { reject(e); }
    });
  }

  function exportData() {
    var text = JSON.stringify({
      app: 'jianji-android',
      v: 1,
      exportedAt: new Date().toISOString(),
      settings: state.settings,
      entries: state.entries
    }, null, 2);
    $('dataArea').value = text;
    copyText(text).then(function () {
      toast('备份已复制到剪贴板');
    }).catch(function () {
      toast('已生成 JSON，请手动复制');
    });
  }

  function importData() {
    var raw = String($('dataArea').value || '').trim();
    if (!raw) { toast('请先粘贴备份 JSON'); return; }
    var d;
    try { d = JSON.parse(raw); } catch (e) { toast('JSON 格式不正确'); return; }
    var entries = normalizeEntries(d && d.entries);
    if (!entries.length) { toast('备份里没有可导入的记录'); return; }
    var s = clone(DEFAULT_SETTINGS);
    if (d && d.settings) {
      if (MODE_LABEL[d.settings.mode]) s.mode = d.settings.mode;
      if (JJ.ACCENTS[d.settings.accent]) s.accent = d.settings.accent;
      if (typeof d.settings.budget === 'number' && d.settings.budget >= 0) s.budget = Math.round(d.settings.budget);
      if (d.settings.goal) {
        s.goal.name = String(d.settings.goal.name || '');
        s.goal.target = Math.max(0, Math.round(Number(d.settings.goal.target) || 0));
      }
    }
    openConfirm('导入数据', '将用 ' + entries.length + ' 笔记录覆盖当前数据，操作不可撤销。', '覆盖导入', function () {
      state.entries = entries;
      state.settings = s;
      save();
      applyTheme();
      renderAll();
      closeSheet(false);
      toast('已导入 ' + entries.length + ' 笔');
    });
  }

  function sampleData() {
    var seeds = [
      [-18, 'income', 'salary', 1800000, '月薪'],
      [-17, 'expense', 'home', 320000, '房租'],
      [-16, 'expense', 'grocery', 18650, '超市 生鲜'],
      [-15, 'expense', 'kid', 12800, '奶粉 纸尿裤'],
      [-14, 'expense', 'food', 3800, '午餐'],
      [-13, 'expense', 'transport', 1500, '地铁'],
      [-12, 'expense', 'daily', 6540, '纸巾 洗衣液'],
      [-11, 'expense', 'food', 8800, '火锅 聚餐'],
      [-10, 'expense', 'fun', 12000, '电影 门票'],
      [-9, 'expense', 'medical', 23000, '药店 感冒药'],
      [-8, 'income', 'redpack', 52000, '生日红包'],
      [-7, 'expense', 'clothing', 39900, '外套'],
      [-6, 'expense', 'study', 19900, '网课'],
      [-5, 'expense', 'food', 2600, '早餐 豆浆'],
      [-4, 'expense', 'social', 60000, '份子钱'],
      [-3, 'expense', 'transport', 8000, '打车'],
      [-2, 'expense', 'grocery', 9650, '水果 蔬菜'],
      [-1, 'expense', 'food', 4200, '晚餐'],
      [0, 'expense', 'transport', 1400, '地铁'],
      [0, 'expense', 'food', 2450, '早餐 油条'],
      [-40, 'expense', 'home', 320000, '上月房租'],
      [-38, 'income', 'salary', 1800000, '上月工资'],
      [-35, 'expense', 'grocery', 21000, '上月采购'],
      [-30, 'expense', 'food', 15600, '上月聚餐']
    ];
    return seeds.map(function (s) {
      return {
        id: JJ.uid(),
        type: s[1],
        cat: s[2],
        amount: s[3],
        date: isoOffset(s[0]),
        note: s[4],
        ts: Date.now() + s[0] * 1000
      };
    });
  }

  /* ---------------- 热更新 ---------------- */
  var updateBusy = false;
  var HOT_FILES = { body: 'body.html', css: 'styles.css', core: 'core.js', app: 'app.js' };

  function activeVersion() { return window.JJ_ACTIVE_VERSION || VERSION; }

  function hotPkg() {
    try {
      var raw = localStorage.getItem(HOT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function compareVersion(a, b) {
    var pa = String(a).split('.'), pb = String(b).split('.');
    for (var i = 0; i < 3; i++) {
      var x = Number(pa[i]) || 0, y = Number(pb[i]) || 0;
      if (x !== y) return x > y ? 1 : -1;
    }
    return 0;
  }

  function fetchText(url, ms) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        if (ctrl) { try { ctrl.abort(); } catch (e) { /* 忽略 */ } }
        reject(new Error('网络超时'));
      }, ms || 8000);
      fetch(url, { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined }).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      }).then(function (text) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(text);
      }, function (err) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  function sha256(text) {
    if (!(window.crypto && window.crypto.subtle)) return Promise.reject(new Error('设备不支持完整性校验'));
    var data = new TextEncoder().encode(text);
    return crypto.subtle.digest('SHA-256', data).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) {
        return ('0' + b.toString(16)).slice(-2);
      }).join('');
    });
  }

  function validManifest(m) {
    if (!m || !/^\d+\.\d+\.\d+$/.test(String(m.version || ''))) return false;
    if (typeof m.base !== 'string' || !/^[\w.\-\/]+$/.test(m.base)) return false;
    if (!m.sha256) return false;
    return ['body', 'css', 'core', 'app'].every(function (k) {
      return typeof m.sha256[k] === 'string' && /^[a-f0-9]{64}$/.test(m.sha256[k]);
    });
  }

  function fetchManifest() {
    var chain = Promise.reject(new Error('无法获取更新清单'));
    HOT_MANIFEST.forEach(function (url) {
      chain = chain.catch(function () {
        return fetchText(url, 8000).then(function (text) {
          var m = JSON.parse(text);
          if (!validManifest(m)) throw new Error('更新清单格式不正确');
          m.origin = url.slice(0, url.lastIndexOf('/') + 1);
          return m;
        });
      });
    });
    return chain;
  }

  function downloadPkg(m) {
    var pkg = { version: m.version, notes: String(m.notes || ''), installedAt: Date.now() };
    return ['body', 'css', 'core', 'app'].reduce(function (chain, key) {
      return chain.then(function () {
        return fetchText(m.origin + m.base + HOT_FILES[key], 20000).then(function (text) {
          return sha256(text).then(function (hash) {
            if (hash !== m.sha256[key]) throw new Error(HOT_FILES[key] + ' 校验失败');
            pkg[key] = text;
          });
        });
      });
    }, Promise.resolve()).then(function () { return pkg; });
  }

  function setUpdateStatus(text, kind) {
    var el = $('updateStatus');
    if (!el) return;
    el.textContent = text;
    el.className = 'update-status' + (kind ? ' ' + kind : '');
  }

  function setUpdateBusy(busy) {
    updateBusy = busy;
    ['btnCheckUpdate', 'btnRestoreBuiltin'].forEach(function (id) {
      var b = $(id);
      if (b) b.disabled = busy;
    });
  }

  function renderAbout() {
    var pkg = hotPkg();
    var ver = activeVersion();
    if ($('aboutVersion')) $('aboutVersion').textContent = 'v' + ver;
    if ($('updateTag')) {
      $('updateTag').textContent = pkg ? '热更新' : '内置';
      $('updateTag').className = 'update-tag' + (pkg ? ' hot' : '');
    }
    if ($('btnRestoreBuiltin')) $('btnRestoreBuiltin').hidden = !pkg;
    if ($('footVersion')) $('footVersion').textContent = '简记 Android · v' + ver + ' · 数据仅存本机';
    setUpdateStatus(pkg
      ? '当前为热更新版本（v' + pkg.version + '）。检查更新需联网，不会上传记录。'
      : '检查更新需联网，仅在你点击时发起请求，不会上传任何记录。');
    setUpdateBusy(false);
  }

  function checkUpdate() {
    if (updateBusy) return;
    setUpdateBusy(true);
    setUpdateStatus('正在检查更新…');
    fetchManifest().then(function (m) {
      if (compareVersion(m.version, activeVersion()) <= 0) {
        setUpdateBusy(false);
        setUpdateStatus('已是最新版本（v' + activeVersion() + '）。');
        return null;
      }
      setUpdateStatus('发现 v' + m.version + '，正在下载并校验…');
      return downloadPkg(m).then(function (pkg) {
        try {
          localStorage.setItem(HOT_KEY, JSON.stringify(pkg));
        } catch (e) {
          throw new Error('本机存储空间不足');
        }
        setUpdateStatus('v' + pkg.version + ' 已下载并校验通过，正在重启…', 'ok');
        setTimeout(function () { window.location.reload(); }, 800);
      });
    }).catch(function (e) {
      setUpdateBusy(false);
      setUpdateStatus('检查失败：' + (e && e.message ? e.message : '网络不可用') + '。可稍后重试。', 'bad');
    });
  }

  function restoreBuiltin() {
    openConfirm('恢复内置版本', '将清除已下载的热更新包并重启。记录与设置不受影响。', '恢复并重启', function () {
      try { localStorage.removeItem(HOT_KEY); } catch (e) { /* 忽略 */ }
      window.location.reload();
    });
  }

  /* ---------------- 事件绑定 ---------------- */
  function bind() {
    document.addEventListener('click', function (e) {
      var t = e.target;

      var tabBtn = t.closest('[data-tab]');
      if (tabBtn) { switchTab(tabBtn.getAttribute('data-tab')); return; }

      if (t.closest('#tabAdd') || t.closest('[data-act="add"]')) { openAdd(); return; }

      if (t.closest('#btnThemeQuick')) { renderThemeSheet(); showSheet('sheet-theme'); return; }

      var closeBtn = t.closest('[data-close]');
      if (closeBtn) { closeSheet(false); return; }

      var sheetBtn = t.closest('[data-sheet]');
      if (sheetBtn) {
        var name = sheetBtn.getAttribute('data-sheet');
        if (name === 'theme') { renderThemeSheet(); showSheet('sheet-theme'); }
        else if (name === 'budget') openBudget();
        else if (name === 'goal') openGoal();
        else if (name === 'data') openData();
        else if (name === 'guide') showSheet('sheet-guide');
        else if (name === 'about') { renderAbout(); showSheet('sheet-about'); }
        return;
      }

      var monthBtn = t.closest('[data-month]');
      if (monthBtn) {
        ui.detailYm = JJ.shiftMonth(ui.detailYm, Number(monthBtn.getAttribute('data-month')));
        renderDetail();
        return;
      }
      var monthStatsBtn = t.closest('[data-month-stats]');
      if (monthStatsBtn) {
        ui.statsYm = JJ.shiftMonth(ui.statsYm, Number(monthStatsBtn.getAttribute('data-month-stats')));
        renderStats();
        return;
      }

      var chip = t.closest('[data-filter]');
      if (chip) { ui.detailFilter = chip.getAttribute('data-filter'); renderDetail(); return; }

      var statsType = t.closest('[data-stats-type]');
      if (statsType) { ui.statsType = statsType.getAttribute('data-stats-type'); renderStats(); return; }

      var entryBtn = t.closest('[data-entry]');
      if (entryBtn) { openEntry(entryBtn.getAttribute('data-entry')); return; }

      var addType = t.closest('[data-add-type]');
      if (addType) {
        ui.type = addType.getAttribute('data-add-type');
        ui.cat = ui.type === 'income' ? JJ.INCOME[0].key : JJ.EXPENSE[0].key;
        ui.catTouched = false;
        renderAdd();
        return;
      }

      var catCell = t.closest('[data-cat]');
      if (catCell) { pickCat(catCell.getAttribute('data-cat')); return; }

      var dayBtn = t.closest('[data-day]');
      if (dayBtn) {
        ui.date = isoOffset(Number(dayBtn.getAttribute('data-day')));
        $('datePick').value = '';
        renderAdd();
        return;
      }

      var key = t.closest('[data-key]');
      if (key) { pressKey(key.getAttribute('data-key')); return; }

      if (t.closest('#saveEntry')) { saveEntry(); return; }

      var modeBtn = t.closest('[data-mode]');
      if (modeBtn) { setMode(modeBtn.getAttribute('data-mode')); return; }

      var accentBtn = t.closest('[data-accent]');
      if (accentBtn) { setAccent(accentBtn.getAttribute('data-accent')); return; }

      if (t.closest('#saveBudget')) { saveBudget(); return; }
      if (t.closest('#saveGoal')) { saveGoal(); return; }

      if (t.closest('#btnCheckUpdate')) { checkUpdate(); return; }
      if (t.closest('#btnRestoreBuiltin')) { restoreBuiltin(); return; }

      var act = t.closest('[data-act]');
      if (act) {
        var a = act.getAttribute('data-act');
        if (a === 'export') { exportData(); return; }
        if (a === 'import') { importData(); return; }
        if (a === 'sample') {
          openConfirm('载入示例数据', '将覆盖当前全部记录，仅用于预览效果。', '载入示例', function () {
            state.entries = sampleData();
            save();
            renderAll();
            closeSheet(false);
            toast('示例数据已载入');
          });
          return;
        }
        if (a === 'clear') {
          openConfirm('清空数据', '将删除本机全部记录与设置，操作不可逆。', '全部清空', function () {
            state.entries = [];
            state.settings = clone(DEFAULT_SETTINGS);
            save();
            applyTheme();
            renderAll();
            closeSheet(false);
            toast('已清空');
          });
          return;
        }
        if (a === 'delete') { deleteEntry(); return; }
      }

      if (t.closest('#confirmOk')) {
        var cb = ui.confirmCb;
        ui.confirmCb = null;
        closeSheet(false);
        if (cb) setTimeout(cb, 60);
        return;
      }

      if (t.id === 'scrim') { closeSheet(false); return; }
    });

    $('noteInput').addEventListener('input', function () {
      if (ui.catTouched) return;
      var g = JJ.guess(this.value);
      if (g) {
        var list = ui.type === 'income' ? JJ.INCOME : JJ.EXPENSE;
        var ok = list.some(function (c) { return c.key === g; });
        if (ok) { ui.cat = g; renderAdd(); }
      }
    });

    $('datePick').addEventListener('change', function () {
      if (!this.value) return;
      ui.date = this.value;
      renderAdd();
    });

    window.addEventListener('popstate', function () {
      if (ui.sheet) closeSheet(true);
      else ui.pushed = false;
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && ui.sheet) closeSheet(false);
    });

    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var onChange = function () { if (state.settings.mode === 'system') applyTheme(); };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    if (/Android/i.test(navigator.userAgent)) document.documentElement.classList.add('platform-android');
    applyTheme();
    bind();
    renderAll();
    renderThemeSheet();
    renderAbout();
    switchTab('home');
  }

  boot();
})();
