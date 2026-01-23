/* 仪表盘页面逻辑：暴露 initDashboardSection 以供 section loader 调用 */
(function () {
    let initialized = false;
    let state = null;
    let activeKey = 'deviceInfo';
    const metricKeys = ['deviceInfo', 'deviceTotal', 'topology', 'traffic', 'resource'];
    const notifier = window.notify || { toast: (m, o) => alert(m, o) }; // 统一通知出口
    const buildDemoTopology = (basic) => [
        {
            id: basic.id ?? 0,
            name: basic.name || 'Gnode_00',
            type: basic.type ?? 0,
            ip: basic.ip || '192.168.99.10',
            channel: basic.channel ?? 2479,
            bw: basic.bw ?? 40,
            tfc_bw: basic.tfc_bw ?? 20,
            version: basic.version || 'v1.1.23_123.B215',
        },
    ];

    /* 初始化仪表盘 section，需在片段插入 DOM 后调用 */
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
            topology: { title: '网络拓扑', value: '--', desc: '等待数据', detail: [], nodes: [] },
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
        hydrateTopologyDetail(buildDemoTopology(demoBasicInfo.data), true);
        fetchDeviceBasicInfo();
        fetchTopology();

        initialized = true;
        window.dashboardPage.patchMetrics = patchMetrics;
        window.dashboardPage.selectCard = selectCard;
        window.dashboardPage.getState = () => ({ ...state });
    }

    /* 绑定顶部快捷操作，统一使用 notifier 反馈 */
    function bindShortcuts() {
        const map = {
            btnExportLog: () => notifier.toast('日志导出功能待接入', { variant: 'info' }),
            btnFactoryReset: () => handleShortcutAction('factory'),
            btnReboot: () => handleShortcutAction('reboot'),
        };
        Object.entries(map).forEach(([id, fn]) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', fn);
        });
    }

    /* 绑定右侧开关与手动扫描按钮 */
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

    /* 绑定卡片点击与键盘激活 */
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

    /* 选择卡片并刷新详情 */
    function selectCard(key) {
        activeKey = key;
        metricKeys.forEach((k) => {
            const card = document.querySelector(`[data-card="${k}"]`);
            if (card) card.classList.toggle('is-active', k === key);
        });
        renderDetail();
    }

    /* 渲染全部卡片的数字与描述 */
    function renderAllCards() {
        metricKeys.forEach((key) => updateCard(key));
    }

    /* 更新单个卡片的展示值 */
    function updateCard(key) {
        const item = state && state[key];
        if (!item) return;
        setText(`${key}Value`, item.value ?? '--');
        setText(`${key}Desc`, item.desc ?? '');
    }

    /* 根据当前选中卡片渲染详情区 */
    function renderDetail() {
        if (!state) return;
        const detailContent = document.getElementById('detailContent');
        const detailPlaceholder = document.getElementById('detailPlaceholder');
        const detailPrimary = document.getElementById('detailPrimary');
        const detailList = document.getElementById('detailList');
        const detailTitle = document.getElementById('detailTitle');

        const item = state[activeKey];
        if (!item || !detailContent || !detailPlaceholder || !detailPrimary || !detailList || !detailTitle) return;

        detailList.classList.remove('is-topology');

        if (activeKey === 'deviceInfo') {
            const hasDetail = item.detail && item.detail.length > 0;
            detailTitle.textContent = `${item.title} · 具体信息`;

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
            return;
        }

        if (activeKey === 'topology') {
            const nodes = item.nodes || [];
            detailTitle.textContent = `${item.title} · 节点列表`;
            detailPrimary.textContent = nodes.length ? `${nodes.length} 台设备` : '--';
            detailList.classList.add('is-topology');

            if (!nodes.length) {
                detailPlaceholder.hidden = false;
                detailContent.hidden = true;
                detailList.innerHTML = '';
                return;
            }

            detailPlaceholder.hidden = true;
            detailContent.hidden = false;
            detailList.innerHTML = '';

            const wrapper = document.createElement('div');
            wrapper.className = 'topology-table-wrapper';
            const table = document.createElement('table');
            table.className = 'topology-table';

            const columns = [
                { key: 'id', label: 'ID' },
                { key: 'name', label: '名称' },
                { key: 'type', label: '类型' },
                { key: 'ip', label: 'IP' },
                { key: 'channel', label: '信道' },
                { key: 'bw', label: '物理带宽' },
                { key: 'tfc_bw', label: '业务带宽' },
                { key: 'version', label: '固件版本' },
                { key: 'mac', label: 'MAC' },
            ];

            const thead = document.createElement('thead');
            const headRow = document.createElement('tr');
            columns.forEach((col) => {
                const th = document.createElement('th');
                th.textContent = col.label;
                headRow.appendChild(th);
            });
            thead.appendChild(headRow);

            const tbody = document.createElement('tbody');
            nodes.forEach((node) => {
                const tr = document.createElement('tr');
                columns.forEach((col) => {
                    const td = document.createElement('td');
                    if (col.key === 'type') {
                        td.textContent = node.type === 0 ? 'G 节点' : 'T 节点';
                    } else if (col.key === 'bw' || col.key === 'tfc_bw') {
                        const val = node[col.key];
                        td.textContent = val != null && val !== '' ? `${val}M` : '--';
                    } else {
                        const val = node[col.key];
                        td.textContent = val != null && val !== '' ? val : '--';
                    }
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });

            table.appendChild(thead);
            table.appendChild(tbody);
            wrapper.appendChild(table);
            detailList.appendChild(wrapper);
            return;
        }

        detailTitle.textContent = `${item.title} · 详情`;
        detailPlaceholder.hidden = false;
        detailContent.hidden = true;
        detailPrimary.textContent = '--';
        detailList.innerHTML = '';
    }

    /* 根据节点类型显示/隐藏相关控件 */
    function applyNodeVisibility() {
        const type = state?.node?.type;
        const autoAvoidWrap = document.getElementById('toggleAutoAvoid');
        const autoJoinWrap = document.getElementById('toggleAutoJoin');
        const manualScanBtn = document.getElementById('btnManualScan');

        if (autoAvoidWrap) autoAvoidWrap.classList.toggle('hidden', type !== 'G');
        if (autoJoinWrap) autoJoinWrap.classList.toggle('hidden', type !== 'T');
        if (manualScanBtn) manualScanBtn.classList.toggle('hidden', type !== 'T');
    }

    /* 更新本地 node 标记并同步 UI 开关 */
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

    /* 启动底部时间更新 */
    function startFooterClock() {
        updateFooter();
        setInterval(updateFooter, 60 * 1000);
    }

    /* 渲染底部版本与时间 */
    function updateFooter() {
        const now = new Date();
        setText('lastUpdated', now.toLocaleString());
        setText('appVersion', 'v0.1.0');
    }

    /* 安全地设置文本 */
    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    /* 拉取单个节点的基础信息，并更新卡片与详情 */
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

    /* 顶部快捷按钮动作：对接重启/出厂接口并反馈通知 */
    async function handleShortcutAction(type, nodeId = 0) {
        const actionText = type === 'reboot' ? '重启' : '恢复出厂';
        notifier.toast(`${actionText}中...`, { variant: 'info', duration: 1800 });
        try {
            if (type === 'reboot') {
                await apiClient.rebootNode(nodeId, {});
            } else {
                await apiClient.factoryResetNode(nodeId, {});
            }
            notifier.toast(`${actionText}已下发`, { variant: 'success' });
        } catch (err) {
            console.error(`[dashboard] ${actionText}失败`, err);
            notifier.toast(`${actionText}失败`, { variant: 'error' });
        }
    }

    /* 拉取节点列表填充拓扑与设备总数，失败则保留示例数据 */
    async function fetchTopology() {
        try {
            const resp = await apiClient.getNodes();
            const raw = resp && resp.data && resp.data.nodes ? resp.data.nodes : resp && resp.nodes ? resp.nodes : [];
            const baseList = Array.isArray(raw)
                ? raw.map((n, idx) => ({
                      id: n && n.id != null ? n.id : idx,
                      name: (n && n.name) || '节点 ' + idx,
                      type: n && n.type != null ? n.type : 0,
                      ip: (n && n.ip) || '',
                      channel: n && n.channel != null ? n.channel : null,
                      bw: n && n.bw != null ? n.bw : null,
                      tfc_bw: n && n.tfc_bw != null ? n.tfc_bw : null,
                      version: (n && n.version) || '',
                      mac: (n && n.mac) || '',
                  }))
                : [];

            const list = await enrichTopology(baseList);
            hydrateTopologyDetail(list, false);
            state.deviceTotal = {
                ...state.deviceTotal,
                value: list.length || '--',
                desc: list.length ? `节点数 ${list.length}` : '暂无节点',
            };
            updateCard('deviceTotal');
            if (activeKey === 'deviceTotal') renderDetail();
        } catch (err) {
            console.error('获取拓扑失败，保持示例数据', err);
        }
    }

    /* 用节点详情（基于 id / ip）补全拓扑列 */
    async function enrichTopology(nodes) {
        if (!Array.isArray(nodes) || nodes.length === 0) return nodes;
        const tasks = nodes.map((node) => fetchNodeDetail(node));
        const results = await Promise.allSettled(tasks);
        return nodes.map((node, idx) => {
            const res = results[idx];
            if (!res || res.status !== 'fulfilled' || !res.value) return node;
            const detail = res.value;
            return {
                ...node,
                ip: detail.ip != null ? detail.ip : node.ip,
                channel: detail.channel != null ? detail.channel : node.channel,
                bw: detail.bw != null ? detail.bw : node.bw,
                tfc_bw: detail.tfc_bw != null ? detail.tfc_bw : node.tfc_bw,
                version: detail.version != null ? detail.version : node.version,
                name: detail.name || node.name,
                type: detail.type != null ? detail.type : node.type,
                mac: detail.mac != null ? detail.mac : node.mac,
            };
        });
    }

    async function fetchNodeDetail(node) {
        if (!node) return null;
        try {
            if (node.id != null) {
                const resp = await apiClient.getNodeBasicInfo(node.id);
                return resp && resp.data ? resp.data : resp;
            }
        } catch (err) {
            console.warn('[dashboard] enrich detail by id failed', err);
        }
        // 如果后端有按 IP 查询接口，可在此兜底
        return null;
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

    function hydrateTopologyDetail(nodes, isDemo = false) {
        if (!state) return;
        const list = Array.isArray(nodes) ? nodes : [];
        const count = list.length;
        state.topology = {
            ...state.topology,
            value: count ? `${count} 台` : '--',
            desc: isDemo ? '示例拓扑' : count ? `节点数 ${count}` : '暂无节点',
            nodes: list,
            isDemo,
        };
        updateCard('topology');
        if (activeKey === 'topology') renderDetail();
    }

    function patchMetrics(partial) {
        if (!state || !partial || typeof partial !== 'object') return;
        Object.entries(partial).forEach(([key, payload]) => {
            if (!state[key]) return;
            if (key === 'topology' && payload.nodes) {
                hydrateTopologyDetail(payload.nodes, false);
                return;
            }

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
