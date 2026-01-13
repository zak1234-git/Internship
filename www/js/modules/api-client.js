/**
 * API 客户端模块
 * 负责读取 config.json 并封装统一的 HTTP 请求
 */

class ApiClient {
    constructor() {
        this.baseUrl = '';
        this.initialized = false;
    }

    /**
     * 初始化：读取配置文件
     */
    async init() {
        if (this.initialized) return;

        try {
            // 读取根目录下的 config.json
            const response = await fetch('config.json');
            if (!response.ok) throw new Error('无法加载配置文件');
            
            const config = await response.json();
            
            // 处理服务器地址配置
            const ip = config.serverip || 'localhost';
            const port = config.port || '8080';
            
            // 智能构建 Base URL
            if (ip.startsWith('http://') || ip.startsWith('https://')) {
                this.baseUrl = `${ip}:${port}`;
            } else {
                this.baseUrl = `http://${ip}:${port}`;
            }
            
            this.initialized = true;
            console.log(`[ApiClient] 初始化成功，API 地址: ${this.baseUrl}`);
        } catch (error) {
            console.error('[ApiClient] 初始化失败:', error);
            // 可以在这里设置一个默认的 fallback 地址，或者抛出错误阻断应用
            // this.baseUrl = 'http://localhost:8080'; 
        }
    }

    /**
     * 发送请求
     * @param {string} endpoint 接口路径，例如 '/api/login'
     * @param {object} options fetch 选项
     */
    async request(endpoint, options = {}) {
        if (!this.initialized) await this.init();

        // 确保 endpoint 以 / 开头
        const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        const url = `${this.baseUrl}${path}`;

        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                // 'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        };

        const finalOptions = { ...defaultOptions, ...options };

        try {
            const response = await fetch(url, finalOptions);
            
            // 处理 401 未授权等通用错误
            if (response.status === 401) {
                console.warn('[ApiClient] 未授权，可能需要重新登录');
                // window.location.href = 'index.html';
            }

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            // 尝试解析 JSON
            return await response.json();
        } catch (error) {
            console.error(`[ApiClient] 请求失败: ${url}`, error);
            throw error;
        }
    }

    /**
     * GET 请求
     */
    get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    /**
     * POST 请求
     */
    post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
}

// 挂载到全局对象
window.apiClient = new ApiClient();
