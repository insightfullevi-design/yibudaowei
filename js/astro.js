// 太阳、月亮位置计算（算法参照开源库 SunCalc，BSD 许可，精度约零点几度，足够做拍摄提示）
(function () {
  var PI = Math.PI, sin = Math.sin, cos = Math.cos, tan = Math.tan,
      asin = Math.asin, atan = Math.atan2, acos = Math.acos, rad = PI / 180;
  var dayMs = 86400000, J1970 = 2440588, J2000 = 2451545, e = rad * 23.4397;

  function toDays(date) { return date.valueOf() / dayMs - 0.5 + J1970 - J2000; }
  function rightAscension(l, b) { return atan(sin(l) * cos(e) - tan(b) * sin(e), cos(l)); }
  function declination(l, b) { return asin(sin(b) * cos(e) + cos(b) * sin(e) * sin(l)); }
  function azimuth(H, phi, dec) { return atan(sin(H), cos(H) * sin(phi) - tan(dec) * cos(phi)); }
  function altitude(H, phi, dec) { return asin(sin(phi) * sin(dec) + cos(phi) * cos(dec) * cos(H)); }
  function siderealTime(d, lw) { return rad * (280.16 + 360.9856235 * d) - lw; }
  function refraction(h) { if (h < 0) h = 0; return 0.0002967 / tan(h + 0.00312536 / (h + 0.08901179)); }

  function sunCoords(d) {
    var M = rad * (357.5291 + 0.98560028 * d);
    var C = rad * (1.9148 * sin(M) + 0.02 * sin(2 * M) + 0.0003 * sin(3 * M));
    var L = M + C + rad * 102.9372 + PI;
    return { dec: declination(L, 0), ra: rightAscension(L, 0) };
  }
  function moonCoords(d) {
    var L = rad * (218.316 + 13.176396 * d), M = rad * (134.963 + 13.064993 * d),
        F = rad * (93.272 + 13.229350 * d);
    var l = L + rad * 6.289 * sin(M), b = rad * 5.128 * sin(F), dt = 385001 - 20905 * cos(M);
    return { ra: rightAscension(l, b), dec: declination(l, b), dist: dt };
  }
  // 方位角转为罗盘角度：正北 0°，顺时针，正东 90°
  function toCompass(az) { var c = az / rad + 180; return (c % 360 + 360) % 360; }

  function sun(date, lat, lng) {
    var lw = rad * -lng, phi = rad * lat, d = toDays(date), c = sunCoords(d);
    var H = siderealTime(d, lw) - c.ra;
    return { az: toCompass(azimuth(H, phi, c.dec)), alt: altitude(H, phi, c.dec) / rad };
  }
  function moon(date, lat, lng) {
    var lw = rad * -lng, phi = rad * lat, d = toDays(date), c = moonCoords(d);
    var H = siderealTime(d, lw) - c.ra, h = altitude(H, phi, c.dec);
    h += refraction(h);
    return { az: toCompass(azimuth(H, phi, c.dec)), alt: h / rad, dist: c.dist };
  }
  // 月亮被照亮的比例（1 = 满月）
  function moonIllum(date) {
    var d = toDays(date), s = sunCoords(d), m = moonCoords(d), sdist = 149598000;
    var phi = acos(sin(s.dec) * sin(m.dec) + cos(s.dec) * cos(m.dec) * cos(s.ra - m.ra));
    var inc = atan(sdist * sin(phi), m.dist - sdist * cos(phi));
    return (1 + cos(inc)) / 2;
  }

  // 按分钟扫描一天，找日出、日落、傍晚黄金时刻、蓝调时刻（本地时间当天）
  function dayTimes(date, lat, lng) {
    var start = new Date(date); start.setHours(0, 0, 0, 0);
    var res = {}, prev = null;
    for (var m = 0; m <= 1440; m += 1) {
      var t = new Date(start.getTime() + m * 60000), a = sun(t, lat, lng).alt;
      if (prev !== null) {
        if (prev < -0.833 && a >= -0.833) res.sunrise = t;
        if (prev >= 6 && a < 6) res.goldenStart = t;      // 傍晚黄金时刻开始
        if (prev >= -0.833 && a < -0.833) res.sunset = t;
        if (prev >= -6 && a < -6) res.blueEnd = t;       // 蓝调时刻结束，天完全黑
      }
      prev = a;
    }
    return res;
  }

  window.Astro = { sun: sun, moon: moon, moonIllum: moonIllum, dayTimes: dayTimes };
})();
