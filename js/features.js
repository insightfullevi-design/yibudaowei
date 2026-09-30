// 上传机位 · 打卡 · 相机复刻 · 对比图 · 分享卡片 · 账号 · 我的巡礼
// 配好云端（config.js 里的 SUPABASE_URL / SUPABASE_KEY）后，上传和打卡所有人可见；没配时保存在本机浏览器里。
(function () {
  var JW, M = window.JWMap, $ = function (id) { return document.getElementById(id); };
  var KEY = 'yjdw_v1';

  // ---------------- 本机存储（失败也不影响使用） ----------------
  var store = { spots: [], checkins: [] };
  var Cloud = window.Cloud, CLOUD = !!(Cloud && Cloud.enabled());
  function myId() { return CLOUD && Cloud.me() ? Cloud.me().id : 'local'; }
  function load() { try { var t = localStorage.getItem(KEY); if (t) store = JSON.parse(t); } catch (e) {} store.spots = store.spots || []; store.checkins = store.checkins || []; }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); return true; }
    catch (e) { JW.toast('本机存储空间不足，照片未能保存（可删除一些旧打卡）'); return false; }
  }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }

  // 把打卡结果合并回机位：次数、最近确认、状态说明
  function applyCheckins() {
    store.checkins.forEach(function (c) {
      var s = JW.spotById[c.spotId]; if (!s) return;
      s.checkins = (s._baseCheckins || 0);
    });
    store.checkins.forEach(function (c) {
      var s = JW.spotById[c.spotId]; if (!s) return;
      s.checkins = (s.checkins || 0) + 1;
      if (!s.status || !s.status.date || c.date >= s.status.date) {
        s.status = { ok: c.state !== 'changed', date: c.date, note: c.state === 'changed' ? '现场已变化' + (c.note ? '：' + c.note : '') : c.result === 'fail' ? '有人没拍成' + (c.note ? '：' + c.note : '') : '有人刚刚复刻成功' };
      }
    });
  }

  // ---------------- 图片工具 ----------------
  function readAsDataURL(file) { return new Promise(function (ok, no) { var r = new FileReader(); r.onload = function () { ok(r.result); }; r.onerror = no; r.readAsDataURL(file); }); }
  function loadImg(src) { return new Promise(function (ok, no) { var i = new Image(); if (/^https?:/.test(src)) i.crossOrigin = 'anonymous'; i.onload = function () { ok(i); }; i.onerror = no; i.src = src; }); }
  // 压缩到最长边 max 像素，节省本机空间
  function shrink(src, max, q) {
    return loadImg(src).then(function (img) {
      var k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', q || 0.82);
    });
  }
  function refSrc(s) {
    if (s.cover) return s.cover;
    var svg = JW.placeholder(s.coverHint || s.name, s.type, false).replace('<svg ', '<svg width="1200" height="900" ');
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  // ---------------- 读取照片里的拍摄信息（位置、朝向、焦距、时间） ----------------
  function readExif(buf) {
    var v = new DataView(buf), out = {};
    if (v.getUint16(0) !== 0xFFD8) return out;
    var off = 2;
    while (off + 4 < v.byteLength) {
      var mk = v.getUint16(off), len = v.getUint16(off + 2);
      if (mk === 0xFFE1 && v.getUint32(off + 4) === 0x45786966) return parseTiff(v, off + 10, out);
      if ((mk & 0xFF00) !== 0xFF00) break;
      off += 2 + len;
    }
    return out;
  }
  function parseTiff(v, t, out) {
    var le = v.getUint16(t) === 0x4949;
    function u16(o) { return v.getUint16(o, le); } function u32(o) { return v.getUint32(o, le); }
    function rat(o) { var d = u32(o + 4); return d ? u32(o) / d : 0; }
    function ifd(o, cb) { var n = u16(o); for (var i = 0; i < n; i++) { var e = o + 2 + i * 12; cb(u16(e), u16(e + 2), u32(e + 4), e + 8); } }
    function valOff(cnt, size, p) { return cnt * size > 4 ? t + u32(p) : p; }
    // 按类型读一个数：短整数、长整数、分数、单/双精度小数都能读
    function num(type, p) {
      if (type === 3) return u16(p); if (type === 4) return u32(p);
      if (type === 5) return rat(t + u32(p)); if (type === 10) { var q = t + u32(p), d = v.getInt32(q + 4, le); return d ? v.getInt32(q, le) / d : 0; }
      if (type === 11) return v.getFloat32(p, le); if (type === 12) return v.getFloat64(t + u32(p), le);
      return 0;
    }
    function str(p, cnt) { var s = ''; for (var i = 0; i < cnt - 1; i++) s += String.fromCharCode(v.getUint8(p + i)); return s; }
    var exifPtr = 0, gpsPtr = 0;
    ifd(t + u32(t + 4), function (tag, type, cnt, p) {
      if (tag === 0x8769) exifPtr = u32(p); if (tag === 0x8825) gpsPtr = u32(p);
      if (tag === 0x010F) out.make = str(valOff(cnt, 1, p), cnt).trim();
      if (tag === 0x0110) out.model = str(valOff(cnt, 1, p), cnt).trim();
    });
    if (exifPtr) ifd(t + exifPtr, function (tag, type, cnt, p) {
      if (tag === 0x9003) out.time = str(valOff(cnt, 1, p), cnt);
      if (tag === 0xA405) out.f35 = num(type, p);
      if (tag === 0x920A) out.focal = num(type, p);
      if (tag === 0x829A) out.exposure = num(type, p);
      if (tag === 0x829D) out.fnum = num(type, p);
      if (tag === 0x8827) out.iso = num(type, p);
      if (tag === 0xA434) out.lens = str(valOff(cnt, 1, p), cnt).trim();
    });
    if (gpsPtr) {
      var g = {};
      ifd(t + gpsPtr, function (tag, type, cnt, p) {
        if (tag === 1 || tag === 3) g[tag] = String.fromCharCode(v.getUint8(p));
        if (tag === 2 || tag === 4) { var q = valOff(3, 8, p); g[tag] = rat(q) + rat(q + 8) / 60 + rat(q + 16) / 3600; }
        if (tag === 0x11) g.dir = rat(valOff(1, 8, p));
      });
      if (g[2] && g[4]) { out.lat = g[1] === 'S' ? -g[2] : g[2]; out.lng = g[3] === 'W' ? -g[4] : g[4]; }
      if (g.dir != null) out.heading = g.dir;
    }
    return out;
  }
  // 等效焦距 → 画面左右视角（35mm 画幅宽 36mm）
  function fovFrom(f35) { return f35 ? Math.round(2 * Math.atan(18 / f35) * 180 / Math.PI) : 70; }

  // ---------------- 上传机位：像发帖子一样 ----------------
  // 选原图（自动读出地点、时间、设备和相机参数）→ 确认站位 → 标题 + 正文 + 标签 → 可选路书 → 发布；随时可存草稿
  var up = null;
  function draftKey() { return 'yjdw_draft_' + myId(); }
  function readDraft() { try { return JSON.parse(localStorage.getItem(draftKey()) || 'null'); } catch (e) { return null; } }
  var TAG_SUGGEST = ['影视同款', '明星同款', '书本同款', '钞能力同款', '城市地标', '创意机位', '限定奇观', '夜景', '日落', '免费', '需预约', '人少'];
  function openUpload() {
    up = { photo: null, pos: null, heading: 0, fov: 70, handles: [], steps: [{ text: '', photo: null }], posFrom: '', tags: [] };
    JW.clearSel();
    var d = readDraft();
    JW.openSheet(
      '<span class="tag skill">发布机位</span><h2>分享一个你发现的好角度</h2>' +
      (d ? '<div class="cond wait"><span class="dot"></span><div>有一份 ' + JW.esc(d.saved || '') + ' 存的草稿。<button class="link" data-act="loaddraft">继续编辑</button> · <button class="link" data-act="dropdraft">丢弃</button></div></div>' : '') +
      '<h3>1 · 照片</h3>' +
      '<p class="tip">请<b>直接从手机相册选原图</b>，会自动读出拍摄地点、时间、设备和相机参数。经过微信、小红书转发的照片会丢失这些信息。</p>' +
      '<label class="upload-drop" id="upDrop"><input type="file" accept="image/*" id="upFile" hidden><span id="upDropText">＋ 从相册选择原图</span></label>' +
      '<div id="upMeta"></div>' +
      '<h3>2 · 站位</h3><div id="upInfo"></div>' +
      '<div class="btn-row"><button class="btn-ghost" data-act="here">📍 用我现在的位置</button><button class="btn-ghost" data-act="pick">在地图上点选</button></div>' +
      '<div class="form">' + field('镜头朝向', '<input id="upHeading" type="range" min="0" max="359" value="0"><span id="upHeadingVal" class="muted">0°</span>') + '</div>' +
      '<p class="muted" id="upHeadTip">华为、小米等很多安卓手机的照片里不记录朝向，可以用下面两种方法补上：</p>' +
      '<div class="btn-row"><button class="btn-ghost" data-act="compass">🧭 举起手机对准拍摄方向</button><button class="btn-ghost" data-act="aim">在地图上点镜头对着的地方</button></div>' +
      '<h3>3 · 写帖子</h3><div class="form">' +
      field('标题（机位名称，必填）', '<input id="upName" maxlength="30" placeholder="例如：白玉兰桥下·颠倒世界">') +
      field('正文（选填）', '<textarea id="upBody" rows="5" placeholder="分享出片经验和机位细节：几点来光线最好、具体站在哪、用什么镜头和姿势、有没有门票或人流、要注意什么……"></textarea>') +
      '<label class="field"><span>标签（必填，至少选一个；会用来归类成专题）</span><div class="tag-ed" id="upTags"></div><input id="upTagIn" placeholder="输入标签，按回车添加"></label>' +
      '<div class="tag-sug" id="upSug"></div></div>' +
      '<h3>4 · 路书（可选）：最后一段怎么走</h3><p class="tip">从最近的地铁口或路口开始，每个转弯拍一张照片、写一句话。定位不准的地方，就靠它把人带到位。</p>' +
      '<div id="upSteps"></div><button class="btn-ghost wide" data-act="addstep">＋ 再加一步</button>' +
      '<p class="muted">发布规则：只收录能合法进入的地点；不要用含他人正脸的照片做封面。</p>' +
      '<div class="btn-row publish-row"><button class="btn-ghost" data-act="draft">存草稿</button><button class="btn-main" data-act="save">发布</button></div>'
    );
    document.getElementById('sheet').classList.add('tall');
    $('upFile').addEventListener('change', onPhoto);
    $('upHeading').addEventListener('input', function () { up.heading = +this.value; $('upHeadingVal').textContent = up.heading + '°'; drawUp(true); });
    $('upTagIn').addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ',' || e.key === '，') { e.preventDefault(); addTag(this.value); this.value = ''; } });
    $('upTagIn').addEventListener('blur', function () { if (this.value.trim()) { addTag(this.value); this.value = ''; } });
    renderSteps(); renderTags(); info(); meta();
    JW.bindSheet(function (act) {
      if (act === 'pick') startPick();
      if (act === 'here') hereNow();
      if (act === 'compass') compassHeading();
      if (act === 'aim') aimHeading();
      if (act === 'addstep') { collectSteps(); up.steps.push({ text: '', photo: null }); renderSteps(); }
      if (act === 'draft') saveDraft();
      if (act === 'loaddraft') loadDraft();
      if (act === 'dropdraft') { try { localStorage.removeItem(draftKey()); } catch (e) {} JW.toast('草稿已丢弃'); openUpload(); }
      if (act === 'save') publish();
    });
  }
  // 标签
  function addTag(t) {
    t = String(t || '').replace(/^#+/, '').replace(/[,，\s]+/g, '').slice(0, 12); if (!t) return;
    if (up.tags.indexOf(t) < 0) { if (up.tags.length >= 8) return JW.toast('最多 8 个标签'); up.tags.push(t); }
    renderTags();
  }
  function renderTags() {
    var box = $('upTags'); if (!box) return;
    box.innerHTML = up.tags.map(function (t, i) { return '<span class="tag-chip">#' + JW.esc(t) + '<button data-deltag="' + i + '" aria-label="删除标签">×</button></span>'; }).join('');
    box.querySelectorAll('[data-deltag]').forEach(function (b) { b.onclick = function (e) { e.preventDefault(); up.tags.splice(+b.getAttribute('data-deltag'), 1); renderTags(); }; });
    $('upSug').innerHTML = TAG_SUGGEST.filter(function (t) { return up.tags.indexOf(t) < 0; }).map(function (t) { return '<button data-sug="' + t + '">#' + t + '</button>'; }).join('');
    $('upSug').querySelectorAll('[data-sug]').forEach(function (b) { b.onclick = function (e) { e.preventDefault(); addTag(b.getAttribute('data-sug')); }; });
  }
  // 照片信息：地点、时间、设备、相机参数
  function meta() {
    var box = $('upMeta'); if (!box) return;
    var e = up.exif; if (!up.photo || !e) { box.innerHTML = ''; return; }
    var rows = [];
    rows.push(['拍摄地点', e.lat ? (up.addr || e.lat.toFixed(5) + ', ' + e.lng.toFixed(5)) : '照片里没有位置信息']);
    if (e.time) rows.push(['拍摄时间', e.time.replace(/^(\d+):(\d+):(\d+)/, '$1-$2-$3')]);
    var dev = [e.make && e.model && e.model.indexOf(e.make) < 0 ? e.make : '', e.model].filter(Boolean).join(' ');
    if (dev) rows.push(['拍摄设备', dev]);
    var cam = [e.focal ? Math.round(e.focal * 10) / 10 + 'mm' : '', e.f35 ? '等效 ' + e.f35 + 'mm' : '', e.fnum ? 'f/' + (Math.round(e.fnum * 10) / 10) : '', e.exposure ? (e.exposure >= 1 ? e.exposure + 's' : e.exposure >= 0.3 ? e.exposure.toFixed(1) + 's' : '1/' + Math.round(1 / e.exposure) + 's') : '', e.iso ? 'ISO ' + e.iso : ''].filter(Boolean).join(' · ');
    if (cam) rows.push(['相机参数', cam]);
    if (e.lens) rows.push(['镜头', e.lens]);
    // 用百度逆地理编码把坐标翻译成地址
    if (e.lat && !up.addr && !up.addrTried && window.BMapGL && BMapGL.Geocoder) {
      up.addrTried = true; var p0 = M.wgs2bd(e.lng, e.lat);
      try { new BMapGL.Geocoder().getLocation(new BMapGL.Point(p0[0], p0[1]), function (r) { if (r && r.address) { up.addr = r.address; meta(); } }); } catch (er) {}
    }
    box.innerHTML = '<div class="meta-card">' + rows.map(function (r) { return '<div><span>' + r[0] + '</span><b>' + JW.esc(r[1]) + '</b></div>'; }).join('') + '</div>';
  }
  // 在地图上点选：上传卡片降下去，点地图放点，点 ✓ 锁定后卡片回来
  var picking = null;
  function startPick() {
    picking = { before: up.pos, beforeFrom: up.posFrom };
    document.getElementById('sheet').classList.add('lowered'); document.body.classList.add('picking');
    var bar = document.getElementById('pickBar');
    if (!bar) { bar = document.createElement('div'); bar.id = 'pickBar'; document.body.appendChild(bar); }
    bar.innerHTML = '<div class="pick-t"><b>点地图，放到你拍照时站的位置</b><span id="pickHint">' + (up.pos ? '已有站位，可以点别处改' : '还没选') + '</span></div>' +
      '<button class="pick-x" id="pickCancel" aria-label="取消">取消</button><button class="pick-ok" id="pickOk" aria-label="确定站位">✓</button>';
    $('pickCancel').onclick = function () { up.pos = picking.before; up.posFrom = picking.beforeFrom; endPick(); };
    $('pickOk').onclick = function () { if (!up.pos) return JW.toast('先在地图上点一下'); up.posFrom = '地图点选'; endPick(); JW.toast('站位已锁定'); };
    (function arm() {
      JW.map.pick(function (p) {
        if (!picking) return;
        up.pos = p; drawUp(true); var h = $('pickHint'); if (h) h.textContent = '已放好，点 ✓ 锁定；也可以再点别处';
        arm();
      });
    })();
  }
  function endPick() {
    picking = null;
    document.body.classList.remove('picking'); document.getElementById('sheet').classList.remove('lowered');
    var bar = document.getElementById('pickBar'); if (bar) bar.innerHTML = '';
    drawUp(true); info();
  }
  // 朝向：用手机指南针（站在拍照的位置，把手机背面对准要拍的方向）
  function setHeading(h, from) {
    up.heading = Math.round((h % 360 + 360) % 360); up.headingFrom = from; $('upHeading').value = up.heading; $('upHeadingVal').textContent = up.heading + '°（' + from + '）';
    drawUp(true); info();
  }
  function compassHeading() {
    function listen() {
      var got = false, t = setTimeout(function () { window.removeEventListener('deviceorientationabsolute', h, true); window.removeEventListener('deviceorientation', h, true); if (!got) JW.toast('没读到指南针：请换用“在地图上点镜头对着的地方”', 3500); }, 4000);
      function h(e) {
        var deg = e.webkitCompassHeading != null ? e.webkitCompassHeading : (e.absolute || e.type === 'deviceorientationabsolute') && e.alpha != null ? 360 - e.alpha : null;
        if (deg == null || got) return; got = true; clearTimeout(t);
        window.removeEventListener('deviceorientationabsolute', h, true); window.removeEventListener('deviceorientation', h, true);
        // 手机竖着对准前方时，屏幕朝向会影响读数，这里按竖屏处理
        setHeading(deg, '手机指南针'); JW.toast('朝向已记录：' + up.heading + '°');
      }
      window.addEventListener('deviceorientationabsolute', h, true); window.addEventListener('deviceorientation', h, true);
      JW.toast('请竖着拿手机，背面对准要拍的方向，保持 2 秒');
    }
    if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().then(function (r) { if (r === 'granted') listen(); else JW.toast('没有得到指南针权限'); }).catch(function () { JW.toast('没有得到指南针权限'); });
    } else listen();
  }
  // 朝向：站位确定后，在地图上点一下镜头对着的地方，自动算出方向
  function aimHeading() {
    if (!up.pos) return JW.toast('先确定站位，再点镜头对着的地方');
    document.getElementById('sheet').classList.add('lowered'); document.body.classList.add('picking');
    var bar = document.getElementById('pickBar');
    if (!bar) { bar = document.createElement('div'); bar.id = 'pickBar'; document.body.appendChild(bar); }
    bar.innerHTML = '<div class="pick-t"><b>点一下镜头对着的地方</b><span>比如照片里的那栋楼</span></div><button class="pick-x" id="pickCancel">取消</button>';
    var done = false;
    function end() { done = true; document.body.classList.remove('picking'); document.getElementById('sheet').classList.remove('lowered'); bar.innerHTML = ''; }
    $('pickCancel').onclick = end;
    JW.map.pick(function (p) { if (done) return; end(); setHeading(M.bearing(up.pos, p), '地图上点选'); JW.toast('朝向已记录：' + up.heading + '°'); });
  }
  function hereNow() {
    if (!navigator.geolocation) return JW.toast('这个浏览器不支持定位');
    JW.toast('正在获取你现在的位置…');
    navigator.geolocation.getCurrentPosition(function (p) {
      up.pos = M.wgs2bd(p.coords.longitude, p.coords.latitude); up.posFrom = '我现在的位置（误差约 ' + Math.round(p.coords.accuracy) + ' 米）';
      drawUp(); info();
    }, function () { JW.toast('没拿到定位：请在浏览器设置里允许定位，或在地图上点选', 3500); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  }
  function renderSteps() {
    var box = $('upSteps'); if (!box) return;
    box.innerHTML = up.steps.map(function (st, i) {
      return '<div class="step-ed"><div class="step-no">' + (i + 1) + '</div>' +
        '<label class="step-ph">' + (st.photo ? '<img src="' + st.photo + '">' : '<span>＋ 指路照片</span>') + '<input type="file" accept="image/*" data-step="' + i + '" hidden></label>' +
        '<textarea rows="2" data-steptext="' + i + '" placeholder="' + (i === 0 ? '如：陆家嘴站 1 号口出来，右转上天桥' : i === up.steps.length - 1 ? '最后一步：站在哪、朝哪拍' : '看到什么参照物，往哪转') + '">' + JW.esc(st.text || '') + '</textarea>' +
        (up.steps.length > 1 ? '<button class="step-del" data-del="' + i + '" aria-label="删除这一步">×</button>' : '') + '</div>';
    }).join('');
    box.querySelectorAll('[data-step]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var f = inp.files[0], i = +inp.getAttribute('data-step'); if (!f) return;
        collectSteps();
        readAsDataURL(f).then(function (u) { return shrink(u, 960, 0.75); }).then(function (small) { up.steps[i].photo = small; renderSteps(); }).catch(function () { JW.toast('照片读取失败'); });
      });
    });
    box.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); collectSteps(); up.steps.splice(+b.getAttribute('data-del'), 1); renderSteps(); }); });
  }
  function collectSteps() { document.querySelectorAll('#upSteps [data-steptext]').forEach(function (t) { var i = +t.getAttribute('data-steptext'); if (up.steps[i]) up.steps[i].text = t.value.trim(); }); }
  var FORM_IDS = ['upName', 'upBody'];
  function saveDraft() {
    collectSteps();
    var d = { saved: new Date().toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }), f: {}, photo: up.photo, pos: up.pos, posFrom: up.posFrom, heading: up.heading, fov: up.fov, exif: up.exif || {}, steps: up.steps, tags: up.tags };
    FORM_IDS.forEach(function (id) { var el = $(id); if (el) d.f[id] = el.value; });
    try { localStorage.setItem(draftKey(), JSON.stringify(d)); JW.toast('草稿已存在这台手机上'); }
    catch (e) {
      try { d.photo = null; d.steps = d.steps.map(function (s) { return { text: s.text, photo: null }; }); localStorage.setItem(draftKey(), JSON.stringify(d)); JW.toast('照片太大存不下，已先存文字和站位'); }
      catch (e2) { JW.toast('手机存储空间不足，草稿没存上'); }
    }
  }
  function loadDraft() {
    var d = readDraft(); if (!d) return;
    openUpload();
    Object.keys(d.f || {}).forEach(function (id) { var el = $(id); if (el) el.value = d.f[id]; });
    up.photo = d.photo; up.pos = d.pos; up.posFrom = d.posFrom || ''; up.heading = d.heading || 0; up.fov = d.fov || 70; up.exif = d.exif || {};
    up.steps = d.steps && d.steps.length ? d.steps : [{ text: '', photo: null }]; up.tags = d.tags || [];
    if (up.photo) $('upDrop').innerHTML = '<img src="' + up.photo + '" alt="成片">';
    $('upHeading').value = up.heading; $('upHeadingVal').textContent = up.heading + '°';
    var c = document.querySelector('#sheetBody .cond.wait'); if (c) c.remove();
    renderSteps(); renderTags(); drawUp(); info(); meta(); JW.toast('已载入草稿');
  }
  function field(label, html) { return '<label class="field"><span>' + label + '</span>' + html + '</label>'; }
  function onPhoto(e) {
    var f = e.target.files[0]; if (!f) return;
    var exif = {};
    f.slice(0, 256 * 1024).arrayBuffer().then(function (buf) { try { exif = readExif(buf); } catch (err) { exif = {}; } return readAsDataURL(f); })
      .then(function (url) { return shrink(url, 1280, 0.8); })
      .then(function (small) {
        up.photo = small; up.exif = exif; up.addr = ''; up.addrTried = false;
        $('upDrop').innerHTML = '<img src="' + small + '" alt="成片">';
        if (exif.lat) { up.pos = M.wgs2bd(exif.lng, exif.lat); up.posFrom = '照片里的拍摄位置'; }
        if (exif.heading != null) { up.heading = Math.round(exif.heading) % 360; $('upHeading').value = up.heading; $('upHeadingVal').textContent = up.heading + '°'; }
        up.fov = fovFrom(exif.f35);
        drawUp(); info(); meta();
        if (!exif.lat) JW.toast('这张照片里没有位置信息，可能是转发过的图。可以点“用我现在的位置”或在地图上点选', 4500);
      }).catch(function () { JW.toast('这张照片读取失败，换一张试试'); });
  }
  function info() {
    var e = up.exif || {}, rows = [];
    rows.push(up.pos ? '站位：已确定（' + JW.esc(up.posFrom || '已定位') + '）' : '站位：还没确定。选原图会自动读取；也可以用你现在的位置，或在地图上点选');
    rows.push(up.headingFrom ? '朝向：' + up.heading + '°（' + up.headingFrom + '）' : e.heading != null ? '朝向：' + Math.round(e.heading) + '°（来自照片）' : '朝向：照片里没有，用下面的指南针或地图点选补上');
    rows.push(e.f35 ? '等效焦距 ' + e.f35 + 'mm → 视角约 ' + up.fov + '°' : '焦距：未读到，按主摄约 70° 估算');
    if (e.time) rows.push('拍摄时间：' + e.time.replace(/^(\d+):(\d+):(\d+)/, '$1-$2-$3'));
    $('upInfo').innerHTML = '<div class="cond ' + (up.pos ? 'ok' : 'wait') + '"><span class="dot"></span><div>' + rows.join('<br>') + '</div></div>';
  }
  function drawUp(noFly) {
    up.handles.forEach(function (h) { JW.map.remove(h); }); up.handles = [];
    if (!up.pos) return;
    up.handles.push(JW.map.polygon(M.sectorPoints(up.pos[0], up.pos[1], up.heading, up.fov, 400), JW.COLORS.skill, 0.2));
    up.handles.push(JW.map.addMarker(up.pos[0], up.pos[1], JW.markerSvg('skill', true), 46, null));
    if (!noFly) JW.map.flyTo(up.pos[0], up.pos[1], 17);
  }
  function publish() {
    collectSteps();
    var name = $('upName').value.trim();
    if (!up.photo) return JW.toast('先从相册选一张原图');
    if (!up.pos) return JW.toast('还不知道站位：用你现在的位置，或在地图上点选');
    if (!name) return JW.toast('写个标题（机位名称）');
    if (CLOUD && !Cloud.me()) { JW.toast('发布前请先登录'); return openAccount('login', '登录后发布的机位所有人都能看到，并署上你的名字'); }
    var body = $('upBody').value.trim(), e = up.exif || {};
    var pending = $('upTagIn').value.trim(); if (pending) { addTag(pending); $('upTagIn').value = ''; }
    if (!up.tags.length) { JW.toast('至少选一个标签，比如 #城市地标'); var sug = $('upSug'); if (sug) sug.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    var tags = up.tags.slice();
    // 由标签推出玩法和专题，由拍摄时间推出光线条件（发帖时不用再选）
    var tj = tags.join(' ');
    var type = /奇观|穿月|悬日|月亮/.test(tj) ? 'wonder' : /同款|影视|电影|剧|人民币|钞能力|课本|书本|地球online|动漫|圣地|明星/.test(tj) ? 'classic' : 'skill';
    var cols = tags.map(window.JW_TAGTOPIC).filter(function (k) { return k && k !== 'wonder'; });
    var col = cols[0];
    var hr = e.time ? +e.time.slice(11, 13) : -1;
    var light = /夜景|夜/.test(tj) ? 'night' : /日落|黄金/.test(tj) ? 'golden' : hr >= 19 || (hr >= 0 && hr < 5) ? 'night' : hr >= 16 ? 'golden' : hr >= 5 ? 'day' : 'any';
    var steps = up.steps.filter(function (st) { return st.text || st.photo; });
    var dev = [e.make && e.model && e.model.indexOf(e.make) < 0 ? e.make : '', e.model].filter(Boolean).join(' ');
    var s = {
      id: 'u' + Date.now(), mine: true, type: type, area: '网友发现', name: name, collection: col, topics: cols.slice(1),
      lng: up.pos[0], lat: up.pos[1], heading: up.heading, fov: up.fov,
      cover: up.photo, coverHint: name, summary: body ? body.split('\n')[0].slice(0, 60) : tags.map(function (t) { return '#' + t; }).join(' '), post: body, tags: tags,
      photoMeta: { place: up.addr || '', time: e.time || '', device: dev, lens: e.lens || '', focal: e.focal || null, f35: e.f35 || null, fnum: e.fnum || null, exposure: e.exposure || null, iso: e.iso || null },
      technique: {}, light: light, lightNote: e.time ? '作者拍摄于 ' + e.time.replace(/^(\d+):(\d+):(\d+)/, '$1-$2-$3') : '',
      access: { fee: '', booking: '', hours: '' },
      guide: steps.map(function (st) { return { text: st.text || '（见照片）', photo: st.photo || null }; }),
      crowd: '', status: { ok: true, date: today(), note: '刚刚发布' }, source: '网友发帖', scene: null
    };
    function done(sp) {
      up.handles.forEach(function (h) { JW.map.remove(h); });
      try { localStorage.removeItem(draftKey()); } catch (e) {}
      document.getElementById('sheet').classList.remove('tall');
      JW.addSpot(sp); JW.drawMarkers(); JW.openSpot(sp.id);
      JW.toast('机位已发布到地图上');
    }
    if (!CLOUD) { store.spots.push(s); if (!save()) { store.spots.pop(); return; } return done(s); }
    var btn = document.querySelector('#sheetBody [data-act=save]'); if (btn) { btn.disabled = true; btn.textContent = '正在上传…'; }
    var photos = [up.photo].concat(s.guide.map(function (g) { return g.photo; }));
    Promise.all(photos.map(function (p) { return p ? Cloud.uploadPhoto(p) : Promise.resolve(null); })).then(function (urls) {
      var data = JSON.parse(JSON.stringify(s)); data.cover = urls[0];
      data.guide.forEach(function (g, i) { g.photo = urls[i + 1]; });
      delete data.id; delete data.mine;
      return Cloud.addSpot(data);
    }).then(function (row) {
      var sp = fromRow(row, { [row.user_id]: myProfile || { nickname: '我' } }); store.spots.push(sp); done(sp);
    }).catch(function (e) { JW.toast('发布失败：' + e.message + '（可以先存草稿）', 4500); if (btn) { btn.disabled = false; btn.textContent = '发布'; } });
  }

  // ---------------- 打卡：一段旅途、一个地标、一条路线、一段时光 ----------------
  var ck = null;
  function openCheckin(s, photo) {
    ck = { spot: s, photo: photo || null, result: 'ok', state: 'same' };
    var lc = JW.lightCheck(s);
    JW.openSheet(
      '<span class="tag ' + s.type + '">打卡</span><h2>' + JW.esc(s.name) + '</h2>' +
      '<div class="ck-photo" id="ckPhoto">' + (ck.photo ? '<img src="' + ck.photo + '">' : '<label class="upload-drop"><input type="file" accept="image/*" capture="environment" id="ckFile" hidden><span>＋ 添加你的复刻照（可选）</span></label>') + '</div>' +
      '<h3>拍到了吗</h3><div class="seg" data-g="result"><button data-v="ok" class="on">拍到了</button><button data-v="fail">没拍成</button></div>' +
      '<h3>现场和机位描述一致吗</h3><div class="seg" data-g="state"><button data-v="same" class="on">还在，一样</button><button data-v="changed">已变化</button></div>' +
      '<label class="field"><span>补充一句（会更新到机位状态）</span><input id="ckNote" placeholder="如：天黑后不反光了；施工围挡；下午人少"></label>' +
      '<p class="muted">此刻：' + JW.esc(lc.text) + '</p>' +
      '<div class="btn-row"><button class="btn-main" data-act="done">完成打卡</button></div>'
    );
    document.querySelectorAll('#sheetBody .seg').forEach(function (g) {
      g.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        g.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
        ck[g.getAttribute('data-g')] = b.getAttribute('data-v');
      });
    });
    var f = $('ckFile'); if (f) f.addEventListener('change', function () {
      var file = f.files[0]; if (!file) return;
      readAsDataURL(file).then(function (u) { return shrink(u, 1080, 0.8); }).then(function (u) { ck.photo = u; $('ckPhoto').innerHTML = '<img src="' + u + '">'; });
    });
    JW.bindSheet(function (act) { if (act === 'done') finishCheckin(); });
  }
  function finishCheckin() {
    var s = ck.spot, now = new Date();
    if (CLOUD && !Cloud.me()) { JW.toast('打卡前请先登录'); return openAccount('login', '登录后打卡会记进你的巡礼地图，也会更新这个机位的状态'); }
    var rec = { id: 'c' + now.getTime(), userId: myId(), spotId: s.id, spotName: s.name, date: today(), time: JW.hm(now), result: ck.result, state: ck.state,
      note: $('ckNote').value.trim(), photo: ck.photo, lng: s.lng, lat: s.lat, light: JW.lightCheck(s, now).cls };
    if (!CLOUD) { store.checkins.push(rec); if (!save()) { rec.photo = null; save(); } return afterCheckin(s, rec); }
    var btn = document.querySelector('#sheetBody [data-act=done]'); if (btn) { btn.disabled = true; btn.textContent = '正在保存…'; }
    (rec.photo ? Cloud.uploadPhoto(rec.photo) : Promise.resolve(null)).then(function (url) {
      var data = JSON.parse(JSON.stringify(rec)); data.photo = url; delete data.id; delete data.userId; delete data.spotId;
      return Cloud.addCheckin(s.id, data);
    }).then(function (row) { var r = ckFromRow(row); store.checkins.push(r); afterCheckin(s, r); })
      .catch(function (e) { JW.toast('打卡保存失败：' + e.message, 4000); if (btn) { btn.disabled = false; btn.textContent = '完成打卡'; } });
  }
  function afterCheckin(s, rec) {
    applyCheckins(); JW.drawMarkers();
    JW.openSheet(
      '<span class="tag ' + s.type + '">打卡完成</span><h2>第 ' + s.checkins + ' 次巡礼这个角度</h2>' +
      '<p>一张照片背后，是一段旅途、一个地标、一条路线、一段时光。</p>' +
      '<div class="kv"><span>地标</span><span>' + JW.esc(s.name) + '</span></div>' +
      '<div class="kv"><span>时光</span><span>' + rec.date + ' ' + rec.time + '</span></div>' +
      '<div class="kv"><span>结果</span><span>' + (rec.result === 'ok' ? '拍到了' : '没拍成') + (rec.note ? ' · ' + JW.esc(rec.note) : '') + '</span></div>' +
      '<div class="btn-row">' + (rec.photo ? '<button class="btn-main" data-act="compare">生成对比图</button>' : '') + '<button class="btn-ghost" data-act="share">分享卡片</button><button class="btn-ghost" data-act="mine">我的巡礼地图</button></div>'
    );
    JW.bindSheet(function (act) { if (act === 'compare') openCompare(s, rec.photo); if (act === 'share') openShare(s, rec.photo); if (act === 'mine') { JW.setFilter('all'); openMine(); } });
  }

  // ---------------- 相机复刻：半透明参考画面叠在取景画面上 ----------------
  var cam = { stream: null, spot: null };
  function openCamera(s) {
    cam.spot = s;
    var box = $('cam'); box.classList.add('open'); box.setAttribute('aria-hidden', 'false');
    $('camRef').src = refSrc(s); $('camRef').style.opacity = $('camAlpha').value / 100;
    $('camTip').textContent = (s.technique && (s.technique.facing || s.technique.pose)) || '对齐参考画面后按快门';
    var v = $('camVideo');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return camFallback('这个浏览器不能直接打开相机');
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } }, audio: false })
      .then(function (st) { cam.stream = st; v.srcObject = st; v.play(); $('camHint').textContent = ''; })
      .catch(function () { camFallback('没能打开相机（需要加密链接和相机权限）'); });
  }
  function camFallback(msg) { $('camHint').innerHTML = msg + '<br><label class="btn-ghost dark" style="display:inline-block;margin-top:10px">从相册选一张<input type="file" accept="image/*" id="camPick" hidden></label>'; var p = $('camPick'); if (p) p.addEventListener('change', function () { var f = p.files[0]; if (f) readAsDataURL(f).then(function (u) { return shrink(u, 1080, 0.85); }).then(afterShot); }); }
  function closeCamera() {
    if (cam.stream) cam.stream.getTracks().forEach(function (t) { t.stop(); });
    cam.stream = null; var box = $('cam'); box.classList.remove('open'); box.setAttribute('aria-hidden', 'true');
  }
  function shoot() {
    var v = $('camVideo'); if (!cam.stream || !v.videoWidth) return JW.toast('相机还没准备好');
    var c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    shrink(c.toDataURL('image/jpeg', 0.9), 1080, 0.85).then(afterShot);
  }
  function afterShot(url) { var s = cam.spot; closeCamera(); openCheckin(s, url); }

  // ---------------- 对比图：上面参考画面，下面我的复刻，加台词字幕 ----------------
  function openCompare(s, photo) {
    var line = (s.scene && s.scene.line) || '';
    JW.openSheet(
      '<span class="tag ' + s.type + '">对比图</span><h2>' + JW.esc(s.name) + '</h2>' +
      '<label class="field"><span>字幕（可选，如一句台词）</span><input id="cmpLine" value="' + JW.esc(line) + '" placeholder="如：翠果，打烂她的嘴"></label>' +
      '<div class="cmp-preview"><img id="cmpImg" alt="对比图预览"></div>' +
      '<div class="btn-row"><button class="btn-main" data-act="dl">保存图片</button></div>' +
      '<p class="muted">上下拼图是网友验证过的爆款格式。参考画面只用你自己或已授权的照片，不放影视剧照。</p>'
    );
    function render() { drawCompare(s, photo, $('cmpLine').value.trim()).then(function (u) { var im = $('cmpImg'); if (im) im.src = u; }); }
    $('cmpLine').addEventListener('change', render); render();
    JW.bindSheet(function (act) {
      if (act === 'dl') { var a = document.createElement('a'); a.href = $('cmpImg').src; a.download = (s.name || '机位') + '-对比图.jpg'; document.body.appendChild(a); a.click(); a.remove(); }
    });
  }
  function drawCompare(s, photo, line) {
    var W = 1080, H = 810, F = 170, c = document.createElement('canvas'); c.width = W; c.height = H * 2 + F;
    var g = c.getContext('2d');
    g.fillStyle = '#F6F1E7'; g.fillRect(0, 0, c.width, c.height);
    return Promise.all([loadImg(refSrc(s)), loadImg(photo)]).then(function (imgs) {
      imgs.forEach(function (img, k) {
        var y = k * H, sc = Math.max(W / img.width, H / img.height), w = img.width * sc, h = img.height * sc;
        g.save(); g.beginPath(); g.rect(0, y, W, H); g.clip(); g.drawImage(img, (W - w) / 2, y + (H - h) / 2, w, h); g.restore();
        g.font = '600 30px "PingFang SC","Microsoft YaHei",sans-serif'; g.fillStyle = 'rgba(21,19,17,.6)';
        var tag = k ? '我的复刻' : '参考画面'; var tw = g.measureText(tag).width;
        g.fillRect(24, y + 24, tw + 32, 50); g.fillStyle = '#fff'; g.fillText(tag, 40, y + 60);
        if (line) {
          g.font = '800 56px "PingFang SC","Microsoft YaHei",sans-serif'; g.textAlign = 'center';
          g.lineWidth = 10; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(line, W / 2, y + H - 48);
          g.fillStyle = '#FFF4D6'; g.fillText(line, W / 2, y + H - 48); g.textAlign = 'left';
        }
      });
      var y0 = H * 2;
      g.fillStyle = '#2A2521'; g.font = '700 40px "PingFang SC","Microsoft YaHei",sans-serif'; g.fillText(s.name, 40, y0 + 70);
      g.fillStyle = '#6B625A'; g.font = '28px "PingFang SC","Microsoft YaHei",sans-serif';
      g.fillText((window.JW_CONFIG.BRAND || '') + ' · ' + (window.JW_CONFIG.SLOGAN || '') + ' · ' + today(), 40, y0 + 122);
      try { window.QR.draw(g, spotLink(s), W - 170, y0 + 10, 150, '#2A2521', '#F6F1E7'); } catch (e) {}
      return c.toDataURL('image/jpeg', 0.9);
    });
  }

  // ---------------- 我的巡礼地图 ----------------
  function openMine() {
    JW.clearSel();
    if (CLOUD && !Cloud.me()) return openAccount('login', '登录后可以看到你的巡礼地图：打过卡的机位、走过的路线');
    var uid = myId();
    var list = store.checkins.filter(function (c) { return !CLOUD || c.userId === uid; }).slice().reverse();
    var mine = store.spots.filter(function (s) { return !CLOUD || s.ownerId === uid; });
    var pts = [];
    list.forEach(function (c) { pts.push([c.lng, c.lat]); JW.sel(JW.map.addMarker(c.lng, c.lat, JW.markerSvg('classic', true), 40, function () { JW.openSpot(c.spotId); })); });
    if (pts.length > 1) JW.sel(JW.map.line(pts.slice().reverse(), '#C8553D', 3, true));
    if (pts.length) JW.map.fit(pts.length === 1 ? [pts[0], [pts[0][0] + 0.004, pts[0][1] + 0.004]] : pts);
    var km = 0; for (var i = 1; i < pts.length; i++) km += M.distance(pts[i - 1], pts[i]) / 1000;
    JW.openSheet(
      '<span class="tag classic">我的巡礼</span><h2>' + (list.length ? '已巡礼 ' + list.length + ' 个角度' : '还没有打卡') + '</h2>' +
      (list.length ? '<p class="muted">红色虚线串起你走过的机位，约 ' + km.toFixed(1) + ' 公里。每一次打卡，都是对这个世界的一次巡礼。</p>' : '<p class="muted">到达任意机位后点“打卡”，这里会留下你的旅途、地标、路线和时光。</p>') +
      list.map(function (c) {
        return '<div class="mine-item" data-act="o' + c.id + '">' + (c.photo ? '<img src="' + c.photo + '">' : '<div class="mine-ph"></div>') +
          '<div><b>' + JW.esc(c.spotName) + '</b><div class="muted">' + c.date + ' ' + c.time + ' · ' + (c.result === 'ok' ? '拍到了' : '没拍成') + (c.note ? ' · ' + JW.esc(c.note) : '') + '</div></div></div>';
      }).join('') +
      '<div class="btn-row"><button class="btn-main" data-act="upload">＋ 上传一个新机位</button></div>' +
      (mine.length ? '<h3>我上传的机位（' + mine.length + '）</h3>' + mine.map(function (s) { return '<div class="mine-item" data-act="s' + s.id + '"><img src="' + s.cover + '"><div><b>' + JW.esc(s.name) + '</b><div class="muted">' + JW.TYPE_NAME[s.type] + '</div></div></div>'; }).join('') : '')
    );
    JW.bindSheet(function (act) {
      if (act === 'upload') openUpload();
      else if (act[0] === 'o') { var c = store.checkins.filter(function (x) { return x.id === act.slice(1); })[0]; if (c && c.photo) openCompare(JW.spotById[c.spotId], c.photo); else if (c) JW.openSpot(c.spotId); }
      else if (act[0] === 's') JW.openSpot(act.slice(1));
    });
  }

  // ---------------- 云端数据转换 ----------------
  var myProfile = null;
  function fromRow(row, profs) {
    var d = row.data || {}, p = (profs || {})[row.user_id] || {};
    d.id = 'c_' + row.id; d.rowId = row.id; d.ownerId = row.user_id; d.mine = !!(Cloud.me() && Cloud.me().id === row.user_id);
    d.author = { name: p.nickname || '网友', homepage: p.homepage || '' };
    d.source = '作者：' + d.author.name;
    d.status = d.status || { ok: true, date: (row.created_at || '').slice(0, 10), note: '' };
    return d;
  }
  function ckFromRow(row) { var d = row.data || {}; d.id = row.id; d.userId = row.user_id; d.spotId = row.spot_id; return d; }
  function loadCloud() {
    return Promise.all([Cloud.listSpots(), Cloud.listCheckins()]).then(function (r) {
      var rows = r[0] || [], cks = r[1] || [];
      return Cloud.profiles(rows.map(function (x) { return x.user_id; })).then(function (profs) {
        store.spots = rows.map(function (row) { return fromRow(row, profs); });
        store.checkins = cks.map(ckFromRow);
        store.spots.forEach(function (sp) { JW.addSpot(sp); });
        applyCheckins(); JW.drawMarkers();
        window.dispatchEvent(new Event('jw-data'));
      });
    }).catch(function (e) { JW.toast('云端数据暂时没加载出来：' + e.message, 4000); });
  }

  // ---------------- 分享卡片：成片 + 机位信息 + 二维码 ----------------
  function spotLink(s) { return (CLOUD ? Cloud.site : location.origin + location.pathname) + '#spot=' + encodeURIComponent(s.id); }
  function wrapText(g, text, x, y, maxW, lh, maxLines) {
    var line = '', lines = 0;
    for (var i = 0; i < text.length; i++) {
      var t = line + text[i];
      if (g.measureText(t).width > maxW && line && '，。、：；！？）”》'.indexOf(text[i]) < 0) { g.fillText(line, x, y); y += lh; line = text[i]; if (++lines >= maxLines - 1) { var rest = text.slice(i); while (g.measureText(rest + '…').width > maxW && rest.length) rest = rest.slice(0, -1); g.fillText(rest + (rest.length < text.length - i ? '…' : ''), x, y); return y + lh; } }
      else line = t;
    }
    if (line) g.fillText(line, x, y);
    return y + lh;
  }
  // 画品牌标志：取景四角 + 视锥 + 时间点
  function drawLogo(g, x, y, size) {
    var k = size / 160;
    g.save(); g.translate(x, y); g.scale(k, k);
    g.fillStyle = '#0f0f0f'; g.beginPath(); g.arc(80, 80, 80, 0, 7); g.fill();
    g.fillStyle = '#d7f36b'; g.beginPath(); g.moveTo(80, 118); g.lineTo(46, 54); g.arc(80, 118, 70, Math.PI + 1.08, 2 * Math.PI - 1.08); g.closePath(); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(80, 118, 11, 0, 7); g.fill();
    g.restore();
  }
  // 通用分享面板：预览图 + 一句话（可改）+ 分享 / 保存 / 复制链接
  function sharePanel(opt) {
    JW.openSheet('<span class="tag skill">分享</span><h2>' + JW.esc(opt.title) + '</h2>' +
      '<label class="field"><span>一句话（会印在卡片上，可以改）</span><input id="shLine" maxlength="40" value="' + JW.esc(opt.line || '') + '"></label>' +
      '<div class="cmp-preview"><img id="shareImg" alt="分享卡片"></div>' +
      '<div class="btn-row"><button class="btn-main" data-act="share">分享给朋友</button><button class="btn-ghost" data-act="dl">保存图片</button><button class="btn-ghost" data-act="copy">复制链接</button></div>' +
      '<p class="muted">卡片上有照片、一句话、标志、产品名和二维码，扫码直接打开' + (opt.what || '这个机位') + '。在微信里可以长按图片保存或转发。</p>');
    var cur = null;
    function render() { opt.draw($('shLine').value.trim()).then(function (u) { cur = u; var im = $('shareImg'); if (im) im.src = u; }).catch(function () { JW.toast('卡片生成失败'); }); }
    $('shLine').addEventListener('change', render); render();
    function blob() { var b = atob(cur.split(',')[1]), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return new File([a], opt.file, { type: 'image/jpeg' }); }
    function save() { var a = document.createElement('a'); a.href = cur; a.download = opt.file; document.body.appendChild(a); a.click(); a.remove(); }
    function copy() { (navigator.clipboard ? navigator.clipboard.writeText(opt.link) : Promise.reject()).then(function () { JW.toast('链接已复制'); }).catch(function () { prompt('复制这个链接', opt.link); }); }
    JW.bindSheet(function (act) {
      if (!cur) return JW.toast('卡片还在生成，稍等一下');
      if (act === 'dl') save();
      if (act === 'copy') copy();
      if (act === 'share') {
        var text = ($('shLine').value.trim() || opt.title) + ' ' + opt.link, f = blob();
        if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f], title: opt.title, text: text }).catch(function () {});
        else if (navigator.share) navigator.share({ title: opt.title, text: text, url: opt.link }).catch(function () {});
        else { save(); copy(); JW.toast('已保存卡片并复制链接，可以发给朋友了'); }
      }
    });
  }
  function drawShare(s, photo, line) {
    var W = 1080, IH = 810, H = 1500, c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d'), F = '"PingFang SC","Microsoft YaHei",sans-serif', col = JW.COLORS[s.type] || '#D98C2B';
    g.fillStyle = '#F6F1E7'; g.fillRect(0, 0, W, H);
    return loadImg(photo || refSrc(s)).catch(function () { return loadImg(refSrc(Object.assign({}, s, { cover: null }))); }).then(function (img) {
      var sc = Math.max(W / img.width, IH / img.height);
      g.save(); g.beginPath(); g.rect(0, 0, W, IH); g.clip(); g.drawImage(img, (W - img.width * sc) / 2, (IH - img.height * sc) / 2, img.width * sc, img.height * sc); g.restore();
      // 取景框四角
      g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 8; g.lineCap = 'round';
      [[40, 40, 1, 1], [W - 40, 40, -1, 1], [40, IH - 40, 1, -1], [W - 40, IH - 40, -1, -1]].forEach(function (k) { g.beginPath(); g.moveTo(k[0], k[1] + 60 * k[3]); g.lineTo(k[0], k[1]); g.lineTo(k[0] + 60 * k[2], k[1]); g.stroke(); });
      var y = IH + 70;
      g.fillStyle = col; g.font = '600 30px ' + F; var tag = JW.TYPE_NAME[s.type] || '机位'; var tw = g.measureText(tag).width;
      g.fillRect(56, y - 34, tw + 32, 46); g.fillStyle = '#fff'; g.fillText(tag, 72, y);
      g.fillStyle = '#2A2521'; g.font = '800 54px ' + F; y = wrapText(g, s.name, 56, y + 84, W - 112, 66, 2);
      g.fillStyle = '#6B625A'; g.font = '30px ' + F;
      var meta = [s.area, s.heading != null ? '镜头朝向 ' + Math.round(s.heading) + '°' : '镜头朝天', s.author ? '作者 ' + s.author.name : ''].filter(Boolean).join(' · ');
      g.fillText(meta, 56, y + 6); y += 62;
      g.fillStyle = '#2A2521'; g.font = '32px ' + F; y = wrapText(g, line != null && line !== '' ? line : (s.summary || ''), 56, y, W - 112 - 260, 46, 4);
      var t = s.technique || {}, tips = [t.lens, t.post, ({ day: '需要白天', golden: '黄金时刻最佳', night: '夜景', any: '随时可拍' })[s.light]].filter(Boolean).slice(0, 3);
      g.font = '600 28px ' + F; var x = 56; y = Math.max(y + 10, H - 250);
      tips.forEach(function (tp) { var w = g.measureText(tp).width + 36; if (x + w > W - 330) return; g.fillStyle = '#FFFDF8'; g.strokeStyle = '#E4DCCF'; g.lineWidth = 2; g.beginPath(); g.rect(x, y - 36, w, 52); g.fill(); g.stroke(); g.fillStyle = '#2A2521'; g.fillText(tp, x + 18, y); x += w + 12; });
      drawLogo(g, 50, H - 150, 96); g.fillStyle = '#2A2521'; g.font = '800 40px ' + F; g.fillText(window.JW_CONFIG.BRAND || '移步到位', 160, H - 96);
      g.fillStyle = '#6B625A'; g.font = '28px ' + F; g.fillText(window.JW_CONFIG.SLOGAN || '', 160, H - 56);
      window.QR.draw(g, spotLink(s), W - 296, H - 330, 250, '#2A2521', '#FFFDF8');
      g.fillStyle = '#6B625A'; g.font = '24px ' + F; g.textAlign = 'center'; g.fillText('扫码导航到这个机位', W - 171, H - 50); g.textAlign = 'left';
      return c.toDataURL('image/jpeg', 0.9);
    });
  }
  function openShare(s, photo) {
    sharePanel({ title: s.name, line: s.summary || '', link: spotLink(s), file: s.name + '-移步到位.jpg', what: '这个机位',
      draw: function (line) { return drawShare(s, photo || s.cover, line); } });
  }

  // ---------------- 账号：登录、注册、找回密码、个人资料 ----------------
  function openAccount(tab, hint) {
    if (!CLOUD) return JW.toast('云端还没接好，暂时只能保存在本机');
    if (Cloud.me() && tab !== 'reset') return goProfile();
    tab = tab || 'login';
    var tabs = '<div class="seg" id="acTabs"><button data-v="login" class="' + (tab === 'login' ? 'on' : '') + '">登录</button><button data-v="signup" class="' + (tab === 'signup' ? 'on' : '') + '">注册</button><button data-v="forgot" class="' + (tab === 'forgot' ? 'on' : '') + '">忘记密码</button></div>';
    var body = tab === 'signup'
      ? field('邮箱', '<input id="acEmail" type="email" autocomplete="email" placeholder="用于确认账号和找回密码">') + field('密码（至少 6 位）', '<input id="acPw" type="password" autocomplete="new-password">') +
        field('昵称', '<input id="acNick" placeholder="会显示在你上传的机位上">') + field('个人主页（可选）', '<input id="acHome" placeholder="可以直接粘贴小红书的分享文案，会自动取出链接">') +
        '<div class="btn-row"><button class="btn-main" data-act="signup">注册</button></div><p class="muted">注册后会收到一封确认邮件，点里面的链接就完成了（没收到的话看看垃圾箱）。</p>'
      : tab === 'forgot'
      ? field('注册时用的邮箱', '<input id="acEmail" type="email" autocomplete="email">') + '<div class="btn-row"><button class="btn-main" data-act="forgot">发送重置密码邮件</button></div>'
      : field('邮箱', '<input id="acEmail" type="email" autocomplete="email">') + field('密码', '<input id="acPw" type="password" autocomplete="current-password">') +
        '<div class="btn-row"><button class="btn-main" data-act="login">登录</button></div><p class="muted"><a href="#" id="acResend">没收到确认邮件？重新发送</a></p>';
    JW.openSheet('<span class="tag skill">账号</span><h2>' + (tab === 'signup' ? '加入移步到位' : tab === 'forgot' ? '找回密码' : '欢迎回来') + '</h2>' +
      (hint && tab !== 'forgot' ? '<p class="muted">' + JW.esc(hint) + '</p>' : '') + tabs + '<div class="form">' + body + '</div><div id="acMsg"></div>');
    $('acTabs').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) openAccount(b.getAttribute('data-v'), hint); });
    var rs = $('acResend'); if (rs) rs.addEventListener('click', function (e) { e.preventDefault(); var em = $('acEmail').value.trim(); if (!em) return msg('先在上面填上邮箱', 'wait'); Cloud.resendConfirm(em).then(function () { msg('确认邮件已重新发送，请查收（也看看垃圾箱）', 'ok'); }).catch(function (er) { msg(er.message, 'bad'); }); });
    function msg(t, cls) { $('acMsg').innerHTML = '<div class="cond ' + cls + '"><span class="dot"></span><div>' + JW.esc(t) + '</div></div>'; }
    function busy(act, on) { var b = document.querySelector('#sheetBody [data-act=' + act + ']'); if (b) { b.disabled = on; b.style.opacity = on ? .6 : 1; } }
    JW.bindSheet(function (act) {
      var em = ($('acEmail') || {}).value, pw = ($('acPw') || {}).value;
      em = (em || '').trim();
      if (act === 'login') {
        if (!em || !pw) return msg('请填写邮箱和密码', 'wait');
        busy(act, true); Cloud.signIn(em, pw).then(function () { JW.toast('登录成功'); afterLogin(); }).catch(function (e) { busy(act, false); msg(e.message, 'bad'); });
      }
      if (act === 'signup') {
        var nick = $('acNick').value.trim(), home = $('acHome').value.trim();
        if (!em || !pw || !nick) return msg('邮箱、密码和昵称都要填', 'wait');
        if (pw.length < 6) return msg('密码至少 6 位', 'wait');
        busy(act, true);
        Cloud.signUp(em, pw, nick, home).then(function (r) {
          if (r.loggedIn) { JW.toast('注册成功'); afterLogin(); }
          else JW.openSheet('<span class="tag skill">还差一步</span><h2>去邮箱确认一下</h2><p>确认邮件已经发到 <b>' + JW.esc(em) + '</b>。点邮件里的链接，就会回到这里并自动登录。</p><p class="muted">几分钟还没收到的话，看看垃圾箱；或者回到登录页点“重新发送”。</p>');
        }).catch(function (e) { busy(act, false); msg(e.message, 'bad'); });
      }
      if (act === 'forgot') {
        if (!em) return msg('请填写邮箱', 'wait');
        busy(act, true);
        Cloud.emailRegistered(em).then(function (reg) {
          if (reg === false) { busy(act, false); msg('这个邮箱还没有注册过。检查一下有没有输错，或者点上面的“注册”。', 'bad'); return; }
          return sendReset();
        });
        function sendReset() { return Cloud.resetPassword(em).then(function () {
          msg('重置邮件已发到 ' + em + '。请在这台手机上打开邮件里的链接，会回到这里让你设置新密码。发件人是 1315024279@qq.com，几分钟没收到的话，在收件箱和垃圾邮件里搜一下这个地址。', 'ok');
          // 60 秒后可以重新发送，按钮不再一直是灰的
          var b = document.querySelector('#sheetBody [data-act=forgot]'), left = 60;
          var tm = setInterval(function () { left--; if (!b || !document.body.contains(b)) return clearInterval(tm); b.textContent = left > 0 ? '重新发送（' + left + ' 秒后）' : '重新发送重置邮件'; if (left <= 0) { clearInterval(tm); busy(act, false); } }, 1000);
        }).catch(function (e) { busy(act, false); msg(e.message, 'bad'); }); }
      }
    });
  }
  function openSetPassword() {
    JW.openSheet('<span class="tag skill">重置密码</span><h2>设置一个新密码</h2>' + field('新密码（至少 6 位）', '<input id="acNew" type="password" autocomplete="new-password">') +
      '<div class="btn-row"><button class="btn-main" data-act="setpw">保存新密码</button></div><div id="acMsg"></div>');
    JW.bindSheet(function () {
      var pw = $('acNew').value; if (pw.length < 6) { JW.toast('密码至少 6 位'); return; }
      Cloud.updatePassword(pw).then(function () { JW.toast('新密码已保存，已登录'); afterLogin(); }).catch(function (e) { JW.toast(e.message, 4000); });
    });
  }
  function openProfile() {
    var u = Cloud.me();
    Cloud.profile(u.id).then(function (p) {
      myProfile = p || { nickname: (u.user_metadata || {}).nickname || '', homepage: (u.user_metadata || {}).homepage || '' };
      var mySpots = store.spots.filter(function (s) { return s.ownerId === u.id; }), myCks = store.checkins.filter(function (c) { return c.userId === u.id; });
      JW.openSheet('<span class="tag skill">我的</span><h2>' + JW.esc(myProfile.nickname || '未命名') + '</h2><p class="muted">' + JW.esc(u.email || '') + '</p>' +
        '<div class="kv"><span>我上传的机位</span><span>' + mySpots.length + ' 个</span></div><div class="kv"><span>我的打卡</span><span>' + myCks.length + ' 次</span></div>' +
        '<div class="btn-row"><button class="btn-main" data-act="mine">我的巡礼地图</button><button class="btn-ghost" data-act="upload">＋ 上传机位</button></div>' +
        '<h3>资料</h3><div class="form">' + field('昵称', '<input id="pfNick" value="' + JW.esc(myProfile.nickname || '') + '">') + field('个人主页', '<input id="pfHome" value="' + JW.esc(myProfile.homepage || '') + '" placeholder="小红书等主页链接">') + '</div>' +
        '<div class="btn-row"><button class="btn-ghost" data-act="save">保存资料</button><button class="btn-ghost" data-act="demo">▶ 看演示</button><button class="btn-ghost" data-act="out">退出登录</button></div>');
      JW.bindSheet(function (act) {
        if (act === 'mine') openMine();
        if (act === 'upload') openUpload();
        if (act === 'out') { Cloud.signOut(); refreshAccountBtn(); loadCloud(); JW.closeSheet(); JW.toast('已退出登录'); }
        if (act === 'save') Cloud.saveProfile({ nickname: $('pfNick').value.trim() || myProfile.nickname, homepage: $('pfHome').value.trim() })
          .then(function (r) { myProfile = r && r[0] || myProfile; JW.toast('资料已保存'); refreshAccountBtn(); loadCloud(); }).catch(function (e) { JW.toast(e.message, 4000); });
      });
    }).catch(function (e) { JW.toast(e.message, 4000); });
  }
  function goProfile() { if (window.Views) window.Views.show('profile'); else openProfile(); }
  var pendingAfterLogin = null;
  function afterLogin() {
    refreshAccountBtn(); touch();
    loadCloud().then(function () { var f = pendingAfterLogin; pendingAfterLogin = null; if (f) f(); else goProfile(); });
  }
  // 登录状态：15 分钟没有任何操作就自动退出
  var IDLE = 15 * 60 * 1000, LKEY = 'yjdw_last';
  function touch() { try { localStorage.setItem(LKEY, String(Date.now())); } catch (e) {} }
  function lastActive() { try { return +localStorage.getItem(LKEY) || 0; } catch (e) { return 0; } }
  function checkIdle() {
    if (!CLOUD || !Cloud.me()) return;
    if (!lastActive()) return touch();
    if (Date.now() - lastActive() > IDLE) { Cloud.signOut(); refreshAccountBtn(); loadCloud(); JW.toast('15 分钟没有操作，已自动退出登录', 3500); if (window.Views) window.Views.refresh(); }
  }
  var lastTouch = 0;
  ['click', 'touchstart', 'keydown'].forEach(function (ev) { document.addEventListener(ev, function () { var n = Date.now(); if (n - lastTouch > 20000) { lastTouch = n; if (!(CLOUD && Cloud.me() && n - lastActive() > IDLE)) touch(); } }, { passive: true, capture: true }); });
  function refreshAccountBtn() {
    var b = $('btnAccount'); if (!b) return;
    if (!CLOUD) { b.style.display = 'none'; return; }
    var u = Cloud.me(); b.textContent = u ? ((u.user_metadata || {}).nickname || '我的') : '登录';
  }

  function init() {
    JW = window.JW; load();
    checkIdle(); setInterval(checkIdle, 30000);
    if (CLOUD) Cloud.onChange(function (ses) { if (ses) touch(); });
    document.getElementById('sheetClose').addEventListener('click', function () { document.getElementById('sheet').classList.remove('tall'); if (picking) endPick(); });
    if (CLOUD) { store.spots = []; store.checkins = []; }
    store.spots.forEach(function (s) { JW.addSpot(s); });
    Object.keys(JW.spotById).forEach(function (id) { var s = JW.spotById[id]; s._baseCheckins = s.checkins || 0; });
    applyCheckins(); JW.drawMarkers();
    refreshAccountBtn();
    var hashSpot = (location.hash.match(/spot=([^&]+)/) || [])[1];
    var auth = CLOUD ? Cloud.consumeHash() : null;
    var ready = CLOUD ? Promise.resolve(auth).then(function (a) {
      if (a && a.error) JW.toast(a.error, 4000);
      refreshAccountBtn();
      return loadCloud().then(function () { return a; });
    }) : Promise.resolve(null);
    ready.then(function (a) {
      if (a && a.type === 'recovery') return openSetPassword();
      if (a && (a.type === 'signup' || a.type === 'magiclink' || a.type === 'invite')) { JW.toast('邮箱已确认，欢迎加入！'); return goProfile(); }
      if (hashSpot) { var id = decodeURIComponent(hashSpot); if (JW.spotById[id]) JW.openSpot(id); else JW.toast('这个机位找不到了，可能已被作者删除'); }
    });
    $('camClose').addEventListener('click', closeCamera);
    $('camShot').addEventListener('click', shoot);
    $('camAlpha').addEventListener('input', function () { $('camRef').style.opacity = this.value / 100; });
    $('btnUpload').addEventListener('click', openUpload);
  }
  window.JWX = { camera: openCamera, checkin: openCheckin, openMine: openMine, openUpload: openUpload, openCompare: openCompare, readExif: readExif, drawCompare: drawCompare,
    share: openShare, drawShare: drawShare, account: openAccount, sharePanel: sharePanel, drawLogo: drawLogo, loadImg: loadImg, refSrc: refSrc,
    wrapText: wrapText, spotLink: spotLink, get store() { return store; }, myId: myId, loadCloud: function () { return CLOUD ? loadCloud() : Promise.resolve(); },
    refreshAccountBtn: function () { refreshAccountBtn(); }, isCloud: CLOUD,
    afterLoginDo: function (f) { pendingAfterLogin = f; }, idleLeft: function () { return Math.max(0, IDLE - (Date.now() - lastActive())); } };
  if (window.JW && window.JW.ready) init(); else window.addEventListener('jw-ready', init, { once: true });
})();
