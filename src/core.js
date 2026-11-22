/* 简记 Android · 共享核心（纯函数，无 DOM 依赖）
 * 设计口径与小程序/桌面端一致：金额用「分」存，日期用 YYYY-MM-DD，分类键跨端同名。
 */
(function (g) {
  'use strict';

  /* ---------- 分类（与小程序 utils/categories.js 同名同色） ---------- */
  var EXPENSE = [
    { key: 'food',      name: '餐饮', color: '#E8836A' },
    { key: 'grocery',   name: '买菜', color: '#6FAE5F' },
    { key: 'kid',       name: '孩子', color: '#E9A23B' },
    { key: 'daily',     name: '日用', color: '#4FB3A5' },
    { key: 'clothing',  name: '服饰', color: '#E5759B' },
    { key: 'home',      name: '家庭', color: '#8E7CD1' },
    { key: 'social',    name: '人情', color: '#D9736E' },
    { key: 'transport', name: '交通', color: '#5B9FE0' },
    { key: 'medical',   name: '医疗', color: '#3FB0C4' },
    { key: 'fun',       name: '娱乐', color: '#A96FC4' },
    { key: 'study',     name: '学习', color: '#6C7CC9' },
    { key: 'other',     name: '其他', color: '#A79DA2' }
  ];

  var INCOME = [
    { key: 'salary',   name: '工资', color: '#4CBFA3' },
    { key: 'bonus',    name: '奖金', color: '#E9A23B' },
    { key: 'redpack',  name: '红包', color: '#D9736E' },
    { key: 'invest',   name: '利息', color: '#5B9FE0' },
    { key: 'other_in', name: '其他', color: '#A79DA2' }
  ];

  var CAT_MAP = {};
  EXPENSE.concat(INCOME).forEach(function (c) { CAT_MAP[c.key] = c; });

  /* ---------- 主题色（与小程序 THEME_NAV 对齐） ---------- */
  var ACCENTS = {
    blue:   { name: '系统蓝', light: '#0078D4', dark: '#4CC2FF', solidLight: '#0078D4', solidDark: '#0067BC' },
    lilac:  { name: '紫罗兰', light: '#6B4EFF', dark: '#B39AFF', solidLight: '#6B4EFF', solidDark: '#5B3FD6' },
    teal:   { name: '青蓝',   light: '#00809D', dark: '#4CC9E5', solidLight: '#00809D', solidDark: '#0B6377' },
    green:  { name: '森绿',   light: '#0E7C3A', dark: '#6CCB8F', solidLight: '#0E7C3A', solidDark: '#0A6B31' }
  };

  /* ---------- 金额 ---------- */
  function fmtCents(cents, opts) {
    opts = opts || {};
    var neg = cents < 0;
    var v = Math.abs(Math.round(cents));
    var s = (v / 100).toFixed(2);
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    var out = parts.join('.');
    if (opts.compact && out.slice(-3) === '.00') out = out.slice(0, -3);
    if (opts.sign && !neg) out = '+' + out;
    return (neg ? '-' : '') + out;
  }

  function parseAmount(str) {
    var s = String(str || '').replace(/[^\d.]/g, '');
    var i = s.indexOf('.');
    if (i >= 0) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '');
    var f = parseFloat(s);
    if (!isFinite(f)) return 0;
    return Math.round(f * 100);
  }

  /* ---------- 日期 ---------- */
  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function isoOf(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function todayISO() { return isoOf(new Date()); }

  function ymOf(iso) { return String(iso || '').slice(0, 7); }

  function ymOfDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1); }

  function shiftMonth(ym, delta) {
    var p = ym.split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1 + delta, 1);
    return ymOfDate(d);
  }

  function daysInMonth(ym) {
    var p = ym.split('-');
    return new Date(Number(p[0]), Number(p[1]), 0).getDate();
  }

  function ymLabel(ym) {
    var p = ym.split('-');
    return p[0] + '年' + Number(p[1]) + '月';
  }

  var WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  function weekOf(iso) {
    var p = iso.split('-');
    return WEEK[new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])).getDay()];
  }

  function fmtDateCN(iso, withWeek) {
    var p = iso.split('-');
    var s = Number(p[1]) + '月' + Number(p[2]) + '日';
    return withWeek ? s + ' ' + weekOf(iso) : s;
  }

  /* ---------- 汇总 ---------- */
  function summarize(entries, ym) {
    var out = { expense: 0, income: 0, balance: 0, count: 0, byCat: {} };
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (ym && ymOf(e.date) !== ym) continue;
      out.count++;
      if (e.type === 'income') out.income += e.amount;
      else out.expense += e.amount;
      if (!out.byCat[e.cat]) out.byCat[e.cat] = { expense: 0, income: 0 };
      out.byCat[e.cat][e.type] += e.amount;
    }
    out.balance = out.income - out.expense;
    return out;
  }

  function groupByDay(entries) {
    var list = entries.slice().sort(function (a, b) {
      return a.date === b.date ? (b.ts || 0) - (a.ts || 0) : (a.date < b.date ? 1 : -1);
    });
    var groups = [];
    var cur = null;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!cur || cur.date !== e.date) {
        cur = { date: e.date, expense: 0, income: 0, items: [] };
        groups.push(cur);
      }
      cur.items.push(e);
      if (e.type === 'income') cur.income += e.amount;
      else cur.expense += e.amount;
    }
    return groups;
  }

  function sortCats(byCat, type, limit) {
    var rows = [];
    Object.keys(byCat).forEach(function (k) {
      var v = byCat[k][type];
      if (v > 0) rows.push({ cat: CAT_MAP[k] || { key: k, name: '其他', color: '#A79DA2' }, value: v, key: k });
    });
    rows.sort(function (a, b) { return b.value - a.value; });
    if (limit && rows.length > limit) {
      var head = rows.slice(0, limit - 1);
      var rest = rows.slice(limit - 1).reduce(function (s, r) { return s + r.value; }, 0);
      head.push({ cat: { key: 'rest', name: '其他', color: '#A79DA2' }, value: rest, key: 'rest' });
      return head;
    }
    return rows;
  }

  /* ---------- 关键词自动分类（与小程序口径一致，取核心词） ---------- */
  var KEYWORDS = {
    kid: ['奶粉', '尿不湿', '纸尿裤', '玩具', '童装', '童鞋', '绘本', '幼儿园', '学费', '疫苗', '宝宝', '积木', '辅导班', '兴趣班', '儿童', '补习', '奶瓶', '辅食'],
    grocery: ['菜市场', '超市', '生鲜', '蔬菜', '水果', '排骨', '鸡蛋', '粮油', '大米', '海鲜', '猪肉', '牛肉', '鸡肉', '速冻'],
    food: ['早餐', '午餐', '晚餐', '外卖', '吃饭', '餐厅', '饭店', '快餐', '食堂', '奶茶', '咖啡', '烧烤', '火锅', '麦当劳', '肯德基', '星巴克', '汉堡', '小吃', '夜宵', '聚餐'],
    home: ['房租', '水费', '电费', '燃气', '物业', '宽带', '话费', '家电', '家具', '维修', '装修', '取暖'],
    social: ['红包', '礼金', '随礼', '份子', '送礼', '结婚', '生日礼', '人情', '压岁钱', '礼盒'],
    transport: ['打车', '公交', '地铁', '加油', '油费', '停车', '高铁', '火车', '机票', '滴滴', '出租车', '共享单车', '过路费', '洗车', '违章', '网约车', '充电桩'],
    medical: ['医院', '挂号', '药店', '体检', '看病', '门诊', '住院', '药费', '牙科', '口腔', '疫苗', '买药'],
    daily: ['纸巾', '洗衣液', '牙膏', '洗发', '沐浴', '清洁', '日用品', '垃圾袋', '拖鞋', '雨伞', '电池', '湿巾'],
    clothing: ['衣服', '裤子', '外套', '鞋', '包包', '化妆品', '护肤', '面膜', '口红', '内衣', '袜子', '羽绒服'],
    fun: ['电影', '旅游', '门票', '健身', '美容', '按摩', '游戏', '露营', '摄影', '演出', '宠物'],
    study: ['课程', '培训', '网课', '资料', '考试', '报名费', '教材', '会员', '书籍', '书店', '学习'],
    invest: ['利息', '存款', '国债', '理财', '基金', '股票', '分红', '赎回'],
    salary: ['工资', '薪水', '月薪', '发薪'],
    bonus: ['奖金', '年终奖', '绩效'],
    redpack: ['红包', '压岁钱'],
    other_in: ['退款', '报销']
  };

  function guess(text) {
    var s = String(text || '').trim();
    if (!s) return null;
    var best = null;
    Object.keys(KEYWORDS).forEach(function (cat) {
      KEYWORDS[cat].forEach(function (kw) {
        if (s.indexOf(kw) >= 0 && (!best || kw.length > best.len)) best = { cat: cat, len: kw.length };
      });
    });
    return best ? best.cat : null;
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  g.JJ = {
    EXPENSE: EXPENSE,
    INCOME: INCOME,
    CAT_MAP: CAT_MAP,
    ACCENTS: ACCENTS,
    fmtCents: fmtCents,
    parseAmount: parseAmount,
    todayISO: todayISO,
    ymOf: ymOf,
    ymOfDate: ymOfDate,
    shiftMonth: shiftMonth,
    daysInMonth: daysInMonth,
    ymLabel: ymLabel,
    fmtDateCN: fmtDateCN,
    weekOf: weekOf,
    summarize: summarize,
    groupByDay: groupByDay,
    sortCats: sortCats,
    guess: guess,
    uid: uid
  };
})(window);
