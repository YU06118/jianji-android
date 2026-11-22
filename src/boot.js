/* 简记 Android · 启动引导（热更新入口）
 * 顺序：读取热更缓存 → 校验结构 → 注入 body/CSS/JS；无缓存、校验失败或脚本异常则加载内置资源。
 * 约束：boot.js 自身与原生层不参与热更；内置版本需与 app.js、tauri.conf.json、Cargo.toml、package.json 一致。
 */
(function () {
  'use strict';

  var BUILTIN_VERSION = '1.0.3';
  var HOT_KEY = 'jianji.hot.pkg.v1';
  var PARTS = ['body', 'css', 'core', 'app'];

  window.JJ_BUILTIN_VERSION = BUILTIN_VERSION;
  window.JJ_ACTIVE_VERSION = BUILTIN_VERSION;

  function readPkg() {
    try {
      var raw = localStorage.getItem(HOT_KEY);
      if (!raw) return null;
      var pkg = JSON.parse(raw);
      if (!pkg || !/^\d+\.\d+\.\d+$/.test(String(pkg.version || ''))) return null;
      for (var i = 0; i < PARTS.length; i++) {
        if (typeof pkg[PARTS[i]] !== 'string' || !pkg[PARTS[i]]) return null;
      }
      return pkg;
    } catch (e) {
      return null;
    }
  }

  function dropPkg() {
    try { localStorage.removeItem(HOT_KEY); } catch (e) { /* 忽略 */ }
  }

  function loadBuiltin() {
    var list = ['core.js', 'app.js'];
    (function next(i) {
      if (i >= list.length) return;
      var s = document.createElement('script');
      s.src = list[i];
      s.onload = s.onerror = function () { next(i + 1); };
      document.body.appendChild(s);
    })(0);
  }

  function applyHot(pkg) {
    var app = document.getElementById('app');
    if (!app) return false;

    var links = document.querySelectorAll('link[rel="stylesheet"]');
    for (var i = 0; i < links.length; i++) links[i].disabled = true;
    var style = document.createElement('style');
    style.setAttribute('data-jj-hot', '1');
    style.textContent = pkg.css;
    document.head.appendChild(style);

    app.innerHTML = pkg.body;

    try {
      /* 热更包内 core/app 为完整源码，合并执行；版本先置位，app 启动时即可读到 */
      window.JJ_ACTIVE_VERSION = pkg.version;
      (new Function(pkg.core + '\n' + pkg.app))();
      return true;
    } catch (e) {
      if (window.console && console.warn) console.warn('[hot] 热更脚本执行失败，回退内置版本', e);
      window.JJ_ACTIVE_VERSION = BUILTIN_VERSION;
      dropPkg();
      return false;
    }
  }

  function start() {
    var pkg = readPkg();
    if (pkg) {
      if (applyHot(pkg)) return;
      dropPkg();
      window.location.reload();
      return;
    }
    /* 有缓存但结构不合法：清掉，避免反复失败 */
    try { if (localStorage.getItem(HOT_KEY)) dropPkg(); } catch (e) { /* 忽略 */ }
    loadBuiltin();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
