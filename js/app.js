// 机位地图 · 主程序
(function () {
  var CFG = window.JW_CONFIG, DATA = window.JW_DATA, M = window.JWMap, A = window.Astro, UX = window.JWUX;
  var COLORS = { classic: '#8fb82a', skill: '#8fb82a', wonder: '#6a5acd', route: '#8fb82a' };
  var TYPE_NAME = { classic: '拍同款', skill: '拍大片', wonder: '限定奇观', route: '路线' };
  var $ = function (id) { return document.getElementById(id); };
  var map, markers = {}, sel = [], walkInfo = null, filter = 'all', userMarker = null;
  var arrival = { spotId: null, routePlanned: false, routeFailed: false, distanceMeters: null, loading: false };
  var spotById = {}; DATA.spots.forEach(function (s) { spotById[s.id] = s; });

  // 演示用起点（示例坐标，真实使用时取手机定位）
  var DEMO_START = {
    '北外滩': { name: '国际客运中心站附近（示例起点）', p: [121.5000, 31.2590] },
    '陆家嘴': { name: '陆家嘴站附近（示例起点）', p: [121.5065, 31.2412] }
  };

  // ---------------- 小工具 ----------------
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hm(d) { return d ? pad(d.getHours()) + ':' + pad(d.getMinutes()) : '--:--'; }
  function md(d) { return (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
  function dur(ms) {
    var m = Math.round(Math.abs(ms) / 60000);
    return m >= 60 ? Math.floor(m / 60) + '小时' + (m % 60 ? (m % 60) + '分钟' : '') : m + '分钟';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function toast(msg, ms) {
    var t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, ms || 2600);
  }
  var WEEK = ['日', '一', '二', '三', '四', '五', '六'];

  // 占位图：没有实拍照片时显示，颜色随机位类型变化
  // 还没有实拍照片时的占位图：浅灰底 + 取景框 +“等你来拍”
  function placeholder(hint, type, dark) {
    var fg = dark ? '#ffffff' : '#0f0f0f';
    return '<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">' +
      '<rect width="400" height="300" fill="' + (dark ? '#26272a' : '#f1f1ee') + '"/>' +
      '<g fill="' + fg + '" fill-opacity=".07"><rect x="60" y="120" width="26" height="180"/><rect x="100" y="70" width="34" height="230"/><rect x="150" y="150" width="30" height="150"/><rect x="250" y="40" width="40" height="260"/><rect x="300" y="110" width="30" height="190"/></g>' +
      '<g fill="none" stroke="' + fg + '" stroke-opacity=".45" stroke-width="4" stroke-linecap="round"><path d="M40 70V40h30M330 40h30v30M360 230v30h-30M70 260H40v-30"/></g>' +
      '<text x="200" y="146" text-anchor="middle" font-size="30" font-weight="600" font-family="PingFang SC,Microsoft YaHei,sans-serif" fill="' + fg + '">等你来拍</text>' +
      '<text x="200" y="178" text-anchor="middle" font-size="14" font-family="PingFang SC,Microsoft YaHei,sans-serif" fill="' + fg + '" fill-opacity=".55">' + esc(String(hint || '上传第一张实拍').slice(0, 12)) + '</text></svg>';
  }
  function coverHtml(s, dark) {
    return s.cover ? '<img src="' + esc(s.cover) + '" alt="' + esc(s.name) + '">' : placeholder(s.coverHint, s.type, dark);
  }

  function markerSvg(type, on, count) {
    var c = COLORS[type] || '#8fb82a', r = on ? 13 : 9;
    return '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">' +
      (on ? '<circle cx="20" cy="20" r="19" fill="' + c + '" fill-opacity=".25"/>' : '') +
      '<circle cx="20" cy="20" r="' + r + '" fill="#ffffff" stroke="' + c + '" stroke-width="3"/>' +
      (count > 1 ? '<text x="20" y="24.5" text-anchor="middle" font-size="12" font-weight="700" font-family="Arial,sans-serif" fill="#0f0f0f">' + count + '</text>' : '<circle cx="20" cy="20" r="3.5" fill="' + c + '"/>') + '</svg>';
  }
  // 相近机位合并：不同用户上传的照片，定位相距 15 米以内的合并成一个点位
  var MERGE_M = 15;
  function sameView(a, b) { return M.distance([a.lng, a.lat], [b.lng, b.lat]) <= MERGE_M; }
  function clusters() {
    var list = DATA.spots.filter(visible).slice().sort(function (a, b) { return (b.cover ? 1 : 0) - (a.cover ? 1 : 0); }), out = [];
    list.forEach(function (s) {
      var c = out.filter(function (k) { return sameView(k.lead, s); })[0];
      if (c) c.members.push(s); else out.push({ lead: s, members: [s] });
    });
    return out;
  }
  function openCluster(c) {
    if (c.members.length < 2) return openSpot(c.lead.id);
    var s = c.lead; clearSel(); highlight(s.id, s.type, s.lng, s.lat); drawView(s); map.flyTo(s.lng, s.lat, 18);
    openSheet('<span class="tag">同一个机位</span><h2>' + esc(s.name) + '</h2><div class="muted">这里有 ' + c.members.length + ' 张照片，左右滑动看看 · <span id="galIdx">1</span> / ' + c.members.length + '</div>' +
      '<div class="gal" id="gal">' + c.members.map(function (m) {
        return '<figure class="gal-item"><div class="gal-img">' + coverHtml(m) + '</div><figcaption><b>' + esc(m.name) + '</b><span>' + esc(m.author ? m.author.name : (m.area || '')) + (m.photoMeta && m.photoMeta.time ? ' · ' + esc(m.photoMeta.time.slice(0, 10).replace(/:/g, '-')) : '') + '</span></figcaption>' +
          '<button class="gal-more" data-act="d:' + esc(m.id) + '">查看详情 ›</button></figure>';
      }).join('') + '</div>');
    var g = $('gal'); g.addEventListener('scroll', function () { var i = Math.round(g.scrollLeft / g.clientWidth) + 1; var el = $('galIdx'); if (el) el.textContent = Math.min(i, c.members.length); }, { passive: true });
    bindSheet(function (act) { if (act.indexOf('d:') === 0) openSpot(act.slice(2)); });
  }
  // ---------------- 光线条件判断（时间切面） ----------------
  function lightCheck(s, now) {
    now = now || new Date();
    var t = A.dayTimes(now, s.lat, s.lng), alt = A.sun(now, s.lat, s.lng).alt;
    var tm = new Date(now.getTime() + 86400000), t2 = A.dayTimes(tm, s.lat, s.lng);
    var res = { times: t };
    if (s.light === 'day') {
      if (alt > 3) { res.cls = 'ok'; res.text = '现在是白天，可以拍。距离日落（' + hm(t.sunset) + '）还有 ' + dur(t.sunset - now) + '。'; }
      else if (now < t.sunrise) { res.cls = 'wait'; res.text = '天还没亮，这个机位需要白天。日出 ' + hm(t.sunrise) + ' 后再拍。'; }
      else { res.cls = 'bad'; res.text = '天已经暗了，现在去拍不出来。建议明天 ' + hm(t2.sunrise) + ' 以后、' + hm(t2.goldenStart) + ' 以前来。'; }
    } else if (s.light === 'golden') {
      var gs = t.goldenStart, ge = new Date(t.sunset.getTime() + 15 * 60000);
      if (now < new Date(gs.getTime() - 20 * 60000)) { res.cls = 'wait'; res.text = '最佳时间是今天 ' + hm(gs) + '–' + hm(ge) + '（黄金时刻），还有 ' + dur(gs - now) + '，建议提前到。'; }
      else if (now <= ge) { res.cls = 'ok'; res.text = '正是黄金时刻，光线最柔和，日落 ' + hm(t.sunset) + '。'; }
      else { res.cls = 'bad'; res.text = '今天的黄金时刻已过。明天最佳 ' + hm(t2.goldenStart) + '–' + hm(new Date(t2.sunset.getTime() + 15 * 60000)) + '，或者现在改拍夜景机位。'; }
    } else if (s.light === 'night') {
      if (alt < -4) { res.cls = 'ok'; res.text = '天已经黑了，正是夜景时间。'; }
      else { res.cls = 'wait'; res.text = '天黑后效果更好：今天 ' + hm(t.blueEnd) + ' 左右天完全黑，还有 ' + dur(t.blueEnd - now) + '。'; }
    } else if (s.light === 'any') { res.cls = 'ok'; res.text = '白天夜晚都能拍。'; }
    else { res.cls = 'wait'; res.text = '光线条件待补充。'; }
    return res;
  }

  // ---------------- 地图与点 ----------------
  function clearSel() { sel.forEach(function (h) { map.remove(h); }); sel = []; map.clearWalk(); walkInfo = null; }
  function drawMarkers() {
    Object.keys(markers).forEach(function (id) { map.remove(markers[id]); });
    markers = {};
    clusters().forEach(function (c) {
      var s = c.lead;
      markers[s.id] = map.addMarker(s.lng, s.lat, markerSvg(s.type, false, c.members.length), 30, function () { openCluster(c); });
    });
    DATA.wonders.forEach(function (w) {
      if (filter !== 'all' && filter !== 'wonder') return;
      markers[w.id] = map.addMarker(w.target.lng, w.target.lat, markerSvg('wonder'), 34, function () { openWonder(w.id); });
    });
    renderSpotRail(); labelsSoon();
  }
  function visible(s) {
    if (filter === 'all') return true;
    if (filter.indexOf('c:') === 0) return window.JW_TOPIC(s, filter.slice(2));
    if (filter === 'mine') return !!s.mine;
    if (filter === 'route') return DATA.routes.some(function (r) { return r.spotIds.indexOf(s.id) >= 0; });
    return s.type === filter;
  }
  function highlight(id, type, lng, lat) {
    sel.push(map.addMarker(lng, lat, markerSvg(type, true), 46, null));
  }

  function renderSpotRail() {
    var rail = $('mapSpotRail'); if (!rail) return;
    var list = DATA.spots.filter(visible);
    rail.innerHTML = list.length ? list.map(function (s) {
      return '<button class="map-spot-card" data-spot="' + esc(s.id) + '"><span class="map-spot-type" style="background:' + COLORS[s.type] + '"></span><span><b>' + esc(s.name) + '</b><small>' + esc(s.area) + ' · ' + esc(TYPE_NAME[s.type]) + '</small></span></button>';
    }).join('') : '<div class="map-spot-empty">当前筛选下没有机位</div>';
    rail.querySelectorAll('[data-spot]').forEach(function (button) {
      button.addEventListener('click', function () { openSpot(button.getAttribute('data-spot')); });
    });
  }

  function renderSearchResults(query) {
    var results = $('mapSearchResults'); if (!results) return;
    var q = String(query || '').trim();
    if (!q) { results.innerHTML = ''; results.classList.remove('open'); return; }
    var list = UX.searchSpots(DATA.spots.filter(visible), q, 6);
    results.innerHTML = list.length ? list.map(function (s) {
      return '<button data-search-spot="' + esc(s.id) + '"><b>' + esc(s.name) + '</b><span>' + esc(s.area) + ' · ' + esc(TYPE_NAME[s.type]) + '</span></button>';
    }).join('') : '<div class="map-search-empty">没有匹配的机位，试试地点或城市名</div>';
    results.classList.add('open');
    results.querySelectorAll('[data-search-spot]').forEach(function (button) {
      button.addEventListener('click', function () {
        var spot = spotById[button.getAttribute('data-search-spot')];
        if (!spot) return;
        $('mapSearchInput').value = spot.name;
        results.classList.remove('open');
        openSpot(spot.id);
      });
    });
  }

  // 定位：取位置 → 地图上放蓝点 →（需要时）飞过去；首页“重新定位”和进地图时都用它
  function locateMe(opts, cb) {
    opts = opts || {};
    map.locate(function (p) {
      if (!p) { if (!opts.quiet) toast('暂时无法获取位置，请检查定位权限'); return cb && cb(null); }
      if (userMarker) map.remove(userMarker);
      userMarker = map.addMarker(p[0], p[1], '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="#3b6fb6" fill-opacity=".22"/><circle cx="16" cy="16" r="7" fill="#3b6fb6" stroke="#fff" stroke-width="3"/></svg>', 32, null);
      if (opts.fly !== false) map.flyTo(p[0], p[1], opts.zoom || 16);
      if (!opts.quiet) toast('已定位到你的位置');
      if (cb) cb(p);
    });
  }
  function locateOnMap() { locateMe({}); }

  // ---------------- 地图上的机位标签：照片 + 名称，引线连到机位点 ----------------
  var labelsRaf = 0;
  function labelsSoon() { if (labelsRaf) return; labelsRaf = setTimeout(function () { labelsRaf = 0; renderLabels(); }, 16); }
  function labelThumb(s) { return s.cover ? '<img src="' + esc(s.cover) + '" alt="">' : placeholder(s.coverHint || s.name, s.type, false); }
  // 热力图：每个机位画一团光晕，机位越密越“热”（浅青柠 → 黄 → 橙）
  var heatCanvas = null, heatRamp = null;
  function ramp() {
    if (heatRamp) return heatRamp;
    var c = document.createElement('canvas'); c.width = 256; c.height = 1; var g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 256, 0);
    gr.addColorStop(0, 'rgba(215,243,107,0)'); gr.addColorStop(.25, 'rgba(215,243,107,.55)'); gr.addColorStop(.55, 'rgba(250,214,70,.75)'); gr.addColorStop(.8, 'rgba(247,150,50,.85)'); gr.addColorStop(1, 'rgba(236,88,50,.9)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 1); heatRamp = g.getImageData(0, 0, 256, 1).data; return heatRamp;
  }
  function drawHeat(pts, W, H) {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    if (!heatCanvas) heatCanvas = document.createElement('canvas');
    heatCanvas.className = 'heat'; heatCanvas.width = W * dpr; heatCanvas.height = H * dpr; heatCanvas.style.width = W + 'px'; heatCanvas.style.height = H + 'px';
    var g = heatCanvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    var R = 46;
    pts.forEach(function (o) {
      var gr = g.createRadialGradient(o.x, o.y, 0, o.x, o.y, R); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(o.x, o.y, R, 0, 7); g.fill();
    });
    var img = g.getImageData(0, 0, heatCanvas.width, heatCanvas.height), d = img.data, rp = ramp();
    for (var i = 3; i < d.length; i += 4) { var a = d[i]; if (!a) continue; var k = Math.min(255, a) * 4; d[i - 3] = rp[k]; d[i - 2] = rp[k + 1]; d[i - 1] = rp[k + 2]; d[i] = rp[k + 3]; }
    g.putImageData(img, 0, 0);
    return heatCanvas;
  }
  function renderLabels() {
    var layer = $('mapLabels'); if (!layer || !map || !map.toPixel) return;
    if (!document.body.classList.contains('on-map')) { layer.innerHTML = ''; return; }
    var W = window.innerWidth, H = window.innerHeight, mobile = W < 900;
    var top = mobile ? 108 : 166, bottom = H - (mobile ? 190 : 110), right = mobile ? W : W - 430;
    var LW = 150, LH = 48, placed = [], html = '', lines = '';
    var all = DATA.spots.filter(visible).map(function (s) { var p = map.toPixel(s.lng, s.lat); return { s: s, x: p[0], y: p[1] }; })
      .filter(function (o) { return o.x > -60 && o.x < W + 60 && o.y > -60 && o.y < H + 60; });
    // 一个合并后的机位只出一个标签
    var cl = clusters(), pts = cl.map(function (c) { var p = map.toPixel(c.lead.lng, c.lead.lat); return { c: c, s: c.lead, x: p[0], y: p[1] }; })
      .filter(function (o) { return o.x > -20 && o.x < right + 20 && o.y > top - 20 && o.y < bottom + 20; });
    pts.forEach(function (o) { placed.push([o.x - 12, o.y - 12, o.x + 12, o.y + 12]); });
    pts.sort(function (a, b) { return (b.c.members.length - a.c.members.length) || ((b.s.cover ? 2 : 0) + (b.s.rowId ? 1 : 0) - (a.s.cover ? 2 : 0) - (a.s.rowId ? 1 : 0)); });
    var OFF = [[-LW - 26, -LH - 22], [26, -LH - 22], [-LW - 26, 22], [26, 22], [-LW / 2, -LH - 40], [-LW / 2, 40], [-LW - 40, -LH / 2], [40, -LH / 2]];
    function free(r) {
      if (r[0] < 6 || r[2] > right - 6 || r[1] < top || r[3] > bottom) return false;
      return !placed.some(function (q) { return r[0] < q[2] + 4 && r[2] > q[0] - 4 && r[1] < q[3] + 4 && r[3] > q[1] - 4; });
    }
    var n = 0, byLead = {};
    pts.forEach(function (o) {
      byLead[o.s.id] = o.c;
      if (n >= 16) return;
      for (var i = 0; i < OFF.length; i++) {
        var x = o.x + OFF[i][0], y = o.y + OFF[i][1], r = [x, y, x + LW, y + LH];
        if (!free(r)) continue;
        placed.push(r); n++;
        var ax = Math.max(x, Math.min(o.x, x + LW)), ay = o.y < y ? y : o.y > y + LH ? y + LH : y + LH / 2;
        lines += '<line x1="' + o.x.toFixed(1) + '" y1="' + o.y.toFixed(1) + '" x2="' + ax.toFixed(1) + '" y2="' + ay.toFixed(1) + '" stroke="rgba(15,15,15,.35)" stroke-width="1"/>';
        var cnt = o.c.members.length;
        html += '<button class="mlabel" data-lead="' + esc(o.s.id) + '" style="left:' + x.toFixed(0) + 'px;top:' + y.toFixed(0) + 'px"><span class="ml-img">' + labelThumb(o.s) + (cnt > 1 ? '<i class="ml-n">' + cnt + '</i>' : '') + '</span><b>' + esc(o.s.name) + '</b></button>';
        break;
      }
    });
    layer.innerHTML = '<svg class="ml-lines" width="' + W + '" height="' + H + '">' + lines + '</svg>' + html;
    layer.insertBefore(drawHeat(all, W, H), layer.firstChild);
    layer.querySelectorAll('[data-lead]').forEach(function (b) { b.addEventListener('click', function () { openCluster(byLead[b.getAttribute('data-lead')]); }); });
  }

  // 取景框在大地上的投影：从站位出发、沿朝向张开的扇形
  function drawView(s, radius) {
    if (s.heading == null) {
      var ring = []; for (var i = 0; i <= 36; i++) ring.push(M.offset(s.lng, s.lat, i * 10, 40));
      sel.push(map.line(ring, COLORS[s.type], 2, true)); // 朝天拍：画一个小圈
      return;
    }
    sel.push(map.polygon(M.sectorPoints(s.lng, s.lat, s.heading, s.fov || 70, radius || 900), COLORS[s.type], 0.18));
  }
  // 太阳方向线：白天画当前太阳方向，晚上画今天日落方向
  function drawSun(s) {
    var now = new Date(), sp = A.sun(now, s.lat, s.lng), t = A.dayTimes(now, s.lat, s.lng);
    var az = sp.alt > 0 ? sp.az : A.sun(t.sunset || now, s.lat, s.lng).az;
    sel.push(map.line([[s.lng, s.lat], M.offset(s.lng, s.lat, az, 700)], '#f0a431', 3, true));
    return { az: az, now: sp.alt > 0 };
  }

  // ---------------- 底部卡片 ----------------
  function openSheet(html) {
    $('sheet').classList.remove('tall'); $('sheetBody').innerHTML = html; $('sheetPrimary').innerHTML = '';
    $('sheet').classList.add('open'); $('sheet').setAttribute('aria-hidden', 'false');
    document.body.classList.add('sheet-open'); $('sheetBody').scrollTop = 0;
  }
  function closeSheet() {
    if (typeof stopNav === 'function' && NAV) stopNav(false);
    $('sheet').classList.remove('open', 'tall'); $('sheet').setAttribute('aria-hidden', 'true');
    $('sheetPrimary').innerHTML = ''; document.body.classList.remove('sheet-open'); clearSel();
    arrival = { spotId: null, routePlanned: false, routeFailed: false, distanceMeters: null, loading: false };
  }

  function renderArrivalPrimary(s) {
    var footer = $('sheetPrimary');
    var hasGuide = !!(s.guide && s.guide.length), phase = UX.navigationPhase({
      routePlanned: arrival.routePlanned, routeFailed: arrival.routeFailed,
      distanceMeters: arrival.distanceMeters, hasGuide: hasGuide
    });
    footer.innerHTML = '<button class="btn-main arrival-primary" id="arrivalPrimary"' + (arrival.loading ? ' disabled' : '') + '>' +
      (arrival.loading ? '正在规划路线…' : esc(phase.label)) + '</button><div class="arrival-hint">' + esc(arrival.loading ? '正在获取你的位置' : phase.hint) + '</div>';
    $('arrivalPrimary').addEventListener('click', function () {
      if (phase.phase === 'plan') startWalkNav(s);
      else openGuide(s);
    });
  }

  function relation(heading, sunAz) {
    if (heading == null) return '';
    var d = Math.abs(((heading - sunAz) % 360 + 540) % 360 - 180);
    return d < 45 ? '逆光（太阳在画面方向）' : d > 135 ? '顺光（太阳在身后）' : '侧光';
  }

  function openSpot(id) {
    var s = spotById[id]; if (!s) return;
    arrival = { spotId: s.id, routePlanned: false, routeFailed: false, distanceMeters: null, loading: false };
    clearSel(); highlight(s.id, s.type, s.lng, s.lat); drawView(s);
    var sun = drawSun(s), lc = lightCheck(s), t = lc.times, tech = s.technique || {};
    map.flyTo(s.lng, s.lat, s.collection === 'rmb' ? 12 : 17);
    var techRows = [['手机姿势', tech.pose], ['镜头', tech.lens], ['朝向', tech.facing], ['后期', tech.post], ['道具', tech.prop]]
      .filter(function (r) { return r[1]; }).map(function (r) { return '<div><b>' + r[0] + '</b>' + esc(r[1]) + '</div>'; }).join('');
    var guide = (s.guide || []).map(function (g) { return '<li>' + (g.photo ? '<img class="step-img" loading="lazy" src="' + esc(g.photo) + '" alt="">' : '') + esc(g.text) + '</li>'; }).join('');
    var rel = relation(s.heading, sun.az);
    openSheet(
      '<span class="tag ' + s.type + '">' + TYPE_NAME[s.type] + '</span>' + (s.marker ? '<span class="tag soft">' + esc(s.marker) + '</span>' : '') +
      (s.collection ? '<span class="tag soft">' + esc(DATA.collections[s.collection].name) + '</span>' : '') +
      '<h2>' + esc(s.name) + '</h2><div class="muted">' + esc(s.area) + (s.heading != null ? ' · 镜头朝向 ' + Math.round(s.heading) + '°' : ' · 镜头朝天') + '</div>' +
      '<div class="rx-row" data-rxbox="' + esc(s.id) + '">' + (window.Social ? window.Social.buttons(s.id) : '') + '</div>' +
      '<div class="cover">' + coverHtml(s) + '</div>' +
      (s.post ? '<div class="post">' + esc(s.post).replace(/\n/g, '<br>') + '</div>' : '<p>' + esc(s.summary) + '</p>') +
      (s.tags && s.tags.length ? '<div class="post-tags">' + s.tags.map(function (t) { return '<span>#' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
      photoMetaHtml(s) + sceneHtml(s) +
      '<div class="cond ' + lc.cls + '"><span class="dot"></span><div>' + esc(lc.text) + (s.lightNote ? '<br><span class="muted">' + esc(s.lightNote) + '</span>' : '') + '</div></div>' +
      '<div class="btn-row">' +
        '<button class="btn-ghost" data-act="copy">预览拍法</button><button class="btn-ghost" data-act="share">分享</button>' +
      '</div><div id="walkBox"></div>' +
      (techRows ? '<h3>拍法</h3><div class="tech">' + techRows + '</div>' : '') +
      '<h3>时间切面 · 今天（' + md(new Date()) + ' 周' + WEEK[new Date().getDay()] + '）</h3>' +
      '<div class="kv"><span>日出 / 日落</span><span>' + hm(t.sunrise) + ' / ' + hm(t.sunset) + '</span></div>' +
      '<div class="kv"><span>黄金时刻</span><span>' + hm(t.goldenStart) + ' – ' + hm(t.sunset) + '</span></div>' +
      '<div class="kv"><span>天完全黑</span><span>' + hm(t.blueEnd) + '</span></div>' +
      (rel ? '<div class="kv"><span>' + (sun.now ? '此刻光线' : '日落时光线') + '</span><span>' + rel + '</span></div>' : '') +
      '<p class="muted">地图上的橙色虚线是' + (sun.now ? '此刻太阳' : '今天日落') + '的方向，扇形是取景框投影到地面上的范围。</p>' +
      (guide ? '<h3>最后一段路书</h3><ol class="steps">' + guide + '</ol>' : '') +
      '<h3>进入与规则</h3>' +
      '<div class="kv"><span>费用</span><span>' + esc(s.access.fee || '待补充') + '</span></div>' +
      '<div class="kv"><span>开放时间</span><span>' + esc(s.access.hours || '待补充') + '</span></div>' +
      (s.access.booking ? '<div class="kv"><span>预约</span><span>' + esc(s.access.booking) + '</span></div>' : '') +
      (s.crowd ? '<div class="kv"><span>人流</span><span>' + esc(s.crowd) + '</span></div>' : '') +
      '<h3>状态</h3><div class="kv"><span>最近确认</span><span>' + esc(s.status.date || '暂无') + (s.status.note ? ' · ' + esc(s.status.note) : '') + '</span></div>' +
      '<div class="kv"><span>打卡</span><span>' + (s.checkins || 0) + ' 次' + (s.best ? ' · ' + esc(s.best) : '') + '</span></div>' +
      (s.author ? '<div class="kv"><span>机位作者</span><span>' + (s.author.homepage && /^https?:\/\//.test(s.author.homepage) ? '<a href="' + esc(s.author.homepage) + '" target="_blank" rel="noopener">' + esc(s.author.name) + '</a>' : esc(s.author.name)) + '</span></div>' : '') +
      '<p class="muted">来源：' + esc(s.source || '') + '</p>'
    );
    renderArrivalPrimary(s);
    bindSheet(function (act) {
      if (act === 'copy') window.JWX && window.JWX.camera(s);
      if (act === 'share') window.JWX && window.JWX.share(s);
    });
  }
  // 作者照片里的拍摄信息：时间、设备、相机参数
  function photoMetaHtml(s) {
    var m = s.photoMeta; if (!m) return '';
    var cam = [m.focal ? Math.round(m.focal * 10) / 10 + 'mm' : '', m.f35 ? '等效 ' + m.f35 + 'mm' : '', m.fnum ? 'f/' + Math.round(m.fnum * 10) / 10 : '', m.exposure ? (m.exposure >= 0.3 ? (+m.exposure).toFixed(1) + 's' : '1/' + Math.round(1 / m.exposure) + 's') : '', m.iso ? 'ISO ' + m.iso : ''].filter(Boolean).join(' · ');
    var rows = [['拍摄地点', m.place], ['拍摄时间', m.time ? m.time.replace(/^(\d+):(\d+):(\d+)/, '$1-$2-$3') : ''], ['拍摄设备', m.device], ['相机参数', cam], ['镜头', m.lens]].filter(function (r) { return r[1]; });
    return rows.length ? '<div class="meta-card">' + rows.map(function (r) { return '<div><span>' + r[0] + '</span><b>' + esc(r[1]) + '</b></div>'; }).join('') + '</div>' : '';
  }
  // 名场面信息：来源作品、场景、台词、剧中地点 vs 实际拍摄地
  function sceneHtml(s) {
    var r = s.scene; if (!r) return '';
    return '<div class="scene"><div class="scene-src">' + esc(r.source || '') + (r.work ? ' ·《' + esc(r.work) + '》' : '') + '</div>' +
      (r.moment ? '<div class="scene-moment">' + esc(r.moment) + '</div>' : '') +
      (r.line ? '<div class="scene-line">“' + esc(r.line) + '”</div>' : '') +
      (r.storyPlace || r.realPlace ? '<div class="scene-place"><span>剧中</span>' + esc(r.storyPlace || '—') + '<span>实际</span>' + esc(r.realPlace || '—') + '</div>' : '') + '</div>';
  }
  function bindSheet(fn) {
    $('sheetBody').querySelectorAll('[data-act]').forEach(function (b) {
      b.addEventListener('click', function () { fn(b.getAttribute('data-act'), b); });
    });
  }

  // 导航：先取手机定位，失败就用示例起点
  function navigate(s, forceDemo, cb) {
    var box = $('walkBox');
    arrival.loading = true; renderArrivalPrimary(s);
    function go(from, label) {
      if (arrival.spotId !== s.id) return;
      var distance = M.distance(from, [s.lng, s.lat]);
      map.walk(from, [s.lng, s.lat], function (r) {
        if (arrival.spotId !== s.id) return;
        arrival.loading = false; arrival.routePlanned = !!r; arrival.routeFailed = !r; arrival.distanceMeters = distance;
        if (box) box.innerHTML = r
          ? '<div class="arrival-progress' + (!(s.guide && s.guide.length) ? ' compact' : '') + '"><span class="done"><i>1</i>路线导航</span><b></b>' + (s.guide && s.guide.length ? '<span><i>2</i>最后100米</span><b></b><span><i>3</i>站位构图</span>' : '<span><i>2</i>站位构图</span>') + '</div><div class="cond ok"><span class="dot"></span><div>从' + esc(label) + '步行 ' + esc(r.distance) + '，约 ' + esc(r.duration) + '。先沿地图路线前往，到附近后点击下方按钮继续。</div></div>'
          : '<div class="cond bad"><span class="dot"></span><div>路线规划失败，可以直接' + (s.guide && s.guide.length ? '进入最后一段路书' : '开始站位与构图') + '。</div></div>';
        renderArrivalPrimary(s);
        if (cb) cb(r);
      });
    }
    var demo = DEMO_START[s.area] || { name: '示例起点', p: M.offset(s.lng, s.lat, 200, 600) };
    if (forceDemo) return go(demo.p, demo.name);
    if (box) box.innerHTML = '<p class="muted">正在获取你的位置…</p>';
    map.locate(function (p) {
      if (arrival.spotId !== s.id) return;
      if (p && M.distance(p, [s.lng, s.lat]) < 30000) go(p, '你的位置');
      else { toast('没拿到附近的定位，用示例起点演示'); go(demo.p, demo.name); }
    });
  }

  // ---------------- 步行导航：百度步行路线 + 实时定位，到附近后自动进入路书 ----------------
  var NAV = null, ARRIVE_M = 50;
  function setUserMarker(p) {
    if (userMarker) map.remove(userMarker);
    userMarker = map.addMarker(p[0], p[1], '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="#3b6fb6" fill-opacity=".22"/><circle cx="16" cy="16" r="7" fill="#3b6fb6" stroke="#fff" stroke-width="3"/></svg>', 32, null);
  }
  function fmtM(m) { return m < 1000 ? Math.round(m) + ' 米' : (m / 1000).toFixed(1) + ' 公里'; }
  function baiduAppLink(s, from) {
    return 'https://api.map.baidu.com/direction?origin=latlng:' + from[1] + ',' + from[0] + '|name:' + encodeURIComponent('我的位置') +
      '&destination=latlng:' + s.lat + ',' + s.lng + '|name:' + encodeURIComponent(s.name) + '&mode=walking&coord_type=bd09ll&output=html&src=webapp.yibudaowei.navi';
  }
  function startWalkNav(s) {
    arrival.loading = true; renderArrivalPrimary(s);
    var demo = DEMO_START[s.area] || { name: '示例起点', p: M.offset(s.lng, s.lat, 200, 600) };
    map.locate(function (p) {
      if (arrival.spotId !== s.id) return;
      var live = !!(p && M.distance(p, [s.lng, s.lat]) < 30000), from = live ? p : demo.p;
      if (!live) toast(p ? '你离这个机位超过 30 公里，先用示例起点演示导航' : '没拿到定位，先用示例起点演示导航', 3500);
      map.walk(from, [s.lng, s.lat], function (r) {
        arrival.loading = false;
        if (!r) { arrival.routeFailed = true; renderArrivalPrimary(s); toast('步行路线规划失败，可以直接用路书找站位', 3500); return; }
        arrival.routePlanned = true; arrival.distanceMeters = M.distance(from, [s.lng, s.lat]); renderArrivalPrimary(s);
        NAV = { s: s, live: live, from: from, r: r, step: 0, watch: null, arrived: false };
        setUserMarker(from);
        // 把起点和机位都放进画面，并给底部导航条留出位置
        var dd = M.distance(from, [s.lng, s.lat]), z = dd < 300 ? 17 : dd < 800 ? 16 : dd < 2000 ? 15 : 14;
        if (map.center) setTimeout(function () { map.center((from[0] + s.lng) / 2, (from[1] + s.lat) / 2 - dd / 110540 * 0.35, z); }, 300);
        $('sheet').classList.add('lowered'); document.body.classList.add('navigating');
        renderNav(M.distance(from, [s.lng, s.lat]));
        if (live && navigator.geolocation) {
          NAV.watch = navigator.geolocation.watchPosition(function (pos) {
            if (!NAV) return;
            var q = M.wgs2bd(pos.coords.longitude, pos.coords.latitude); setUserMarker(q);
            // 走到下一步的拐点附近，就切到下一条提示
            var st = NAV.r.steps;
            while (NAV.step < st.length - 1 && st[NAV.step + 1].pos && M.distance(q, st[NAV.step + 1].pos) < 20) NAV.step++;
            var left = M.distance(q, [s.lng, s.lat]);
            renderNav(left);
            if (left <= ARRIVE_M && !NAV.arrived) arriveNav();
          }, function () {}, { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 });
        }
      });
    });
  }
  function renderNav(left) {
    var bar = $('navBar'); if (!bar || !NAV) return;
    var st = NAV.r.steps || [], cur = st[NAV.step] ? st[NAV.step].text : '沿地图上的路线步行';
    var mins = Math.max(1, Math.round(left / 70));
    bar.innerHTML = '<div class="nav-top"><span class="nav-tag">' + (NAV.live ? '步行导航中' : '演示导航') + '</span><span class="nav-left">距机位 ' + fmtM(left) + ' · 约 ' + mins + ' 分钟</span></div>' +
      '<div class="nav-step">' + esc(cur) + '</div>' +
      (st.length > 1 ? '<div class="nav-next">共 ' + st.length + ' 步 · 第 ' + (NAV.step + 1) + ' 步' + (st[NAV.step + 1] ? ' · 下一步：' + esc(st[NAV.step + 1].text) : '') + '</div>' : '') +
      '<div class="nav-btns"><button class="btn-ghost" id="navExit">退出</button><a class="btn-ghost" id="navApp" href="' + esc(baiduAppLink(NAV.s, NAV.from)) + '" target="_blank" rel="noopener">用百度地图App</a><button class="btn-main" id="navArrive">我已到附近</button></div>';
    $('navExit').onclick = function () { stopNav(true); };
    $('navArrive').onclick = arriveNav;
  }
  function stopNav(restoreSheet) {
    if (NAV && NAV.watch != null && navigator.geolocation) navigator.geolocation.clearWatch(NAV.watch);
    NAV = null; document.body.classList.remove('navigating'); var bar = $('navBar'); if (bar) bar.innerHTML = '';
    if (restoreSheet) $('sheet').classList.remove('lowered');
  }
  function arriveNav() {
    if (!NAV) return; var s = NAV.s; NAV.arrived = true;
    stopNav(false); $('sheet').classList.remove('lowered');
    arrival.distanceMeters = 0; renderArrivalPrimary(s);
    var hasGuide = !!(s.guide && s.guide.length);
    toast(hasGuide ? '已到附近，按路书找准站位' : '已到附近，这个机位没有路书，直接对准朝向开拍', 3000);
    openGuide(s);
  }

  // ---------------- 路书模式（全屏） ----------------
  var G = { steps: [], i: 0, spot: null, onDone: null };
  function openGuide(s, onDone) {
    var steps = (s.guide || []).map(function (g) { return { kind: 'walk', text: g.text, photo: g.photo }; });
    steps.push({ kind: 'frame' });
    G = { steps: steps, i: 0, spot: s, onDone: onDone || null };
    $('guide').classList.add('open'); $('guide').setAttribute('aria-hidden', 'false'); document.body.classList.add('guiding');
    renderGuide();
  }
  function closeGuide() {
    $('guide').classList.remove('open'); $('guide').setAttribute('aria-hidden', 'true'); document.body.classList.remove('guiding'); stopCompass();
    var cb = G.onDone; G.onDone = null; if (cb) cb();
  }
  function renderGuide() {
    var st = G.steps[G.i], s = G.spot;
    $('guideProgress').innerHTML = G.steps.map(function (_, k) { return '<i class="' + (k <= G.i ? 'on' : '') + '"></i>'; }).join('');
    $('guidePrev').style.visibility = G.i ? 'visible' : 'hidden';
    if (st.kind === 'walk') {
      stopCompass();
      $('guideStage').innerHTML = '<div class="guide-photo">' + (st.photo ? '<img src="' + esc(st.photo) + '">' : placeholder('第 ' + (G.i + 1) + ' 步 · 指路照片', s.type, true)) + '</div>' +
        '<div class="guide-text">' + (G.i + 1) + '. ' + esc(st.text) + '</div>' +
        '<div class="guide-sub">照片里的箭头就是要走的方向。现场定位误差较大，走到照片里的位置后，点“我到了”。</div>';
      $('guideNext').textContent = G.i === G.steps.length - 2 ? '到站位了，开始构图' : '我到了，下一步';
    } else {
      var t = s.technique || {};
      $('guideStage').innerHTML =
        '<div class="compass" id="compass"><div class="ring"></div><div class="target" id="cTarget"></div><div class="me"></div><div class="deg" id="cDeg">' + (s.heading == null ? '朝天' : Math.round(s.heading) + '°') + '</div></div>' +
        '<div class="guide-text" id="cTip">' + (s.heading == null ? '镜头朝天，' + esc(t.facing || '') : '把手机转向 ' + Math.round(s.heading) + '°（' + dirName(s.heading) + '）') + '</div>' +
        '<div class="guide-sub">' + [t.pose, t.lens, t.post ? '后期：' + t.post : '', t.prop ? '道具：' + t.prop : ''].filter(Boolean).map(esc).join(' · ') +
        '<br><br><button class="btn-ghost dark" id="guideCam" style="margin-top:12px">打开相机，叠加参考画面对齐</button></div>';
      $('guideNext').textContent = '完成，去打卡';
      startCompass(s.heading);
      var gc = $('guideCam'); if (gc) gc.addEventListener('click', function () { if (window.JWX) window.JWX.camera(s); });
    }
  }
  function dirName(h) { return ['北', '东北', '东', '东南', '南', '西南', '西', '西北'][Math.round(h / 45) % 8]; }
  function guideNext() {
    if (G.i < G.steps.length - 1) { G.i++; renderGuide(); } else { var sp = G.spot; closeGuide(); if (!DEMO.on && window.JWX) window.JWX.checkin(sp); }
  }

  // 指南针：手机上读取朝向，提示还要转多少度
  var compassOn = false;
  function onOrient(e) {
    var h = e.webkitCompassHeading != null ? e.webkitCompassHeading : (e.absolute && e.alpha != null ? 360 - e.alpha : null);
    if (h == null || G.spot == null || G.spot.heading == null) return;
    var diff = ((G.spot.heading - h) % 360 + 540) % 360 - 180;
    var tg = $('cTarget'); if (tg) tg.style.transform = 'rotate(' + diff + 'deg)';
    var tip = $('cTip'); if (tip) tip.textContent = Math.abs(diff) < 5 ? '方向对了！' : '再往' + (diff > 0 ? '右' : '左') + '转 ' + Math.round(Math.abs(diff)) + '°';
  }
  function startCompass(target) {
    if (target == null) return;
    var tg = $('cTarget'); if (tg) tg.style.transform = 'rotate(0deg)';
    function listen() { compassOn = true; window.addEventListener('deviceorientationabsolute', onOrient); window.addEventListener('deviceorientation', onOrient); }
    if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().then(function (r) { if (r === 'granted') listen(); }).catch(function () {});
    } else listen();
  }
  function stopCompass() {
    if (!compassOn) return; compassOn = false;
    window.removeEventListener('deviceorientationabsolute', onOrient); window.removeEventListener('deviceorientation', onOrient);
  }

  // ---------------- 路线：按光线条件自动排顺序 ----------------
  var RANK = { day: 0, any: 1, golden: 2, night: 3 };
  function planRoute(r, now) {
    now = now || new Date();
    var spots = r.spotIds.map(function (id) { return spotById[id]; });
    // 排序：需要白天的最先，其次随时可拍，再是黄金时刻，最后夜景；同类保持作者给的顺序
    // 在“光线先后”约束下（白天 → 随时 → 黄金时刻 → 夜景）枚举所有顺序，选步行总距离最短的
    var best = null;
    (function perm(arr, rest) {
      if (!rest.length) {
        for (var k = 1; k < arr.length; k++) if (RANK[arr[k].light] < RANK[arr[k - 1].light]) return;
        var tot = 0; for (k = 1; k < arr.length; k++) tot += M.distance([arr[k - 1].lng, arr[k - 1].lat], [arr[k].lng, arr[k].lat]);
        if (!best || tot < best.tot) best = { tot: tot, arr: arr };
        return;
      }
      rest.forEach(function (x, i) { perm(arr.concat([x]), rest.slice(0, i).concat(rest.slice(i + 1))); });
    })([], spots);
    var order = r.fixedOrder ? spots : (best ? best.arr : spots);
    var t = A.dayTimes(now, order[0].lat, order[0].lng);
    var stay = 25 * 60000, plan = [], cursor;
    var lastIdx = order.length - 1;
    // 以最后一个点的理想时间倒推出发时间
    var anchor = order[lastIdx].light === 'night' ? t.blueEnd : order[lastIdx].light === 'golden' ? t.goldenStart : new Date(t.goldenStart.getTime() - 60 * 60000);
    var legs = [];
    for (var i = 1; i < order.length; i++) legs.push(M.distance([order[i - 1].lng, order[i - 1].lat], [order[i].lng, order[i].lat]) * 1.3 / 70 * 60000);
    cursor = anchor.getTime();
    for (i = lastIdx; i >= 0; i--) { plan[i] = new Date(cursor); if (i > 0) cursor -= stay + legs[i - 1]; }
    var warn = '';
    order.forEach(function (s, k) {
      if (s.light === 'day' && plan[k] > t.goldenStart) warn = s.name + ' 需要白天，按这个节奏会太晚。';
    });
    var tooLate = now > plan[0];
    return { order: order, times: plan, legs: legs, dayTimes: t, warn: warn, tooLate: tooLate };
  }

  function openRoute(id) {
    var r = DATA.routes.filter(function (x) { return x.id === id; })[0]; if (!r) return;
    clearSel();
    var p = planRoute(r), pts = p.order.map(function (s) { return [s.lng, s.lat]; });
    sel.push(map.line(pts, COLORS.route, 5, false));
    p.order.forEach(function (s, k) { sel.push(map.addMarker(s.lng, s.lat, numSvg(k + 1), 30, function () { openSpot(s.id); })); drawView(s, 220); });
    map.fit(pts);
    var tl = p.order.map(function (s, k) {
      var lc = lightCheck(s, p.times[k]);
      return '<div class="ti"><div class="time">' + hm(p.times[k]) + '　' + esc(s.name) + '</div>' +
        '<div class="muted">' + TYPE_NAME[s.type] + ' · ' + ({ day: '需要白天', golden: '黄金时刻', night: '夜景', any: '随时' }[s.light] || '') + '</div>' +
        (k < p.legs.length ? '<div class="muted">↓ 步行约 ' + Math.max(1, Math.round(p.legs[k] / 60000)) + ' 分钟</div>' : '') + '</div>';
    }).join('');
    openSheet(
      '<span class="tag route">路线</span><h2>' + esc(r.name) + '</h2>' +
      '<p>' + esc(r.advice) + '</p>' +
      '<div class="cond ' + (p.tooLate ? 'bad' : 'ok') + '"><span class="dot"></span><div>' +
      (p.tooLate ? '今天已经赶不上最佳节奏了，建议明天 ' + hm(p.times[0]) + ' 左右出发。' : '按今天的日落时间（' + hm(p.dayTimes.sunset) + '）倒推，建议 ' + hm(p.times[0]) + ' 出发。') +
      (p.warn ? '<br>' + esc(p.warn) : '') + '</div></div>' +
      (r.fixedOrder ? '<h3>推荐顺序</h3><p class="muted">这条路线的顺序由地形决定（全程下坡），不按光线重排。</p>' : '<h3>自动排好的顺序</h3><p class="muted">系统按每个机位的光线条件排序：需要白天的先拍，黄金时刻卡在日落前，夜景留到最后。</p>') +
      '<div class="timeline">' + tl + '</div>' +
      '<div class="btn-row"><button class="btn-main" data-act="first">从第一站开始</button></div>'
    );
    bindSheet(function (act) { if (act === 'first') openSpot(p.order[0].id); });
    return p;
  }
  function numSvg(n) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30"><circle cx="15" cy="15" r="13" fill="#2f7d6d" stroke="#fff" stroke-width="3"/><text x="15" y="20" text-anchor="middle" font-size="14" font-weight="700" fill="#fff" font-family="Arial">' + n + '</text></svg>';
  }

  // ---------------- 等奇观：环金穿月预测 ----------------
  function angDiff(a, b) { return Math.abs(((a - b) % 360 + 540) % 360 - 180); }
  // 几何关系：站位到方孔的距离 d 必须让“塔尖”和“方孔”在画面里上下对齐：
  //   (方孔高 - 机位高) / d = (塔尖高 - 机位高) / (d - 两楼间距 D)  =>  d = (方孔高-机位高)·D / (方孔高-塔尖高)
  // 于是月亮必须出现在固定的方向（对齐线方位）和固定的高度，我们只需找出月亮何时经过这个点。
  function wonderGeometry(w) {
    var T = [w.target.lng, w.target.lat], F = [w.front.lng, w.front.lat];
    var az0 = M.bearing(F, T), D = M.distance(F, T), hT = w.target.h - w.cameraHeight;
    var dReq = hT * D / (w.target.h - w.front.h);
    return { az0: az0, D: D, dist: dReq, alt: Math.atan(hT / dReq) * 180 / Math.PI,
             cam: M.offset(T[0], T[1], (az0 + 180) % 360, dReq) };
  }
  function predictWonder(w, days) {
    var g = wonderGeometry(w), T = [w.target.lng, w.target.lat], res = [];
    var start = new Date(); start.setHours(0, 0, 0, 0);
    for (var d = 0; d < days; d++) {
      var day = new Date(start.getTime() + d * 86400000);
      if (A.moonIllum(new Date(day.getTime() + 12 * 3600000)) < w.minIllum - 0.08) continue;
      var best = null;
      for (var m = 0; m < 1440; m++) {
        var t = new Date(day.getTime() + m * 60000), mp = A.moon(t, T[1], T[0]);
        if (Math.abs(mp.alt - g.alt) > 3) continue;
        var dAz = angDiff(mp.az, g.az0), dAlt = Math.abs(mp.alt - g.alt);
        var err = Math.sqrt(dAz * dAz + dAlt * dAlt);
        if (err > 1.5) continue;
        if (A.sun(t, T[1], T[0]).alt > -1) continue; // 太阳还在天上，天空太亮
        var ill = A.moonIllum(t); if (ill < w.minIllum) continue;
        if (!best || err < best.err) best = { time: t, az: mp.az, alt: mp.alt, err: err, illum: ill };
      }
      if (best) res.push(best);
    }
    res.sort(function (a, b) { return a.time - b.time; });
    return { geo: g, az0: g.az0, list: res };
  }
  function grade(err) { return err < 0.3 ? '正中方孔' : err < 0.6 ? '穿过方孔' : err < 1 ? '贴着方孔边缘' : '擦边而过（可作备选）'; }

  var WSTATE = { w: null, pred: null, cam: [] };
  function openWonder(id, cb) {
    var w = DATA.wonders.filter(function (x) { return x.id === id; })[0]; if (!w) return;
    clearSel();
    var T = [w.target.lng, w.target.lat], F = [w.front.lng, w.front.lat];
    map.flyTo(w.target.lng, w.target.lat, 14);
    openSheet('<span class="tag wonder">等奇观</span><h2>' + esc(w.name) + '</h2><p>' + esc(w.desc) + '</p><p class="muted">正在计算未来一年的月亮位置…</p>');
    setTimeout(function () {
      var pred = predictWonder(w, 400);
      WSTATE = { w: w, pred: pred, cam: [] };
      // 对齐线：从方孔经过金茂塔尖向后延长，站在这条线上两栋楼才会对齐
      var far = M.offset(T[0], T[1], (pred.az0 + 180) % 360, 9000);
      sel.push(map.line([T, far], COLORS.wonder, 3, true));
      sel.push(map.addMarker(F[0], F[1], dotSvg('#3b4b8c'), 18, null));
      sel.push(map.addMarker(T[0], T[1], dotSvg('#3b4b8c'), 18, null));
      var g = pred.geo, list = pred.list.slice(0, 8);
      // 站位是唯一确定的：画出站位和它看向方孔的视线
      sel.push(map.addMarker(g.cam[0], g.cam[1], markerSvg('wonder', true), 46, null));
      sel.push(map.polygon(M.sectorPoints(g.cam[0], g.cam[1], g.az0, 3, g.dist + 400), COLORS.wonder, 0.25));
      map.fit([g.cam, T]);
      var cands = list.length ? list.map(function (c) {
        return '<div class="cand"><div class="big">' + c.time.getFullYear() + '年' + md(c.time) + ' 周' + WEEK[c.time.getDay()] + ' ' + hm(c.time) + '</div>' +
          '<div class="muted">' + grade(c.err) + ' · 偏差 ' + c.err.toFixed(2) + '° · 月面 ' + Math.round(c.illum * 100) + '%</div></div>';
      }).join('') : '<p class="muted">未来一年内没有算到满足条件的时刻。</p>';
      openSheet(
        '<span class="tag wonder">等奇观</span><h2>' + esc(w.name) + '</h2><p>' + esc(w.desc) + '</p>' +
        '<h3>第一步：空间 · 站在哪</h3>' +
        '<div class="cond ok"><span class="dot"></span><div>蓝色虚线是“对齐线”：从' + esc(w.target.name) + '穿过' + esc(w.front.name) + '向后延长，站在线上两栋楼才会对齐。' +
        '在线上还要站到离方孔约 <b>' + (g.dist / 1000).toFixed(1) + ' 公里</b>处，塔尖才会刚好顶进方孔：这个点就是地图上的大圆点。</div></div>' +
        '<h3>第二步：时间 · 什么时候</h3>' +
        '<p>从这个站位看，月亮必须出现在方位 <b>' + g.az0.toFixed(1) + '°</b>、高度 <b>' + g.alt.toFixed(1) + '°</b>。系统逐分钟计算未来一年的月亮位置，找出月亮经过这一点、接近满月、而且天已经黑了的时刻：</p>' +
        cands +
        '<p class="muted">说明：楼的坐标和高度是近似值，两楼间距差 10 米，站位就会差约 90 米，所以结果是“候选日期和候选区域”。出发前还要看天气是否通透。</p>'
      );
      if (cb) cb(pred);
    }, 60);
  }
  function dotSvg(c) { return '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"><circle cx="9" cy="9" r="6" fill="' + c + '" stroke="#fff" stroke-width="2"/></svg>'; }

  // ---------------- 演示模式 ----------------
  var DEMO = { on: false, timer: null };
  function caption(step, text) {
    $('captionStep').textContent = step; $('captionText').textContent = text;
    $('caption').classList.add('open'); $('caption').setAttribute('aria-hidden', 'false');
  }
  function stopDemo() {
    DEMO.on = false; clearTimeout(DEMO.timer);
    $('caption').classList.remove('open'); $('caption').setAttribute('aria-hidden', 'true');
  }
  function runScript(title, steps) {
    stopDemo(); DEMO.on = true; var i = 0;
    (function next() {
      if (!DEMO.on || i >= steps.length) { if (DEMO.on) DEMO.timer = setTimeout(stopDemo, 2500); return; }
      var st = steps[i++]; caption(title + ' · ' + i + '/' + steps.length, st.say);
      try { if (st.act) st.act(); } catch (e) { console.error(e); }
      DEMO.timer = setTimeout(next, st.wait || 4200);
    })();
  }
  function guideDemoSteps(s) {
    var arr = [{ say: '到了附近，切换到路书模式：定位误差有 5 到 15 米，所以最后一段不靠定位，靠一步一张的指路照片。', act: function () { openGuide(s); } }];
    (s.guide || []).slice(1).forEach(function (g) { arr.push({ say: '走到照片里的位置，点“我到了”：' + g.text, act: guideNext, wait: 3200 }); });
    arr.push({ say: '到达站位。指南针告诉你镜头该朝哪，拍法卡片告诉你怎么拍：视野就是取景框。', act: guideNext, wait: 5200 });
    arr.push({ say: '完成后打卡、复刻同款，这个机位的“最近确认”时间也随之更新。', act: function () { closeGuide(); } });
    return arr;
  }
  var DEMOS = [
    { no: 1, type: 'classic', title: '拍同款：环形天桥看东方明珠', run: function () {
      var s = spotById.ring;
      runScript('经典同款', [
        { say: '人人都见过的“上海明信片”画面。点开机位：站在哪、朝哪拍、用什么镜头，一目了然。', act: function () { setFilter('all'); openSpot('ring'); } },
        { say: '系统结合此刻时间和日落时间判断：这是夜景机位，' + lightCheck(s).text, wait: 5200 },
        { say: '扇形是取景框投影在地面的范围，橙色虚线是太阳方向：顺光还是逆光，出发前就知道。', wait: 4800 },
        { say: '一键调用百度步行路线规划，从地铁站走到机位。', act: function () { navigate(s, true); }, wait: 5000 }
      ].concat(guideDemoSteps(s)));
    } },
    { no: 2, type: 'route', title: '路线：北外滩出片线', run: function () {
      var p;
      runScript('机位路线', [
        { say: '三个机位串成一条路线。关键不是距离最短，而是光线：桥下镜面天黑就失效。', act: function () { setFilter('route'); p = openRoute('bund-north'); }, wait: 5200 },
        { say: '系统按每个机位的光线条件自动排序，并用今天的日落时间倒推出发时间。', wait: 5200 },
        { say: '第一站之后先去桥下镜面：它需要白天，排在黄金时刻之前。', act: function () { openSpot('mirror'); }, wait: 5200 },
        { say: '最后一站世界会客厅，正好赶上日落。', act: function () { openSpot('lounge'); }, wait: 4500 },
        { say: '这就是“时间切面”：同一个位置，不同时刻，是完全不同的画面。', act: function () { openRoute('bund-north'); } }
      ]);
    } },
    { no: 3, type: 'skill', title: '拍大片：三件套仰拍', run: function () {
      var s = spotById.snowking;
      runScript('拍大片', [
        { say: '会找不等于会拍。这个机位的关键是拍法：背对“开瓶器”，镜头朝天，开广角。', act: function () { setFilter('all'); openSpot('snowking'); }, wait: 5200 },
        { say: '拍法被拆成姿势、镜头、朝向、道具，照着做就能复刻。', wait: 4200 },
        { say: '现场最好用的线索往往不是坐标，而是“地上趴着各种姿势拍照的人”。路书把这些线索按顺序串起来。', act: function () { navigate(s, true); }, wait: 5200 }
      ].concat(guideDemoSteps(s)));
    } },
    { no: 4, type: 'wonder', title: '等奇观：环金穿月', run: function () {
      runScript('等奇观', [
        { say: '满月穿过环球金融中心的方孔，金茂塔尖顶在月亮中间。这是一道几何题：地图最擅长解几何题。', act: function () { setFilter('wonder'); openWonder('moon-swfc'); }, wait: 5600 },
        { say: '蓝色虚线是对齐线：站在线上，两栋楼才会对齐。', wait: 4600 },
        { say: '再算未来一年月亮的方向和高度，找出月亮正好沿对齐线升起、又接近满月的时刻，得到日期和站位。', wait: 5600 },
        { say: '同一张地图：普通人找到能复刻的美，摄影师找到一年几次的奇观。', wait: 5000 }
      ]);
    } }
  ];
  function openDemoMenu() {
    clearSel();
    openSheet('<h2>演示</h2><p class="muted">每个演示自动走完：判断时间 → 规划路线 → 路书指路 → 构图指引。录制作品视频时直接用。</p>' +
      DEMOS.map(function (d, k) {
        return '<div class="demo-item" data-act="d' + k + '"><div class="demo-no" style="background:' + COLORS[d.type] + '">' + d.no + '</div><div><b>' + esc(d.title) + '</b></div></div>';
      }).join(''));
    bindSheet(function (act) { DEMOS[+act.slice(1)].run(); });
  }

  // ---------------- 筛选 ----------------
  function setFilter(f) {
    filter = f;
    document.querySelectorAll('#chips button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-f') === f); });
    drawMarkers();
  }
  function onChip(f) {
    setFilter(f); closeSheet();
    if (f.indexOf('c:') === 0) {
      var key = f.slice(2), col = DATA.collections[key];
      var list = DATA.spots.filter(function (s) { return window.JW_TOPIC(s, key); });
      map.fit(list.map(function (s) { return [s.lng, s.lat]; }).concat(list.length === 1 ? [[list[0].lng + 0.01, list[0].lat + 0.01]] : []));
      openSheet('<span class="tag classic">专题</span><h2>' + esc(col.name) + '</h2><p>' + esc(col.desc) + '</p>' +
        list.map(function (s, k) { return '<div class="demo-item" data-act="s' + k + '"><div class="demo-no" style="background:' + COLORS[s.type] + '">' + (k + 1) + '</div><div><b>' + esc(s.name) + '</b><div class="muted">' + esc(s.area) + (s.status && s.status.note ? ' · ' + esc(s.status.note) : '') + '</div></div></div>'; }).join(''));
      bindSheet(function (act) { openSpot(list[+act.slice(1)].id); });
    } else if (f === 'mine') {
      if (window.JWX) window.JWX.openMine();
    } else if (f === 'route') {
      openSheet('<span class="tag route">路线</span><h2>机位路线</h2>' + DATA.routes.map(function (r, k) {
        return '<div class="demo-item" data-act="r' + k + '"><div class="demo-no" style="background:' + COLORS.route + '">' + (k + 1) + '</div><div><b>' + esc(r.name) + '</b><div class="muted">' + r.spotIds.length + ' 个机位</div></div></div>';
      }).join(''));
      bindSheet(function (act) { openRoute(DATA.routes[+act.slice(1)].id); });
    } else if (f === 'wonder') {
      openWonder(DATA.wonders[0].id);
    } else {
      map.flyTo(CFG.CENTER[0], CFG.CENTER[1], CFG.ZOOM);
    }
  }

  // ---------------- 启动 ----------------
  function start(useBaidu, reason) {
    if (CFG.BRAND) { document.querySelector('.brand-name').textContent = CFG.BRAND; document.title = CFG.BRAND + ' · ' + (CFG.SLOGAN || ''); }
    var bs = document.querySelector('.brand-sub'); if (CFG.SLOGAN && bs) bs.textContent = CFG.SLOGAN;
    map = M.create($('map'), CFG.CENTER, CFG.ZOOM, useBaidu);
    if (map.onView) map.onView(labelsSoon);
    $('statusPill').textContent = useBaidu ? '百度地图已连接' : '离线预览 · ' + (reason || '');
    drawMarkers();
    document.querySelectorAll('#chips button').forEach(function (b) { b.addEventListener('click', function () { onChip(b.getAttribute('data-f')); }); });
    $('mapSearchInput').addEventListener('input', function () { renderSearchResults(this.value); });
    $('mapSearchInput').addEventListener('focus', function () { renderSearchResults(this.value); });
    $('mapSearchInput').addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { this.value = ''; renderSearchResults(''); this.blur(); }
    });
    $('btnLocateMap').addEventListener('click', locateOnMap);
    $('sheetClose').addEventListener('click', closeSheet);
    $('guideExit').addEventListener('click', closeGuide);
    $('guideNext').addEventListener('click', guideNext);
    $('guidePrev').addEventListener('click', function () { if (G.i > 0) { G.i--; renderGuide(); } });
    $('btnDemo').addEventListener('click', openDemoMenu);
    $('captionStop').addEventListener('click', stopDemo);
    // 调试入口：网址后面加 #demo1 ～ #demo4 可直接开始演示
    setTimeout(function () { window.JW.ready = true; window.dispatchEvent(new Event('jw-ready')); }, 0);
    var h = location.hash.match(/demo(\d)/); if (h && DEMOS[h[1] - 1]) setTimeout(function () { DEMOS[h[1] - 1].run(); }, 600);
  }
  M.load(CFG.BAIDU_AK, 8000, start);

  function addSpot(s) { if (!spotById[s.id]) DATA.spots.push(s); spotById[s.id] = s; }
  function removeSpot(id) { DATA.spots = DATA.spots.filter(function (s) { return s.id !== id; }); window.JW_DATA.spots = DATA.spots; delete spotById[id]; closeSheet(); drawMarkers(); }
  window.JW = { get map() { return map; }, spotById: spotById, addSpot: addSpot, removeSpot: removeSpot, drawMarkers: drawMarkers, openSheet: openSheet, closeSheet: closeSheet,
    bindSheet: bindSheet, toast: toast, esc: esc, placeholder: placeholder, lightCheck: lightCheck, setFilter: setFilter, COLORS: COLORS, TYPE_NAME: TYPE_NAME,
    clearSel: clearSel, sel: function (h) { sel.push(h); }, markerSvg: markerSvg, hm: hm, md: md, planRoute: planRoute, predictWonder: predictWonder, lightCheck: lightCheck, openSpot: openSpot, openRoute: openRoute, openWonder: openWonder, DEMOS: DEMOS,
    locateMe: function (o, cb) { locateMe(o, cb); }, renderLabels: labelsSoon };
})();
