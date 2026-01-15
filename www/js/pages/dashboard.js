/**
 * 仪表盘页面逻辑：暴露 initDashboardSection 以供 section loader 调用
 */
(function () {
    let initialized = false;
    let state = null;
    let activeKey = 'deviceInfo';
    const metricKeys = ['deviceInfo', 'deviceTotal', 'topology', 'traffic', 'resource'];

    /**
     * 初始化仪表盘 section，需在片段插入 DOM 后调用
     */
    function initDashboardSection(sectionRoot) {
        if (initialized) return;
        const root = sectionRoot || document.getElementById('dashboardSection');
        if (!root) return;

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

        state = {
            deviceInfo: { title: '当前设备', value: demoBasicInfo.data.name, desc: `IP ${demoBasicInfo.data.ip}`, detail: [] },
            deviceTotal: { title: '设备总数', value: '--', desc: '等待数据', detail: [] },
            topology: { title: '网络拓扑', value: '--', desc: '等待数据', detail: [] },
            traffic: { title: '数据流量', value: '--', desc: '等待数据', detail: [] },
            resource: { title: '资源使用', value: '--', desc: '等待数据', detail: [] },
            node: { type: 'G', autoAvoid: false, autoJoin: false, autoRefresh: false },
        };

        bindShortcuts();
        bindCards(root);
        setupToggles();
        startFooterClock();

        renderAllCards();
        selectCard(activeKey);

        hydrateDeviceDetail(demoBasicInfo.data, true);
        fetchDeviceBasicInfo();

        initialized = true;
        window.dashboardPage.patchMetrics = patchMetrics;
        window.dashboardPage.selectCard = selectCard;
        window.dashboardPage.getState = () => ({ ...state });
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

    function bindCards(root) {
        metricKeys.forEach((key) => {
            const card = root.querySelector(`[data-card="${key}"]`);
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
        const item = state && state[key];
        if (!item) return;
        setText(`${key}Value`, item.value ?? '--');
        setText(`${key}Desc`, item.desc ?? '');
    }

    function renderDetail() {
        if (!state) return;
        const detailContent = document.getElementById('detailContent');
        const detailPlaceholder = document.getElementById('detailPlaceholder');
        const detailPrimary = document.getElementById('detailPrimary');
        const detailList = document.getElementById('detailList');
        const detailTitle = document.getElementById('detailTitle');

        const item = state[activeKey];
        if (!item || !detailContent || !detailPlaceholder || !detailPrimary || !detailList || !detailTitle) return;

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
        const type = state?.node?.type;
        const autoAvoidWrap = document.getElementById('toggleAutoAvoid');
        const autoJoinWrap = document.getElementById('toggleAutoJoin');
        const manualScanBtn = document.getElementById('btnManualScan');

        if (autoAvoidWrap) autoAvoidWrap.classList.toggle('hidden', type !== 'G');
        if (autoJoinWrap) autoJoinWrap.classList.toggle('hidden', type !== 'T');
        if (manualScanBtn) manualScanBtn.classList.toggle('hidden', type !== 'T');
    }

    function updateNodeFlags(partial) {
        if (!state) return;
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
        if (!state) return;
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

    function patchMetrics(partial) {
        if (!state || !partial || typeof partial !== 'object') return;
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
        initDashboardSection,
    };
})();
