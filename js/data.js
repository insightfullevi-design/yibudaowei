// ================= 机位数据 =================
// 这是示例数据：坐标是估算的，文字来自网友分享的整理，需要你们实拍后逐条核对、替换。
// 坐标用百度坐标（BD09）。校准方法：打开百度“坐标拾取器”，点到站位处，复制经纬度填进来。
//
// 字段说明：
//   type      机位玩法：classic 同款复刻 / skill 技法出片 / wonder 专业奇观
//   heading   镜头朝向，正北 0°、正东 90°、正南 180°、正西 270°；朝天拍填 null
//   fov       画面左右能装下的角度：广角约 100，主摄约 70，长焦约 30
//   light     光线条件：day 需要白天 / golden 傍晚黄金时刻最佳 / night 夜景 / any 都行
//   guide     最后一段路书：一步一句话，photo 以后换成你们拍的指路照片
//   cover     成片照片路径，比如 'img/spots/mirror.jpg'；没有就留 null，会显示占位图

window.JW_DATA = {
  spots: [
    {
      id: 'mirror', type: 'skill', area: '北外滩',
      name: '白玉兰桥下·颠倒世界',
      lng: 121.5005, lat: 31.2548, heading: 150, fov: 80,
      cover: null, coverHint: '倒过来的东方明珠',
      summary: '桥底是反光镜面，把陆家嘴和镜面一起拍进来，再把照片倒转 180°。',
      technique: { pose: '手机贴近桥底边缘，镜头朝上斜对江面', lens: '主摄 1 倍', facing: '面朝陆家嘴（东南）', post: '照片旋转 180°', prop: '' },
      light: 'day', lightNote: '要靠天光才有倒影：天黑后桥底不反光，网友实测会失败。',
      access: { fee: '免费', booking: '', hours: '全天开放' },
      guide: [
        { text: '走到白玉兰广场前、小巨蛋前面的那座桥' },
        { text: '下到桥下，抬头能看到镜面一样的桥底' },
        { text: '站到能同时看到桥底镜面和对岸陆家嘴的位置，开拍' }
      ],
      crowd: '', status: { ok: true, date: '2026-07-13', note: '网友反馈：白天可以，天黑失败' },
      source: '小红书网友评论分享，待实拍核实'
    },
    {
      id: 'bench', type: 'skill', area: '北外滩',
      name: '九龙路×东长治路口的椅子',
      lng: 121.4990, lat: 31.2570, heading: 160, fov: 70,
      cover: null, coverHint: '街角长椅与远处天际线',
      summary: '街角长椅做前景，坐着或侧身都好出片。',
      technique: { pose: '人坐长椅一侧，拍摄者蹲低', lens: '主摄 1 倍', facing: '面朝东南', post: '', prop: '' },
      light: 'any', lightNote: '白天都能拍，傍晚侧光最柔和。',
      access: { fee: '免费', booking: '', hours: '全天' },
      guide: [
        { text: '沿东长治路走到与九龙路的交叉口（待实拍补充指路照片）' },
        { text: '路口转角处找到长椅' }
      ],
      crowd: '', status: { ok: true, date: '2026-07-01', note: '' },
      source: '小红书网友笔记整理，待实拍核实'
    },
    {
      id: 'lounge', type: 'skill', area: '北外滩',
      name: '北外滩世界会客厅·陆家嘴全景',
      lng: 121.5010, lat: 31.2515, heading: 145, fov: 70,
      cover: null, coverHint: '隔江的陆家嘴四件套',
      summary: '隔着黄浦江正对陆家嘴，能把东方明珠和三件套一起收进画面，比外滩人少。',
      technique: { pose: '站在江边栏杆内侧，手机横拍', lens: '主摄 1 倍或 2 倍', facing: '面朝东南，正对陆家嘴', post: '', prop: '' },
      light: 'golden', lightNote: '日落前后逆光剪影，天黑后接着拍夜景。',
      access: { fee: '免费', booking: '', hours: '滨江步道全天开放' },
      guide: [
        { text: '沿北外滩滨江步道往东南走（待实拍补充）' },
        { text: '走到正对东方明珠的开阔处' }
      ],
      crowd: '比外滩人少', status: { ok: true, date: '2026-07-01', note: '' },
      source: '小红书网友笔记整理，待实拍核实'
    },
    {
      id: 'ring', type: 'classic', area: '陆家嘴',
      name: '陆家嘴环形天桥·东方明珠',
      lng: 121.5082, lat: 31.2425, heading: 320, fov: 90,
      cover: null, coverHint: '天桥上仰望东方明珠',
      summary: '万能机位：东方明珠和三件套都能入镜，夜里还能拍桥下车流光轨。',
      technique: { pose: '站在天桥外沿', lens: '广角 0.5 倍', facing: '面朝西北的东方明珠', post: '', prop: '' },
      light: 'night', lightNote: '夜景最震撼，楼体灯光开放时间以官方公告为准。',
      access: { fee: '免费', booking: '', hours: '全天' },
      guide: [
        { text: '地铁 2 号线陆家嘴站出站，跟着指示牌上环形天桥（出口号待实拍补充）' },
        { text: '沿天桥走到能看到东方明珠正面的一侧' }
      ],
      crowd: '晚上人多，工作日较好', status: { ok: true, date: '2026-09-01', note: '' },
      source: '网友分享整理，待实拍核实'
    },
    {
      id: 'sticker', type: 'skill', area: '陆家嘴',
      name: '东泰路×花园石桥路口·官方地贴',
      lng: 121.5105, lat: 31.2395, heading: 110, fov: 100,
      cover: null, coverHint: '三件套同框仰拍',
      summary: '官方设了打卡地贴，站上去就是三件套同框的经典仰拍。',
      technique: { pose: '站在地贴上，手机举低仰拍', lens: '广角 0.5 倍', facing: '面朝三栋高楼', post: '', prop: '' },
      light: 'any', lightNote: '白天夜晚都行。',
      access: { fee: '免费', booking: '', hours: '全天' },
      marker: '有官方打卡地贴',
      guide: [
        { text: '走到东泰路与花园石桥路交叉口' },
        { text: '找到地上的官方打卡地贴，站上去' }
      ],
      crowd: '注意：路边有揽客的收费摄影师，可以不理', status: { ok: true, date: '2026-09-01', note: '' },
      source: '网友分享整理，待实拍核实'
    },
    {
      id: 'snowking', type: 'skill', area: '陆家嘴',
      name: '三件套仰拍·四足均分',
      lng: 121.5132, lat: 31.2390, heading: null, fov: 100,
      cover: null, coverHint: '手举饮料杯，三栋楼从四角伸进画面',
      summary: '转身背对“开瓶器”，镜头朝天开广角，让三栋楼均匀分布在画面四周。',
      technique: { pose: '手机平举朝天，道具举在画面中间', lens: '广角 0.5 倍', facing: '背对环球金融中心（开瓶器），镜头朝天', post: '', prop: '奶茶杯等道具' },
      light: 'night', lightNote: '夜里楼体亮灯效果最好。',
      access: { fee: '免费', booking: '', hours: '全天' },
      guide: [
        { text: '陆家嘴站 8 号口出来（待实拍核实出口号）' },
        { text: '往三栋高楼中间走，快到时会看到地上趴着各种姿势拍照的人' },
        { text: '转身背对开瓶器，镜头朝天' }
      ],
      crowd: '', status: { ok: true, date: '2026-08-15', note: '' },
      source: '小红书网友笔记整理，待实拍核实'
    },

    // ---- 名场面复刻：上海影视取景地 ----
    {
      id: 'tinytimes', type: 'classic', area: '静安', collection: 'film',
      name: '上海展览中心·弧形大楼梯',
      lng: 121.4590, lat: 31.2315, heading: 20, fov: 70,
      cover: null, coverHint: '从楼梯上走下来的那一幕',
      summary: '电影《小时代》里一群人从弧形白色楼梯走下来的名场面，实景就在上海展览中心。',
      scene: { source: '影视名场面', work: '小时代', moment: '顾里生日会前，众人从弧形楼梯走下', line: '', storyPlace: '电影中的宴会场地', realPlace: '上海展览中心' },
      technique: { pose: '一人从楼梯中段往下走，拍摄者站在楼梯下方侧面', lens: '主摄 1 倍', facing: '面朝楼梯', post: '', prop: '长外套走路带风更像原片' },
      light: 'day', lightNote: '白色石材在白天侧光下最有质感。',
      access: { fee: '待确认', booking: '', hours: '场馆有展会时才开放，是否能进入楼梯区域需出发前确认' },
      guide: [
        { text: '到上海展览中心正门（地铁 2、7 号线静安寺站方向，出口待实拍补充）' },
        { text: '找到主楼前的白色弧形楼梯（待实拍补充指路照片）' }
      ],
      crowd: '', status: { ok: null, date: '', note: '开放情况待确认' },
      source: '小红书网友笔记整理，待实拍核实'
    },

    // ---- 名场面复刻：人民币里的中国（没有照片时显示“等你来复刻第一张”） ----
    { id: 'rmb20', type: 'classic', area: '桂林', collection: 'rmb', scene: { source: '人民币图案', work: '第五套人民币', moment: '20 元背面图案', storyPlace: '', realPlace: '漓江' }, name: '20 元背面·漓江', lng: 110.5270, lat: 24.9260, heading: null, fov: 70, cover: null, coverHint: '等你来复刻第一张', summary: '对应第五套人民币 20 元背面图案的实景。', technique: {}, light: 'day', lightNote: '', access: { fee: '', booking: '', hours: '' }, guide: [], status: { ok: null, date: '', note: '待认领' }, source: '坐标为估算，待核实' },
    { id: 'rmb1', type: 'classic', area: '杭州', collection: 'rmb', scene: { source: '人民币图案', work: '第五套人民币', moment: '1 元背面图案', storyPlace: '', realPlace: '三潭印月' }, name: '1 元背面·三潭印月', lng: 120.1520, lat: 30.2440, heading: null, fov: 70, cover: null, coverHint: '等你来复刻第一张', summary: '对应第五套人民币 1 元背面图案的实景。', technique: {}, light: 'day', lightNote: '', access: { fee: '', booking: '', hours: '' }, guide: [], status: { ok: null, date: '', note: '待认领' }, source: '坐标为估算，待核实' },
    { id: 'rmb5', type: 'classic', area: '泰安', collection: 'rmb', scene: { source: '人民币图案', work: '第五套人民币', moment: '5 元背面图案', storyPlace: '', realPlace: '泰山' }, name: '5 元背面·泰山', lng: 117.1100, lat: 36.2600, heading: null, fov: 70, cover: null, coverHint: '等你来复刻第一张', summary: '对应第五套人民币 5 元背面图案的实景。', technique: {}, light: 'day', lightNote: '', access: { fee: '', booking: '', hours: '' }, guide: [], status: { ok: null, date: '', note: '待认领' }, source: '坐标为估算，待核实' },
    { id: 'rmb50', type: 'classic', area: '拉萨', collection: 'rmb', scene: { source: '人民币图案', work: '第五套人民币', moment: '50 元背面图案', storyPlace: '', realPlace: '布达拉宫' }, name: '50 元背面·布达拉宫', lng: 91.1230, lat: 29.6600, heading: null, fov: 70, cover: null, coverHint: '等你来复刻第一张', summary: '对应第五套人民币 50 元背面图案的实景。', technique: {}, light: 'day', lightNote: '', access: { fee: '', booking: '', hours: '' }, guide: [], status: { ok: null, date: '', note: '待认领' }, source: '坐标为估算，待核实' },
    { id: 'rmb100', type: 'classic', area: '北京', collection: 'rmb', scene: { source: '人民币图案', work: '第五套人民币', moment: '100 元背面图案', storyPlace: '', realPlace: '人民大会堂' }, name: '100 元背面·人民大会堂', lng: 116.4010, lat: 39.9070, heading: null, fov: 70, cover: null, coverHint: '等你来复刻第一张', summary: '对应第五套人民币 100 元背面图案的实景。', technique: {}, light: 'day', lightNote: '', access: { fee: '', booking: '', hours: '' }, guide: [], status: { ok: null, date: '', note: '待认领' }, source: '坐标为估算，待核实' }
  ],

  collections: {
    film: { name: '上海影视取景地', desc: '剧里的名场面，就在你每天路过的街角。' },
    rmb: { name: '人民币里的中国', desc: '集齐 5 张，点亮全国地图。' }
  },

  routes: [
    {
      id: 'bund-north', name: '北外滩出片线：下午出发，天黑前拍完镜面',
      spotIds: ['bench', 'mirror', 'lounge'],
      advice: '先拍需要白天的桥下镜面，最后在世界会客厅等日落。',
      constraints: [
        { spot: 'mirror', rule: 'day', text: '桥下镜面必须在天黑前拍' },
        { spot: 'lounge', rule: 'golden', text: '世界会客厅留到日落前后' }
      ]
    },
    {
      id: 'lujiazui-night', name: '陆家嘴夜景线：三件套仰拍一网打尽',
      spotIds: ['ring', 'sticker', 'snowking'],
      advice: '天黑后出发，楼体亮灯效果最好。',
      constraints: [{ spot: 'ring', rule: 'night', text: '环形天桥夜景最佳' }]
    }
  ],

  // 专业奇观：环金穿月（月亮穿过环球金融中心顶部方孔，金茂塔尖顶在月亮中间）
  // 楼的坐标和高度是近似值，结果只作“候选日期和候选区域”
  wonders: [
    {
      id: 'moon-swfc', name: '环金穿月',
      desc: '满月穿过“开瓶器”顶部方孔，金茂塔尖正好顶在月亮中间，一年只有很少几次机会。',
      body: 'moon',
      target: { name: '环球金融中心方孔', lng: 121.5161, lat: 31.2397, h: 472 },
      front: { name: '金茂大厦塔尖', lng: 121.5136, lat: 31.2402, h: 420 },
      cameraHeight: 10,
      minIllum: 0.85
    }
  ]
};
