// 二维码生成（字节模式、纠错等级 M、版本 1–9，足够放下一个网址）
// 算法参照公开的 QR 码标准实现思路，不依赖外部库。
(function () {
  var RAW = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292];
  var ECC = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22];
  var BLK = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5];
  var ALIGN = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46]];

  function mul(x, y) { var z = 0; for (var i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 0xFF; }
  function divisor(deg) {
    var r = []; for (var i = 0; i < deg - 1; i++) r.push(0); r.push(1);
    var root = 1;
    for (i = 0; i < deg; i++) {
      for (var j = 0; j < r.length; j++) { r[j] = mul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
      root = mul(root, 2);
    }
    return r;
  }
  function remainder(data, div) {
    var r = div.map(function () { return 0; });
    data.forEach(function (b) { var f = b ^ r.shift(); r.push(0); div.forEach(function (c, i) { r[i] ^= mul(c, f); }); });
    return r;
  }
  function utf8(s) { return Array.prototype.slice.call(new TextEncoder().encode(s)); }

  function encode(text) {
    var bytes = utf8(text), ver = 0;
    for (var v = 1; v <= 9; v++) { var cap = RAW[v] - ECC[v] * BLK[v]; if (bytes.length + 2 <= cap) { ver = v; break; } }
    if (!ver) throw new Error('二维码内容太长');
    var dataLen = RAW[ver] - ECC[ver] * BLK[ver], bits = [];
    function push(val, n) { for (var i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    push(4, 4); push(bytes.length, 8); bytes.forEach(function (b) { push(b, 8); });
    push(0, Math.min(4, dataLen * 8 - bits.length));
    while (bits.length % 8) bits.push(0);
    var data = []; for (var i = 0; i < bits.length; i += 8) { var b = 0; for (var k = 0; k < 8; k++) b = (b << 1) | bits[i + k]; data.push(b); }
    for (var pad = 0xEC; data.length < dataLen; pad ^= 0xEC ^ 0x11) data.push(pad);

    // 分块加纠错码并交错
    var nb = BLK[ver], ecl = ECC[ver], raw = RAW[ver], nShort = nb - raw % nb, shortLen = Math.floor(raw / nb);
    var blocks = [], div = divisor(ecl), off = 0;
    for (i = 0; i < nb; i++) {
      var d = data.slice(off, off + shortLen - ecl + (i < nShort ? 0 : 1)); off += d.length;
      var e = remainder(d, div); if (i < nShort) d.push(-1);
      blocks.push(d.concat(e));
    }
    var out = [];
    for (i = 0; i < blocks[0].length; i++) blocks.forEach(function (bl) { if (bl[i] !== -1) out.push(bl[i]); });

    // 画功能图形
    var size = ver * 4 + 17, M = [], F = [];
    for (i = 0; i < size; i++) { M.push(new Array(size).fill(false)); F.push(new Array(size).fill(false)); }
    function set(x, y, dark) { M[y][x] = dark; F[y][x] = true; }
    for (i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    function finder(cx, cy) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var dist = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, dist !== 2 && dist !== 4);
      }
    }
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    var al = ALIGN[ver];
    al.forEach(function (ay, a) { al.forEach(function (ax, b) {
      if ((a === 0 && b === 0) || (a === 0 && b === al.length - 1) || (a === al.length - 1 && b === 0)) return;
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }); });
    function drawFormat(mask) {
      var dataF = (0 << 3) | mask, rem = dataF; // 纠错等级 M 的格式位是 00
      for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var fb = ((dataF << 10) | rem) ^ 0x5412;
      function g(i) { return ((fb >>> i) & 1) !== 0; }
      for (i = 0; i <= 5; i++) set(8, i, g(i));
      set(8, 7, g(6)); set(8, 8, g(7)); set(7, 8, g(8));
      for (i = 9; i < 15; i++) set(14 - i, 8, g(i));
      for (i = 0; i < 8; i++) set(size - 1 - i, 8, g(i));
      for (i = 8; i < 15; i++) set(8, size - 15 + i, g(i));
      set(8, size - 8, true);
    }
    drawFormat(0);
    if (ver >= 7) {
      var rem = ver; for (i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      var vb = (ver << 12) | rem;
      for (i = 0; i < 18; i++) { var c = ((vb >>> i) & 1) !== 0, a = size - 11 + i % 3, bb = Math.floor(i / 3); set(a, bb, c); set(bb, a, c); }
    }
    // 放数据
    var bi = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) for (var j = 0; j < 2; j++) {
        var x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
        if (!F[y][x] && bi < out.length * 8) { M[y][x] = ((out[bi >>> 3] >>> (7 - (bi & 7))) & 1) !== 0; bi++; }
      }
    }
    // 选惩罚分最低的掩码
    var masks = [
      function (x, y) { return (x + y) % 2 === 0; }, function (x, y) { return y % 2 === 0; },
      function (x) { return x % 3 === 0; }, function (x, y) { return (x + y) % 3 === 0; },
      function (x, y) { return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; },
      function (x, y) { return x * y % 2 + x * y % 3 === 0; },
      function (x, y) { return (x * y % 2 + x * y % 3) % 2 === 0; },
      function (x, y) { return ((x + y) % 2 + x * y % 3) % 2 === 0; }
    ];
    function applyMask(m) { for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) if (!F[y][x] && masks[m](x, y)) M[y][x] = !M[y][x]; }
    function penalty() {
      var p = 0, dark = 0, x, y, run, prev;
      for (y = 0; y < size; y++) { run = 0; prev = null; for (x = 0; x < size; x++) { if (M[y][x] === prev) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else { run = 1; prev = M[y][x]; } if (M[y][x]) dark++; } }
      for (x = 0; x < size; x++) { run = 0; prev = null; for (y = 0; y < size; y++) { if (M[y][x] === prev) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else { run = 1; prev = M[y][x]; } } }
      for (y = 0; y < size - 1; y++) for (x = 0; x < size - 1; x++) { var c = M[y][x]; if (c === M[y][x + 1] && c === M[y + 1][x] && c === M[y + 1][x + 1]) p += 3; }
      p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
      return p;
    }
    var best = 0, bestP = Infinity;
    for (var m = 0; m < 8; m++) { applyMask(m); drawFormat(m); var pp = penalty(); if (pp < bestP) { bestP = pp; best = m; } applyMask(m); }
    applyMask(best); drawFormat(best);
    return M;
  }

  // 画到画布上：x、y 为左上角，px 为总边长（含四格留白）
  function draw(ctx, text, x, y, px, dark, light) {
    var M = encode(text), n = M.length, cell = px / (n + 8);
    ctx.fillStyle = light || '#fff'; ctx.fillRect(x, y, px, px);
    ctx.fillStyle = dark || '#000';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (M[r][c]) ctx.fillRect(Math.floor(x + (c + 4) * cell), Math.floor(y + (r + 4) * cell), Math.ceil(cell), Math.ceil(cell));
  }
  window.QR = { encode: encode, draw: draw };
})();
