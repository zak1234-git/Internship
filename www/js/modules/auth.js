/**
 * 认证模块
 * 负责登录表单的验证与提交逻辑
 */

// import { apiClient } from './api-client.js';

class AuthManager {
    constructor(formId) {
        this.form = document.getElementById(formId);
        if (this.form) {
            this.init();
        }
    }

    init() {
        // 表单统一在这里绑定提交事件，便于后续扩展/解绑
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    async handleSubmit(e) {
        e.preventDefault();

        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const username = usernameInput ? usernameInput.value.trim() : '';
        const password = passwordInput ? passwordInput.value : '';
        
        const btnTextEl = document.querySelector('.login-btn span');
        const originalText = btnTextEl ? btnTextEl.innerText : '';

        if (btnTextEl) btnTextEl.innerText = '正在连接...';

        try {
            // --- 真实 API 调用 ---
            // const result = await apiClient.post('/api/login', { username, password });
            
            // if (result.success) {
            //     // 保存 token (如果有)
            //     // localStorage.setItem('token', result.token);
            //     this.onLoginSuccess(btnTextEl);
            // } else {
            //     this.onLoginFailure(btnTextEl, originalText, passwordInput, result.message);
            // }

            // --- 模拟逻辑 ---
            // 模拟网络延迟
            await new Promise(resolve => setTimeout(resolve, 800));
            
            // 这里的验证逻辑仅供测试，实际应使用上面的 API 调用
            if (username === 'admin' && password === '123456') {
                this.onLoginSuccess(btnTextEl);
            } else {
                this.onLoginFailure(btnTextEl, originalText, passwordInput);
            }

        } catch (error) {
            console.error('登录请求异常:', error);
            this.onLoginFailure(btnTextEl, originalText, passwordInput, '服务器连接失败');
        }
    }

    onLoginSuccess(btnTextEl) {
        if (btnTextEl) btnTextEl.innerText = '连接成功';
        window.location.href = 'dashboard.html';
    }

    onLoginFailure(btnTextEl, originalText, passwordInput, message) {
        const msg = message || '认证失败：密钥无效或ID错误';
        alert(msg);
        
        if (btnTextEl) btnTextEl.innerText = originalText || '立即登录';
        
        if (passwordInput) {
            passwordInput.value = '';
            passwordInput.focus();
        }
    }
}

// 挂载到全局对象
window.AuthManager = AuthManager;
