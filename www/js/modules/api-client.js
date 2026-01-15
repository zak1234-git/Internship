/**
 * API 客户端模块
 * - 从 config.json 读取后端地址与端口
 * - 统一拼接 /api/v1 基础路径
 * - 内置 Bearer Token 透传（可在调用前设置）
 * - 提供常用业务接口封装，便于页面直接调用
 */

class ApiClient {
    constructor() {
        this.baseUrl = '';
        this.initialized = false;
        this.apiPrefix = '/api/v1';
        this.token = null; // 如有登录得到的 token，可通过 setToken 传入
    }

    /**
     * 初始化：读取配置文件
     */
    async init() {
        if (this.initialized) return;

        try {
            // 读取根目录下的 config.json，避免把接口地址写死在代码里
            const response = await fetch('config.json');
            if (!response.ok) throw new Error('无法加载配置文件');
            
            const config = await response.json();
            
            // 处理服务器地址配置
            const ip = config.serverip || 'localhost';
            const port = config.port || '8080';
            
            // 智能构建 Base URL：支持直接写 http/https，也支持裸 IP/域名
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

    /** 设置/更新 Bearer Token（登录成功后调用） */
    setToken(token) {
        this.token = token;
    }

    /** 统一构建完整 URL，自动附加 /api/v1 前缀 */
    buildUrl(endpoint) {
        const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        return `${this.baseUrl}${this.apiPrefix}${path}`;
    }

    /**
     * 通用请求封装（自动挂载 JSON 头与 Token，支持覆盖）
     * @param {string} endpoint 例如 '/nodes'
     * @param {RequestInit} options fetch 选项
     */
    async request(endpoint, options = {}) {
        if (!this.initialized) await this.init();

        const url = this.buildUrl(endpoint);

        const isFormData = options.body instanceof FormData;
        const defaultHeaders = {
            ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        };

        if (this.token) {
            defaultHeaders['Authorization'] = `Bearer ${this.token}`;
        }

        const finalOptions = {
            method: 'GET',
            ...options,
            headers: { ...defaultHeaders, ...(options.headers || {}) },
        };

        try {
            const response = await fetch(url, finalOptions);

            if (response.status === 401) {
                console.warn('[ApiClient] 未授权，可能需要重新登录');
            }

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            // 部分接口可能无内容，尝试解析 JSON
            const text = await response.text();
            return text ? JSON.parse(text) : {};
        } catch (error) {
            console.error(`[ApiClient] 请求失败: ${url}`, error);
            throw error;
        }
    }

    /** 基础 GET */
    get(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'GET' });
    }

    /** 基础 POST（JSON） */
    post(endpoint, data, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'POST',
            body: data instanceof FormData ? data : JSON.stringify(data || {}),
        });
    }

    /**
     * 业务接口：获取单个节点基本信息
     * @param {number} nodeId 节点 ID，默认 0
     */
    getNodeBasicInfo(nodeId = 0) {
        return this.get(`/nodes/${nodeId}/basicinfo`);
    }

    /** 登录，返回 token */
    login(payload) {
        return this.post('/user/login', payload);
    }

    /** 获取 AP 列表 */
    getNodes() {
        return this.get('/nodes');
    }

    /** 获取节点高级信息 */
    getNodeAdvInfo(nodeId) {
        return this.get(`/nodes/${nodeId}/advinfo`);
    }

    /** 设置节点基础信息 */
    setNodeBasicInfo(nodeId, payload) {
        return this.post(`/nodes/${nodeId}/basicinfo`, payload);
    }

    /** 设置节点高级信息 */
    setNodeAdvInfo(nodeId, payload) {
        return this.post(`/nodes/${nodeId}/advinfo`, payload);
    }

    /** 获取设备连接信息 */
    getNodeConnInfo(nodeId) {
        return this.get(`/nodes/${nodeId}/conninfo`);
    }

    /** 节点流量统计 */
    getNodeTraffic(nodeId) {
        return this.get(`/nodes/${nodeId}/stats/traffic`);
    }

    /** 时间同步 */
    timeSync(nodeId, payload) {
        return this.post(`/nodes/${nodeId}/timesync`, payload);
    }

    /** 设备连接 */
    connectNode(nodeId, payload) {
        return this.post(`/nodes/${nodeId}/connect`, payload);
    }

    /** 断开设备连接 */
    disconnectNode(nodeId, payload) {
        return this.post(`/nodes/${nodeId}/disconnect`, payload);
    }

    /** 重启指定节点 */
    rebootNode(nodeId, payload) {
        return this.post(`/nodes/${nodeId}/reboot`, payload);
    }

    /** 上传固件（FormData，需外部构建） */
    uploadFirmware(nodeId, formData) {
        return this.post(`/nodes/${nodeId}/firmware/upload`, formData, {
            // FormData 时不要覆盖 Content-Type，让浏览器自动带 boundary
        });
    }

    /** 升级节点固件 */
    upgradeFirmware(nodeId, payload) {
        return this.post(`/nodes/${nodeId}/firmware/upgrade`, payload);
    }
}

// 挂载到全局对象
window.apiClient = new ApiClient();
