/**
 * 布局控制模块：侧边栏折叠/抽屉、主题切换、用户菜单
 * - 监听按钮、遮罩与窗口尺寸
 * - 根据断点切换抽屉模式与折叠态
 * - 提供主题与用户菜单开关
 */
class LayoutController {
    constructor() {
        this.shell = document.getElementById('appShell');
        this.sidebar = document.getElementById('sidebar');
        this.sidebarToggle = document.getElementById('sidebarToggle');
        this.sidebarDrawerToggle = document.getElementById('sidebarDrawerToggle');
        this.drawerMask = document.getElementById('drawerMask');
        this.brandArea = document.getElementById('brandArea');
        this.themeToggle = document.getElementById('themeToggle');
        this.userMenu = document.getElementById('userMenu');
        this.userTrigger = document.getElementById('userTrigger');
        this.userDropdown = document.getElementById('userDropdown');

        this.drawerBreakpoint = 1024;
        this.isDrawer = window.innerWidth < this.drawerBreakpoint;
        this.isCollapsed = false;
        this.isDark = document.body.classList.contains('theme-dark');
        if (!this.isDark) {
            document.body.classList.remove('theme-dark');
        }

        this.bindEvents();
        this.syncMode();
    }

    bindEvents() {
        // 桌面折叠按钮
        if (this.sidebarToggle) {
            this.sidebarToggle.addEventListener('click', () => this.toggleSidebar());
        }

        // 移动端抽屉按钮
        if (this.sidebarDrawerToggle) {
            this.sidebarDrawerToggle.addEventListener('click', () => this.toggleDrawer());
        }

        if (this.drawerMask) {
            this.drawerMask.addEventListener('click', () => this.closeDrawer());
        }

        if (this.brandArea) {
            this.brandArea.addEventListener('dblclick', () => {
                window.location.href = 'dashboard.html';
            });
        }

        // 主题切换
        if (this.themeToggle) {
            this.themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        // 用户下拉菜单开关
        if (this.userTrigger && this.userDropdown) {
            this.userTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                const open = this.userDropdown.classList.toggle('open');
                this.userTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
            });

            document.addEventListener('click', () => this.closeUserDropdown());
        }

        window.addEventListener('resize', () => this.syncMode());
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeDrawer();
        });
    }

    syncMode() {
        // 根据窗口宽度决定是否进入抽屉模式，移动端关闭折叠态
        this.isDrawer = window.innerWidth < this.drawerBreakpoint;
        this.shell.classList.toggle('drawer-mode', this.isDrawer);

        if (this.isDrawer) {
            this.shell.classList.remove('sidebar-collapsed');
            this.isCollapsed = false;
        }
    }

    toggleSidebar() {
        // 桌面模式下切折叠；移动端转交抽屉逻辑，避免状态冲突
        if (this.isDrawer) {
            this.toggleDrawer();
            return;
        }
        this.isCollapsed = !this.isCollapsed;
        this.shell.classList.toggle('sidebar-collapsed', this.isCollapsed);
        const expanded = !this.isCollapsed;
        if (this.sidebarToggle) {
            this.sidebarToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        }
    }

    toggleDrawer() {
        // 移动端抽屉展开/关闭，并控制遮罩与下拉菜单
        if (!this.isDrawer) return;
        const open = this.shell.classList.toggle('drawer-open');
        if (this.drawerMask) this.drawerMask.style.display = open ? 'block' : 'none';
        if (!open) this.closeUserDropdown();
    }

    closeDrawer() {
        if (!this.isDrawer) return;
        this.shell.classList.remove('drawer-open');
        if (this.drawerMask) this.drawerMask.style.display = 'none';
    }

    toggleTheme() {
        // 简单切换 body.theme-dark，其他样式在 CSS 变量层覆盖
        this.isDark = !this.isDark;
        document.body.classList.toggle('theme-dark', this.isDark);
    }

    closeUserDropdown() {
        // 全局点击或关闭抽屉时收起下拉
        if (!this.userDropdown) return;
        this.userDropdown.classList.remove('open');
        if (this.userTrigger) this.userTrigger.setAttribute('aria-expanded', 'false');
    }
}

window.LayoutController = LayoutController;
