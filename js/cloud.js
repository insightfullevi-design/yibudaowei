// 云端账号与数据（Supabase），直接调用它的网页接口，不依赖外部脚本库
(function () {
  var C = window.JW_CONFIG || {};
  var BASE = (C.SUPABASE_URL || '').replace(/\/$/, ''), KEY = C.SUPABASE_KEY || '';
  var SITE = C.SITE_URL || (location.origin + location.pathname);
  var SKEY = 'yjdw_session';
  var session = null, listeners = [];

  function enabled() { return !!(BASE && KEY); }
  function saveSession(s) { session = s; try { s ? localStorage.setItem(SKEY, JSON.stringify(s)) : localStorage.removeItem(SKEY); } catch (e) {} listeners.forEach(function (f) { f(s); }); }
  function loadSession() { try { var t = localStorage.getItem(SKEY); if (t) session = JSON.parse(t); } catch (e) {} }
  function toSession(r) {
    return { access_token: r.access_token, refresh_token: r.refresh_token, expires_at: r.expires_at || Math.floor(Date.now() / 1000) + (+r.expires_in || 3600), user: r.user };
  }

  // 把接口返回的英文错误翻成中文提示
  function zh(msg) {
    var m = String(msg || '');
    var map = [
      [/Invalid login credentials/i, '邮箱或密码不对'],
      [/Email not confirmed/i, '邮箱还没确认：请先去邮箱点确认链接（也看看垃圾箱）'],
      [/User already registered/i, '这个邮箱已经注册过了，直接登录或找回密码'],
      [/Password should be at least/i, '密码至少 6 位'],
      [/rate limit|too many/i, '操作太频繁，请过一会儿再试'],
      [/Unable to validate email|invalid format/i, '邮箱格式不对'],
      [/New password should be different/i, '新密码不能和旧密码一样'],
      [/JWT expired/i, '登录已过期，请重新登录'],
      [/Failed to fetch|NetworkError/i, '网络连不上云端，稍后再试']
    ];
    for (var i = 0; i < map.length; i++) if (map[i][0].test(m)) return map[i][1];
    return m || '出了点问题，请稍后再试';
  }

  function req(path, opt) {
    opt = opt || {};
    var h = { apikey: KEY, 'Content-Type': 'application/json' };
    if (opt.auth !== false && session) h.Authorization = 'Bearer ' + session.access_token;
    Object.keys(opt.headers || {}).forEach(function (k) { h[k] = opt.headers[k]; });
    return fetch(BASE + path, { method: opt.method || 'GET', headers: h, body: opt.body }).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = t; }
        if (!r.ok) throw new Error(zh((j && (j.msg || j.message || j.error_description || j.error)) || r.statusText));
        return j;
      });
    }).catch(function (e) { throw new Error(zh(e.message)); });
  }

  // 登录状态快过期时自动续期
  function fresh() {
    if (!session) return Promise.resolve(null);
    if (session.expires_at - 60 > Date.now() / 1000) return Promise.resolve(session);
    return req('/auth/v1/token?grant_type=refresh_token', { method: 'POST', auth: false, body: JSON.stringify({ refresh_token: session.refresh_token }) })
      .then(function (r) { saveSession(toSession(r)); return session; })
      .catch(function () { saveSession(null); return null; });
  }

  // ---------- 账号 ----------
  function signUp(email, password, nickname, homepage) {
    return req('/auth/v1/signup?redirect_to=' + encodeURIComponent(SITE), { method: 'POST', auth: false,
      body: JSON.stringify({ email: email, password: password, data: { nickname: nickname, homepage: homepage || '' } }) })
      .then(function (r) {
        if (r && r.access_token) { saveSession(toSession(r)); return { loggedIn: true }; }
        // 邮箱已注册时接口会返回一个没有身份记录的用户，按“已注册”提示
        if (r && r.identities && r.identities.length === 0) throw new Error('这个邮箱已经注册过了，直接登录或找回密码');
        return { needConfirm: true };
      });
  }
  function signIn(email, password) {
    return req('/auth/v1/token?grant_type=password', { method: 'POST', auth: false, body: JSON.stringify({ email: email, password: password }) })
      .then(function (r) { saveSession(toSession(r)); return session; });
  }
  function signOut() { var s = session; saveSession(null); if (s) fetch(BASE + '/auth/v1/logout', { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + s.access_token } }).catch(function () {}); }
  function resetPassword(email) {
    return req('/auth/v1/recover?redirect_to=' + encodeURIComponent(SITE), { method: 'POST', auth: false, body: JSON.stringify({ email: email }) });
  }
  function updatePassword(pw) { return fresh().then(function () { return req('/auth/v1/user', { method: 'PUT', body: JSON.stringify({ password: pw }) }); }); }
  function resendConfirm(email) {
    return req('/auth/v1/resend?redirect_to=' + encodeURIComponent(SITE), { method: 'POST', auth: false, body: JSON.stringify({ type: 'signup', email: email }) });
  }

  // 邮件链接点回来时，网址井号后面带着登录凭据；读出来并清掉网址
  function consumeHash() {
    var h = location.hash.replace(/^#/, ''); if (!/access_token=|error_description=/.test(h)) return null;
    var p = {}; h.split('&').forEach(function (kv) { var i = kv.indexOf('='); if (i > 0) p[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' ')); });
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    if (p.error_description) return { error: /expired|invalid/i.test(p.error_description) ? '链接已失效，请重新发送邮件' : p.error_description };
    var s = { access_token: p.access_token, refresh_token: p.refresh_token, expires_at: +p.expires_at || Math.floor(Date.now() / 1000) + (+p.expires_in || 3600), user: null };
    session = s;
    return req('/auth/v1/user').then(function (u) { s.user = u; saveSession(s); return { type: p.type }; })
      .catch(function (e) { saveSession(null); return { error: e.message }; });
  }

  // ---------- 数据 ----------
  function me() { return session && session.user; }
  function profile(uid) { return req('/rest/v1/profiles?id=eq.' + uid + '&select=*', { auth: false }).then(function (r) { return r && r[0]; }); }
  function saveProfile(p) {
    p.id = me().id; // 资料不存在就新建，存在就更新
    return fresh().then(function () { return req('/rest/v1/profiles', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(p) }); });
  }
  function profiles(ids) {
    ids = ids.filter(function (x, i) { return x && ids.indexOf(x) === i; });
    if (!ids.length) return Promise.resolve({});
    return req('/rest/v1/profiles?select=id,nickname,homepage&id=in.(' + ids.join(',') + ')', { auth: false })
      .then(function (r) { var m = {}; (r || []).forEach(function (p) { m[p.id] = p; }); return m; });
  }
  function listSpots() { return req('/rest/v1/spots?select=id,user_id,data,created_at&order=created_at.desc&limit=500', { auth: false }); }
  function addSpot(data) {
    return fresh().then(function () { return req('/rest/v1/spots', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ user_id: me().id, data: data }) }); })
      .then(function (r) { return r[0]; });
  }
  function deleteSpot(id) { return fresh().then(function () { return req('/rest/v1/spots?id=eq.' + id, { method: 'DELETE' }); }); }
  function listCheckins() { return req('/rest/v1/checkins?select=id,user_id,spot_id,data,created_at&order=created_at.asc&limit=1000', { auth: false }); }
  function addCheckin(spotId, data) {
    return fresh().then(function () { return req('/rest/v1/checkins', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ user_id: me().id, spot_id: spotId, data: data }) }); })
      .then(function (r) { return r[0]; });
  }
  // 上传照片到“photos/用户编号/时间.jpg”，返回公开网址
  function uploadPhoto(dataUrl) {
    return fresh().then(function () {
      var bin = atob(dataUrl.split(',')[1]), arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      var path = me().id + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.jpg';
      return fetch(BASE + '/storage/v1/object/photos/' + path, { method: 'POST',
        headers: { apikey: KEY, Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'image/jpeg', 'x-upsert': 'false' },
        body: new Blob([arr], { type: 'image/jpeg' }) })
        .then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(zh(t)); }); return BASE + '/storage/v1/object/public/photos/' + path; });
    });
  }

  loadSession();
  window.Cloud = {
    enabled: enabled, site: SITE, get session() { return session; }, me: me, onChange: function (f) { listeners.push(f); },
    fresh: fresh, signUp: signUp, signIn: signIn, signOut: signOut, resetPassword: resetPassword, updatePassword: updatePassword, resendConfirm: resendConfirm,
    consumeHash: consumeHash, profile: profile, saveProfile: saveProfile, profiles: profiles,
    listSpots: listSpots, addSpot: addSpot, deleteSpot: deleteSpot, listCheckins: listCheckins, addCheckin: addCheckin, uploadPhoto: uploadPhoto
  };
})();
