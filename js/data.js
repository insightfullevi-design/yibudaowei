// ================= 机位数据 =================
// 这是示例数据：坐标是估算的，文字来自网友分享的整理，需要你们实拍后逐条核对、替换。
// 坐标用百度坐标（BD09）。校准方法：打开百度“坐标拾取器”，点到站位处，复制经纬度填进来。
//
// 字段说明：
//   type      机位玩法：classic 拍同款 / skill 拍大片 / wonder 等奇观
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

    // ---- 拍同款：上海影视取景地 ----
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


    // ---- 你收集的案例（坐标为估算，文字为网友笔记整理，待核实） ----
    {
      id: 'shizilin', type: 'classic', area: '苏州', collection: 'film',
      name: '狮子林·女儿国花窗', lng: 120.6366, lat: 31.3266, heading: null, fov: 70,
      cover: null, coverHint: '两个人扒着花窗往外看',
      summary: '86 版《西游记》女儿国一幕的取景地，两人扒着八角花窗往外看，就是经典同款。',
      scene: { source: '影视名场面', work: '西游记（1986）', moment: '女儿国：八戒和悟空扒着花窗偷看', line: '', storyPlace: '女儿国', realPlace: '苏州狮子林' },
      technique: { pose: '两人一高一低贴近花窗，表情夸张', lens: '主摄 1 倍，从窗外拍', facing: '正对花窗', post: '', prop: '' },
      light: 'day', lightNote: '园林白天开放。',
      access: { fee: '景区门票', booking: '热门时段建议提前购票', hours: '以景区公告为准' },
      guide: [{ text: '进入狮子林景区后找到带八角花窗的回廊（具体位置待实拍补充）' }],
      crowd: '网友反馈：遇到好几波来打卡同款的游客', status: { ok: true, date: '', note: '点赞 2735、收藏 1931' },
      source: '小红书网友笔记整理，待核实'
    },
    {
      id: 'gugong', type: 'classic', area: '北京', collection: 'film',
      name: '故宫长泰门·翠果打嘴', lng: 116.4061, lat: 39.9262, heading: null, fov: 70,
      cover: null, coverHint: '宫墙下一跪一站',
      summary: '在故宫红墙石灯旁复刻《甄嬛传》名场面。注意：剧中宫殿戏多在横店拍摄，这里是“同款场景”复刻。',
      scene: { source: '影视名场面', work: '甄嬛传', moment: '华妃命翠果掌嘴', line: '翠果，打烂她的嘴', storyPlace: '后宫长街', realPlace: '拍摄地多在横店明清宫苑；故宫为同款场景' },
      technique: { pose: '一人跪、一人伸手指着，其余人站成一排', lens: '主摄 1 倍', facing: '侧对红墙', post: '可加台词字幕', prop: '旗装或汉服更有感觉' },
      light: 'day', lightNote: '故宫白天开放，需预约门票。',
      access: { fee: '故宫门票', booking: '需提前实名预约', hours: '以故宫博物院公告为准，周一通常闭馆' },
      guide: [{ text: '进入故宫后前往长泰门一带（路线待补充）' }],
      crowd: '游客多，注意不要影响他人通行', status: { ok: true, date: '', note: '点赞 2629、收藏 1670' },
      source: '小红书网友笔记整理，待核实'
    },
    {
      id: 'daguanyuan', type: 'classic', area: '北京', collection: 'film',
      name: '北京大观园·圆明园避暑外景', lng: 116.3658, lat: 39.8788, heading: null, fov: 70,
      cover: null, coverHint: '剧中“圆明园”名场面',
      summary: '《甄嬛传》里“圆明园避暑”的外景在这里，也是《红楼梦》《还珠格格》的取景地。可以跟着剧情顺序打卡。',
      scene: { source: '影视名场面', work: '甄嬛传', moment: '圆明园避暑的多场外景', line: '', storyPlace: '圆明园', realPlace: '北京大观园' },
      technique: {}, light: 'day', lightNote: '',
      access: { fee: '景区门票', booking: '', hours: '以景区公告为准' },
      guide: [], crowd: '', status: { ok: true, date: '', note: '可按剧情顺序串成路线' },
      source: '小红书网友笔记整理，待核实'
    },
    {
      id: 'heyuan', type: 'classic', area: '扬州', collection: 'film',
      name: '何园片石山房·李玉湖同款', lng: 119.4538, lat: 32.3925, heading: null, fov: 70,
      cover: null, coverHint: '回廊栏杆边坐着的李玉湖',
      summary: '《上错花轿嫁对郎》李玉湖的机位集中在片石山房，反派的机位在蝴蝶厅和复道回廊。',
      scene: { source: '影视名场面', work: '上错花轿嫁对郎', moment: '李玉湖坐在回廊栏杆边', line: '', storyPlace: '', realPlace: '扬州何园' },
      technique: { pose: '侧坐回廊美人靠，双手放膝上', lens: '主摄 1 倍', facing: '侧面平拍', post: '', prop: '汉服或旗袍' },
      light: 'day', lightNote: '', access: { fee: '景区门票', booking: '', hours: '以景区公告为准' },
      guide: [{ text: '进入何园后前往片石山房（具体路线待补充）' }],
      crowd: '人略多', status: { ok: true, date: '', note: '' }, source: '小红书网友笔记整理，待核实'
    },
    {
      id: 'rome', type: 'classic', area: '罗马', collection: 'textbook',
      name: '斗兽场·历史课本封面同款', lng: 12.4970, lat: 41.8978, heading: 100, fov: 70,
      cover: null, coverHint: '举着课本对齐斗兽场',
      summary: '人教版高中历史《中外历史纲要（下）》封面就是斗兽场。举起课本对齐实景，还能参与“地球 online”藏书接力。',
      scene: { source: '课本封面', work: '高中历史必修《中外历史纲要（下）》', moment: '封面：罗马斗兽场', line: '', storyPlace: '', realPlace: '意大利罗马斗兽场' },
      technique: { pose: '手举课本挡住半个画面，让封面和实景重合', lens: '主摄 1 倍', facing: '面朝斗兽场', post: '', prop: '课本' },
      light: 'day', lightNote: '', access: { fee: '外观免费', booking: '', hours: '全天' },
      guide: [{ text: '地铁 Colosseo 站出站，过马路' }, { text: '右手边围栏标语后面，正对斗兽场的位置就是机位' }],
      crowd: '', status: { ok: true, date: '', note: '藏书接力：网友反馈书“还在”' }, source: '小红书网友笔记整理，待核实'
    },
    {
      id: 'london', type: 'classic', area: '伦敦', collection: 'textbook',
      name: '威斯敏斯特桥·英语课本大本钟', lng: -0.1154, lat: 51.5068, heading: 270, fov: 70,
      cover: null, coverHint: '举着英语书和大本钟同框',
      summary: '英语课本封面上的大本钟。桥上靠近大本钟一侧的第一个救生圈里、桥下报亭附近的救生圈柜子里，都有接力藏书。',
      scene: { source: '课本封面', work: '英语课本', moment: '封面：大本钟', line: '', storyPlace: '', realPlace: '伦敦威斯敏斯特桥' },
      technique: { pose: '人站侧面，课本举在胸前与大本钟同框', lens: '主摄 1 倍', facing: '面朝大本钟', post: '', prop: '课本' },
      light: 'day', lightNote: '', access: { fee: '免费', booking: '', hours: '全天' },
      guide: [{ text: '走上威斯敏斯特桥，靠近大本钟这一侧' }, { text: '找第一个救生圈，接力的书就在里面' }],
      crowd: '', status: { ok: true, date: '', note: '藏书接力进行中' }, source: '小红书网友笔记整理，待核实'
    },
    {
      id: 'zootopia', type: 'skill', area: '上海迪士尼', collection: '',
      name: '疯狂动物城·大裤衩绿门', lng: 121.6707, lat: 31.1481, heading: null, fov: 80,
      cover: null, coverHint: '绿色大门前的站位',
      summary: '疯狂动物城园区的出片点合集：大裤衩绿门、小鼠门口敲门、绿色大椅子、红绿灯……人少的红绿灯随便挑。',
      scene: null,
      technique: { pose: '站着或坐着都行；小鼠门口可以做敲门动作', lens: '广角 0.5 倍', facing: '正对门面', post: '', prop: '' },
      light: 'day', lightNote: '', access: { fee: '乐园门票', booking: '', hours: '以乐园公告为准' },
      guide: [{ text: '进入疯狂动物城园区，入口处走几十米就能看到绿色大椅子' }, { text: '警局里的点位需要排队进入' }],
      crowd: '部分点位需排队', status: { ok: true, date: '', note: '点赞 1306、收藏 1078' }, source: '小红书网友笔记整理，待核实'
    },
    {
      id: 'eling', type: 'skill', area: '重庆', collection: '',
      name: '鹅岭公园·起点', lng: 106.5487, lat: 29.5562, heading: null, fov: 70,
      cover: null, coverHint: '鹅岭公园门口',
      summary: '“鹅岭 → 贰厂 → 李子坝”全程下坡的第一站。',
      technique: {}, light: 'day', lightNote: '鹅岭栈桥每周一维保停运。',
      access: { fee: '', booking: '', hours: '栈桥每周一停运' },
      guide: [{ text: '鹅岭站 1 号口出来' }, { text: '出来爬梯子左转' }, { text: '上到马路直走，继续走就到公园门口' }],
      crowd: '', status: { ok: true, date: '', note: '' }, source: '小红书网友笔记整理，待核实'
    },
    {
      id: 'erchang', type: 'skill', area: '重庆', collection: '',
      name: '贰厂文创园', lng: 106.5439, lat: 29.5585, heading: null, fov: 70,
      cover: null, coverHint: '贰厂红砖楼',
      summary: '从鹅岭公园出来左走，沿马路走到底就到。', technique: {}, light: 'any', lightNote: '',
      access: { fee: '免费', booking: '', hours: '' },
      guide: [{ text: '公园出来左走' }, { text: '沿马路走到底' }],
      crowd: '', status: { ok: true, date: '', note: '' }, source: '小红书网友笔记整理，待核实'
    },
    {
      id: 'liziba', type: 'skill', area: '重庆', collection: '',
      name: '李子坝·轻轨穿楼', lng: 106.5480, lat: 29.5603, heading: null, fov: 70,
      cover: null, coverHint: '轻轨从楼里穿过',
      summary: '要拍到列车正好穿楼，需要在观景平台等车来；平台人很多，提前占位。',
      technique: { pose: '在观景平台举手机等列车进楼', lens: '主摄或 2 倍', facing: '正对穿楼的轨道', post: '', prop: '' },
      light: 'day', lightNote: '需要等列车经过，按班次间隔耐心等。',
      access: { fee: '免费', booking: '', hours: '' },
      guide: [{ text: '出贰厂到马路，酸奶牛旁边往下走' }, { text: '酒店右转，过闸机左转，下楼梯右转' }, { text: '一路下坡到李子坝轻轨站，站内 1 号口出，跟着“观景平台”指示走' }],
      crowd: '观景平台人多', status: { ok: true, date: '', note: '点赞 1344、收藏 1548' }, source: '小红书网友笔记整理，待核实'
    },

    // ---- 拍同款：人民币里的中国（没有照片时显示“等你来复刻第一张”） ----
    { id: 'rmb20', type: 'classic', area: '桂林', collection: 'rmb', scene: { source: '人民币图案', work: '第五套人民币', moment: '20 元背面图案', storyPlace: '', realPlace: '漓江' }, name: '20 元背面·漓江', lng: 110.5270, lat: 24.9260, heading: null, fov: 70, cover: null, coverHint: '等你来复刻第一张', summary: '对应第五套人民币 20 元背面图案的实景。', technique: {}, light: 'day', lightNote: '', access: { fee: '', booking: '', hours: '' }, guide: [], status: { ok: null, date: '', note: '待认领' }, source: '坐标为估算，待核实' },
    { id: 'rmb1', type: 'classic', area: '杭州', collection: 'rmb', scene: { source: '人民币图案', work: '第五套人民币', moment: '1 元背面图案', storyPlace: '', realPlace: '三潭印月' }, name: '1 元背面·三潭印月', lng: 120.1520, lat: 30.2440, heading: null, fov: 70, cover: null, coverHint: '等你来复刻第一张', summary: '对应第五套人民币 1 元背面图案的实景。', technique: {}, light: 'day', lightNote: '', access: { fee: '', booking: '', hours: '' }, guide: [], status: { ok: null, date: '', note: '待认领' }, source: '坐标为估算，待核实' },
    { id: 'rmb5', type: 'classic', area: '泰安', collection: 'rmb', scene: { source: '人民币图案', work: '第五套人民币', moment: '5 元背面图案', storyPlace: '', realPlace: '泰山' }, name: '5 元背面·泰山', lng: 117.1100, lat: 36.2600, heading: null, fov: 70, cover: null, coverHint: '等你来复刻第一张', summary: '对应第五套人民币 5 元背面图案的实景。', technique: {}, light: 'day', lightNote: '', access: { fee: '', booking: '', hours: '' }, guide: [], status: { ok: null, date: '', note: '待认领' }, source: '坐标为估算，待核实' },
    { id: 'rmb50', type: 'classic', area: '拉萨', collection: 'rmb', scene: { source: '人民币图案', work: '第五套人民币', moment: '50 元背面图案', storyPlace: '', realPlace: '布达拉宫' }, name: '50 元背面·布达拉宫', lng: 91.1230, lat: 29.6600, heading: null, fov: 70, cover: null, coverHint: '等你来复刻第一张', summary: '对应第五套人民币 50 元背面图案的实景。', technique: {}, light: 'day', lightNote: '', access: { fee: '', booking: '', hours: '' }, guide: [], status: { ok: null, date: '', note: '待认领' }, source: '坐标为估算，待核实' },
    { id: 'rmb100', type: 'classic', area: '北京', collection: 'rmb', scene: { source: '人民币图案', work: '第五套人民币', moment: '100 元背面图案', storyPlace: '', realPlace: '人民大会堂' }, name: '100 元背面·人民大会堂', lng: 116.4010, lat: 39.9070, heading: null, fov: 70, cover: null, coverHint: '等你来复刻第一张', summary: '对应第五套人民币 100 元背面图案的实景。', technique: {}, light: 'day', lightNote: '', access: { fee: '', booking: '', hours: '' }, guide: [], status: { ok: null, date: '', note: '待认领' }, source: '坐标为估算，待核实' }
  ],

  collections: {
    film: { name: '影视同款', desc: '剧里的名场面，就在你路过的街角。' },
    rmb: { name: '人民币里的中国', desc: '集齐 5 张，点亮全国地图。' },
    textbook: { name: '地球 online', desc: '举起课本对齐封面上的远方，参与藏书接力。' },
    landmark: { name: '热门地标打卡', desc: '大家都在拍的地标，换个站位拍出不一样。' }
  },

  routes: [
    {
      id: 'chongqing', name: '鹅岭 → 贰厂 → 李子坝：全程下坡不废腿',
      spotIds: ['eling', 'erchang', 'liziba'], fixedOrder: true,
      advice: '按这个方向走全程下坡、树荫多；反着走就是一路爬坡。每周一鹅岭栈桥停运。',
      constraints: []
    },
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

  // 等奇观：环金穿月（月亮穿过环球金融中心顶部方孔，金茂塔尖顶在月亮中间）
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

// 热门地标打卡：把这些机位归进“热门地标”专题
['mirror', 'lounge', 'ring', 'sticker', 'snowking', 'liziba', 'zootopia'].forEach(function (id) {
  window.JW_DATA.spots.forEach(function (s) { if (s.id === id && !s.collection) s.collection = 'landmark'; });
});
