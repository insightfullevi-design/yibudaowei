// 页面层：首页、经典案例、身边的机位、个人主页、分享移步到位
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var JW, X, M = window.JWMap, Cloud = window.Cloud;
  var startHash = location.hash, current = 'home', listMode = null;

  function esc(t) { return JW.esc(t); }
  function km(m) { return m < 1000 ? Math.round(m / 10) * 10 + ' 米' : (m / 1000 < 100 ? (m / 1000).toFixed(1) : Math.round(m / 1000)) + ' 公里'; }
  function haversine(a, b) {
    var R = 6371000, r = Math.PI / 180, dLat = (b[1] - a[1]) * r, dLng = (b[0] - a[0]) * r;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function allSpots() { return window.JW_DATA.spots; }
  function coverHtml(s) { return s.cover ? '<img loading="lazy" src="' + esc(s.cover) + '" alt="">' : JW.placeholder(s.coverHint || s.name, s.type, false); }

  // ---------------- 切换页面 ----------------
  function show(name) {
    current = name;
    ['home', 'list', 'profile'].forEach(function (v) { var el = $('v' + v[0].toUpperCase() + v.slice(1)); el.classList.toggle('open', v === name); el.setAttribute('aria-hidden', v === name ? 'false' : 'true'); });
    document.body.classList.toggle('on-map', name === 'map');
    if (name !== 'map') JW.closeSheet();
    if (name === 'home') renderHome();
    if (name === 'profile') renderProfile();
    var v = $('v' + name[0].toUpperCase() + name.slice(1)); if (v) v.scrollTop = 0;
    setTab(name === 'list' ? 'home' : name);
  }
  function setTab(t) { document.querySelectorAll('#tabbar [data-tab]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === t); }); }
  function goSpot(id) { show('map'); setTimeout(function () { JW.openSpot(id); }, 60); }
  function goMap(fn) { show('map'); if (fn) setTimeout(fn, 60); }

  // ---------------- 分类：三种玩法 + 专题 + 路线 ----------------
  var PLAYS = [
    { key: 'classic', name: '拍同款', en: 'SAME SHOT', desc: '站到同一个位置，复刻剧里、课本里、钞票上的那一幕', color: '#C8553D',
      icon: '<svg viewBox="0 0 32 32"><rect x="4" y="7" width="17" height="13" rx="2"/><rect x="11" y="12" width="17" height="13" rx="2"/></svg>' },
    { key: 'skill', name: '拍大片', en: 'MASTER SHOT', desc: '构图、焦段、姿势、后期都教你，普通地方也能出片', color: '#D98C2B',
      icon: '<svg viewBox="0 0 32 32"><path d="M5 11h5l2-3h8l2 3h5v14H5z"/><circle cx="16" cy="17.5" r="4.5"/></svg>' },
    { key: 'wonder', name: '等奇观', en: 'RARE MOMENT', desc: '穿月、悬日：算好哪天哪一分钟，一年只等几次', color: '#2B3A67',
      icon: '<svg viewBox="0 0 32 32"><circle cx="21" cy="9" r="4.5"/><path d="M8 28V12h4v16M14 28V6h4v22M4 28h24"/></svg>' }
  ];
  var TOPICS = [
    { key: 'film', color: '#C8553D' }, { key: 'textbook', color: '#2B3A67' }, { key: 'rmb', color: '#8A6A2E' }
  ];
  function topicInfo(k) { var c = window.JW_DATA.collections[k] || {}; return { name: c.name || k, desc: c.desc || '' }; }
  var CATS = PLAYS.map(function (p) {
    return { key: p.key, name: p.name, desc: p.desc, color: p.color, wonder: p.key === 'wonder', test: function (s) { return s.type === p.key; } };
  }).concat(TOPICS.map(function (t) {
    var i = topicInfo(t.key);
    return { key: t.key, name: i.name, desc: i.desc, color: t.color, test: function (s) { return s.collection === t.key; } };
  })).concat([
    { key: 'route', name: '机位路线', desc: '按光线和地形排好顺序', color: '#2F7D6D', route: true },
    { key: 'ugc', name: '网友上传', desc: '最新发现的好角度', color: '#6B625A', test: function (s) { return !!s.rowId; } }
  ]);
  function catBy(k) { return CATS.filter(function (c) { return c.key === k; })[0]; }
  function catCount(c) {
    if (c.route) return window.JW_DATA.routes.length;
    var n = allSpots().filter(c.test).length;
    return c.wonder ? n + window.JW_DATA.wonders.length : n;
  }

  // ---------------- 此刻 · 我身边 ----------------
  var FALLBACK = [121.5064, 31.2451], lastPos = null;
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function dur(ms) { var m = Math.max(1, Math.round(ms / 60000)); return m < 60 ? m + ' 分钟' : Math.floor(m / 60) + ' 小时' + (m % 60 ? ' ' + (m % 60) + ' 分' : ''); }
  // 用太阳位置说清楚“现在是什么光”
  function nowCtx(p) {
    var now = new Date(), A = window.Astro, t = A.dayTimes(now, p[1], p[0]);
    var gEnd = new Date(t.sunset.getTime() + 15 * 60000);
    if (now < t.sunrise) return { title: '天还没亮 · 日出 ' + hm(t.sunrise), sub: '再过 ' + dur(t.sunrise - now) + ' 日出；夜景机位还能再拍一会儿。' };
    if (now < t.goldenStart) return { title: '距离日落还有 ' + dur(t.sunset - now), sub: '日落 ' + hm(t.sunset) + '，黄金时刻 ' + hm(t.goldenStart) + ' 开始。现在适合需要白天的机位。' };
    if (now <= gEnd) return { title: '黄金时刻进行中', sub: '日落 ' + hm(t.sunset) + '，光线最柔和的时候，赶紧出发。' };
    if (now < t.blueEnd) return { title: '蓝调时刻 · 夜景马上开拍', sub: '天在 ' + hm(t.blueEnd) + ' 左右完全黑下来，楼体灯光正亮起。' };
    return { title: '夜景时间', sub: '城市灯光已经亮起，夜景机位正是时候。明天日出 ' + hm(A.dayTimes(new Date(now.getTime() + 86400000), p[1], p[0]).sunrise) + '。' };
  }
  var RANK = { ok: 0, wait: 1, bad: 2 }, BADGE = { ok: '现在正好', wait: '稍后更好', bad: '今天错过' };
  function nearbyNow(p, n) {
    var now = new Date();
    return allSpots().map(function (s) { var lc = JW.lightCheck(s, now); return { s: s, d: haversine(p, [s.lng, s.lat]), cls: lc.cls || 'wait', text: lc.text }; })
      .sort(function (a, b) { return a.d - b.d; }).slice(0, n || 30);
  }
  function badge(cls) { return '<span class="badge ' + cls + '">' + BADGE[cls] + '</span>'; }
  function nowCard() {
    var p = lastPos || FALLBACK, c = nowCtx(p);
    var top = nearbyNow(p, 12).sort(function (a, b) { return (RANK[a.cls] - RANK[b.cls]) || (a.d - b.d); }).slice(0, 3);
    return '<div class="now" id="nowCard"><div class="now-h"><b>此刻 · 我身边</b><span>' + (lastPos ? '按你的位置' : '以上海陆家嘴为例') + ' · ' + hm(new Date()) + '</span></div>' +
      '<div class="now-time">' + esc(c.title) + '</div><p class="now-sub">' + esc(c.sub) + '</p>' +
      '<div class="now-list">' + top.map(function (x) {
        return '<button class="now-item" data-spot="' + esc(x.s.id) + '"><div class="ni-img">' + coverHtml(x.s) + '</div><div class="ni-t"><b>' + esc(x.s.name) + '</b><span>' + badge(x.cls) + esc(JW.TYPE_NAME[x.s.type] || '') + '</span></div><em>' + km(x.d) + '</em></button>';
      }).join('') + '</div>' +
      '<div class="btn-row"><button class="btn-main" data-go="nearby">' + (lastPos ? '看更多身边机位' : '定位，看我身边的机位') + '</button><button class="btn-ghost" data-go="map">打开地图</button></div></div>';
  }

  // ---------------- 首页 ----------------
  function topicArt(k, color) {
    var bg = '<rect width="320" height="400" fill="' + color + '"/><circle cx="260" cy="70" r="120" fill="#fff" opacity=".08"/>';
    var fg = {
      film: '<g fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="3"><rect x="40" y="70" width="240" height="150" rx="6"/></g><g fill="#fff" opacity=".35">' + [0,1,2,3,4,5,6,7].map(function (i) { return '<rect x="' + (50 + i * 29) + '" y="78" width="16" height="10" rx="2"/><rect x="' + (50 + i * 29) + '" y="202" width="16" height="10" rx="2"/>'; }).join('') + '</g><path d="M140 125v40l34-20z" fill="#fff" opacity=".6"/>',
      textbook: '<g fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="3"><path d="M160 90c-30-16-70-18-110-10v140c40-8 80-6 110 10 30-16 70-18 110-10V80c-40-8-80-6-110 10zM160 90v140"/></g><path d="M70 190l30-40 22 24 18-16 20 32" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="3"/>',
      rmb: '<g fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="3"><rect x="40" y="90" width="240" height="120" rx="8"/><circle cx="100" cy="150" r="30"/></g><path d="M160 180l26-46 22 30 16-18 24 34" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="3"/><text x="258" y="120" fill="#fff" opacity=".6" font-size="22" font-weight="700" text-anchor="end">¥</text>'
    }[k] || '';
    return '<svg class="t-art" viewBox="0 0 320 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' + bg + fg + '</svg>';
  }
  function routeCard(r) {
    var names = r.spotIds.map(function (id) { var s = JW.spotById[id]; return s ? s.name.replace(/[（(].*$/, '').slice(0, 8) : id; });
    return '<button class="route-card" data-spot="r:' + esc(r.id) + '"><b>' + esc(r.name) + '</b><span>' + esc(r.advice || '') + '</span>' +
      '<div class="route-dots">' + names.map(function (_, i) { return (i ? '<s></s>' : '') + '<i></i>'; }).join('') + '</div>' +
      '<div class="route-names">' + names.map(function (n) { return '<span>' + esc(n) + '</span>'; }).join('') + '</div></button>';
  }
  function renderHome() {
    var ugc = allSpots().filter(function (s) { return s.rowId; }).slice(0, 8);
    var loggedIn = Cloud && Cloud.enabled() && Cloud.me();
    $('vHome').innerHTML =
      '<header class="h-top"><div class="brand"><svg class="brand-mark" viewBox="0 0 160 160" width="30" height="30"><use href="#logoMark"/></svg><div class="brand-name">' + esc(window.JW_CONFIG.BRAND) + '</div></div>' +
      '<button class="btn-ghost btn-acc" data-go="account">' + (loggedIn ? esc(((Cloud.me().user_metadata || {}).nickname) || '我的') : '登录') + '</button></header>' +
      // 1 首屏
      '<section class="hero"><p class="eyebrow">拍照机位导航</p><h1>导航到<br>最美的那个角度</h1>' +
        '<p class="lead">普通导航把你送到“地点”就结束了。移步到位把你送到<b>站位</b>，告诉你<b>朝哪拍</b>、<b>几点来</b>、<b>怎么拍</b>。</p>' +
        nowCard() + '</section>' +
      // 2 三种玩法
      '<section class="sec"><div class="sec-h"><h2>三种玩法</h2><button class="link" data-go="cases">全部分类 ›</button></div><div class="plays">' +
        PLAYS.map(function (p) {
          var eg = p.key === 'wonder' ? window.JW_DATA.wonders.map(function (w) { return w.name; }) : allSpots().filter(function (s) { return s.type === p.key && !s.rowId; }).slice(0, 3).map(function (s) { return s.name.replace(/[（(].*$/, ''); });
          return '<button class="play" data-cat="' + p.key + '" style="--c:' + p.color + '"><div class="play-ic">' + p.icon + '</div><div class="play-t"><b>' + p.name + '<small>' + catCount(catBy(p.key)) + '</small></b><span>' + esc(p.desc) + '</span>' + (eg.length ? '<i>' + esc(eg.join(' · ')) + '</i>' : '') + '</div></button>';
        }).join('') + '</div></section>' +
      // 3 专题
      '<section class="sec"><div class="sec-h"><h2>专题</h2></div><div class="topics">' +
        TOPICS.map(function (t) { var i = topicInfo(t.key), c = catBy(t.key);
          return '<button class="topic" data-cat="' + t.key + '" style="--c:' + t.color + '">' + topicArt(t.key, t.color) + '<div class="t-txt"><div class="t-n">' + catCount(c) + ' 个机位</div><b>' + esc(i.name) + '</b><span>' + esc(i.desc) + '</span></div></button>';
        }).join('') + '</div></section>' +
      // 4 路线
      '<section class="sec"><div class="sec-h"><h2>路线</h2><button class="link" data-cat="route">全部 ›</button></div>' + window.JW_DATA.routes.slice(0, 3).map(routeCard).join('') + '</section>' +
      // 5 网友刚刚发现
      '<section class="sec"><div class="sec-h"><h2>网友刚刚发现</h2>' + (ugc.length ? '<button class="link" data-cat="ugc">更多 ›</button>' : '') + '</div>' +
        (ugc.length ? '<div class="strip">' + ugc.map(function (s) { return '<button class="card" data-spot="' + esc(s.id) + '"><div class="card-img">' + coverHtml(s) + '</div><b>' + esc(s.name) + '</b><span>' + esc(s.author ? s.author.name : '') + '</span></button>'; }).join('') + '</div>'
          : '<p class="muted">还没有人上传。<button class="link" data-go="upload">成为第一个</button></p>') + '</section>' +
      // 6 理念
      '<section class="idea"><p class="eyebrow">我们相信</p><h2>每一次打卡，都是对这个世界的一次巡礼。</h2><p>一张美照背后，是一段旅途、一个地标、一条路线、一段时光。移步到位把导航的终点，从“地点”改成“视角”。</p>' +
        '<div class="idea-3"><div><em>一个点</em><b>站位</b><span>精确到该站的那块地砖</span></div><div><em>一个朝向</em><b>取景框</b><span>地图上的扇形就是视野</span></div><div><em>一段时光</em><b>时间切面</b><span>日落、灯光、月亮、人流</span></div></div>' +
        '<div class="btn-row"><button class="btn-main" data-go="upload">＋ 上传我的机位</button><button class="btn-ghost" data-go="shareapp">分享移步到位</button><button class="btn-ghost" data-go="demo">▶ 看演示</button></div></section>' +
      '<footer class="h-foot">百度地图开发者创作大赛参赛作品 · 地图与路线能力由百度地图提供</footer>';
    bind($('vHome'));
  }

  // ---------------- 列表页：分类 / 身边 ----------------
  function openList(mode, catKey) {
    listMode = mode; show('list');
    var v = $('vList');
    if (mode === 'cases') {
      v.innerHTML = listHead('全部分类', '三种玩法 · 专题 · 路线') + '<div class="cat-grid wide">' + CATS.map(function (c) {
        return '<button class="cat" data-cat="' + c.key + '" style="--c:' + c.color + '"><span class="cat-n">' + catCount(c) + '</span><b>' + esc(c.name) + '</b><span>' + esc(c.desc) + '</span></button>';
      }).join('') + '</div>';
    } else if (mode === 'cat') {
      var c = catBy(catKey) || CATS[0];
      var tabs = '<nav class="tabs">' + CATS.map(function (x) { return '<button data-cat="' + x.key + '" class="' + (x.key === catKey ? 'on' : '') + '">' + esc(x.name) + '</button>'; }).join('') + '</nav>';
      var items;
      if (c.route) items = window.JW_DATA.routes.map(function (r) { return row({ id: 'r:' + r.id, name: r.name, sub: r.spotIds.length + ' 个机位 · ' + r.advice, color: c.color, art: JW.placeholder(r.spotIds.length + ' 个机位', 'route', false) }); });
      else items = (c.wonder ? window.JW_DATA.wonders.map(function (w) { return row({ id: 'w:' + w.id, name: w.name, sub: w.desc, color: c.color, art: JW.placeholder(w.name, 'wonder', true) }); }) : []).concat(allSpots().filter(c.test).map(function (s) { return spotRow(s); }));
      v.innerHTML = listHead(c.name, c.desc) + tabs + '<div class="rows">' + (items.join('') || '<p class="muted pad">这一类还没有机位，<button class="link" data-go="upload">上传第一个</button></p>') + '</div>';
    } else if (mode === 'nearby') {
      v.innerHTML = listHead('此刻 · 我身边', '正在获取你的位置…') + '<div id="nearBody"><p class="muted pad">第一次使用时，浏览器会询问是否允许获取位置，请点“允许”。</p></div>';
      locate(function (p, fallback) {
        if (!fallback) lastPos = p;
        var c = nowCtx(p), list = nearbyNow(p, 30);
        var good = list.filter(function (x) { return x.cls === 'ok'; }), later = list.filter(function (x) { return x.cls !== 'ok'; });
        v.querySelector('.l-sub').textContent = fallback ? '没拿到定位，先以上海陆家嘴为例' : '时间 + 地点：现在能拍的排在前面';
        var nr = function (x) { return row({ id: x.s.id, name: x.s.name, sub: BADGE[x.cls] + ' · ' + (x.s.area || '') + ' · ' + (JW.TYPE_NAME[x.s.type] || ''), dist: km(x.d), art: coverHtml(x.s) }); };
        $('nearBody').innerHTML = '<div class="now-bar"><b>' + esc(c.title) + '</b><span>' + esc(c.sub) + '</span></div>' +
          '<h3 class="grp">现在就能拍<small>' + good.length + ' 个</small></h3><div class="rows">' + (good.map(nr).join('') || '<p class="muted">附近暂时没有此刻合适的机位，看看下面稍后更好的。</p>') + '</div>' +
          '<h3 class="grp">晚点再来<small>' + later.length + ' 个</small></h3><div class="rows">' + later.map(nr).join('') + '</div>';
        bind($('nearBody'));
      });
    }
    bind(v);
  }
  function listHead(t, sub) { return '<header class="l-top"><button class="back" data-go="back" aria-label="返回">‹</button><div><h1>' + esc(t) + '</h1><p class="l-sub">' + esc(sub || '') + '</p></div></header>'; }
  function spotRow(s, dist) {
    var tags = [JW.TYPE_NAME[s.type], s.scene && s.scene.work ? '《' + s.scene.work + '》' : '', s.author ? '作者 ' + s.author.name : ''].filter(Boolean).join(' · ');
    return row({ id: s.id, name: s.name, sub: (s.area || '') + (tags ? ' · ' + tags : ''), dist: dist, art: coverHtml(s), color: JW.COLORS[s.type] });
  }
  function row(o) {
    return '<button class="row" data-spot="' + esc(o.id) + '"><div class="row-img">' + o.art + '</div><div class="row-t"><b>' + esc(o.name) + '</b><span>' + esc(o.sub || '') + '</span></div>' + (o.dist ? '<em>' + esc(o.dist) + '</em>' : '<i>›</i>') + '</button>';
  }
  function locate(cb) {
    var fallback = [121.5064, 31.2451];
    if (!navigator.geolocation) return cb(fallback, true);
    navigator.geolocation.getCurrentPosition(function (p) { cb(M.wgs2bd(p.coords.longitude, p.coords.latitude), false); }, function () { cb(fallback, true); }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 });
  }

  // ---------------- 个人主页 ----------------
  function renderProfile() {
    var v = $('vProfile');
    if (!(Cloud && Cloud.enabled())) { v.innerHTML = listHead('我的', '') + '<p class="pad muted">云端还没接好。</p>'; return bind(v); }
    var u = Cloud.me();
    if (!u) {
      v.innerHTML = listHead('我的', '') + '<div class="p-empty">' + heroArt() + '<h2>登录后开始你的巡礼</h2><p class="muted">上传你发现的机位（会署上你的名字），打卡复刻同款，生成带二维码的分享卡片。</p>' +
        '<div class="btn-row"><button class="btn-main" data-go="login">登录</button><button class="btn-ghost" data-go="signup">注册</button></div></div>';
      return bind(v);
    }
    var store = X.store, mySpots = store.spots.filter(function (s) { return s.ownerId === u.id; }), myCks = store.checkins.filter(function (c) { return c.userId === u.id; }).slice().reverse();
    var dist = 0; for (var i = 1; i < myCks.length; i++) dist += haversine([myCks[i - 1].lng, myCks[i - 1].lat], [myCks[i].lng, myCks[i].lat]);
    v.innerHTML = listHead('我的', '') + '<div class="p-body"><div class="p-card"><div class="avatar">' + esc(((u.user_metadata || {}).nickname || u.email || '我')[0]) + '</div><div class="p-id"><h2 id="pName">…</h2><p class="muted">' + esc(u.email || '') + '</p><p id="pHome"></p></div></div>' +
      '<div class="stats"><div><b>' + mySpots.length + '</b><span>上传机位</span></div><div><b>' + myCks.length + '</b><span>打卡</span></div><div><b>' + (dist / 1000).toFixed(1) + '</b><span>巡礼公里</span></div></div>' +
      '<div class="btn-row"><button class="btn-main" data-go="upload">＋ 上传机位</button><button class="btn-ghost" data-go="minemap">巡礼地图</button><button class="btn-ghost" data-go="shareapp">分享移步到位</button></div>' +
      '<h3>我上传的机位</h3>' + (mySpots.length ? '<div class="grid2">' + mySpots.map(function (s) {
        return '<div class="tile"><button class="tile-img" data-spot="' + esc(s.id) + '">' + coverHtml(s) + '</button><div class="tile-t"><b>' + esc(s.name) + '</b><span>' + (s.checkins || 0) + ' 次打卡</span></div><button class="tile-share" data-share="' + esc(s.id) + '">分享</button></div>';
      }).join('') + '</div>' : '<p class="muted">还没有上传。把你拍过的好角度分享出来吧。</p>') +
      '<h3>我的打卡</h3>' + (myCks.length ? '<div class="rows">' + myCks.map(function (c) {
        return '<button class="row" data-ck="' + esc(c.id) + '"><div class="row-img">' + (c.photo ? '<img loading="lazy" src="' + esc(c.photo) + '">' : JW.placeholder('打卡', 'classic', false)) + '</div><div class="row-t"><b>' + esc(c.spotName) + '</b><span>' + esc(c.date + ' ' + c.time) + ' · ' + (c.result === 'ok' ? '拍到了' : '没拍成') + (c.note ? ' · ' + esc(c.note) : '') + '</span></div><i>›</i></button>';
      }).join('') + '</div>' : '<p class="muted">还没有打卡。到了机位点“打卡”，这里会留下你的旅途、地标、路线和时光。</p>') +
      '<div class="btn-row p-foot"><button class="btn-ghost" data-go="editprofile">编辑资料</button><button class="btn-ghost" data-go="demo">▶ 看演示</button><button class="btn-ghost" data-go="logout">退出登录</button></div></div>';
    Cloud.profile(u.id).then(function (p) {
      p = p || {}; var n = $('pName'); if (!n) return;
      n.textContent = p.nickname || (u.user_metadata || {}).nickname || '未命名';
      $('pHome').innerHTML = p.homepage ? '<a href="' + esc(p.homepage) + '" target="_blank" rel="noopener">我的主页 ↗</a>' : '<button class="link" data-go="editprofile">添加个人主页</button>';
      bind($('pHome'));
    });
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
    root.querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function (e) { e.preventDefault(); go(b.getAttribute('data-go')); }; });
    root.querySelectorAll('[data-cat]').forEach(function (b) { b.onclick = function () { openList('cat', b.getAttribute('data-cat')); }; });
    root.querySelectorAll('[data-spot]').forEach(function (b) { b.onclick = function () { openItem(b.getAttribute('data-spot')); }; });
    root.querySelectorAll('[data-share]').forEach(function (b) { b.onclick = function () { var s = JW.spotById[b.getAttribute('data-share')]; if (s) X.share(s); }; });
    root.querySelectorAll('[data-ck]').forEach(function (b) { b.onclick = function () {
      var c = X.store.checkins.filter(function (x) { return String(x.id) === b.getAttribute('data-ck'); })[0]; if (!c) return;
      var s = JW.spotById[c.spotId]; if (s && c.photo) X.share(s, c.photo); else if (s) goSpot(s.id);
    }; });
  }
  function openItem(id) {
    if (id.indexOf('r:') === 0) return goMap(function () { JW.openRoute(id.slice(2)); });
    if (id.indexOf('w:') === 0) return goMap(function () { JW.openWonder(id.slice(2)); });
    goSpot(id);
  }
  function go(what) {
    if (what === 'map') return show('map');
    if (what === 'home') return show('home');
    if (what === 'back') return listMode === 'cat' && current === 'list' ? (listMode = null, show('home')) : show('home');
    if (what === 'nearby') return openList('nearby');
    if (what === 'cases') return openList('cases');
    if (what === 'account') return Cloud && Cloud.me() ? show('profile') : X.account('login');
    if (what === 'login') return X.account('login');
    if (what === 'signup') return X.account('signup');
    if (what === 'upload') { if (Cloud && Cloud.enabled() && !Cloud.me()) return X.account('login', '登录后上传的机位所有人都能看到，并署上你的名字'); return goMap(X.openUpload); }
    if (what === 'profile') return show('profile');
    if (what === 'minemap') return goMap(X.openMine);
    if (what === 'shareapp') return shareApp();
    if (what === 'demo') { show('map'); return setTimeout(function () { $('btnDemo').click(); }, 60); }
    if (what === 'editprofile') return editProfile();
    if (what === 'logout') { Cloud.signOut(); X.refreshAccountBtn(); X.loadCloud(); show('home'); JW.toast('已退出登录'); }
  }

  function init() {
    JW = window.JW; X = window.JWX;
    $('btnHome').addEventListener('click', function () { show('home'); });
    $('btnAccount').onclick = function () { go('account'); };
    document.querySelectorAll('#tabbar [data-tab]').forEach(function (b) { b.onclick = function () {
      var t = b.getAttribute('data-tab');
      if (t === 'upload') return go('upload');
      if (t === 'profile') return show('profile');
      show(t);
    }; });
    // 如果之前已经允许过定位，悄悄拿一次位置，首页“此刻 · 我身边”就按真实位置显示
    try { navigator.permissions && navigator.permissions.query({ name: 'geolocation' }).then(function (r) {
      if (r.state === 'granted') locate(function (p, fb) { if (!fb) { lastPos = p; if (current === 'home') renderHome(); } });
    }).catch(function () {}); } catch (e) {}
    // 每分钟刷新一次首页的时间
    setInterval(function () { if (current === 'home' && !document.hidden) { var y = $('vHome').scrollTop; renderHome(); $('vHome').scrollTop = y; } }, 60000);
    window.addEventListener('jw-data', function () { if (current === 'home') renderHome(); if (current === 'profile') renderProfile(); });
    if (Cloud && Cloud.onChange) Cloud.onChange(function () { if (current === 'home') renderHome(); });
    // 从分享二维码、邮件链接进来时直接进地图或个人页，其余情况先看首页
    if (/spot=/.test(startHash)) show('map');
    else if (/access_token=|error_description=/.test(startHash)) show('profile');
    else show('home');
  }
  window.Views = { show: show, openList: openList, shareApp: shareApp, goSpot: goSpot };
  if (window.JWX && window.JW && window.JW.ready) init(); else window.addEventListener('jw-ready', function () { setTimeout(init, 0); }, { once: true });
})();
