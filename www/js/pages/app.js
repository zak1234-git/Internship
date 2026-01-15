(function () {
    document.addEventListener('DOMContentLoaded', initApp);

    async function initApp() {
        const contentArea = document.getElementById('contentArea');
        if (!contentArea) return;

        // 懒加载片段与对应初始化函数
        const sections = {
            dashboard: { fragment: 'fragments/dashboard.html', init: (el) => window.dashboardPage && window.dashboardPage.initDashboardSection(el) },
            device: { fragment: 'fragments/device.html', init: null },
            ota: { fragment: 'fragments/ota.html', init: null },
            user: { fragment: 'fragments/user.html', init: null },
            log: { fragment: 'fragments/log.html', init: null },
            help: { fragment: 'fragments/help.html', init: null },
            setting: { fragment: 'fragments/setting.html', init: null },
        };

        const cache = new Map();

        await apiClient.init();
        new LayoutController();

        const mainNav = document.getElementById('mainNav');
        if (mainNav) {
            mainNav.addEventListener('click', (e) => {
                const link = e.target.closest('.menu-item');
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

            if (!cache.has(target)) {
                const sectionEl = await fetchSection(config.fragment);
                if (!sectionEl) return;
                sectionEl.hidden = true;
                sectionEl.dataset.sectionKey = target;
                contentArea.appendChild(sectionEl);
                cache.set(target, sectionEl);
            }

            cache.forEach((el, key) => {
                el.hidden = key !== target;
            });

            const current = cache.get(target);
            if (!current) return;

            if (!config.initialized && typeof config.init === 'function') {
                config.init(current);
                config.initialized = true;
            }

            current.hidden = false;
            history.replaceState(null, '', `#${target}`);
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
    }
})();
