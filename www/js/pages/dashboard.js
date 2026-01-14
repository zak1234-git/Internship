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
    await apiClient.init();
    const layout = new LayoutController();

    // 指标状态（无假数据，占位符）
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

    const state = {
        deviceInfo: { title: '当前设备', value: demoBasicInfo.data.name, desc: `IP ${demoBasicInfo.data.ip}`, detail: [] },
        deviceTotal: { title: '设备总数', value: '--', desc: '等待数据', detail: [] },
        topology: { title: '网络拓扑', value: '--', desc: '等待数据', detail: [] },
        traffic: { title: '数据流量', value: '--', desc: '等待数据', detail: [] },
        resource: { title: '资源使用', value: '--', desc: '等待数据', detail: [] },
        node: { type: 'G', autoAvoid: false, autoJoin: false, autoRefresh: false },
    };

    let activeKey = 'deviceInfo';

    // 初始化交互与首屏渲染
    initNav();
    bindShortcuts();
    bindCards();
    startFooterClock();
    renderAllCards();
    selectCard(activeKey);

    setupToggles();

    // 预填示例详情便于首屏展示
    hydrateDeviceDetail(demoBasicInfo.data, true);

    // 首次拉取当前设备信息
    fetchDeviceBasicInfo();

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

    function setupToggles() {
        const autoAvoid = document.querySelector('#toggleAutoAvoid input');
        const autoJoin = document.querySelector('#toggleAutoJoin input');
        const autoRefresh = document.querySelector('#toggleAutoRefresh input');
        const manualScan = document.getElementById('btnManualScan');

        if (autoAvoid) autoAvoid.addEventListener('change', () => updateNodeFlags({ autoAvoid: autoAvoid.checked }));
        if (autoJoin) autoJoin.addEventListener('change', () => updateNodeFlags({ autoJoin: autoJoin.checked }));
        if (autoRefresh) autoRefresh.addEventListener('change', () => updateNodeFlags({ autoRefresh: autoRefresh.checked }));
        if (manualScan) manualScan.addEventListener('click', () => console.log('手动扫描触发'));

        applyNodeVisibility();
    }

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

    function selectCard(key) {
        activeKey = key;
        metricKeys.forEach((k) => {
            const card = document.querySelector(`[data-card="${k}"]`);
            if (card) card.classList.toggle('is-active', k === key);
        });
        renderDetail();
    }

    function renderAllCards() {
        metricKeys.forEach((key) => updateCard(key));
    }

    function updateCard(key) {
        // 填充卡片主数值与描述
        const item = state[key];
        if (!item) return;
        setText(`${key}Value`, item.value ?? '--');
        setText(`${key}Desc`, item.desc ?? '');
    }

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

    function applyNodeVisibility() {
        // 节点类型驱动的控件显示：G 节点展示“自动避让”，T 节点展示“自动入网/手动扫描”
        const type = state.node.type;
        const autoAvoidWrap = document.getElementById('toggleAutoAvoid');
        const autoJoinWrap = document.getElementById('toggleAutoJoin');
        const manualScanBtn = document.getElementById('btnManualScan');

        if (autoAvoidWrap) autoAvoidWrap.classList.toggle('hidden', type !== 'G');
        if (autoJoinWrap) autoJoinWrap.classList.toggle('hidden', type !== 'T');
        if (manualScanBtn) manualScanBtn.classList.toggle('hidden', type !== 'T');
    }

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

    function startFooterClock() {
        updateFooter();
        setInterval(updateFooter, 60 * 1000);
    }

    function updateFooter() {
        const now = new Date();
        setText('lastUpdated', now.toLocaleString());
        setText('appVersion', 'v0.1.0');
    }

    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

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

    // 对外暴露增量更新接口（局部刷新，无假数据）
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

    window.dashboardPage = {
        patchMetrics,
        selectCard,
        getState: () => ({ ...state }),
    };
});
