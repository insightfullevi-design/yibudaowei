// 点赞 ♥ 与收藏 ★：登录后存到云端 reactions 表；云端表还没建好时先存在本机
(function () {
  var Cloud = window.Cloud, CLOUD = !!(Cloud && Cloud.enabled());
  var LKEY = 'yjdw_react';
  var rows = [], cloudOk = CLOUD, loaded = false, listeners = [];
  function uid() { return CLOUD && Cloud.me() ? Cloud.me().id : 'guest'; }
  function local() { try { return JSON.parse(localStorage.getItem(LKEY) || '[]'); } catch (e) { return []; } }
  function saveLocal(list) { try { localStorage.setItem(LKEY, JSON.stringify(list)); } catch (e) {} }
  function all() { return cloudOk ? rows : local(); }
  function has(kind, id) { var u = uid(); return all().some(function (r) { return r.user_id === u && r.spot_id === id && r.kind === kind; }); }
  function count(kind, id) { return all().filter(function (r) { return r.spot_id === id && r.kind === kind; }).length; }
  function mine(kind) { var u = uid(); return all().filter(function (r) { return r.user_id === u && r.kind === kind; }).map(function (r) { return r.spot_id; }); }
  function emit() { listeners.forEach(function (f) { f(); }); }
  function load() {
    if (!CLOUD) { loaded = true; return Promise.resolve(); }
    return Cloud.listReactions().then(function (r) { rows = r || []; cloudOk = true; loaded = true; emit(); })
      .catch(function () { cloudOk = false; loaded = true; emit(); });
  }
  function toggle(kind, id) {
    if (CLOUD && !Cloud.me()) {
      window.JW.toast(kind === 'like' ? '登录后就能点赞' : '登录后就能收藏，在“我的”里随时找到');
      if (window.JWX) window.JWX.account('login', '登录后点赞和收藏会保存在你的账号里');
      return Promise.resolve(false);
    }
    var on = has(kind, id), u = uid();
    if (!cloudOk) {
      var l = local().filter(function (r) { return !(r.user_id === u && r.spot_id === id && r.kind === kind); });
      if (!on) l.push({ user_id: u, spot_id: id, kind: kind });
      saveLocal(l); emit(); return Promise.resolve(!on);
    }
    if (on) rows = rows.filter(function (r) { return !(r.user_id === u && r.spot_id === id && r.kind === kind); });
    else rows.push({ user_id: u, spot_id: id, kind: kind });
    emit();
    return (on ? Cloud.delReaction(id, kind) : Cloud.addReaction(id, kind)).then(function () { return !on; })
      .catch(function (e) { window.JW.toast('没保存成功：' + e.message, 3000); return load().then(function () { return on; }); });
  }
  // 生成 ♥ ★ 两个按钮；dark 用在深色大图上
  function buttons(id, dark) {
    var lk = has('like', id), fv = has('fav', id), n = count('like', id), m = count('fav', id);
    return '<button class="rx' + (lk ? ' on' : '') + (dark ? ' dark' : '') + '" data-rx="like" data-id="' + id + '" aria-label="点赞"><i>' + (lk ? '♥' : '♡') + '</i><span>' + (n || '点赞') + '</span></button>' +
      '<button class="rx fav' + (fv ? ' on' : '') + (dark ? ' dark' : '') + '" data-rx="fav" data-id="' + id + '" aria-label="收藏"><i>' + (fv ? '★' : '☆') + '</i><span>' + (m || '收藏') + '</span></button>';
  }
  // 只有一颗星的收藏按钮（地图底部卡片用）
  function star(id) { var fv = has('fav', id); return '<button class="rx-star' + (fv ? ' on' : '') + '" data-rx="fav" data-id="' + id + '" aria-label="' + (fv ? '取消收藏' : '收藏') + '">' + (fv ? '★' : '☆') + '</button>'; }
  // 事件委托：页面任何地方的 ♥ ★ 按钮都能用
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-rx]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    var kind = b.getAttribute('data-rx'), id = b.getAttribute('data-id');
    toggle(kind, id).then(function (on) { if (on) window.JW.toast(kind === 'like' ? '已点赞' : '已收藏，在“我的 · 收藏”里找到它'); });
  }, true);
  // 状态变化时刷新页面上所有按钮
  listeners.push(function () {
    document.querySelectorAll('[data-rxbox]').forEach(function (box) { box.innerHTML = buttons(box.getAttribute('data-rxbox'), box.hasAttribute('data-dark')); });
    document.querySelectorAll('[data-rxstar]').forEach(function (box) { box.innerHTML = star(box.getAttribute('data-rxstar')); });
  });
  if (CLOUD && Cloud.onChange) Cloud.onChange(function () { load(); });
  window.Social = { load: load, has: has, count: count, mine: mine, toggle: toggle, buttons: buttons, star: star, onChange: function (f) { listeners.push(f); }, get cloudOk() { return cloudOk; } };
  load();
})();
