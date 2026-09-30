// 页面层：五个标签——首页 / 地图 / 上传 / 专题 / 我的。每个标签一屏放下，不用往下滑
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var JW, X, M = window.JWMap, Cloud = window.Cloud, S = window.Social;
  var startHash = location.hash, current = 'home', tab = 'home', back = 'home', profTab = 'pub';
  var VIEWS = ['home', 'list', 'topic', 'upload', 'profile'];

  function esc(t) { return JW.esc(t); }
  function cloudOn() { return Cloud && Cloud.enabled(); }
  function me() { return cloudOn() ? Cloud.me() : null; }
  function km(m) { return m < 1000 ? Math.round(m / 10) * 10 + ' 米' : (m / 1000 < 100 ? (m / 1000).toFixed(1) : Math.round(m / 1000)) + ' 公里'; }
  function haversine(a, b) {
    var R = 6371000, r = Math.PI / 180, dLat = (b[1] - a[1]) * r, dLng = (b[0] - a[0]) * r;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function allSpots() { return window.JW_DATA.spots; }
  function coverHtml(s, big) { return s.cover ? '<img loading="lazy" src="' + esc(s.cover) + '" alt="">' : JW.placeholder(s.coverHint || s.name, s.type, !!big); }
  function logo(sz) { return '<svg class="brand-mark" viewBox="0 0 160 160" width="' + sz + '" height="' + sz + '" aria-hidden="true"><use href="#logoMark"/></svg>'; }

  // ---------------- 切换页面 ----------------
  function show(name, keepTab) {
    current = name;
    VIEWS.forEach(function (v) { var el = $('v' + v[0].toUpperCase() + v.slice(1)); el.classList.toggle('open', v === name); el.setAttribute('aria-hidden', v === name ? 'false' : 'true'); });
    document.body.classList.toggle('on-map', name === 'map');
    if (name !== 'map') JW.closeSheet();
    if (!keepTab && name !== 'list') tab = name;
    if (name === 'home') renderHome();
    if (name === 'topic') renderTopic();
    if (name === 'upload') renderUpload();
    if (name === 'profile') renderProfile();
    if (name === 'map') renderNear();
    document.querySelectorAll('#tabbar [data-tab]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === tab); });
  }
  function goSpot(id) { tab = 'map'; show('map'); setTimeout(function () { JW.openSpot(id); }, 60); }
  function goMap(fn) { tab = 'map'; show('map'); if (fn) setTimeout(fn, 60); }

  // ---------------- 分类与专题 ----------------
  var PLAYS = { classic: '拍同款', skill: '拍大片', wonder: '限定奇观' };
  var TOPICS = [{ key: 'film', color: '#2a2140' }, { key: 'star', color: '#3a2438' }, { key: 'textbook', color: '#1f2c3a' }, { key: 'rmb', color: '#33301f' }, { key: 'landmark', color: '#1c2530' }, { key: 'creative', color: '#23301f' }];
  function topicInfo(k) { var c = window.JW_DATA.collections[k] || {}; return { name: c.name || k, desc: c.desc || '' }; }
  function catBy(k) {
    if (PLAYS[k]) return { key: k, name: PLAYS[k], desc: '', color: JW.COLORS[k], wonder: k === 'wonder', test: function (s) { return s.type === k; } };
    if (k === 'route') return { key: k, name: '机位路线', desc: '按光线和地形排好顺序', color: '#2F7D6D', route: true };
    var t = TOPICS.filter(function (x) { return x.key === k; })[0] || TOPICS[0], i = topicInfo(t.key);
    return { key: t.key, name: i.name, desc: i.desc, color: t.color, test: function (s) { return window.JW_TOPIC(s, t.key); } };
  }
  function catCount(c) { if (c.route) return window.JW_DATA.routes.length; var n = allSpots().filter(c.test).length; return c.wonder ? n + window.JW_DATA.wonders.length : n; }

  // ---------------- 此刻 · 我身边（时间 + 地点） ----------------
  var FALLBACK = [121.5064, 31.2451], lastPos = null, locTried = false, locFail = false;
  var RANK = { ok: 0, wait: 1, bad: 2 }, BADGE = { ok: '现在正好', wait: '稍后更好', bad: '今天错过' };
  function nearbyNow(p, n) {
    var now = new Date();
    return allSpots().map(function (s) { var lc = JW.lightCheck(s, now); return { s: s, d: haversine(p, [s.lng, s.lat]), cls: lc.cls || 'wait' }; })
      .sort(function (a, b) { return a.d - b.d; }).slice(0, n || 12);
  }
  function locate(cb) {
    if (!navigator.geolocation) return cb(FALLBACK, true);
    navigator.geolocation.getCurrentPosition(function (p) { cb(M.wgs2bd(p.coords.longitude, p.coords.latitude), false); }, function () { cb(FALLBACK, true); }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 });
  }
  function renderNear() {
    var box = $('near'); if (!box) return;
    if (JW.renderLabels) JW.renderLabels();
    if (!locTried) {
      locTried = true;
      box.innerHTML = '<div class="near-h"><b>我身边</b><span>正在获取你的位置…</span></div>';
      var done = false, t = setTimeout(function () { if (!done) { done = true; locFail = true; renderNear(); } }, 9000);
      // 进地图就定位：放蓝点；附近 20 公里内有机位才把地图挪过去
      JW.locateMe({ quiet: true, fly: false }, function (p) {
        if (done) return; done = true; clearTimeout(t);
        locFail = !p; if (p) lastPos = p;
        // 地图中心：附近 20 公里内有机位就以你为中心，否则以陆家嘴为例；往下挪一点，给底部“我身边”留位置
        var c = p && nearbyNow(p, 1)[0].d < 20000 ? p : FALLBACK;
        JW.map.center(c[0], c[1] - 0.0012, 15);
        renderNear();
      });
      return;
    }
    var p = lastPos || FALLBACK, list = nearbyNow(p, 12), far = list.length && list[0].d > 20000;
    list = list.sort(function (a, b) { return far ? a.d - b.d : (RANK[a.cls] - RANK[b.cls]) || (a.d - b.d); });
    var label = locFail ? '未获取定位 · 以陆家嘴为例' : far ? '附近 20 公里内暂无 · 离你最近的' : '现在能拍的排前面';
    box.innerHTML = '<div class="near-h"><b>我身边</b><span>' + label + '</span><button class="link" data-near="relocate">重新定位</button></div>' +
      '<div class="near-list">' + (far ? '<button class="near-empty" data-near="upload"><b>这里还没有机位</b><span>成为第一个上传的人 ＋</span></button>' : '') +
      list.map(function (x) {
        return '<div class="near-card" data-spot="' + esc(x.s.id) + '"><div class="nc-img">' + coverHtml(x.s) + '</div><div class="nc-t"><b>' + esc(x.s.name) + '</b>' +
          '<span><em class="badge ' + x.cls + '">' + BADGE[x.cls] + '</em>' + km(x.d) + '</span></div><div class="nc-star" data-rxstar="' + esc(x.s.id) + '">' + S.star(x.s.id) + '</div></div>';
      }).join('') + '</div>';
    box.querySelectorAll('[data-spot]').forEach(function (c) { c.onclick = function () { JW.openSpot(c.getAttribute('data-spot')); }; });
    box.querySelectorAll('[data-near]').forEach(function (b) { b.onclick = function () {
      if (b.getAttribute('data-near') === 'upload') return go('upload');
      b.textContent = '定位中…';
      JW.locateMe({ fly: false }, function (p) { locFail = !p; if (p) { lastPos = p; JW.map.center(p[0], p[1] - 0.0012, 15); } renderNear(); });
    }; });
  }

  // ---------------- 首页：标志 + 名字 + 口号、搜索、大图（去拍同款、点赞、收藏） ----------------
  var FEATURED = ['mirror', 'shizilin', 'snowking', 'gugong', 'rome', 'liziba', 'tinytimes', 'ring', 'london'];
  function featured() {
    // 有真实照片的机位全部排进来，按点赞 + 收藏从多到少，同分时新发布的在前；真实照片不足 5 张才用示意图补位
    var heat = function (s) { return S.count('like', s.id) + S.count('fav', s.id); };
    var real = allSpots().filter(function (s) { return s.cover; }).map(function (s, i) { return { s: s, h: heat(s), i: i }; })
      .sort(function (a, b) { return b.h - a.h || a.i - b.i; }).map(function (x) { return x.s; }).slice(0, 12);
    if (real.length >= 5) return real;
    return real.concat(FEATURED.map(function (id) { return JW.spotById[id]; }).filter(function (s) { return s && real.indexOf(s) < 0; })).slice(0, 10);
  }
  function renderHome() {
    var list = featured();
    $('vHome').innerHTML = '<div class="fit home">' +
      '<header class="hm-top">' + logo(40) + '<div><div class="hm-name">' + esc(window.JW_CONFIG.BRAND) + '</div><div class="hm-slogan">' + esc(window.JW_CONFIG.SLOGAN) + '</div></div></header>' +
      '<form class="search hm-search" data-search><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><input type="search" placeholder="搜机位、地标、剧名、城市" enterkeyhint="search"></form>' +
      '<div class="carousel" id="hmCar">' + list.map(function (s) {
        return '<article class="slide" data-go-spot="' + esc(s.id) + '"><div class="slide-img">' + coverHtml(s, true) + '</div><div class="slide-shade"></div>' +
          '<div class="slide-txt"><b>' + esc(s.name) + '</b><span>' + esc(s.area) + (s.author ? ' · ' + esc(s.author.name) : '') + '</span>' +
          '<div class="slide-act"><button class="btn-main" data-go-spot="' + esc(s.id) + '">去拍同款</button><div class="rx-row" data-rxbox="' + esc(s.id) + '" data-dark>' + S.buttons(s.id, true) + '</div></div></div></article>';
      }).join('') + '</div>' +
      '<div class="dots" id="hmDots">' + list.map(function (_, i) { return '<i class="' + (i ? '' : 'on') + '"></i>'; }).join('') + '</div></div>';
    var car = $('hmCar');
    car.addEventListener('scroll', function () { var i = Math.round(car.scrollLeft / car.clientWidth); document.querySelectorAll('#hmDots i').forEach(function (d, k) { d.classList.toggle('on', k === i); }); }, { passive: true });
    bind($('vHome'));
  }

  // ---------------- 专题：四个大卡片 + 路线 ----------------
    function topicArt(k, color) {
    var bg = '<rect width="320" height="400" fill="' + color + '"/><circle cx="260" cy="70" r="120" fill="#fff" opacity=".08"/>';
    var fg = {
      film: '<g fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="3"><rect x="40" y="70" width="240" height="150" rx="6"/></g><g fill="#fff" opacity=".35">' + [0,1,2,3,4,5,6,7].map(function (i) { return '<rect x="' + (50 + i * 29) + '" y="78" width="16" height="10" rx="2"/><rect x="' + (50 + i * 29) + '" y="202" width="16" height="10" rx="2"/>'; }).join('') + '</g><path d="M140 125v40l34-20z" fill="#fff" opacity=".6"/>',
      textbook: '<g fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="3"><path d="M160 90c-30-16-70-18-110-10v140c40-8 80-6 110 10 30-16 70-18 110-10V80c-40-8-80-6-110 10zM160 90v140"/></g><path d="M70 190l30-40 22 24 18-16 20 32" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="3"/>',
      rmb: '<g fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="3"><rect x="40" y="90" width="240" height="120" rx="8"/><circle cx="100" cy="150" r="30"/></g><path d="M160 180l26-46 22 30 16-18 24 34" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="3"/><text x="258" y="120" fill="#fff" opacity=".6" font-size="22" font-weight="700" text-anchor="end">¥</text>',
      star: '<path d="M160 90l18 40 44 5-33 30 9 44-38-22-38 22 9-44-33-30 44-5z" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="3"/>',
      landmark: '<g fill="#fff" opacity=".4"><rect x="70" y="150" width="30" height="120"/><rect x="150" y="80" width="10" height="190"/><circle cx="155" cy="190" r="26"/><circle cx="155" cy="130" r="16"/><rect x="220" y="120" width="34" height="150"/></g>',
      creative: '<path d="M160 280 L100 140 A150 150 0 0 1 220 140 Z" fill="#d7f36b" opacity=".75"/><circle cx="160" cy="280" r="12" fill="#fff"/>'
    }[k] || '';
    return '<svg class="t-art" viewBox="0 0 320 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' + bg + fg + '</svg>';
  }

  function wonderArt() {
    return '<svg class="t-art" viewBox="0 0 640 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="640" height="300" fill="#231f3a"/><circle cx="470" cy="110" r="46" fill="#d7f36b" opacity=".9"/><g fill="#ffffff" opacity=".35"><rect x="430" y="150" width="26" height="150"/><path d="M500 300 L520 90 L540 300Z"/><rect x="120" y="190" width="40" height="110"/><rect x="180" y="150" width="30" height="150"/></g></svg>';
  }
  function topicCover(k) { var c = allSpots().filter(function (s) { return s.cover && window.JW_TOPIC(s, k); })[0]; return c ? '<img class="t-art" src="' + esc(c.cover) + '" alt="">' : ''; }
  function renderTopic() {
    // 七个专题同一种卡片；数量按当前机位（含网友发帖的标签）实时统计
    var list = TOPICS.concat([{ key: 'wonder', color: '#231f3a' }]);
    $('vTopic').innerHTML = '<div class="fit topic-page"><header class="pg-h"><h1>专题</h1></header>' +
      '<div class="tp-grid seven">' + list.map(function (t) {
        var c = catBy(t.key), n = catCount(c), name = t.key === 'wonder' ? '限定奇观' : topicInfo(t.key).name;
        var art = topicCover(t.key) || (t.key === 'wonder' ? wonderArt() : topicArt(t.key, t.color));
        return '<button class="tp-card' + (t.key === 'wonder' ? ' wide' : '') + '" data-cat="' + t.key + '" style="--c:' + t.color + '">' + art + '<div class="tp-txt"><em>' + (n ? n + ' 个机位' : '等你来拍') + '</em><b>' + esc(name) + '</b></div></button>';
      }).join('') + '</div></div>';
    bind($('vTopic'));
  }

  // ---------------- 列表页：专题 / 分类 / 搜索结果 ----------------
  function listHead(t, sub) { return '<header class="l-top"><button class="back" data-go="back" aria-label="返回">‹</button><div><h1>' + esc(t) + '</h1><p class="l-sub">' + esc(sub || '') + '</p></div></header>'; }
  function row(o) { return '<button class="row" data-spot="' + esc(o.id) + '"><div class="row-img">' + o.art + '</div><div class="row-t"><b>' + esc(o.name) + '</b><span>' + esc(o.sub || '') + '</span></div>' + (o.dist ? '<em>' + esc(o.dist) + '</em>' : '<i>›</i>') + '</button>'; }
  function spotRow(s) {
    var tags = [JW.TYPE_NAME[s.type], s.scene && s.scene.work ? '《' + s.scene.work + '》' : '', s.author ? '作者 ' + s.author.name : ''].filter(Boolean).join(' · ');
    return row({ id: s.id, name: s.name, sub: (s.area || '') + (tags ? ' · ' + tags : ''), art: coverHtml(s) });
  }
  function openList(mode, key) {
    back = current === 'list' ? back : current; show('list', true);
    var v = $('vList'), items, title, sub;
    if (mode === 'search') {
      var q = String(key || '').trim().toLowerCase(); title = '搜索“' + key + '”';
      var hit = allSpots().filter(function (s) {
        var col = s.collection && window.JW_DATA.collections[s.collection] ? window.JW_DATA.collections[s.collection].name : '';
        return [s.name, s.area, s.summary, col, JW.TYPE_NAME[s.type], s.scene && s.scene.work, s.scene && s.scene.realPlace, s.author && s.author.name, (s.tags || []).join(' '), s.post].join(' ').toLowerCase().indexOf(q) >= 0;
      });
      var rts = []; // 路线入口暂时下线：以后按临近点位或同主题自动生成路线，数据和编排逻辑都保留着
      items = rts.map(function (r) { return row({ id: 'r:' + r.id, name: r.name, sub: r.spotIds.length + ' 个机位 · 路线', art: JW.placeholder(r.spotIds.length + ' 个机位', 'route', false) }); }).concat(hit.map(spotRow));
      sub = items.length ? '找到 ' + items.length + ' 个' : '';
      v.innerHTML = listHead(title, sub) + '<div class="rows">' + (items.join('') || '<div class="empty"><b>还没有相关机位</b><p>换个关键词试试，或者把你知道的好角度传上来。</p><button class="btn-main" data-go="upload">＋ 上传机位</button></div>') + '</div>';
    } else {
      var c = catBy(key);
      if (c.route) items = window.JW_DATA.routes.map(function (r) { return row({ id: 'r:' + r.id, name: r.name, sub: r.spotIds.length + ' 个机位 · ' + r.advice, art: JW.placeholder(r.spotIds.length + ' 个机位', 'route', false) }); });
      else if (c.wonder) items = wonderGroups();
      else items = allSpots().filter(c.test).map(spotRow);
      v.innerHTML = listHead(c.name, c.desc || (catCount(c) + ' 个')) + '<div class="rows">' + (items.join('') || '<div class="empty"><b>这一类还没有机位</b><button class="btn-main" data-go="upload">＋ 上传第一个</button></div>') + '</div>';
    }
    v.scrollTop = 0; bind(v);
  }
  // 限定奇观专题：按奇观类型分组，每条显示“下一次”
  function wonderGroups() {
    var W = window.JW_WONDER, groups = {}, order = W.KINDS.concat(['未分类']);
    function put(k, html, t) { (groups[k] = groups[k] || []).push({ html: html, t: t }); }
    window.JW_DATA.wonders.forEach(function (w) { put('穿月', row({ id: 'w:' + w.id, name: w.name, sub: '每月满月前后 · 点开推算未来一年', art: JW.placeholder(w.name, 'wonder', true) }), 0); });
    allSpots().filter(function (s) { return s.type === 'wonder'; }).forEach(function (s) {
      var k = s.wonder && s.wonder.kind || '未分类', n = s.wonder ? W.next(s) : { text: '', date: null };
      put(order.indexOf(k) >= 0 ? k : '其他', row({ id: s.id, name: s.name, sub: n.text || (s.area || ''), art: coverHtml(s) }), n.date ? +n.date : 9e15);
    });
    return order.filter(function (k) { return groups[k]; }).map(function (k) {
      return '<h3 class="l-grp">' + esc(k) + '<em>' + groups[k].length + '</em></h3>' + groups[k].sort(function (a, b) { return a.t - b.t; }).map(function (x) { return x.html; }).join('');
    });
  }
  function search(q) { q = String(q || '').trim(); if (!q) return JW.toast('输入想找的机位、地标或剧名'); openList('search', q); }

  // ---------------- 上传：先登录，再进入上传表单 ----------------
  function renderUpload() {
    if (cloudOn() && !me()) {
      $('vUpload').innerHTML = '<div class="fit gate">' + logo(56) + '<h1>登录后上传你的机位</h1><p class="muted">发布的机位所有人都能看到，并署上你的名字。</p>' +
        '<ol class="gate-steps"><li><b>从相册选原图</b><span>自动读出拍摄位置、朝向和焦段</span></li><li><b>确认站位</b><span>照片定位、你现在的位置，或在地图上点选</span></li><li><b>写路书</b><span>每个转弯一张照片 + 一句话，带人走完最后几百米</span></li></ol>' +
        '<div class="btn-row"><button class="btn-main" data-go="login">登录</button><button class="btn-ghost" data-go="signup">注册</button></div></div>';
      return bind($('vUpload'));
    }
    goMap(X.openUpload); tab = 'upload';
    document.querySelectorAll('#tabbar [data-tab]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === 'upload'); });
  }

  // ---------------- 我的：登录状态、我的发布 / 点赞 / 收藏 ----------------
  function tile(s, extra, canDelete) {
    return '<div class="tile"><button class="tile-img" data-spot="' + esc(s.id) + '">' + coverHtml(s) + '</button><div class="tile-t"><b>' + esc(s.name) + '</b><span>' + esc(extra || s.area || '') + '</span></div>' +
      '<button class="tile-share" data-share="' + esc(s.id) + '">分享</button>' + (canDelete ? '<button class="tile-del" data-del="' + esc(s.id) + '">删除</button>' : '') + '</div>';
  }
  // 删除自己发布的机位：先在卡片里确认，再从云端删掉
  function confirmDelete(id) {
    var s = JW.spotById[id]; if (!s) return;
    JW.openSheet('<span class="tag">删除机位</span><h2>删除“' + esc(s.name) + '”？</h2><p class="muted">删除后地图上和别人的收藏里都看不到它了，这一步不能撤销。</p>' +
      '<div class="btn-row"><button class="btn-ghost" data-act="no">取消</button><button class="btn-danger" data-act="yes">确认删除</button></div>');
    JW.bindSheet(function (act) {
      if (act === 'no') return JW.closeSheet();
      var b = document.querySelector('#sheetBody [data-act=yes]'); if (b) { b.disabled = true; b.textContent = '正在删除…'; }
      Cloud.deleteSpot(s.rowId).then(function () {
        X.store.spots = X.store.spots.filter(function (x) { return x.id !== id; });
        JW.removeSpot(id); JW.toast('已删除'); renderProfile();
      }).catch(function (e) { JW.toast(e.message, 4000); if (b) { b.disabled = false; b.textContent = '确认删除'; } });
    });
  }
  function renderProfile() {
    var v = $('vProfile');
    if (!cloudOn()) { v.innerHTML = '<div class="fit gate"><h1>我的</h1><p class="muted">云端还没接好。</p></div>'; return; }
    var u = me();
    if (!u) {
      v.innerHTML = '<div class="fit gate">' + logo(56) + '<h1>登录后开始你的巡礼</h1><p class="muted">你的发布、点赞和收藏都会保存在账号里，换手机也不丢。</p>' +
        '<div class="btn-row"><button class="btn-main" data-go="login">登录</button><button class="btn-ghost" data-go="signup">注册</button></div>' +
        '<button class="link" data-go="shareapp">分享移步到位给朋友</button><button class="link" data-go="disclaimer">版权与使用说明</button></div>';
      return bind(v);
    }
    var pub = X.store.spots.filter(function (s) { return s.ownerId === u.id; });
    var liked = S.mine('like').map(function (id) { return JW.spotById[id]; }).filter(Boolean);
    var favd = S.mine('fav').map(function (id) { return JW.spotById[id]; }).filter(Boolean);
    var lists = { pub: pub, like: liked, fav: favd };
    var empty = { pub: ['还没有发布', '把你拍过的好角度传上来', '＋ 上传机位', 'upload'], like: ['还没有点赞', '在首页或机位卡片上点 ♡', '去首页逛逛', 'home'], fav: ['还没有收藏', '在地图或机位卡片上点 ☆，想去的地方存在这里', '打开地图', 'map'] }[profTab];
    var cur = lists[profTab], mins = Math.ceil(X.idleLeft() / 60000);
    v.innerHTML = '<div class="fit prof">' +
      '<div class="p-card"><div class="avatar">' + esc(((u.user_metadata || {}).nickname || u.email || '我')[0]) + '</div><div class="p-id"><h2 id="pName">' + esc((u.user_metadata || {}).nickname || '…') + '</h2>' +
        '<p class="muted">' + esc(u.email || '') + '</p><p class="login-state"><span class="dot-ok"></span>已登录 · ' + mins + ' 分钟内无操作将自动退出</p></div>' +
        '<div class="p-ops"><button class="link" data-go="editprofile">编辑</button><button class="link" data-go="logout">退出</button></div></div>' +
      '<nav class="p-tabs">' + [['pub', '我的发布', pub.length], ['like', '我的点赞', liked.length], ['fav', '我的收藏', favd.length]].map(function (t) {
        return '<button data-ptab="' + t[0] + '" class="' + (profTab === t[0] ? 'on' : '') + '"><b>' + t[2] + '</b><span>' + t[1] + '</span></button>';
      }).join('') + '</nav>' +
      '<div class="p-list">' + (cur.length ? '<div class="grid2">' + cur.map(function (s) { return tile(s, profTab === 'pub' ? (s.checkins || 0) + ' 次打卡' : s.area, profTab === 'pub' && !!s.rowId); }).join('') + '</div>'
        : '<div class="empty"><b>' + empty[0] + '</b><p>' + empty[1] + '</p><button class="btn-ghost" data-go="' + empty[3] + '">' + empty[2] + '</button></div>') + '</div>' +
      '<div class="p-foot"><button class="link" data-go="shareapp">分享移步到位</button><button class="link" data-go="disclaimer">版权与使用说明</button></div></div>';
    v.querySelectorAll('[data-ptab]').forEach(function (b) { b.onclick = function () { profTab = b.getAttribute('data-ptab'); renderProfile(); }; });
    Cloud.profile(u.id).then(function (p) { var n = $('pName'); if (n && p && p.nickname) n.textContent = p.nickname; }).catch(function () {});
    bind(v);
  }
    function editProfile() {
    var u = Cloud.me(); if (!u) return;
    Cloud.profile(u.id).then(function (p) {
      p = p || {};
      JW.openSheet('<span class="tag skill">编辑资料</span><h2>我的资料</h2><div class="form">' +
        '<label class="field"><span>昵称</span><input id="epNick" value="' + esc(p.nickname || '') + '"></label>' +
        '<label class="field"><span>个人主页</span><input id="epHome" value="' + esc(p.homepage || '') + '" placeholder="可直接粘贴小红书分享文案"></label></div>' +
        '<div class="btn-row"><button class="btn-main" data-act="save">保存</button></div>');
      JW.bindSheet(function () {
        Cloud.saveProfile({ nickname: $('epNick').value.trim() || p.nickname, homepage: $('epHome').value.trim() })
          .then(function () { JW.toast('资料已保存'); JW.closeSheet(); X.refreshAccountBtn(); X.loadCloud().then(function () { renderProfile(); }); })
          .catch(function (e) { JW.toast(e.message, 4000); });
      });
    });
  }

  // ---------------- 分享移步到位（产品卡片） ----------------
  function drawAppCard(line) {
    var W = 1080, H = 1500, c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d'), F = '"PingFang SC","Microsoft YaHei",sans-serif', IH = 860;
    var photo = (allSpots().filter(function (s) { return s.rowId && s.cover; })[0] || {}).cover;
    g.fillStyle = '#F6F1E7'; g.fillRect(0, 0, W, H);
    function art() {
      var gr = g.createLinearGradient(0, 0, 0, IH); gr.addColorStop(0, '#F3D9A8'); gr.addColorStop(1, '#E9C9A0'); g.fillStyle = gr; g.fillRect(0, 0, W, IH);
      g.fillStyle = 'rgba(42,37,33,.16)'; [[300, 300, 50, 420], [380, 200, 64, 520], [470, 280, 44, 440], [560, 120, 70, 600], [660, 320, 44, 400]].forEach(function (r) { g.fillRect(r[0], r[1], r[2], r[3]); });
      var rg = g.createRadialGradient(540, 820, 10, 540, 820, 560); rg.addColorStop(0, 'rgba(217,140,43,.6)'); rg.addColorStop(1, 'rgba(217,140,43,0)');
      g.fillStyle = rg; g.beginPath(); g.moveTo(540, 820); g.lineTo(270, 250); g.arc(540, 820, 630, Math.PI + 1.13, 2 * Math.PI - 1.13); g.closePath(); g.fill();
      g.fillStyle = '#2B3A67'; g.beginPath(); g.arc(860, 170, 56, 0, 7); g.fill();
    }
    var p = photo ? X.loadImg(photo).then(function (img) { var sc = Math.max(W / img.width, IH / img.height); g.save(); g.beginPath(); g.rect(0, 0, W, IH); g.clip(); g.drawImage(img, (W - img.width * sc) / 2, (IH - img.height * sc) / 2, img.width * sc, img.height * sc); g.restore(); }).catch(art) : Promise.resolve(art());
    return p.then(function () {
      g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 9; g.lineCap = 'round';
      [[48, 48, 1, 1], [W - 48, 48, -1, 1], [48, IH - 48, 1, -1], [W - 48, IH - 48, -1, -1]].forEach(function (k) { g.beginPath(); g.moveTo(k[0], k[1] + 70 * k[3]); g.lineTo(k[0], k[1]); g.lineTo(k[0] + 70 * k[2], k[1]); g.stroke(); });
      X.drawLogo(g, 56, IH + 60, 120);
      g.fillStyle = '#2A2521'; g.font = '800 72px ' + F; g.fillText(window.JW_CONFIG.BRAND || '移步到位', 196, IH + 140);
      g.fillStyle = '#6B625A'; g.font = '32px ' + F; g.fillText(window.JW_CONFIG.SLOGAN || '', 198, IH + 192);
      g.fillStyle = '#2A2521'; g.font = '600 40px ' + F; X.wrapText(g, line || '不止到达地点，更要站对位置、朝对方向、赶上对的时间。', 56, IH + 300, W - 112 - 300, 58, 4);
      window.QR.draw(g, (Cloud && Cloud.site) || location.href.split('#')[0], W - 316, H - 350, 270, '#2A2521', '#FFFDF8');
      g.fillStyle = '#6B625A'; g.font = '26px ' + F; g.textAlign = 'center'; g.fillText('扫码打开移步到位', W - 181, H - 50); g.textAlign = 'left';
      g.fillStyle = '#6B625A'; g.font = '26px ' + F; g.fillText('每一次打卡，都是对这个世界的一次巡礼', 56, H - 50);
      return c.toDataURL('image/jpeg', 0.9);
    });
  }
  function shareApp() {
    X.sharePanel({ title: window.JW_CONFIG.BRAND + ' · ' + window.JW_CONFIG.SLOGAN, line: '不止到达地点，更要站对位置、朝对方向、赶上对的时间。',
      link: (Cloud && Cloud.site) || location.href.split('#')[0], file: '移步到位.jpg', what: '移步到位', draw: drawAppCard });
  }


  // ---------------- 事件 ----------------
  function bind(root) {
    root.querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function (e) { e.preventDefault(); e.stopPropagation(); go(b.getAttribute('data-go')); }; });
    root.querySelectorAll('[data-cat]').forEach(function (b) { b.onclick = function () { openList('cat', b.getAttribute('data-cat')); }; });
    root.querySelectorAll('[data-spot]').forEach(function (b) { b.onclick = function () { openItem(b.getAttribute('data-spot')); }; });
    root.querySelectorAll('[data-go-spot]').forEach(function (b) { b.onclick = function (e) { if (e.target.closest('[data-rx]')) return; e.stopPropagation(); goSpot(b.getAttribute('data-go-spot')); }; });
    root.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); confirmDelete(b.getAttribute('data-del')); }; });
    root.querySelectorAll('[data-share]').forEach(function (b) { b.onclick = function () { var s = JW.spotById[b.getAttribute('data-share')]; if (s) X.share(s); }; });
    root.querySelectorAll('[data-search]').forEach(function (f) { f.onsubmit = function (e) { e.preventDefault(); var i = f.querySelector('input'); search(i.value); i.blur(); }; });
  }
  function openItem(id) {
    if (id.indexOf('r:') === 0) return goMap(function () { JW.openRoute(id.slice(2)); });
    if (id.indexOf('w:') === 0) return goMap(function () { JW.openWonder(id.slice(2)); });
    goSpot(id);
  }
  function needLogin(tab0, then) { X.afterLoginDo(then); X.account(tab0, '登录后上传的机位所有人都能看到，并署上你的名字'); }
  function go(what) {
    if (what === 'map' || what === 'home' || what === 'topic' || what === 'profile') return show(what);
    if (what === 'back') return show(back || 'home');
    if (what === 'login' || what === 'signup') { var from = current; X.afterLoginDo(function () { show(from === 'upload' ? 'upload' : 'profile'); }); return X.account(what); }
    if (what === 'upload') { tab = 'upload'; if (cloudOn() && !me()) return show('upload'); return show('upload'); }
    if (what === 'shareapp') return shareApp();
    if (what === 'disclaimer') return JW.openDisclaimer();
    if (what === 'editprofile') return editProfile();
    if (what === 'logout') { Cloud.signOut(); X.refreshAccountBtn(); X.loadCloud(); show('profile'); JW.toast('已退出登录'); }
  }

  function init() {
    JW = window.JW; X = window.JWX;
    document.querySelectorAll('#tabbar [data-tab]').forEach(function (b) { b.onclick = function () { go(b.getAttribute('data-tab')); }; });
    var ms = $('mapSearch'); if (ms) ms.onsubmit = function (e) { e.preventDefault(); search($('mapQ').value); $('mapQ').blur(); };
    window.addEventListener('jw-data', function () { if (current === 'home') renderHome(); if (current === 'profile') renderProfile(); if (current === 'map') renderNear(); });
    var homeSorted = false; // 云端点赞收藏第一次读到后，首页按新数字重排一次（用户还没滑动时）
    S.onChange(function () {
      if (current === 'profile') renderProfile();
      var car = $('hmCar');
      if (!homeSorted && S.cloudOk && current === 'home' && car && car.scrollLeft < 5) { homeSorted = true; renderHome(); }
    });
    if (Cloud && Cloud.onChange) Cloud.onChange(function () { if (current === 'profile') renderProfile(); if (current === 'upload') renderUpload(); });
    setInterval(function () { if (current === 'profile' && !document.hidden) { var el = document.querySelector('.login-state'); if (el && me()) el.innerHTML = '<span class="dot-ok"></span>已登录 · ' + Math.ceil(X.idleLeft() / 60000) + ' 分钟内无操作将自动退出'; } }, 30000);
    // 从分享二维码进来直接进地图，从邮件链接进来进“我的”，其余先看首页
    if (/spot=/.test(startHash)) { tab = 'map'; show('map'); }
    else if (/type=recovery/.test(startHash)) show('profile', true);
    else if (/access_token=|error_description=/.test(startHash)) show('profile');
    else show('home');
  }
  window.Views = { show: show, openList: openList, shareApp: shareApp, goSpot: goSpot, search: search, refresh: function () { show(current, true); } };
  if (window.JWX && window.JW && window.JW.ready) init(); else window.addEventListener('jw-ready', function () { setTimeout(init, 0); }, { once: true });
})();
