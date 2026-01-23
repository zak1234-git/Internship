/*
 * API 客户端模块：配置驱动 baseUrl/Token/超时，统一 /api/v1 前缀，封装常用业务接口。
 */
class ApiClient {
    constructor() {
        this.baseUrl = '';
        this.initialized = false;
        this.apiPrefix = '/api/v1';
        this.token = null; // 如有登录得到的 token，可通过 setToken 传入
        this.timeout = 10000; // 默认 10s，config.json 可覆盖
    }

    /* 初始化：读取配置文件并构建 baseUrl / token / timeout */
    async init() {
        if (this.initialized) return;

        // file:// 预览时跳过网络配置，允许后续走示例数据
        if (window.location.protocol === 'file:') {
            console.warn('[ApiClient] file:// 预览，跳过 config.json，使用占位 baseUrl');
            this.baseUrl = '';
            this.initialized = true;
            return;
        }

        try {
            const response = await fetch('config.json');
            if (!response.ok) throw new Error('无法加载配置文件');
            const config = await response.json();

            const ip = config.serverip || 'localhost';
            const port = config.port || '8080';
            this.token = config.token || this.token;
            this.timeout = config.timeout || this.timeout;

            // 与 main.js 类似：支持 http/https 或裸 IP/域名
            if (ip.startsWith('http://') || ip.startsWith('https://')) {
                this.baseUrl = `${ip}:${port}`;
            } else {
                this.baseUrl = `http://${ip}:${port}`;
            }

            console.log(`[ApiClient] 初始化成功，API 地址: ${this.baseUrl}`);
        } catch (error) {
            console.warn('[ApiClient] 初始化失败，将使用默认占位，file:// 预览将直接走示例数据:', error);
            this.baseUrl = '';
        } finally {
            this.initialized = true;
        }
    }

    /* 手动覆写配置（运行时切换 IP/Port/Token/Timeout） */
    setConfig({ baseUrl, ip, port, token, timeout } = {}) {
        if (baseUrl) this.baseUrl = baseUrl;
        if (ip) this.baseUrl = ip.startsWith('http') ? `${ip}${port ? ':' + port : ''}` : `http://${ip}${port ? ':' + port : ''}`;
        if (token) this.token = token;
        if (timeout) this.timeout = timeout;
        this.initialized = true;
    }

    /* 设置/更新 Bearer Token（登录成功后调用） */
    setToken(token) {
        this.token = token;
    }

    /* 统一构建完整 URL，自动附加 /api/v1 前缀 */
    buildUrl(endpoint) {
        const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        return `${this.baseUrl}${this.apiPrefix}${path}`;
    }

    /* 通用请求封装：自动挂载 JSON/Token，支持超时 */
    async request(endpoint, options = {}) {
        if (!this.initialized) await this.init();

        // 本地 file:// 访问且未配置 baseUrl 时直接报错，让上层使用示例数据
        if (!this.baseUrl && window.location.protocol === 'file:') {
            throw new Error('LOCAL_FILE_PREVIEW_NO_BASEURL');
        }

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

        // 超时控制：使用 AbortController，可被调用方覆盖 timeout
        const controller = new AbortController();
        const timeoutMs = options.timeout || this.timeout;
        const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;
        finalOptions.signal = controller.signal;

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
        } finally {
            if (timer) clearTimeout(timer);
        }
    }

    /* 基础 GET */
    get(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'GET' });
    }

    /* 基础 POST（JSON 或 FormData） */
    post(endpoint, data, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'POST',
            body: data instanceof FormData ? data : JSON.stringify(data || {}),
        });
    }

    /* 获取单个节点基本信息 */
    getNodeBasicInfo(nodeId = 0) {
        return this.get(`/nodes/${nodeId}/basicinfo`);
    }

    /* 登录，返回 token */
    login(payload) {
        return this.post('/user/login', payload);
    }

    /* 获取 AP 列表 */
    getNodes() {
        return this.get('/nodes');
    }

    /* 获取节点高级信息 */
    getNodeAdvInfo(nodeId) {
        return this.get(`/nodes/${nodeId}/advinfo`);
    }

    /* 设置节点基础信息 */
    setNodeBasicInfo(nodeId, payload) {
        return this.post(`/nodes/${nodeId}/basicinfo`, payload);
    }

    /* 设置节点高级信息 */
    setNodeAdvInfo(nodeId, payload) {
        return this.post(`/nodes/${nodeId}/advinfo`, payload);
    }

    /* 获取设备连接信息 */
    getNodeConnInfo(nodeId) {
        return this.get(`/nodes/${nodeId}/conninfo`);
    }

    /* 节点流量统计 */
    getNodeTraffic(nodeId) {
        return this.get(`/nodes/${nodeId}/stats/traffic`);
    }

    /* 时间同步 */
    timeSync(nodeId, payload) {
        return this.post(`/nodes/${nodeId}/timesync`, payload);
    }

    /* 设备连接 */
    connectNode(nodeId, payload) {
        return this.post(`/nodes/${nodeId}/connect`, payload);
    }

    /* 断开设备连接 */
    disconnectNode(nodeId, payload) {
        return this.post(`/nodes/${nodeId}/disconnect`, payload);
    }

    /* 重启指定节点 */
    rebootNode(nodeId, payload) {
        return this.post(`/nodes/${nodeId}/reboot`, payload);
    }

    /* 恢复出厂设置 */
    factoryResetNode(nodeId, payload = {}) {
        return this.post(`/nodes/${nodeId}/factory`, payload);
    }

    /* 上传固件（FormData，需外部构建） */
    uploadFirmware(nodeId, formData) {
        return this.post(`/nodes/${nodeId}/firmware/upload`, formData, {
            // FormData 时不要覆盖 Content-Type，让浏览器自动带 boundary
        });
    }

    /* 升级节点固件 */
    upgradeFirmware(nodeId, payload) {
        return this.post(`/nodes/${nodeId}/firmware/upgrade`, payload);
    }
}

// 挂载到全局对象
window.apiClient = new ApiClient();
