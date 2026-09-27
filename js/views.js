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
  }
  function goSpot(id) { show('map'); setTimeout(function () { JW.openSpot(id); }, 60); }
  function goMap(fn) { show('map'); if (fn) setTimeout(fn, 60); }

  // ---------------- 分类 ----------------
  var CATS = [
    { key: 'film', name: '影视名场面', desc: '剧里的那一幕，就在这个街角', color: '#C8553D', test: function (s) { return s.collection === 'film' || (s.scene && s.scene.source === '影视名场面'); } },
    { key: 'textbook', name: '课本里的世界', desc: '举起课本，对齐封面上的远方', color: '#2B3A67', test: function (s) { return s.collection === 'textbook' || (s.scene && s.scene.source === '课本封面'); } },
    { key: 'rmb', name: '人民币里的中国', desc: '集齐 5 张，点亮全国地图', color: '#8A6A2E', test: function (s) { return s.collection === 'rmb'; } },
    { key: 'skill', name: '技法出片', desc: '找得到，还要会拍', color: '#D98C2B', test: function (s) { return s.type === 'skill'; } },
    { key: 'wonder', name: '城市奇观', desc: '一年只有几次的对齐时刻', color: '#2B3A67', wonder: true },
    { key: 'route', name: '机位路线', desc: '按光线和地形排好顺序', color: '#2F7D6D', route: true },
    { key: 'ugc', name: '网友上传', desc: '最新发现的好角度', color: '#6B625A', test: function (s) { return !!s.rowId; } }
  ];
  function catCount(c) { if (c.wonder) return window.JW_DATA.wonders.length; if (c.route) return window.JW_DATA.routes.length; return allSpots().filter(c.test).length; }

  // ---------------- 首页 ----------------
  function heroArt() {
    return '<svg class="hero-art" viewBox="0 0 360 260" aria-hidden="true">' +
      '<defs><linearGradient id="hs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3D9A8"/><stop offset="1" stop-color="#F6F1E7"/></linearGradient>' +
      '<radialGradient id="hc" cx=".5" cy="1" r=".9"><stop offset="0" stop-color="#D98C2B" stop-opacity=".55"/><stop offset="1" stop-color="#D98C2B" stop-opacity="0"/></radialGradient></defs>' +
      '<rect width="360" height="260" rx="22" fill="url(#hs)"/>' +
      '<g stroke="#2A2521" stroke-opacity=".07">' + Array.apply(null, Array(9)).map(function (_, i) { return '<path d="M' + (i * 45) + ' 0V260M0 ' + (i * 32) + 'H360"/>'; }).join('') + '</g>' +
      '<circle cx="292" cy="58" r="20" fill="#2B3A67" opacity=".9"/>' +
      '<path d="M180 222 L96 70 A170 170 0 0 1 264 70 Z" fill="url(#hc)"/>' +
      '<path d="M180 222 L96 70 M180 222 L264 70" stroke="#D98C2B" stroke-width="2" stroke-dasharray="4 5"/>' +
      '<g fill="#2A2521" opacity=".18"><rect x="120" y="96" width="16" height="70"/><rect x="146" y="62" width="20" height="104"/><rect x="176" y="84" width="14" height="82"/><rect x="200" y="40" width="22" height="126"/><rect x="230" y="92" width="14" height="74"/></g>' +
      '<circle cx="180" cy="222" r="10" fill="#2A2521"/><circle cx="180" cy="222" r="22" fill="none" stroke="#2A2521" stroke-opacity=".25"/>' +
      '<g fill="none" stroke="#2A2521" stroke-width="4" stroke-linecap="round"><path d="M20 46V20h26M314 20h26v26M340 214v26h-26M46 240H20v-26"/></g></svg>';
  }
  function renderHome() {
    var ugc = allSpots().filter(function (s) { return s.rowId; }).slice(0, 8);
    var loggedIn = Cloud && Cloud.enabled() && Cloud.me();
    $('vHome').innerHTML =
      '<header class="h-top"><div class="brand"><svg class="brand-mark" viewBox="0 0 160 160" width="30" height="30"><use href="#logoMark"/></svg><div class="brand-name">' + esc(window.JW_CONFIG.BRAND) + '</div></div>' +
      '<button class="btn-ghost btn-acc" data-go="account">' + (loggedIn ? esc(((Cloud.me().user_metadata || {}).nickname) || '我的') : '登录') + '</button></header>' +
      '<section class="hero">' +
        '<p class="eyebrow">拍照机位导航</p>' +
        '<h1>导航到<br>最美的那个角度</h1>' +
        '<p class="lead">普通导航把你送到“地点”就结束了。移步到位把你送到<b>站位</b>，告诉你<b>朝哪拍</b>、<b>几点来</b>、<b>怎么拍</b>。</p>' +
        heroArt() +
        '<div class="hero-cta"><button class="btn-main" data-go="nearby">看看我身边的机位</button><button class="btn-ghost" data-go="map">打开机位地图</button></div>' +
      '</section>' +
      '<section class="pillars">' +
        pillar('一个点', '站位', '精确到你该站的那块地砖：路书一步一图，把你带到最后一米。', '#2A2521') +
        pillar('一个朝向', '取景框', '地图上的扇形就是取景框在大地上的影子：朝哪拍、顺光还是逆光，出发前就知道。', '#D98C2B') +
        pillar('一段时光', '时间切面', '日落、灯光、月亮、人流：同一个位置，不同时刻是完全不同的画面。', '#2B3A67') +
      '</section>' +
      '<section class="sec"><div class="sec-h"><h2>经典案例</h2><button class="link" data-go="cases">全部分类 ›</button></div>' +
        '<div class="cat-grid">' + CATS.map(function (c) {
          return '<button class="cat" data-cat="' + c.key + '" style="--c:' + c.color + '"><span class="cat-n">' + catCount(c) + '</span><b>' + esc(c.name) + '</b><span>' + esc(c.desc) + '</span></button>';
        }).join('') + '</div></section>' +
      (ugc.length ? '<section class="sec"><div class="sec-h"><h2>网友刚刚发现</h2><button class="link" data-cat="ugc">更多 ›</button></div><div class="strip">' +
        ugc.map(function (s) { return '<button class="card" data-spot="' + esc(s.id) + '"><div class="card-img">' + coverHtml(s) + '</div><b>' + esc(s.name) + '</b><span>' + esc(s.author ? s.author.name : '') + '</span></button>'; }).join('') + '</div></section>' : '') +
      '<section class="sec how"><h2>怎么用</h2><ol>' +
        '<li><b>发现</b>在地图或分类里找到一个机位，看站位、朝向和拍法。</li>' +
        '<li><b>看时机</b>结合日落、天气和开放时间，告诉你现在去合不合适。</li>' +
        '<li><b>移步</b>百度地图把你带到附近，路书和指南针带你站到位。</li>' +
        '<li><b>复刻与巡礼</b>叠加参考画面拍同款，打卡、生成分享卡片，也可以上传你的机位。</li>' +
      '</ol></section>' +
      '<section class="motto"><p>每一次打卡，都是对这个世界的一次巡礼。</p><p class="muted">一张美照背后，是一段旅途、一个地标、一条路线、一段时光。</p>' +
        '<div class="btn-row"><button class="btn-main" data-go="upload">＋ 上传我的机位</button><button class="btn-ghost" data-go="shareapp">分享移步到位</button><button class="btn-ghost" data-go="demo">▶ 看演示</button></div></section>' +
      '<footer class="h-foot">百度地图开发者创作大赛参赛作品 · 地图与路线能力由百度地图提供</footer>';
    bind($('vHome'));
  }
  function pillar(k, t, d, c) { return '<div class="pillar" style="--c:' + c + '"><span class="pk">' + k + '</span><b>' + t + '</b><p>' + d + '</p></div>'; }

  // ---------------- 列表页：分类 / 身边 ----------------
  function openList(mode, catKey) {
    listMode = mode; show('list');
    var v = $('vList');
    if (mode === 'cases') {
      v.innerHTML = listHead('经典案例', '按类别浏览') + '<div class="cat-grid wide">' + CATS.map(function (c) {
        return '<button class="cat" data-cat="' + c.key + '" style="--c:' + c.color + '"><span class="cat-n">' + catCount(c) + '</span><b>' + esc(c.name) + '</b><span>' + esc(c.desc) + '</span></button>';
      }).join('') + '</div>';
    } else if (mode === 'cat') {
      var c = CATS.filter(function (x) { return x.key === catKey; })[0];
      var tabs = '<nav class="tabs">' + CATS.map(function (x) { return '<button data-cat="' + x.key + '" class="' + (x.key === catKey ? 'on' : '') + '">' + esc(x.name) + '</button>'; }).join('') + '</nav>';
      var items;
      if (c.route) items = window.JW_DATA.routes.map(function (r) { return row({ id: 'r:' + r.id, name: r.name, sub: r.spotIds.length + ' 个机位 · ' + r.advice, color: c.color, art: JW.placeholder(r.spotIds.length + ' 个机位', 'route', false) }); });
      else if (c.wonder) items = window.JW_DATA.wonders.map(function (w) { return row({ id: 'w:' + w.id, name: w.name, sub: w.desc, color: c.color, art: JW.placeholder(w.name, 'wonder', true) }); });
      else items = allSpots().filter(c.test).map(function (s) { return spotRow(s); });
      v.innerHTML = listHead(c.name, c.desc) + tabs + '<div class="rows">' + (items.join('') || '<p class="muted pad">这一类还没有机位，<button class="link" data-go="upload">上传第一个</button></p>') + '</div>';
    } else if (mode === 'nearby') {
      v.innerHTML = listHead('我身边的机位', '正在获取你的位置…') + '<div class="rows" id="nearRows"><p class="muted pad">第一次使用时，浏览器会询问是否允许获取位置，请点“允许”。</p></div>';
      locate(function (p, fallback) {
        var list = allSpots().map(function (s) { return { s: s, d: haversine(p, [s.lng, s.lat]) }; }).sort(function (a, b) { return a.d - b.d; }).slice(0, 30);
        v.querySelector('.l-sub').textContent = fallback ? '没拿到定位，先以上海陆家嘴为例' : '按离你的距离排序';
        $('nearRows').innerHTML = list.map(function (x) { return spotRow(x.s, km(x.d)); }).join('');
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
