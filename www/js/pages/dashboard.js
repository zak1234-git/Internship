/**
 * 仪表盘页面逻辑：数据渲染、交互桥接
 */
document.addEventListener('DOMContentLoaded', async () => {
    // 初始化全局模块
    await apiClient.init();
    const layout = new LayoutController();

    // 指标状态（无假数据，占位符）
    const metricKeys = ['deviceInfo', 'deviceTotal', 'topology', 'traffic', 'resource'];
    const state = {
        deviceInfo: { title: '当前设备', value: '--', desc: '等待数据', detail: [] },
        deviceTotal: { title: '设备总数', value: '--', desc: '等待数据', detail: [] },
        topology: { title: '网络拓扑', value: '--', desc: '等待数据', detail: [] },
        traffic: { title: '数据流量', value: '--', desc: '等待数据', detail: [] },
        resource: { title: '资源使用', value: '--', desc: '等待数据', detail: [] },
        node: { type: 'G', autoAvoid: false, autoJoin: false, autoRefresh: false },
    };

    let activeKey = 'deviceInfo';

    initNav();
    bindShortcuts();
    bindCards();
    startFooterClock();
    renderAllCards();
    selectCard(activeKey);

    setupToggles();

    const clearBtn = document.getElementById('clearDetail');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => clearDetail());
    }

    function initNav() {
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

        const hasDetail = item.detail && item.detail.length > 0;
        detailTitle.textContent = `${item.title} · 详情`;

        if (!hasDetail) {
            detailPlaceholder.hidden = false;
            detailContent.hidden = true;
            return;
        }

        detailPlaceholder.hidden = true;
        detailContent.hidden = false;
        detailPrimary.textContent = item.value ?? '--';
        detailList.innerHTML = '';

        item.detail.forEach((row) => {
            const div = document.createElement('div');
            div.className = 'detail-item';
            if (typeof row === 'string') {
                div.textContent = row;
            } else {
                const label = row.label || '项';
                const value = row.value || '--';
                div.innerHTML = `<strong>${label}</strong>：${value}`;
            }
            detailList.appendChild(div);
        });
    }

    function clearDetail() {
        const item = state[activeKey];
        if (!item) return;
        item.detail = [];
        renderDetail();
    }

    function applyNodeVisibility() {
        const type = state.node.type;
        const autoAvoidWrap = document.getElementById('toggleAutoAvoid');
        const autoJoinWrap = document.getElementById('toggleAutoJoin');
        const manualScanBtn = document.getElementById('btnManualScan');

        if (autoAvoidWrap) autoAvoidWrap.classList.toggle('hidden', type !== 'G');
        if (autoJoinWrap) autoJoinWrap.classList.toggle('hidden', type !== 'T');
        if (manualScanBtn) manualScanBtn.classList.toggle('hidden', type !== 'T');
    }

    function updateNodeFlags(partial) {
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
