(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JWUX = api;
})(typeof self !== 'undefined' ? self : this, function () {
  function normalized(value) {
    return String(value == null ? '' : value).trim().toLocaleLowerCase();
  }

  function searchSpots(spots, query, limit) {
    var q = normalized(query), max = limit == null ? 6 : Math.max(0, limit);
    return (spots || []).filter(function (spot) {
      if (!q) return true;
      return [spot.name, spot.area, spot.summary, spot.marker, spot.source]
        .some(function (value) { return normalized(value).indexOf(q) >= 0; });
    }).slice(0, max);
  }

  function formatDistance(meters) {
    if (meters == null || !isFinite(meters)) return '';
    var m = Math.max(0, Math.round(meters));
    if (m < 1000) return m + '米';
    return (m / 1000).toFixed(1) + '公里';
  }

  function navigationPhase(state) {
    state = state || {};
    if (state.routeFailed && state.hasGuide === false) {
      return { phase: 'align', label: '直接开始站位与构图', hint: '路线规划失败，仍可按镜头朝向和参考画面对齐' };
    }
    if (state.routeFailed) {
      return { phase: 'guide', label: '直接进入最后一段路书', hint: '路线规划失败，仍可按现场照片找到站位' };
    }
    if (!state.routePlanned) {
      return { phase: 'plan', label: '开始到位导航', hint: state.hasGuide === false ? '先规划路线，到附近后按朝向和参考画面对齐' : '先规划路线，再用最后一段路书找到准确站位' };
    }
    if (state.hasGuide === false) {
      return { phase: 'align', label: '我已到附近，开始构图', hint: '按镜头朝向和参考画面对齐，完成后即可打卡' };
    }
    if (state.distanceMeters != null && state.distanceMeters <= 25) {
      return { phase: 'align', label: '开始站位与构图', hint: '已到机位附近，按朝向和参考画面对齐' };
    }
    if (state.distanceMeters != null && state.distanceMeters <= 120) {
      return { phase: 'guide', label: '进入最后100米路书', hint: '路线导航完成，按现场照片找到准确站位' };
    }
    var distance = formatDistance(state.distanceMeters);
    return {
      phase: 'route',
      label: '我已到附近，进入路书',
      hint: distance ? '距站位约 ' + distance + '，请先沿地图路线前往' : '请先沿地图路线前往，到附近后进入路书'
    };
  }

  return { searchSpots: searchSpots, formatDistance: formatDistance, navigationPhase: navigationPhase };
});
