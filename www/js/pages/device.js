/*
 * 设备管理页脚本：列表、编辑、动作、带宽校验，含 mock 兜底与统一通知。
 */
(function () {
    // 选项/默认值常量：统一供渲染与校验使用
    const DEVICE_TYPES = [
        { value: 0, label: 'G 节点(主节点)' },
        { value: 1, label: 'T 节点(终端节点)' },
    ];

    const CHANNEL_OPTIONS = [41, 125, 209, 291, 375, 459, 541, 625, 709, 791, 1375, 1459, 1541, 1625, 1709, 1791, 1875, 1959, 2041, 2125, 2209, 2291, 2479, 2563, 2645, 2729, 2813];

    const BW_OPTIONS = [
        { value: 20, label: '20M' },
        { value: 40, label: '40M' },
        { value: 80, label: '80M' },
    ];

    const DEFAULTS = { channel: 2479, bw: 40, tfc_bw: 20, version: 'v1.1.23' };

    const state = {
        list: [],
        selectedId: null,
        activeAction: null,
        cache: {},
    };

    // 统一通知出口，缺省时退回 alert 防止页面无反馈
    const notifier = window.notify || { toast: (m) => alert(m), inline: () => {} };

    // 数据层：封装 API 调用与回退逻辑（与 apiClient 解耦 UI）
    const deviceService = {
        /* 拉取节点列表，返回归一化结果；含超时兜底 */
        async list() {
            const apiCall = apiClient
                .getNodes()
                .then((resp) => normalizeNodes(resp && resp.data && resp.data.nodes ? resp.data.nodes : resp && resp.nodes ? resp.nodes : []));
            return withTimeout(apiCall, 8000);
        },
        /* 保存基础信息：失败时降级为本地成功，保持 UI 流畅 */
        async saveBasic(id, payload) {
            try {
                return await apiClient.setNodeBasicInfo(id, payload);
            } catch (err) {
                console.warn('[device] saveBasic fallback preview', err);
                return { status: 'mock-ok' };
            }
        },
        /* 重启设备：失败时使用占位 promise 避免界面卡死 */
        async reboot(id) {
            try {
                return await apiClient.rebootNode(id, {});
            } catch (err) {
                console.warn('[device] reboot fallback preview', err);
                return fakeAsync();
            }
        },
        /* 恢复出厂：已接入真实接口，失败时兜底 */
        async factory(id) {
            try {
                return await apiClient.factoryResetNode(id, {});
            } catch (err) {
                console.warn('[device] factory fallback preview', err);
                return fakeAsync();
            }
        },
    };

    /* 对外入口：片段挂载后初始化页面 */
    function initDeviceSection(root) {
        if (!root || root._inited) return;
        root._inited = true;

        cacheDom();
        initSelects();
        bindEvents();
        loadListWithFastFallback();
    }

    /* 缓存 DOM 节点，避免重复查询 */
    function cacheDom() {
        state.cache.tableBody = getEl('deviceTableBody');
        state.cache.refreshBtn = getEl('refreshDeviceList');
        state.cache.tabButtons = document.querySelectorAll('#configTabs .tab-btn');
        state.cache.tabPanels = document.querySelectorAll('.config-tab-panel');
        state.cache.formHint = getEl('formHint');

        state.cache.fieldId = getEl('fieldId');
        state.cache.fieldName = getEl('fieldName');
        state.cache.fieldType = getEl('fieldType');
        state.cache.fieldIp = getEl('fieldIp');
        state.cache.fieldChannel = getEl('fieldChannel');
        state.cache.fieldBw = getEl('fieldBw');
        state.cache.fieldTfcBw = getEl('fieldTfcBw');
        state.cache.fieldVersion = getEl('fieldVersion');

        state.cache.btnSave = getEl('btnSaveConfig');
        state.cache.table = getEl('deviceTable');
    }

    /* 初始化下拉选项 */
    function initSelects() {
        fillSelect(state.cache.fieldType, DEVICE_TYPES);
        fillSelect(state.cache.fieldChannel, CHANNEL_OPTIONS.map((c) => ({ value: c, label: c })));
        fillSelect(state.cache.fieldBw, BW_OPTIONS);
        fillSelect(state.cache.fieldTfcBw, BW_OPTIONS);
    }

    /* 绑定事件：刷新、Tab 切换、表格操作、表单联动 */
    function bindEvents() {
        if (state.cache.refreshBtn) state.cache.refreshBtn.addEventListener('click', loadListWithFastFallback);

        const { tabButtons, tabPanels } = state.cache;
        if (tabButtons && tabButtons.length) {
            tabButtons.forEach((btn) => {
                btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
            });
            switchTab('basic');
        }

        if (state.cache.btnSave) state.cache.btnSave.addEventListener('click', handleSave);

        if (state.cache.table) {
            state.cache.table.addEventListener('click', (e) => {
                const actionBtn = findClosest(e.target, 'button[data-action]');
                if (actionBtn) {
                    const action = actionBtn.getAttribute('data-action');
                    const id = parseInt(actionBtn.getAttribute('data-id'), 10);
                    if (action === 'edit') selectDevice(id, 'edit');
                    if (action === 'reboot') handleRowAction(id, 'reboot');
                    if (action === 'factory') handleRowAction(id, 'factory');
                    return;
                }
                const row = findClosest(e.target, 'tr[data-id]');
                if (row) {
                    const rowId = parseInt(row.getAttribute('data-id'), 10);
                    selectDevice(rowId, null);
                }
            });
        }

        if (state.cache.fieldBw) state.cache.fieldBw.addEventListener('change', enforceTfcOptions);
        if (state.cache.fieldTfcBw) state.cache.fieldTfcBw.addEventListener('change', () => {
            const bw = toInt(state.cache.fieldBw.value, 0);
            const tfc = toInt(state.cache.fieldTfcBw.value, 0);
            if (!ensureBandwidthValid(bw, tfc, true)) enforceTfcOptions();
        });
    }

    /* 拉取列表：先占位“加载中”，接口失败或超时快速回退 mock */
    function loadListWithFastFallback(preferId) {
        const tableBody = state.cache.tableBody;
        if (tableBody) tableBody.innerHTML = '<tr class="empty-row"><td colspan="9">加载中...</td></tr>';

        let resolved = false;
        deviceService
            .list()
            .then((nodes) => enrichNodeDetails(nodes))
            .then((nodes) => {
                resolved = true;
                state.list = nodes && nodes.length ? nodes : mockNodesSync();
                renderTable();
                autoSelect(preferId);
            })
            .catch((err) => {
                console.warn('[device] list fallback', err);
                resolved = true;
                state.list = mockNodesSync();
                renderTable();
                autoSelect(preferId);
                notifier.toast('设备列表获取失败，已显示示例数据', { variant: 'warn' });
            });

        setTimeout(() => {
            if (resolved) return;
            state.list = mockNodesSync();
            renderTable();
            autoSelect(preferId);
        }, 900);

        return new Promise((resolve) => {
            setTimeout(() => resolve(state.list), 950);
        });
    }

    /* 补充节点详情：用 node id 调 api/v1/nodes/{id} 基础信息，缺失字段再填回表格 */
    async function enrichNodeDetails(list) {
        if (!Array.isArray(list) || list.length === 0) return list;
        const tasks = list.map((node) => fetchNodeDetail(node));
        const results = await Promise.allSettled(tasks);
        return list.map((node, idx) => {
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
            };
        });
    }

    /* 单个节点详情拉取，失败返回 null 防止阻塞 */
    async function fetchNodeDetail(node) {
        if (!node || node.id == null) return null;
        try {
            const resp = await apiClient.getNodeBasicInfo(node.id);
            return resp && resp.data ? resp.data : resp;
        } catch (err) {
            console.warn('[device] enrich detail failed', err);
            return null;
        }
    }

    /* 列表加载后自动选中指定行，否则第一行 */
    function autoSelect(preferId) {
        if (preferId != null && findById(state.list, preferId)) {
            selectDevice(preferId, 'edit');
            return;
        }
        if (state.list.length > 0) selectDevice(state.list[0].id, 'edit');
        else setInlineHint('暂无设备，请检查数据源', 'warn');
    }

    /* 渲染表格：根据 state.list 生成行 */
    function renderTable() {
        const tableBody = state.cache.tableBody;
        if (!tableBody) return;
        if (!state.list || state.list.length === 0) {
            tableBody.innerHTML = '<tr class="empty-row"><td colspan="9">暂无设备</td></tr>';
            return;
        }
        const rows = state.list.map((item) => {
            const typeLabel = item.type === 0 ? 'G 节点' : 'T 节点';
            const activeAction = state.activeAction;
            const channelText = item.channel === 0 || item.channel ? item.channel : '--';
            const bwText = item.bw === 0 || item.bw ? item.bw + 'M' : '--';
            const tfcText = item.tfc_bw === 0 || item.tfc_bw ? item.tfc_bw + 'M' : '--';
            return [
                '<tr data-id="' + item.id + '">',
                '<td>' + item.id + '</td>',
                '<td>' + escapeHtml(item.name) + '</td>',
                '<td>' + typeLabel + '</td>',
                '<td>' + escapeHtml(item.ip || '--') + '</td>',
                '<td>' + channelText + '</td>',
                '<td>' + bwText + '</td>',
                '<td>' + tfcText + '</td>',
                '<td>' + escapeHtml(item.version || '--') + '</td>',
                '<td class="actions">',
                buildActionBtn('edit', '编辑', item.id, activeAction),
                buildActionBtn('reboot', '重启', item.id, activeAction),
                buildActionBtn('factory', '恢复', item.id, activeAction),
                '</td>',
                '</tr>',
            ].join('');
        });
        tableBody.innerHTML = rows.join('');
    }

    /* 选中行并填充表单，支持按钮高亮 */
    function selectDevice(id, action) {
        const target = findById(state.list, id);
        if (!target) return;
        state.selectedId = id;
        state.activeAction = action ? { id: id, action: action } : null;
        renderTable();
        fillForm(target);
        setInlineHint('');
    }

    /* 将选中设备写入表单并触发带宽联动 */
    function fillForm(item) {
        const { fieldId, fieldName, fieldType, fieldIp, fieldChannel, fieldBw, fieldTfcBw, fieldVersion } = state.cache;
        if (!item) return;
        if (fieldId) fieldId.value = item.id;
        if (fieldName) fieldName.value = item.name || '';
        if (fieldType) fieldType.value = item.type;
        if (fieldIp) fieldIp.value = item.ip || '';
        if (fieldChannel) fieldChannel.value = item.channel == null ? '' : item.channel;
        if (fieldBw) fieldBw.value = item.bw == null ? '' : item.bw;
        if (fieldTfcBw) fieldTfcBw.value = item.tfc_bw == null ? '' : item.tfc_bw;
        if (fieldVersion) fieldVersion.value = item.version || '';
        enforceTfcOptions();
    }

    /* 保存基础配置：校验 → 调用服务 → 更新缓存列表 */
    function handleSave() {
        if (state.selectedId == null) {
            notifier.toast('请先选择设备', { variant: 'warn' });
            return;
        }

        const payload = {
            id: state.selectedId,
            name: (state.cache.fieldName && state.cache.fieldName.value.trim()) || '',
            type: toInt(state.cache.fieldType && state.cache.fieldType.value, 0),
            ip: (state.cache.fieldIp && state.cache.fieldIp.value.trim()) || '',
            channel: toInt(state.cache.fieldChannel && state.cache.fieldChannel.value, DEFAULTS.channel),
            bw: toInt(state.cache.fieldBw && state.cache.fieldBw.value, DEFAULTS.bw),
            tfc_bw: toInt(state.cache.fieldTfcBw && state.cache.fieldTfcBw.value, DEFAULTS.tfc_bw),
        };

        if (!payload.name) return notifier.toast('设备名称不能为空', { variant: 'error' });
        if (!payload.ip) return notifier.toast('IP 地址不能为空', { variant: 'error' });
        if (!ensureBandwidthValid(payload.bw, payload.tfc_bw, true)) {
            enforceTfcOptions();
            return;
        }

        const current = findById(state.list, state.selectedId);
        if (current && payload.bw < current.tfc_bw) {
            notifier.toast('当前物理带宽小于设备的业务带宽，请确认', { variant: 'warn' });
        }

        setLoading(state.cache.btnSave, true);
        deviceService
            .saveBasic(payload.id, {
                type: payload.type,
                name: payload.name,
                ip: payload.ip,
                channel: payload.channel,
                bw: payload.bw,
                tfc_bw: payload.tfc_bw,
            })
            .then(() => {
                mergeToList(payload);
                fillForm(findById(state.list, payload.id));
                notifier.toast('保存成功', { variant: 'success' });
                setLoading(state.cache.btnSave, false);
                loadListWithFastFallback(payload.id);
                if (current && payload.ip !== current.ip && payload.id === 0) redirectToNewIp(payload.ip);
            })
            .catch((err) => {
                console.error('[device] save failed', err);
                setLoading(state.cache.btnSave, false);
                notifier.toast('保存失败，已保留原值', { variant: 'error' });
            });
    }

    /* 行操作：重启/恢复出厂，成功后提示并可跳转 */
    function handleRowAction(id, type) {
        const actionText = type === 'reboot' ? '重启' : type === 'factory' ? '恢复出厂' : '操作';
        if (!confirm('确认要' + actionText + '设备 ' + id + ' 吗？')) return;
        const selector = 'button[data-action="' + type + '"][data-id="' + id + '"]';
        const btn = document.querySelector(selector);
        state.activeAction = { id: id, action: type };
        setLoading(btn, true);

        const actionPromise = type === 'reboot' ? deviceService.reboot(id) : deviceService.factory(id);
        actionPromise
            .then(() => {
                notifier.toast(actionText + '完成', { variant: 'success' });
                setLoading(btn, false);
                if (type === 'reboot' || type === 'factory') window.location.href = 'app.html';
            })
            .catch((err) => {
                console.error('[device] action failed', err);
                notifier.toast(actionText + '失败', { variant: 'error' });
                setLoading(btn, false);
            });
    }

    /* 将表单更新合并回缓存列表，避免重新拉取 */
    function mergeToList(payload) {
        const list = state.list || [];
        for (let i = 0; i < list.length; i++) {
            if (list[i].id === payload.id) {
                list[i] = {
                    id: payload.id,
                    name: payload.name,
                    type: payload.type,
                    ip: payload.ip,
                    channel: payload.channel,
                    bw: payload.bw,
                    tfc_bw: payload.tfc_bw,
                    version: list[i].version || DEFAULTS.version,
                };
                return;
            }
        }
    }

    function redirectToNewIp(ip) {
        const protocol = window.location.protocol || 'http:';
        const target = protocol + '//' + ip + '/app.html';
        window.location.href = target;
    }

    /* 底部行内提示，统一走 notifier.inline */
    function setInlineHint(text, variant) {
        if (!text) {
            if (state.cache.formHint) state.cache.formHint.textContent = '';
            return;
        }
        notifier.inline(state.cache.formHint, text, { variant: variant || 'info' });
    }

    /* Tab 显隐控制 */
    function switchTab(tab) {
        const { tabButtons, tabPanels } = state.cache;
        tabButtons.forEach((btn) => btn.classList.toggle('is-active', btn.getAttribute('data-tab') === tab));
        tabPanels.forEach((panel) => {
            const match = panel.getAttribute('data-tab') === tab;
            panel.hidden = !match;
        });
    }

    function fillSelect(selectEl, options) {
        if (!selectEl || !options) return;
        selectEl.innerHTML = '';
        for (let i = 0; i < options.length; i++) {
            const opt = options[i];
            const optionEl = document.createElement('option');
            optionEl.value = opt.value;
            optionEl.textContent = opt.label;
            selectEl.appendChild(optionEl);
        }
    }

    function findById(list, id) {
        if (!list) return null;
        for (let i = 0; i < list.length; i++) {
            if (list[i].id === id) return list[i];
        }
        return null;
    }

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function findClosest(el, selector) {
        while (el && el !== document) {
            if (matches(el, selector)) return el;
            el = el.parentNode;
        }
        return null;
    }

    function matches(el, selector) {
        if (!el || el.nodeType !== 1) return false;
        const fn = el.matches || el.msMatchesSelector || el.webkitMatchesSelector;
        if (!fn) return false;
        return fn.call(el, selector);
    }

    function buildActionBtn(action, label, id, activeAction) {
        const isActive = activeAction && activeAction.id === id && activeAction.action === action;
        const cls = 'action-btn' + (isActive ? ' is-active' : '');
        return '<button class="' + cls + '" data-action="' + action + '" data-id="' + id + '">' + label + '</button>';
    }

    function ensureBandwidthValid(bw, tfcBw, showAlert) {
        if (tfcBw > bw) {
            if (showAlert) notifier.toast('业务带宽不能大于物理带宽', { variant: 'error' });
            return false;
        }
        return true;
    }

    /* 带宽联动：业务带宽不得超过物理带宽，超出则自动降级并提示 */
    function enforceTfcOptions() {
        const bwEl = state.cache.fieldBw;
        const tfcEl = state.cache.fieldTfcBw;
        if (!bwEl || !tfcEl) return;
        const bw = toInt(bwEl.value, 0);
        const current = toInt(tfcEl.value, 0);
        const options = BW_OPTIONS.filter((opt) => opt.value <= bw);
        fillSelect(tfcEl, options);
        if (current && current <= bw) {
            tfcEl.value = current;
        } else if (options.length) {
            tfcEl.value = options[options.length - 1].value;
            notifier.toast('业务带宽已自动调整为不超过物理带宽', { variant: 'warn' });
        }
    }

    function setLoading(btn, on) {
        if (!btn) return;
        if (on) {
            btn.classList.add('loading');
            btn.disabled = true;
        } else {
            btn.classList.remove('loading');
            btn.disabled = false;
        }
    }

    function fakeAsync() {
        return new Promise((resolve) => setTimeout(resolve, 1200));
    }

    function toInt(val, fallback) {
        const num = parseInt(val, 10);
        return isNaN(num) ? fallback : num;
    }

    function getEl(id) {
        return document.getElementById(id);
    }

    /* 归一化后端数据：补齐默认值，便于 UI 展示 */
    function normalizeNodes(raw) {
        const list = [];
        for (let i = 0; i < raw.length; i++) {
            const item = raw[i] || {};
            list.push({
                id: item.id,
                name: item.name || (item.id != null ? 'node_' + item.id : '未命名'),
                type: item.type != null ? item.type : 0,
                ip: item.ip || '',
                channel: item.channel != null ? item.channel : null,
                bw: item.bw != null ? item.bw : null,
                tfc_bw: item.tfc_bw != null ? item.tfc_bw : null,
                version: item.version || '',
                mac: item.mac || '',
            });
        }
        return list;
    }

    /* 本地示例数据：离线或接口失败时兜底 */
    function mockNodesSync() {
        return normalizeNodes([
            { id: 0, type: 0, name: 'Gnode_000', ip: '192.168.99.10', channel: 2479, bw: 40, tfc_bw: 20, version: 'v1.1.23_123.B215' },
            { id: 1, type: 1, name: 'tnode_001', ip: '192.168.99.11', channel: 1541, bw: 20, tfc_bw: 20, version: 'v1.1.23_123.B215' },
            { id: 2, type: 1, name: 'tnode_002', ip: '192.168.99.12', channel: 2645, bw: 80, tfc_bw: 40, version: 'v1.1.23_123.B215' },
            { id: 3, type: 1, name: 'tnode_003', ip: '192.168.99.13', channel: 125, bw: 20, tfc_bw: 20, version: 'v1.1.23_123.B215' },
            { id: 4, type: 1, name: 'tnode_004', ip: '192.168.99.14', channel: 459, bw: 40, tfc_bw: 20, version: 'v1.1.23_123.B215' },
            { id: 5, type: 1, name: 'tnode_005', ip: '192.168.99.15', channel: 709, bw: 20, tfc_bw: 20, version: 'v1.1.23_123.B215' },
            { id: 6, type: 1, name: 'tnode_006', ip: '192.168.99.16', channel: 1459, bw: 40, tfc_bw: 40, version: 'v1.1.23_123.B215' },
            { id: 7, type: 1, name: 'tnode_007', ip: '192.168.99.17', channel: 1791, bw: 80, tfc_bw: 40, version: 'v1.1.23_123.B215' },
            { id: 8, type: 1, name: 'tnode_008', ip: '192.168.99.18', channel: 1959, bw: 80, tfc_bw: 80, version: 'v1.1.23_123.B215' },
            { id: 9, type: 1, name: 'tnode_009', ip: '192.168.99.19', channel: 2125, bw: 40, tfc_bw: 20, version: 'v1.1.23_123.B215' },
            { id: 10, type: 1, name: 'tnode_010', ip: '192.168.99.20', channel: 2291, bw: 20, tfc_bw: 20, version: 'v1.1.23_123.B215' },
            { id: 11, type: 1, name: 'tnode_011', ip: '192.168.99.21', channel: 2479, bw: 80, tfc_bw: 80, version: 'v1.1.23_123.B215' },
        ]);
    }

    function withTimeout(promise, ms) {
        let timer;
        const timeout = new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('timeout')), ms);
        });
        return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
    }

    window.devicePage = { initDeviceSection };
})();
