/**
 * 登录页面入口脚本
 * 负责组装各个模块
 */

// 模块已通过全局变量引入

document.addEventListener('DOMContentLoaded', async () => {
    // 1. 优先初始化 API 配置 (读取 config.json)
    await apiClient.init();

    // 2. 初始化背景粒子系统：左侧画布承载科技感背景
    new ParticleBackground('backgroundCanvas', '.left-panel');

    // 3. 初始化认证管理：绑定表单提交与模拟登录逻辑
    new AuthManager('loginForm');
});
