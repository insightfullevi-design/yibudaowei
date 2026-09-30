// 地图适配层：优先用百度地图；没填密钥或加载失败时，用一个简易的“离线预览地图”兜底，
// 保证界面和功能随时能演示。其他代码只调用这里的函数，不直接碰百度的接口。
(function () {
  var M = { mode: null };

  // ---------- 通用几何 ----------
  // 从一点出发，沿某方向走 dist 米，得到新坐标（近距离足够准）
  M.offset = function (lng, lat, bearingDeg, dist) {
    var b = bearingDeg * Math.PI / 180;
    return [lng + dist * Math.sin(b) / (111320 * Math.cos(lat * Math.PI / 180)),
            lat + dist * Math.cos(b) / 110540];
  };
  M.bearing = function (a, b) { // a、b 为 [lng, lat]
    var dx = (b[0] - a[0]) * 111320 * Math.cos(a[1] * Math.PI / 180), dy = (b[1] - a[1]) * 110540;
    return (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
  };
  M.distance = function (a, b) {
    var dx = (b[0] - a[0]) * 111320 * Math.cos(a[1] * Math.PI / 180), dy = (b[1] - a[1]) * 110540;
    return Math.sqrt(dx * dx + dy * dy);
  };
  // 照片和手机定位给的是国际通用坐标（WGS84），百度地图用自己的坐标（BD09），需要换算（公开的标准算法）
  M.wgs2bd = function (lng, lat) {
    var PI = Math.PI;
    if (lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271) return [lng, lat];
    function tLat(x, y) { var r = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x)); r += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3; r += (20 * Math.sin(y * PI) + 40 * Math.sin(y / 3 * PI)) * 2 / 3; r += (160 * Math.sin(y / 12 * PI) + 320 * Math.sin(y * PI / 30)) * 2 / 3; return r; }
    function tLng(x, y) { var r = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x)); r += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3; r += (20 * Math.sin(x * PI) + 40 * Math.sin(x / 3 * PI)) * 2 / 3; r += (150 * Math.sin(x / 12 * PI) + 300 * Math.sin(x / 30 * PI)) * 2 / 3; return r; }
    var a = 6378245, ee = 0.00669342162296594323, dLat = tLat(lng - 105, lat - 35), dLng = tLng(lng - 105, lat - 35);
    var rad = lat / 180 * PI, mg = Math.sin(rad); mg = 1 - ee * mg * mg; var sq = Math.sqrt(mg);
    dLat = dLat * 180 / ((a * (1 - ee)) / (mg * sq) * PI); dLng = dLng * 180 / (a / sq * Math.cos(rad) * PI);
    var x = lng + dLng, y = lat + dLat, xpi = PI * 3000 / 180;
    var z = Math.sqrt(x * x + y * y) + 0.00002 * Math.sin(y * xpi), th = Math.atan2(y, x) + 0.000003 * Math.cos(x * xpi);
    return [z * Math.cos(th) + 0.0065, z * Math.sin(th) + 0.006];
  };

  M.sectorPoints = function (lng, lat, heading, fov, radius) {
    var pts = [[lng, lat]], steps = 16;
    for (var i = 0; i <= steps; i++) pts.push(M.offset(lng, lat, heading - fov / 2 + fov * i / steps, radius));
    pts.push([lng, lat]);
    return pts;
  };

  // 底部卡片/右侧面板会挡住地图，定位和缩放时把目标放到可见区域中间
  function mobile() { return window.innerWidth < 900; }
  M.margins = function () { return mobile() ? [120, 30, Math.round(window.innerHeight * 0.64), 30] : [120, 440, 40, 40]; };
  M.lift = function () { var m = M.margins(); return [(m[3] - m[1]) / 2, (m[2] - m[0]) / 2]; }; // 目标需要相对屏幕中心偏移的像素

  // ---------- 载入百度地图 ----------
  M.load = function (ak, timeoutMs, done) {
    if (!ak || /粘贴/.test(ak)) return done(false, '还没有填写密钥');
    var finished = false;
    window.__jwBMapReady = function () { if (!finished) { finished = true; done(true); } };
    var s = document.createElement('script');
    s.src = 'https://api.map.baidu.com/api?type=webgl&v=1.0&ak=' + encodeURIComponent(ak) + '&callback=__jwBMapReady';
    s.onerror = function () { if (!finished) { finished = true; done(false, '百度地图脚本加载失败（检查网络）'); } };
    document.head.appendChild(s);
    setTimeout(function () { if (!finished) { finished = true; done(false, '百度地图加载超时'); } }, timeoutMs);
  };

  // ================= 百度实现 =================
  function Baidu(el, center, zoom) {
    var map = new BMapGL.Map(el);
    map.centerAndZoom(new BMapGL.Point(center[0], center[1]), zoom);
    map.enableScrollWheelZoom(true);
    map.addControl(new BMapGL.ScaleControl({ anchor: BMAP_ANCHOR_BOTTOM_LEFT }));
    try { map.setMapStyleV2({ styleJson: FILM_STYLE }); } catch (e) { /* 样式失败不影响使用 */ }
    this.map = map;
    this._walk = null;
    this._view = [];
    var self = this, raf = 0;
    function fire() { if (raf) return; raf = setTimeout(function () { raf = 0; self._view.forEach(function (f) { f(); }); }, 16); }
    ['moving', 'moveend', 'zooming', 'zoomend', 'resize', 'dragging', 'dragend', 'update'].forEach(function (ev) { try { map.addEventListener(ev, fire); } catch (e) {} });
    window.addEventListener('resize', fire);
  }
  // 经纬度 → 地图容器里的像素位置（给机位照片标签定位用）
  Baidu.prototype.toPixel = function (lng, lat) { var px = this.map.pointToPixel(new BMapGL.Point(lng, lat)); return [px.x, px.y]; };
  Baidu.prototype.onView = function (f) { this._view.push(f); };
  function P(p) { return new BMapGL.Point(p[0], p[1]); }
  Baidu.prototype.addMarker = function (lng, lat, svg, size, onClick) {
    var icon = new BMapGL.Icon('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg),
      new BMapGL.Size(size, size), { anchor: new BMapGL.Size(size / 2, size / 2) });
    var mk = new BMapGL.Marker(new BMapGL.Point(lng, lat), { icon: icon });
    if (onClick) mk.addEventListener('click', onClick);
    this.map.addOverlay(mk);
    return mk;
  };
  Baidu.prototype.polygon = function (pts, color, opacity) {
    var pg = new BMapGL.Polygon(pts.map(P), { strokeColor: color, strokeWeight: 1, strokeOpacity: 0.9, fillColor: color, fillOpacity: opacity });
    this.map.addOverlay(pg); return pg;
  };
  Baidu.prototype.line = function (pts, color, width, dashed) {
    var pl = new BMapGL.Polyline(pts.map(P), { strokeColor: color, strokeWeight: width, strokeOpacity: 0.9, strokeStyle: dashed ? 'dashed' : 'solid' });
    this.map.addOverlay(pl); return pl;
  };
  Baidu.prototype.remove = function (h) { if (h) this.map.removeOverlay(h); };
  Baidu.prototype.flyTo = function (lng, lat, zoom) {
    var z = zoom || this.map.getZoom(), mpp = Math.pow(2, 18 - z), off = M.lift();
    // 把地图中心挪到目标点的“反方向”，目标就落在没被卡片挡住的区域
    var c = [lng - off[0] * mpp / (111320 * Math.cos(lat * Math.PI / 180)), lat - off[1] * mpp / 110540];
    this.map.centerAndZoom(new BMapGL.Point(c[0], c[1]), z);
  };
  Baidu.prototype.center = function (lng, lat, zoom) { this.map.centerAndZoom(new BMapGL.Point(lng, lat), zoom || this.map.getZoom()); };
  Baidu.prototype.fit = function (pts) { this.map.setViewport(pts.map(P), { margins: M.margins() }); };
  Baidu.prototype.locate = function (cb) {
    var geo = new BMapGL.Geolocation();
    geo.getCurrentPosition(function (r) {
      if (this.getStatus() === BMAP_STATUS_SUCCESS) cb([r.point.lng, r.point.lat], r.accuracy);
      else cb(null);
    }, { enableHighAccuracy: true });
  };
  // 百度步行路线规划：从 from 走到 to，在地图上画出路线，回调返回距离和时间
  Baidu.prototype.walk = function (from, to, cb) {
    this.clearWalk();
    var self = this;
    this._walk = new BMapGL.WalkingRoute(this.map, {
      renderOptions: { map: this.map, autoViewport: true },
      onSearchComplete: function (res) {
        try {
          if (self._walk.getStatus() !== BMAP_STATUS_SUCCESS) return cb(null);
          var plan = res.getPlan(0), steps = [];
          try {
            var route = plan.getRoute(0), n = route.getNumSteps();
            for (var i = 0; i < n; i++) { var st = route.getStep(i), sp = st.getPosition(); steps.push({ text: String(st.getDescription(false) || '').replace(/<[^>]+>/g, ''), pos: sp ? [sp.lng, sp.lat] : null }); }
          } catch (e) {}
          cb({ distance: plan.getDistance(true), duration: plan.getDuration(true), meters: plan.getDistance(false), steps: steps });
        } catch (e) { cb(null); }
      }
    });
    this._walk.search(P(from), P(to));
  };
  Baidu.prototype.clearWalk = function () { if (this._walk) { this._walk.clearResults(); this._walk = null; } };
  Baidu.prototype.setTilt = function (t) { this.map.setTilt(t); };
  // 点地图取一个坐标（上传机位时校准站位用），只响应一次
  Baidu.prototype.pick = function (cb) {
    var map = this.map;
    function h(e) { map.removeEventListener('click', h); var p = e.latlng || e.point; cb([p.lng, p.lat]); }
    map.addEventListener('click', h);
  };

  // 胶片风底图：暖灰陆地、青灰江水，道路淡化，让机位点更突出
  var FILM_STYLE = [
    { featureType: 'land', elementType: 'geometry', stylers: { color: '#efe9dfff' } },
    { featureType: 'water', elementType: 'geometry', stylers: { color: '#b9cfd1ff' } },
    { featureType: 'green', elementType: 'geometry', stylers: { color: '#d6dfc6ff' } },
    { featureType: 'building', elementType: 'geometry.fill', stylers: { color: '#e4dccfff' } },
    { featureType: 'highway', elementType: 'geometry.fill', stylers: { color: '#f7f1e6ff' } },
    { featureType: 'arterial', elementType: 'geometry.fill', stylers: { color: '#f7f1e6ff' } },
    { featureType: 'local', elementType: 'geometry.fill', stylers: { color: '#f7f1e6ff' } },
    { featureType: 'poilabel', elementType: 'labels.icon', stylers: { visibility: 'off' } }
  ];

  // ================= 离线预览实现（无需网络） =================
  function Offline(el, center, zoom) {
    this.el = el; this.cx = center[0]; this.cy = center[1]; this.z = zoom; this.items = [];
    el.classList.add('offline-map');
    el.innerHTML = '<svg class="om-svg"></svg><div class="om-markers"></div><div class="om-note">离线预览：填入百度地图密钥后显示真实地图</div>';
    this.svg = el.querySelector('.om-svg'); this.layer = el.querySelector('.om-markers');
    var self = this, drag = null;
    el.addEventListener('pointerdown', function (e) { if (e.target.closest('.om-mk')) return; drag = [e.clientX, e.clientY]; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', function (e) {
      if (!drag) return; var s = self.scale();
      self.cx -= (e.clientX - drag[0]) / s; self.cy += (e.clientY - drag[1]) / (s * 1.17);
      drag = [e.clientX, e.clientY]; self.render();
    });
    el.addEventListener('pointerup', function () { drag = null; });
    el.addEventListener('wheel', function (e) { e.preventDefault(); self.z = Math.max(4, Math.min(19, self.z + (e.deltaY < 0 ? 0.5 : -0.5))); self.render(); }, { passive: false });
    window.addEventListener('resize', function () { self.render(); });
  }
  Offline.prototype.scale = function () { return 256 * Math.pow(2, this.z) / 360; }; // 每经度多少像素
  Offline.prototype.px = function (lng, lat) {
    var s = this.scale(), w = this.el.clientWidth, h = this.el.clientHeight;
    return [w / 2 + (lng - this.cx) * s, h / 2 - (lat - this.cy) * s * 1.17];
  };
  Offline.prototype.render = function () {
    var self = this, svg = '';
    this.items.forEach(function (it) {
      if (it.kind === 'marker') {
        var p = self.px(it.lng, it.lat);
        it.node.style.left = p[0] + 'px'; it.node.style.top = p[1] + 'px';
      } else {
        var d = it.pts.map(function (q, i) { var p = self.px(q[0], q[1]); return (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
        if (it.kind === 'polygon') svg += '<path d="' + d + 'Z" fill="' + it.color + '" fill-opacity="' + it.opacity + '" stroke="' + it.color + '"/>';
        else svg += '<path d="' + d + '" fill="none" stroke="' + it.color + '" stroke-width="' + it.width + '"' + (it.dashed ? ' stroke-dasharray="6 5"' : '') + '/>';
      }
    });
    this.svg.innerHTML = svg;
    (this._view || []).forEach(function (f) { f(); });
  };
  Offline.prototype.toPixel = function (lng, lat) { return this.px(lng, lat); };
  Offline.prototype.onView = function (f) { (this._view = this._view || []).push(f); };
  Offline.prototype.addMarker = function (lng, lat, svgStr, size, onClick) {
    var n = document.createElement('div'); n.className = 'om-mk'; n.innerHTML = svgStr;
    n.style.width = n.style.height = size + 'px';
    if (onClick) n.addEventListener('click', onClick);
    this.layer.appendChild(n);
    var it = { kind: 'marker', lng: lng, lat: lat, node: n }; this.items.push(it); this.render(); return it;
  };
  Offline.prototype.polygon = function (pts, color, opacity) { var it = { kind: 'polygon', pts: pts, color: color, opacity: opacity }; this.items.push(it); this.render(); return it; };
  Offline.prototype.line = function (pts, color, width, dashed) { var it = { kind: 'line', pts: pts, color: color, width: width, dashed: dashed }; this.items.push(it); this.render(); return it; };
  Offline.prototype.remove = function (it) {
    var i = this.items.indexOf(it); if (i < 0) return;
    if (it.node) it.node.remove(); this.items.splice(i, 1); this.render();
  };
  Offline.prototype.flyTo = function (lng, lat, zoom) {
    if (zoom) this.z = zoom;
    var s = this.scale(), off = M.lift();
    this.cx = lng - off[0] / s; this.cy = lat - off[1] / (s * 1.17); this.render();
  };
  Offline.prototype.center = function (lng, lat, zoom) { if (zoom) this.z = zoom; this.cx = lng; this.cy = lat; this.render(); };
  Offline.prototype.fit = function (pts) {
    var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; }), m = M.margins();
    var w = Math.max(100, this.el.clientWidth - m[1] - m[3]), h = Math.max(100, this.el.clientHeight - m[0] - m[2]);
    var dx = Math.max(Math.max.apply(0, xs) - Math.min.apply(0, xs), 0.001), dy = Math.max(Math.max.apply(0, ys) - Math.min.apply(0, ys), 0.001);
    this.z = Math.min(17, Math.log2(Math.min(w / dx, h / (dy * 1.17)) * 360 / 256) - 0.1);
    this.flyTo((Math.min.apply(0, xs) + Math.max.apply(0, xs)) / 2, (Math.min.apply(0, ys) + Math.max.apply(0, ys)) / 2);
  };
  Offline.prototype.locate = function (cb) {
    if (!navigator.geolocation) return cb(null);
    navigator.geolocation.getCurrentPosition(function (p) { cb(M.wgs2bd(p.coords.longitude, p.coords.latitude), p.coords.accuracy); }, function () { cb(null); }, { timeout: 6000 });
  };
  Offline.prototype.walk = function (from, to, cb) {
    this.clearWalk(); this._walk = this.line([from, to], '#3b6fb6', 4, true);
    var d = M.distance(from, to); cb({ distance: (d / 1000).toFixed(1) + '公里（直线）', duration: Math.round(d / 70) + '分钟（估算）', meters: d, steps: [{ text: '沿直线方向步行约 ' + Math.round(d) + ' 米（离线预览）', pos: from }] });
  };
  Offline.prototype.clearWalk = function () { if (this._walk) { this.remove(this._walk); this._walk = null; } };
  Offline.prototype.setTilt = function () {};
  Offline.prototype.pick = function (cb) {
    var self = this;
    function h(e) {
      if (e.target.closest('.om-mk')) return;
      self.el.removeEventListener('click', h);
      var r = self.el.getBoundingClientRect(), s = self.scale();
      var x = e.clientX - r.left, y = e.clientY - r.top;
      cb([self.cx + (x - r.width / 2) / s, self.cy - (y - r.height / 2) / (s * 1.17)]);
    }
    setTimeout(function () { self.el.addEventListener('click', h); }, 0);
  };

  M.create = function (el, center, zoom, useBaidu) {
    M.mode = useBaidu ? 'baidu' : 'offline';
    return useBaidu ? new Baidu(el, center, zoom) : new Offline(el, center, zoom);
  };
  window.JWMap = M;
})();
