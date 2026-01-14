/**
 * API 客户端模块
 * - 读取 config.json 获取后端地址
 * - 提供基础 GET/POST 方法
 * - 聚合业务接口（如节点信息）便于页面复用
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
         * 通用 JSON 请求封装
         * @param {string} endpoint 例如 '/api/v1/...'
         * @param {RequestInit} options fetch 选项，method/headers/body 等
         */
        async request(endpoint, options = {}) {
            if (!this.initialized) await this.init();

            const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
            const url = `${this.baseUrl}${path}`;

            const defaultOptions = {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    // 'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            };

            const finalOptions = {
                ...defaultOptions,
                ...options,
                headers: { ...defaultOptions.headers, ...(options.headers || {}) }
            };

            try {
                const response = await fetch(url, finalOptions);

                if (response.status === 401) {
                    console.warn('[ApiClient] 未授权，可能需要重新登录');
                    // window.location.href = 'index.html';
                }

                if (!response.ok) {
                    throw new Error(`API Error: ${response.status} ${response.statusText}`);
                }

                return await response.json();
            } catch (error) {
                console.error(`[ApiClient] 请求失败: ${url}`, error);
                throw error;
            }
        }

        /** 基础 GET */
        get(endpoint, options = {}) {
            return this.request(endpoint, { ...options, method: 'GET' });
        }

        /** 基础 POST */
        post(endpoint, data, options = {}) {
            return this.request(endpoint, {
                ...options,
                method: 'POST',
                body: JSON.stringify(data)
            });
        }

    /**
     * 业务接口：获取单个节点基本信息
     * @param {number} nodeId 节点 ID，默认 0
     */
    getNodeBasicInfo(nodeId = 0) {
        return this.get(`/api/v1/nodes/nodes/${nodeId}/basicinfo`);
    }
}

// 挂载到全局对象
window.apiClient = new ApiClient();
