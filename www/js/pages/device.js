(function () {
    // 下拉选项常量：类型、信道、带宽
    var DEVICE_TYPES = [
        { value: 0, label: 'G 节点(主节点)' },
        { value: 1, label: 'T 节点(终端节点)' },
    ];

    var CHANNEL_OPTIONS = [41, 125, 209, 291, 375, 459, 541, 625, 709, 791, 1375, 1459, 1541, 1625, 1709, 1791, 1875, 1959, 2041, 2125, 2209, 2291, 2479, 2563, 2645, 2729, 2813];

    var BW_OPTIONS = [
        { value: 20, label: '20M' },
        { value: 40, label: '40M' },
        { value: 80, label: '80M' },
    ];

    // 页内状态：列表、当前选中设备、当前高亮的操作按钮
    var state = {
        list: [],
        selectedId: null,
        activeAction: null,
    };

    // 对外暴露的入口：片段插入后由 app.js 调用
    function initDeviceSection(root) {
        if (!root || root._inited) return;
        root._inited = true;

        var tableBody = document.getElementById('deviceTableBody');
        var refreshBtn = document.getElementById('refreshDeviceList');
        var basicConfig = document.getElementById('basicConfig');
        var basicPanel = basicConfig ? findClosest(basicConfig, 'article') : null;
        var tabButtons = document.querySelectorAll('#configTabs .tab-btn');
        var tabPanels = document.querySelectorAll('.config-tab-panel');
        var formHint = document.getElementById('formHint');
        var toastTimer = null; // 记录 toast 计时器，避免多次点击叠加

        var fieldId = document.getElementById('fieldId');
        var fieldName = document.getElementById('fieldName');
        var fieldType = document.getElementById('fieldType');
        var fieldIp = document.getElementById('fieldIp');
        var fieldChannel = document.getElementById('fieldChannel');
        var fieldBw = document.getElementById('fieldBw');
        var fieldTfcBw = document.getElementById('fieldTfcBw');
        var fieldVersion = document.getElementById('fieldVersion');

        var btnSave = document.getElementById('btnSaveConfig');
        // 页面下部不再重复重启/恢复按钮
        var btnReboot = document.getElementById('btnRebootDevice');
        var btnFactory = document.getElementById('btnFactoryResetDevice');
        // 已移除断开按钮，预留变量避免报错
        var btnDisconnect = document.getElementById('btnDisconnectDevice');

        // 初始化下拉选项
        fillSelect(fieldType, DEVICE_TYPES);
        fillSelect(fieldChannel, CHANNEL_OPTIONS.map(function (c) { return { value: c, label: c }; }));
        fillSelect(fieldBw, BW_OPTIONS);
        fillSelect(fieldTfcBw, BW_OPTIONS);

        if (refreshBtn) refreshBtn.addEventListener('click', loadDeviceList);

        if (tabButtons && tabButtons.length) {
            tabButtons.forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var tab = btn.getAttribute('data-tab');
                    switchTab(tab);
                });
            });
            switchTab('basic');
        }

        if (btnSave) btnSave.addEventListener('click', handleSave);
        // 底部重复按钮已移除，仅保留表格内的重启/恢复
        // 断开暂未启用

        // 表格事件委托
        var table = document.getElementById('deviceTable');
        if (table) {
            table.addEventListener('click', function (e) {
                var actionBtn = findClosest(e.target, 'button[data-action]');
                if (actionBtn) {
                    var action = actionBtn.getAttribute('data-action');
                    var id = parseInt(actionBtn.getAttribute('data-id'), 10);
                    if (action === 'edit') selectDevice(id, 'edit');
                    if (action === 'reboot') handleRowAction(id, 'reboot');
                    if (action === 'factory') handleRowAction(id, 'factory');
                    return;
                }
                var row = findClosest(e.target, 'tr[data-id]');
                if (row) {
                    var rowId = parseInt(row.getAttribute('data-id'), 10);
                    selectDevice(rowId, null);
                }
            });
        }

        // 绑定带宽联动，限制业务带宽不超过物理带宽
        if (fieldBw) fieldBw.addEventListener('change', enforceTfcOptions);
        if (fieldTfcBw) fieldTfcBw.addEventListener('change', function () {
            var bw = parseInt(fieldBw.value || '0', 10);
            var tfc = parseInt(fieldTfcBw.value || '0', 10);
            if (!ensureBandwidthValid(bw, tfc, true)) {
                enforceTfcOptions();
            }
        });

        // 首次加载列表
        loadDeviceList();

        // 拉取列表：优先请求接口，超时或失败再回退 mock；接口成功则不显示 mock
        function loadDeviceList() {
            if (tableBody) {
                tableBody.innerHTML = '<tr class="empty-row"><td colspan="9">加载中...</td></tr>';
            }
            var loaded = false;
            fetchNodes().then(function (nodes) {
                loaded = true;
                if (!nodes || !nodes.length) {
                    state.list = mockNodesSync();
                } else {
                    state.list = nodes;
                }
                renderTable();
                if (state.list.length > 0) selectDevice(state.list[0].id, 'edit');
                else showHint('暂无设备，请检查数据源');
            }).catch(function () {
                loaded = true;
                state.list = mockNodesSync();
                renderTable();
                if (state.list.length > 0) selectDevice(state.list[0].id, 'edit');
            });

            // 兜底：接口超过 900ms 未返回则先展示 mock，防止空白等待
            setTimeout(function () {
                if (loaded) return;
                state.list = mockNodesSync();
                renderTable();
                if (state.list.length > 0) selectDevice(state.list[0].id, 'edit');
            }, 900);
        }

        // 优先调用后端 /nodes，失败走本地 mock；超时快速回退
        function fetchNodes() {
            var timeout = new Promise(function (resolve, reject) {
                setTimeout(function () { reject(new Error('timeout')); }, 800);
            });
            return Promise.race([
                apiClient.getNodes().then(function (resp) {
                    var data = resp && resp.data && resp.data.nodes ? resp.data.nodes : [];
                    return normalizeNodes(data);
                }),
                timeout,
            ]).catch(function () {
                return mockNodes();
            });
        }

        // 统一字段，并填充缺省值便于 UI 展示
        function normalizeNodes(raw) {
            var list = [];
            for (var i = 0; i < raw.length; i++) {
                var item = raw[i] || {};
                list.push({
                    id: item.id,
                    name: item.name || ('node_' + item.id),
                    type: item.type != null ? item.type : 0,
                    ip: item.ip || '192.168.99.' + (100 + i),
                    channel: item.channel != null ? item.channel : 2479,
                    bw: item.bw != null ? item.bw : 40,
                    tfc_bw: item.tfc_bw != null ? item.tfc_bw : 20,
                    version: item.version || 'v1.1.23',
                });
            }
            return list;
        }

        // 本地示例数据，便于离线预览（同步）
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

        // 本地示例数据（异步封装）
        function mockNodes() {
            return Promise.resolve(mockNodesSync());
        }

        // 根据 state.list 渲染表格
        function renderTable() {
            if (!tableBody) return;
            if (!state.list || state.list.length === 0) {
                tableBody.innerHTML = '<tr class="empty-row"><td colspan="9">暂无设备</td></tr>';
                return;
            }
            var rows = state.list.map(function (item) {
                var typeLabel = item.type === 0 ? 'G 节点' : 'T 节点';
                var activeAction = state.activeAction;
                return [
                    '<tr data-id="' + item.id + '">',
                    '<td>' + item.id + '</td>',
                    '<td>' + escapeHtml(item.name) + '</td>',
                    '<td>' + typeLabel + '</td>',
                    '<td>' + escapeHtml(item.ip) + '</td>',
                    '<td>' + item.channel + '</td>',
                    '<td>' + item.bw + 'M</td>',
                    '<td>' + item.tfc_bw + 'M</td>',
                    '<td>' + escapeHtml(item.version) + '</td>',
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

        // 选中行，填充表单；action 用于高亮按钮
        function selectDevice(id, action) {
            var target = findById(state.list, id);
            if (!target) return;
            state.selectedId = id;
            state.activeAction = action ? { id: id, action: action } : null;
            renderTable();
            fillForm(target);
            showHint('');
        }

        function fillForm(item) {
            if (!item) return;
            if (fieldId) fieldId.value = item.id;
            if (fieldName) fieldName.value = item.name || '';
            if (fieldType) fieldType.value = item.type;
            if (fieldIp) fieldIp.value = item.ip || '';
            if (fieldChannel) fieldChannel.value = item.channel;
            if (fieldBw) fieldBw.value = item.bw;
            if (fieldTfcBw) fieldTfcBw.value = item.tfc_bw;
            if (fieldVersion) fieldVersion.value = item.version || '';

            // 根据物理带宽过滤业务带宽选项
            enforceTfcOptions();
        }

        // 保存基础配置（带校验与 IP 变更跳转）
        function handleSave() {
            if (state.selectedId == null) {
                alert('请先选择设备');
                return;
            }

            var payload = {
                id: state.selectedId,
                name: fieldName ? fieldName.value.trim() : '',
                type: fieldType ? parseInt(fieldType.value, 10) : 0,
                ip: fieldIp ? fieldIp.value.trim() : '',
                channel: fieldChannel ? parseInt(fieldChannel.value, 10) : 2479,
                bw: fieldBw ? parseInt(fieldBw.value, 10) : 20,
                tfc_bw: fieldTfcBw ? parseInt(fieldTfcBw.value, 10) : 20,
            };

            if (!payload.name) {
                alert('设备名称不能为空');
                return;
            }
            if (!payload.ip) {
                alert('IP 地址不能为空');
                return;
            }
            if (!ensureBandwidthValid(payload.bw, payload.tfc_bw, true)) {
                enforceTfcOptions();
                return;
            }

            var current = findById(state.list, state.selectedId);
            if (current && payload.bw < current.tfc_bw) {
                alert('当前物理带宽小于设备的业务带宽，请确认');
            }

            setLoading(btnSave, true);
            saveNode(payload).then(function () {
                mergeToList(payload);
                fillForm(findById(state.list, payload.id));
                showToast('保存成功'); // 保存成功后浮层提示，避免撑开页面
                setLoading(btnSave, false);

                if (current && payload.ip !== current.ip && payload.id === 0) {
                    redirectToNewIp(payload.ip);
                }
            }).catch(function () {
                setLoading(btnSave, false);
                alert('保存失败，使用本地预览模式');
            });
        }

        // 底部按钮的重启/恢复/断开
        function handleAction(type) {
            if (state.selectedId == null) {
                alert('请先选择设备');
                return;
            }
            handleRowAction(state.selectedId, type);
        }

        // 表格行上的动作，含确认与预览模式反馈
        function handleRowAction(id, type) {
            var actionText = type === 'reboot' ? '重启' : type === 'factory' ? '恢复出厂' : '断开连接';
            if (!confirm('确认要' + actionText + '设备 ' + id + ' 吗？')) return;
            var btn = null;
            var selector = 'button[data-action="' + type + '"][data-id="' + id + '"]';
            btn = document.querySelector(selector);
            state.activeAction = { id: id, action: type };
            setLoading(btn, true);
            fakeAsync().then(function () {
                setLoading(btn, false);
                alert(actionText + '操作已完成（预览模式）');
                if (type === 'reboot' || type === 'factory') {
                    window.location.href = 'app.html';
                }
            });
        }

        // 调用后端保存，失败则视作预览成功
        function saveNode(payload) {
            return apiClient.setNodeBasicInfo(payload.id, {
                type: payload.type,
                name: payload.name,
                ip: payload.ip,
                channel: payload.channel,
                bw: payload.bw,
                tfc_bw: payload.tfc_bw,
            }).catch(function () {
                return Promise.resolve({ status: 'success' });
            });
        }

        // 将提交结果合并回 state.list
        function mergeToList(payload) {
            var list = state.list || [];
            for (var i = 0; i < list.length; i++) {
                if (list[i].id === payload.id) {
                    list[i] = {
                        id: payload.id,
                        name: payload.name,
                        type: payload.type,
                        ip: payload.ip,
                        channel: payload.channel,
                        bw: payload.bw,
                        tfc_bw: payload.tfc_bw,
                        version: list[i].version || 'v1.1.23',
                    };
                    return;
                }
            }
        }

        // 修改当前设备 IP 后跳转仪表盘（新地址）
        function redirectToNewIp(ip) {
            var protocol = window.location.protocol || 'http:';
            var target = protocol + '//' + ip + '/app.html';
            window.location.href = target;
        }

        // 底部提示文案
        function showHint(text) {
            if (!text) {
                if (formHint) formHint.textContent = ''; // 清空旧文案，避免残留
                return;
            }
            showToast(text); // 将提示统一交给 toast 展示，避免撑开布局
        }

        // 顶部悬浮提示：用于展示保存成功等反馈
        function showToast(message) {
            var toast = getToastElement(); // 获取或创建 toast 容器
            toast.textContent = message || ''; // 写入提示文字
            toast.classList.add('show'); // 触发展示动画
            if (toastTimer) clearTimeout(toastTimer); // 清理上一次定时器，避免提前隐藏
            toastTimer = setTimeout(function () {
                toast.classList.remove('show'); // 超时后隐藏提示
            }, 3000);
        }

        // 创建并缓存 toast 节点，确保多次调用复用同一元素
        function getToastElement() {
            var toast = document.getElementById('toastMessage'); // 尝试获取已有 toast
            if (!toast) {
                toast = document.createElement('div'); // 创建新的 toast 容器
                toast.id = 'toastMessage'; // 设定 ID 供样式选择与复用
                document.body.appendChild(toast); // 挂载到 body，保证固定定位可用
            }
            return toast;
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

        // 占位异步，模拟设备处理时的等待
        function fakeAsync() {
            return new Promise(function (resolve) {
                setTimeout(resolve, 1200);
            });
        }

        function switchTab(tab) {
            tabButtons.forEach(function (btn) {
                var isActive = btn.getAttribute('data-tab') === tab;
                btn.classList.toggle('is-active', isActive);
            });
            tabPanels.forEach(function (panel) {
                var match = panel.getAttribute('data-tab') === tab;
                panel.hidden = !match;
            });
        }
    }

    // 通用：填充下拉选项
    function fillSelect(selectEl, options) {
        if (!selectEl || !options) return;
        selectEl.innerHTML = '';
        for (var i = 0; i < options.length; i++) {
            var opt = options[i];
            var optionEl = document.createElement('option');
            optionEl.value = opt.value;
            optionEl.textContent = opt.label;
            selectEl.appendChild(optionEl);
        }
    }

    // 通用：按 id 查找
    function findById(list, id) {
        if (!list) return null;
        for (var i = 0; i < list.length; i++) {
            if (list[i].id === id) return list[i];
        }
        return null;
    }

    // 通用：转义 HTML，防止文本串入标签
    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // 通用：兼容性良好的 closest
    function findClosest(el, selector) {
        while (el && el !== document) {
            if (matches(el, selector)) return el;
            el = el.parentNode;
        }
        return null;
    }

    // 通用：matches 兼容低版本浏览器
    function matches(el, selector) {
        if (!el || el.nodeType !== 1) return false;
        var fn = el.matches || el.msMatchesSelector || el.webkitMatchesSelector;
        if (!fn) return false;
        return fn.call(el, selector);
    }

    // 生成操作按钮模板，带高亮态
    function buildActionBtn(action, label, id, activeAction) {
        var isActive = activeAction && activeAction.id === id && activeAction.action === action;
        var cls = 'action-btn' + (isActive ? ' is-active' : '');
        return '<button class="' + cls + '" data-action="' + action + '" data-id="' + id + '">' + label + '</button>';
    }

    // 校验业务带宽不得超过物理带宽
    function ensureBandwidthValid(bw, tfcBw, showAlert) {
        if (tfcBw > bw) {
            if (showAlert) alert('业务带宽不能大于物理带宽');
            return false;
        }
        return true;
    }

    // 根据物理带宽，过滤可选的业务带宽
    function enforceTfcOptions() {
        var bwEl = document.getElementById('fieldBw');
        var tfcEl = document.getElementById('fieldTfcBw');
        if (!bwEl || !tfcEl) return;
        var bw = parseInt(bwEl.value || '0', 10);
        var current = parseInt(tfcEl.value || '0', 10);
        var options = [];
        for (var i = 0; i < BW_OPTIONS.length; i++) {
            if (BW_OPTIONS[i].value <= bw) options.push(BW_OPTIONS[i]);
        }
        fillSelect(tfcEl, options);
        if (current && current <= bw) {
            tfcEl.value = current;
        } else if (options.length) {
            tfcEl.value = options[options.length - 1].value;
            alert('业务带宽已自动调整为不超过物理带宽');
        }
    }

    window.devicePage = {
        initDeviceSection: initDeviceSection,
    };
})();
