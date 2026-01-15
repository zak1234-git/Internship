/**
 * 仪表盘页面逻辑：数据渲染、交互桥接
 * 结构：
 * 1) 初始化与全局状态
 * 2) 交互绑定（导航、快捷键、开关、卡片）
 * 3) 渲染函数（卡片与详情）
 * 4) 节点可见性逻辑
 * 5) 底部信息与工具函数
 * 6) 数据拉取（真实接口调用）
 * 7) 对外暴露的 patch 接口
 */
document.addEventListener('DOMContentLoaded', async () => {
    // 初始化全局模块
    await apiClient.init(); // 初始化 API 客户端
    const layout = new LayoutController(); // 初始化布局控制器（未使用）

    // 定义仪表盘的主要指标卡片的 key
    const metricKeys = ['deviceInfo', 'deviceTotal', 'topology', 'traffic', 'resource'];

    // 示例数据：用于首屏样式预览，真实接口返回后会覆盖
    const demoBasicInfo = {
        status: 'success',
        data: {
            id: 0,
            name: 'Gnode_00',
            mac: '5A:5A:55:EA:49E2',
            bw: 20,
            tfc_bw: 20,
            type: 0,
            channel: 2479,
            rssi: 0,
            ip: '192.168.99.14',
            version: 'v1.1.23_123.B215',
            net_manage_ip: '192.168.99.111',
            log_port: 6025,
            aj_flag: 0,
        },
    };

    // 定义全局状态对象，存储仪表盘的所有状态数据
    const state = {
        deviceInfo: { title: '当前设备', value: demoBasicInfo.data.name, desc: `IP ${demoBasicInfo.data.ip}`, detail: [] },
        deviceTotal: { title: '设备总数', value: '--', desc: '等待数据', detail: [] },
        topology: { title: '网络拓扑', value: '--', desc: '等待数据', detail: [] },
        traffic: { title: '数据流量', value: '--', desc: '等待数据', detail: [] },
        resource: { title: '资源使用', value: '--', desc: '等待数据', detail: [] },
        node: { type: 'G', autoAvoid: false, autoJoin: false, autoRefresh: false }, // 节点状态
    };

    let activeKey = 'deviceInfo'; // 当前选中的卡片 key

    // 初始化交互与首屏渲染
    initNav(); // 初始化左侧导航栏
    bindShortcuts(); // 绑定快捷操作按钮
    bindCards(); // 绑定卡片的点击与键盘交互
    startFooterClock(); // 启动底部时钟
    renderAllCards(); // 渲染所有卡片
    selectCard(activeKey); // 默认选中第一个卡片

    setupToggles(); // 设置开关按钮的交互逻辑

    // 预填示例详情便于首屏展示
    hydrateDeviceDetail(demoBasicInfo.data, true);

    // 首次拉取当前设备信息
    fetchDeviceBasicInfo();

    /**
     * 初始化左侧导航栏的交互逻辑
     */
    function initNav() {
        // 左侧导航仅做选中态切换，实际视图切换可后续扩展
        const nav = document.getElementById('mainNav');
        if (!nav) return;
        nav.addEventListener('click', (e) => {
            const link = e.target.closest('.menu-item');
            if (!link) return;
            nav.querySelectorAll('.menu-item').forEach((item) => item.classList.remove('active'));
            link.classList.add('active');
        });
    }

    /**
     * 绑定快捷操作按钮的点击事件
     */
    function bindShortcuts() {
        // 侧边“快捷操作”按钮映射到具体回调，当前为占位日志
        const map = {
            btnExportLog: () => console.log('TODO: 导出日志'),
            btnFactoryReset: () => console.log('TODO: 恢复出厂设置'),
            btnReboot: () => console.log('TODO: 重启设备'),
        };
        Object.entries(map).forEach(([id, fn]) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', fn);
        });
    }

    /**
     * 设置开关按钮的交互逻辑
     */
    function setupToggles() {
        const autoAvoid = document.querySelector('#toggleAutoAvoid input');
        const autoJoin = document.querySelector('#toggleAutoJoin input');
        const autoRefresh = document.querySelector('#toggleAutoRefresh input');
        const manualScan = document.getElementById('btnManualScan');

        if (autoAvoid) autoAvoid.addEventListener('change', () => updateNodeFlags({ autoAvoid: autoAvoid.checked }));
        if (autoJoin) autoJoin.addEventListener('change', () => updateNodeFlags({ autoJoin: autoJoin.checked }));
        if (autoRefresh) autoRefresh.addEventListener('change', () => updateNodeFlags({ autoRefresh: autoRefresh.checked }));
        if (manualScan) manualScan.addEventListener('click', () => console.log('手动扫描触发'));

        applyNodeVisibility(); // 根据节点类型更新控件的可见性
    }

    /**
     * 绑定卡片的点击与键盘交互事件
     */
    function bindCards() {
        // 卡片可点击与键盘可达
        metricKeys.forEach((key) => {
            const card = document.querySelector(`[data-card="${key}"]`);
            if (!card) return;
            card.addEventListener('click', () => selectCard(key));
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectCard(key);
                }
            });
        });
    }

    /**
     * 选中指定的卡片，并更新详情视图
     */
    function selectCard(key) {
        activeKey = key;
        metricKeys.forEach((k) => {
            const card = document.querySelector(`[data-card="${k}"]`);
            if (card) card.classList.toggle('is-active', k === key);
        });
        renderDetail(); // 渲染详情内容
    }

    /**
     * 渲染所有卡片的主数值与描述
     */
    function renderAllCards() {
        metricKeys.forEach((key) => updateCard(key));
    }

    /**
     * 更新指定卡片的主数值与描述
     */
    function updateCard(key) {
        const item = state[key];
        if (!item) return;
        setText(`${key}Value`, item.value ?? '--');
        setText(`${key}Desc`, item.desc ?? '');
    }

    /**
     * 渲染详情视图
     */
    function renderDetail() {
        const detailContent = document.getElementById('detailContent');
        const detailPlaceholder = document.getElementById('detailPlaceholder');
        const detailPrimary = document.getElementById('detailPrimary');
        const detailList = document.getElementById('detailList');
        const detailTitle = document.getElementById('detailTitle');

        const item = state[activeKey];
        if (!item || !detailContent || !detailPlaceholder || !detailPrimary || !detailList || !detailTitle) return;

        // 非“当前设备”卡片默认不显示设备详情，避免残留内容误展示
        if (activeKey !== 'deviceInfo') {
            detailTitle.textContent = `${item.title} · 详情`;
            detailPlaceholder.hidden = false;
            detailContent.hidden = true;
            detailPrimary.textContent = '--';
            detailList.innerHTML = '';
            return;
        }

        const hasDetail = item.detail && item.detail.length > 0;
        const titleSuffix = activeKey === 'deviceInfo' ? '具体信息' : '详情';
        detailTitle.textContent = `${item.title} · ${titleSuffix}`;

        if (!hasDetail) {
            detailPlaceholder.hidden = false;
            detailContent.hidden = true;
            return;
        }

        detailPlaceholder.hidden = true;
        detailContent.hidden = false;
        detailPrimary.textContent = item.value ?? '--';
        detailList.innerHTML = '';

        // 构建详情条目（字符串或 {label,value}），使用 label/value 分栏便于排版
        item.detail.forEach((row) => {
            const div = document.createElement('div');
            div.className = 'detail-item';

            if (typeof row === 'string') {
                div.textContent = row;
                detailList.appendChild(div);
                return;
            }

            const labelSpan = document.createElement('span');
            labelSpan.className = 'detail-label';
            labelSpan.textContent = row.label || '项';

            const valueSpan = document.createElement('span');
            valueSpan.className = 'detail-value';
            valueSpan.textContent = row.value || '--';

            div.appendChild(labelSpan);
            div.appendChild(valueSpan);
            detailList.appendChild(div);
        });
    }

    /**
     * 根据节点类型更新控件的可见性
     */
    function applyNodeVisibility() {
        const type = state.node.type;
        const autoAvoidWrap = document.getElementById('toggleAutoAvoid');
        const autoJoinWrap = document.getElementById('toggleAutoJoin');
        const manualScanBtn = document.getElementById('btnManualScan');

        if (autoAvoidWrap) autoAvoidWrap.classList.toggle('hidden', type !== 'G');
        if (autoJoinWrap) autoJoinWrap.classList.toggle('hidden', type !== 'T');
        if (manualScanBtn) manualScanBtn.classList.toggle('hidden', type !== 'T');
    }

    /**
     * 更新节点状态并同步 UI
     */
    function updateNodeFlags(partial) {
        // 合并节点状态并同步 UI
        state.node = { ...state.node, ...partial };
        const { autoAvoid, autoJoin, autoRefresh } = state.node;

        const autoAvoidInput = document.querySelector('#toggleAutoAvoid input');
        const autoJoinInput = document.querySelector('#toggleAutoJoin input');
        const autoRefreshInput = document.querySelector('#toggleAutoRefresh input');

        if (autoAvoidInput && autoAvoidInput.checked !== autoAvoid) autoAvoidInput.checked = autoAvoid;
        if (autoJoinInput && autoJoinInput.checked !== autoJoin) autoJoinInput.checked = autoJoin;
        if (autoRefreshInput && autoRefreshInput.checked !== autoRefresh) autoRefreshInput.checked = autoRefresh;

        applyNodeVisibility();
    }

    /**
     * 启动底部时钟，定时更新时间
     */
    function startFooterClock() {
        updateFooter();
        setInterval(updateFooter, 60 * 1000);
    }

    /**
     * 更新底部的时间与版本号
     */
    function updateFooter() {
        const now = new Date();
        setText('lastUpdated', now.toLocaleString());
        setText('appVersion', 'v0.1.0');
    }

    /**
     * 设置指定元素的文本内容
     */
    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    /**
     * 拉取当前设备的基本信息
     */
    async function fetchDeviceBasicInfo(nodeId = 0) {
        try {
            const resp = await apiClient.getNodeBasicInfo(nodeId);
            const data = resp && resp.data ? resp.data : {};

            hydrateDeviceDetail(data, false);
        } catch (error) {
            console.error('获取节点基本信息失败', error);
            state.deviceInfo = {
                ...state.deviceInfo,
                desc: '获取失败',
            };
            updateCard('deviceInfo');
            if (activeKey === 'deviceInfo') renderDetail();
        }
    }

    /**
     * 将后端返回的设备详情数据填充到状态中
     */
    function hydrateDeviceDetail(data, isDemo = false) {
        // 将后端返回的字段映射到详情卡片。type 0/1 -> G/T 节点。
        const typeLabel = data.type === 0 ? 'G' : 'T';
        const detail = [
            { label: '设备名称', value: data.name || '--' },
            { label: '设备类型', value: typeLabel === 'G' ? 'G 节点' : 'T 节点' },
            { label: 'IP 地址', value: data.ip || '--' },
            { label: '信道', value: data.channel ?? '--' },
            { label: '物理带宽', value: data.bw != null ? `${data.bw} MHz` : '--' },
            { label: '业务带宽', value: data.tfc_bw != null ? `${data.tfc_bw} MHz` : '--' },
            { label: '系统网管 IP 地址', value: data.net_manage_ip || '--' },
            { label: '系统网管端口号', value: data.log_port ?? '--' },
            { label: '固件版本', value: data.version || '--' },
        ];

        const desc = data.ip ? `IP ${data.ip}` : '无 IP 信息';
        const value = data.name || '--';

        state.deviceInfo = {
            ...state.deviceInfo,
            value,
            desc: isDemo ? `${desc}（示例）` : desc,
            detail,
        };

        updateCard('deviceInfo');
        if (activeKey === 'deviceInfo') renderDetail();

        state.node = { ...state.node, type: typeLabel };
        applyNodeVisibility();
    }

    /**
     * 对外暴露增量更新接口（局部刷新，无假数据）
     */
    function patchMetrics(partial) {
        if (!partial || typeof partial !== 'object') return;
        Object.entries(partial).forEach(([key, payload]) => {
            if (!state[key]) return;
            state[key] = { ...state[key], ...payload };
            if (metricKeys.includes(key)) {
                updateCard(key);
                if (key === activeKey) renderDetail();
            }
            if (key === 'node') {
                updateNodeFlags(payload);
            }
        });
    }

    // 将部分方法暴露到全局，便于外部调用
    window.dashboardPage = {
        patchMetrics,
        selectCard,
        getState: () => ({ ...state }),
    };
});
