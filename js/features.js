// 上传机位 · 打卡 · 相机复刻 · 对比图 · 我的巡礼
// 参赛版没有服务器：用户上传的机位和打卡记录保存在这台设备的浏览器里。
(function () {
  var JW, M = window.JWMap, $ = function (id) { return document.getElementById(id); };
  var KEY = 'yjdw_v1';

  // ---------------- 本机存储（失败也不影响使用） ----------------
  var store = { spots: [], checkins: [] };
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
  function loadImg(src) { return new Promise(function (ok, no) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = no; i.src = src; }); }
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
    function str(p, cnt) { var s = ''; for (var i = 0; i < cnt - 1; i++) s += String.fromCharCode(v.getUint8(p + i)); return s; }
    var exifPtr = 0, gpsPtr = 0;
    ifd(t + u32(t + 4), function (tag, type, cnt, p) { if (tag === 0x8769) exifPtr = u32(p); if (tag === 0x8825) gpsPtr = u32(p); });
    if (exifPtr) ifd(t + exifPtr, function (tag, type, cnt, p) {
      if (tag === 0x9003) out.time = str(valOff(cnt, 1, p), cnt);
      if (tag === 0xA405) out.f35 = u16(p);
      if (tag === 0x920A) out.focal = rat(valOff(1, 8, p));
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

  // ---------------- 上传机位 ----------------
  var up = null;
  function openUpload() {
    up = { photo: null, pos: null, heading: 0, fov: 70, handles: [] };
    JW.clearSel();
    JW.openSheet(
      '<span class="tag skill">上传机位</span><h2>分享一个你发现的好角度</h2>' +
      '<p class="muted">请选手机拍的<b>原图</b>：经过微信、小红书转发的照片会丢失位置和朝向信息。</p>' +
      '<label class="upload-drop" id="upDrop"><input type="file" accept="image/*" id="upFile" hidden><span id="upDropText">＋ 选择成片原图</span></label>' +
      '<div id="upInfo"></div>' +
      '<div class="form">' +
      field('名称', '<input id="upName" placeholder="例如：白玉兰桥下·颠倒世界">') +
      field('玩法', '<select id="upType"><option value="classic">名场面复刻</option><option value="skill" selected>技法出片</option><option value="wonder">专业奇观</option></select>') +
      field('镜头朝向', '<input id="upHeading" type="range" min="0" max="359" value="0"><span id="upHeadingVal" class="muted">0°</span>') +
      field('光线条件', '<select id="upLight"><option value="any">随时都行</option><option value="day">需要白天</option><option value="golden">黄金时刻最佳</option><option value="night">夜景</option></select>') +
      field('一句话介绍', '<input id="upSummary" placeholder="这个机位妙在哪">') +
      field('拍法', '<input id="upPose" placeholder="姿势，如：手机贴近桥底，镜头朝上"><input id="upLens" placeholder="镜头，如：广角 0.5 倍"><input id="upPost" placeholder="后期或道具（可不填）">') +
      '<details class="more"><summary>名场面信息（可选）</summary>' +
      field('来源作品', '<input id="upWork" placeholder="如：小时代">') + field('场景', '<input id="upMoment" placeholder="如：众人从楼梯走下">') +
      field('台词', '<input id="upLine" placeholder="生成对比图时作为字幕">') + field('剧中地点 / 实际拍摄地', '<input id="upStory" placeholder="剧中地点"><input id="upReal" placeholder="实际拍摄地">') + '</details>' +
      field('路书（一行一步）', '<textarea id="upGuide" rows="4" placeholder="地铁 2 号线陆家嘴站 1 号口出&#10;沿天桥往东方明珠方向走&#10;在第三根灯柱旁停下，转身背对江面"></textarea>') +
      field('进入与规则', '<input id="upAccess" placeholder="如：免费、全天开放；或需门票、需预约">') +
      '</div><div class="btn-row"><button class="btn-ghost" data-act="pick">在地图上点选站位</button><button class="btn-main" data-act="save">发布机位</button></div>' +
      '<p class="muted">发布规则：只收录能合法进入的地点；不要上传包含他人正脸的照片作为封面。</p>'
    );
    $('upFile').addEventListener('change', onPhoto);
    $('upHeading').addEventListener('input', function () { up.heading = +this.value; $('upHeadingVal').textContent = up.heading + '°'; drawUp(); });
    JW.bindSheet(function (act) {
      if (act === 'pick') { JW.toast('在地图上点一下你拍照时站的位置'); JW.map.pick(function (p) { up.pos = p; drawUp(); info(); JW.toast('站位已更新'); }); }
      if (act === 'save') publish();
    });
  }
  function field(label, html) { return '<label class="field"><span>' + label + '</span>' + html + '</label>'; }
  function onPhoto(e) {
    var f = e.target.files[0]; if (!f) return;
    var exif = {};
    f.slice(0, 256 * 1024).arrayBuffer().then(function (buf) { try { exif = readExif(buf); } catch (err) { exif = {}; } return readAsDataURL(f); })
      .then(function (url) { return shrink(url, 1280, 0.8); })
      .then(function (small) {
        up.photo = small; up.exif = exif;
        $('upDrop').innerHTML = '<img src="' + small + '" alt="成片">';
        if (exif.lat) up.pos = M.wgs2bd(exif.lng, exif.lat);
        if (exif.heading != null) { up.heading = Math.round(exif.heading) % 360; $('upHeading').value = up.heading; $('upHeadingVal').textContent = up.heading + '°'; }
        up.fov = fovFrom(exif.f35);
        drawUp(); info();
      }).catch(function () { JW.toast('这张照片读取失败，换一张试试'); });
  }
  function info() {
    var e = up.exif || {}, rows = [];
    rows.push(up.pos ? '站位：已定位' + (e.lat ? '（来自照片）' : '（地图点选）') : '站位：<b>照片里没有位置信息</b>，请点“在地图上点选站位”');
    rows.push(e.heading != null ? '朝向：' + Math.round(e.heading) + '°（来自照片）' : '朝向：照片里没有，请拖动滑块调整');
    rows.push(e.f35 ? '等效焦距 ' + e.f35 + 'mm → 视角约 ' + up.fov + '°' : '焦距：未读到，按主摄约 70° 估算');
    if (e.time) rows.push('拍摄时间：' + e.time.replace(/^(\d+):(\d+):(\d+)/, '$1-$2-$3'));
    $('upInfo').innerHTML = '<div class="cond ' + (up.pos ? 'ok' : 'wait') + '"><span class="dot"></span><div>' + rows.join('<br>') + '</div></div>';
  }
  function drawUp() {
    up.handles.forEach(function (h) { JW.map.remove(h); }); up.handles = [];
    if (!up.pos) return;
    up.handles.push(JW.map.polygon(M.sectorPoints(up.pos[0], up.pos[1], up.heading, up.fov, 400), JW.COLORS.skill, 0.2));
    up.handles.push(JW.map.addMarker(up.pos[0], up.pos[1], JW.markerSvg('skill', true), 46, null));
    JW.map.flyTo(up.pos[0], up.pos[1], 17);
  }
  function publish() {
    var name = $('upName').value.trim();
    if (!up.photo) return JW.toast('先选一张成片');
    if (!up.pos) return JW.toast('还不知道站位：请在地图上点选');
    if (!name) return JW.toast('给机位起个名字');
    var type = $('upType').value, work = $('upWork').value.trim();
    var s = {
      id: 'u' + Date.now(), mine: true, type: type, area: '我上传的', name: name,
      lng: up.pos[0], lat: up.pos[1], heading: up.heading, fov: up.fov,
      cover: up.photo, coverHint: name, summary: $('upSummary').value.trim() || '网友发现的机位',
      technique: { pose: $('upPose').value.trim(), lens: $('upLens').value.trim(), facing: '镜头朝向 ' + up.heading + '°', post: $('upPost').value.trim(), prop: '' },
      light: $('upLight').value, lightNote: '',
      access: { fee: '', booking: '', hours: $('upAccess').value.trim() },
      guide: $('upGuide').value.split('\n').map(function (t) { return t.trim(); }).filter(Boolean).map(function (t) { return { text: t }; }),
      crowd: '', status: { ok: true, date: today(), note: '刚刚发布' }, source: '本机上传',
      scene: work ? { source: '影视名场面', work: work, moment: $('upMoment').value.trim(), line: $('upLine').value.trim(), storyPlace: $('upStory').value.trim(), realPlace: $('upReal').value.trim() } : null
    };
    store.spots.push(s);
    if (!save()) { store.spots.pop(); return; }
    up.handles.forEach(function (h) { JW.map.remove(h); });
    JW.addSpot(s); JW.drawMarkers(); JW.openSpot(s.id);
    JW.toast('机位已发布到地图上');
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
    var rec = { id: 'c' + now.getTime(), spotId: s.id, spotName: s.name, date: today(), time: JW.hm(now), result: ck.result, state: ck.state,
      note: $('ckNote').value.trim(), photo: ck.photo, lng: s.lng, lat: s.lat, light: JW.lightCheck(s, now).cls };
    store.checkins.push(rec);
    if (!save()) { rec.photo = null; save(); }
    applyCheckins(); JW.drawMarkers();
    JW.openSheet(
      '<span class="tag ' + s.type + '">打卡完成</span><h2>第 ' + s.checkins + ' 次巡礼这个角度</h2>' +
      '<p>一张照片背后，是一段旅途、一个地标、一条路线、一段时光。</p>' +
      '<div class="kv"><span>地标</span><span>' + JW.esc(s.name) + '</span></div>' +
      '<div class="kv"><span>时光</span><span>' + rec.date + ' ' + rec.time + '</span></div>' +
      '<div class="kv"><span>结果</span><span>' + (rec.result === 'ok' ? '拍到了' : '没拍成') + (rec.note ? ' · ' + JW.esc(rec.note) : '') + '</span></div>' +
      '<div class="btn-row">' + (rec.photo ? '<button class="btn-main" data-act="compare">生成对比图</button>' : '') + '<button class="btn-ghost" data-act="mine">我的巡礼地图</button></div>'
    );
    JW.bindSheet(function (act) { if (act === 'compare') openCompare(s, rec.photo); if (act === 'mine') { JW.setFilter('all'); openMine(); } });
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
      g.fillStyle = '#D98C2B'; g.beginPath(); g.moveTo(W - 90, y0 + 120); g.arc(W - 90, y0 + 120, 70, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5); g.closePath(); g.fill();
      g.fillStyle = '#2A2521'; g.beginPath(); g.arc(W - 90, y0 + 120, 11, 0, Math.PI * 2); g.fill();
      return c.toDataURL('image/jpeg', 0.9);
    });
  }

  // ---------------- 我的巡礼地图 ----------------
  function openMine() {
    JW.clearSel();
    var list = store.checkins.slice().reverse(), mine = store.spots;
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

  function init() {
    JW = window.JW; load();
    store.spots.forEach(function (s) { JW.addSpot(s); });
    Object.keys(JW.spotById).forEach(function (id) { var s = JW.spotById[id]; s._baseCheckins = s.checkins || 0; });
    applyCheckins(); JW.drawMarkers();
    $('camClose').addEventListener('click', closeCamera);
    $('camShot').addEventListener('click', shoot);
    $('camAlpha').addEventListener('input', function () { $('camRef').style.opacity = this.value / 100; });
    $('btnUpload').addEventListener('click', openUpload);
  }
  window.JWX = { camera: openCamera, checkin: openCheckin, openMine: openMine, openUpload: openUpload, openCompare: openCompare, readExif: readExif, drawCompare: drawCompare };
  if (window.JW && window.JW.ready) init(); else window.addEventListener('jw-ready', init, { once: true });
})();
