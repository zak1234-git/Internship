(function () {
    document.addEventListener('DOMContentLoaded', initApp);

    async function initApp() {
        const contentArea = document.getElementById('contentArea');
        if (!contentArea) return;

        // 懒加载片段与对应初始化函数
        // 声明所有可导航的 section：对应片段路径和初始化函数
        const sections = {
            dashboard: { fragment: 'fragments/dashboard.html', init: (el) => window.dashboardPage && window.dashboardPage.initDashboardSection(el) },
            device: { fragment: 'fragments/device.html', init: (el) => window.devicePage && window.devicePage.initDeviceSection(el) },
            ota: { fragment: 'fragments/ota.html', init: null },
            user: { fragment: 'fragments/user.html', init: null },
            log: { fragment: 'fragments/log.html', init: null },
            help: { fragment: 'fragments/help.html', init: null },
            setting: { fragment: 'fragments/setting.html', init: null },
        };

        // 已加载片段的缓存，避免重复 fetch
        const cache = new Map();
        // 串行化 section 加载，避免快速切换导致状态错乱
        let sectionLoading = Promise.resolve();

        await apiClient.init();
        new LayoutController();

        const mainNav = document.getElementById('mainNav');
        if (mainNav) {
            // 拦截导航点击，阻止默认锚点跳转，改为显隐 section
            mainNav.addEventListener('click', (e) => {
                const link = closestPolyfill(e.target, '.menu-item');
                if (!link) return;
                e.preventDefault();
                const target = link.dataset.target;
                if (!target) return;
                setActiveNav(target);
                loadSection(target);
            });
        }

        const initial = normalizeTarget(location.hash) || 'dashboard';
        setActiveNav(initial);
        await loadSection(initial);

        // 监听 hash 变化（兼容直接修改地址栏或浏览器前进后退）
        window.addEventListener('hashchange', () => {
            const target = normalizeTarget(location.hash);
            if (!target || !sections[target]) return;
            setActiveNav(target);
            loadSection(target);
        });

        function normalizeTarget(hash) {
            return hash ? hash.replace('#', '') : '';
        }

        function setActiveNav(target) {
            if (!mainNav) return;
            mainNav.querySelectorAll('.menu-item').forEach((item) => {
                item.classList.toggle('active', item.dataset.target === target);
            });
        }

        async function loadSection(target) {
            const config = sections[target];
            if (!config) return;

            // 串行化加载，避免快速切换导致状态错乱
            sectionLoading = sectionLoading.then(async () => {
                if (!cache.has(target)) {
                    const sectionEl = await fetchSection(config.fragment);
                    if (!sectionEl) return;
                    sectionEl.hidden = true;
                    sectionEl.dataset.sectionKey = target;
                    contentArea.appendChild(sectionEl);
                    cache.set(target, sectionEl);
                }

                cache.forEach((el, key) => {
                    const visible = key === target;
                    el.hidden = !visible;
                    el.style.display = visible ? '' : 'none';
                });

                const current = cache.get(target);
                if (!current) return;

                if (!config.initialized && typeof config.init === 'function') {
                    config.init(current);
                    config.initialized = true;
                }

                current.hidden = false;
                current.style.display = '';
                history.replaceState(null, '', `#${target}`);
            });
            return sectionLoading;
        }

        async function fetchSection(path) {
            try {
                const resp = await fetch(path, { cache: 'no-cache' });
                if (!resp.ok) throw new Error(`加载失败: ${resp.status}`);
                const html = await resp.text();
                const wrapper = document.createElement('div');
                wrapper.innerHTML = html.trim();
                const section = wrapper.firstElementChild;
                if (!section || section.tagName.toLowerCase() !== 'section') {
                    console.warn('片段缺少 section 根节点:', path);
                    return null;
                }
                return section;
            } catch (err) {
                console.error('加载片段出错', err);
                return null;
            }
        }

        function closestPolyfill(el, selector) {
            if (!el) return null;
            if (typeof el.closest === 'function') return el.closest(selector);
            const match = (node) => {
                const fn = node.matches || node.msMatchesSelector || node.webkitMatchesSelector;
                return fn ? fn.call(node, selector) : false;
            };
            let node = el;
            while (node && node !== document) {
                if (match(node)) return node;
                node = node.parentElement;
            }
            return null;
        }
    }
})();
