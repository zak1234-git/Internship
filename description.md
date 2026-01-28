# 项目上手说明

> 面向agent的快速上手文档。内容基于现有代码与配置归纳。

---

## 1. 项目目的与使用场景
本项目为“星闪动态子网管理系统”的前端页面，提供登录、仪表盘、设备配置与运维操作（重启/恢复出厂/拓扑展示等）的可视化管理界面。适用于局域网或设备管理后台的日常运维、设备状态监控、参数配置与批量管理。

---

## 2. 目录结构概览
> 只列关键文件/目录与职责。

- [www/index.html](../www/index.html)  
  登录页入口（加载 `api-client`、粒子背景、认证逻辑）。

- [www/app.html](../www/app.html)  
  主应用外壳（侧边栏、顶栏、内容区、脚本入口）。

- [www/config.json](../www/config.json)  
  后端地址配置（`serverip`/`port`/`timeout`/`token`）。

- [www/fragments/](../www/fragments/)  
  各业务模块 HTML 片段（dashboard/device/ota/user/log/help/setting）。由 `app.js` 懒加载并缓存。

- [www/js/pages/app.js](../www/js/pages/app.js)  
  应用入口与哈希路由（片段懒加载、初始化模块）。

- [www/js/pages/dashboard.js](../www/js/pages/dashboard.js)  
  仪表盘逻辑（指标卡片、拓扑、快捷操作）。

- [www/js/pages/device.js](../www/js/pages/device.js)  
  设备管理逻辑（列表、编辑、带宽校验、操作）。

- [www/js/pages/login.js](../www/js/pages/login.js)  
  登录页入口脚本。

- [www/js/modules/api-client.js](../www/js/modules/api-client.js)  
  API 客户端（配置读取、统一 `/api/v1` 前缀、GET/POST 封装）。

- [www/js/modules/layout.js](../www/js/modules/layout.js)  
  布局控制（侧边栏、抽屉、主题、用户菜单）。

- [www/js/modules/notify.js](../www/js/modules/notify.js)  
  统一通知（Toast/行内提示）。

- [www/js/modules/particle-background.js](../www/js/modules/particle-background.js)  
  登录页粒子与路由器动画背景。

- [docs/architecture.md](architecture.md)  
  架构与约定概览。

---

## 3. 关键流程
### 3.1 登录流程
1. 打开登录页 [www/index.html](../www/index.html)。
2. `login.js` 启动：`apiClient.init()` → `ParticleBackground` → `AuthManager` 绑定表单。
3. `AuthManager.handleSubmit()` 当前为模拟校验（`admin/123456`），成功跳转 `app.html`。

### 3.2 应用加载与导航
1. 打开 [www/app.html](../www/app.html)。
2. `app.js` 执行：初始化 `apiClient`、`LayoutController`。
3. 根据 `hash`（如 `#dashboard`）懒加载 [www/fragments/](../www/fragments/) 片段并缓存。
4. 每个 section 首次加载时触发对应 init（如 `dashboardPage.initDashboardSection`）。

### 3.3 设备管理流程
1. 进入“设备配置”模块后，`devicePage.initDeviceSection()` 拉取节点列表。
2. `deviceService.list()` 使用 `apiClient.getNodes()`，超时/失败走 mock 数据。
3. 点击行或“编辑”按钮 → 填充表单 → 保存调用 `setNodeBasicInfo`。
4. “重启/恢复出厂”调用对应 API，成功后刷新或跳转。

---

## 4. 关键模块与核心函数（重点）
> 只列入口与关键函数。

### 4.1 入口函数索引表
| 入口点 | 文件 | 作用 |
|---|---|---|
| `DOMContentLoaded → initApp()` | [www/js/pages/app.js](../www/js/pages/app.js) | 应用启动、路由、片段加载 |
| `DOMContentLoaded` | [www/js/pages/login.js](../www/js/pages/login.js) | 登录页启动 |
| `new LayoutController()` | [www/js/modules/layout.js](../www/js/modules/layout.js) | 布局/主题/菜单控制 |
| `dashboardPage.initDashboardSection()` | [www/js/pages/dashboard.js](../www/js/pages/dashboard.js) | 仪表盘初始化 |
| `devicePage.initDeviceSection()` | [www/js/pages/device.js](../www/js/pages/device.js) | 设备页初始化 |
| `new AuthManager('loginForm')` | [www/js/modules/auth.js](../www/js/modules/auth.js) | 登录表单控制 |

### 4.2 ApiClient 关键函数
- `init()`：读取 [www/config.json](../www/config.json) 并构建 `baseUrl` 与 `timeout`。
- `request()` / `get()` / `post()`：统一请求封装（JSON、Token、超时控制）。
- 业务接口：`getNodes()`、`getNodeBasicInfo()`、`setNodeBasicInfo()`、`rebootNode()`、`factoryResetNode()`、`uploadFirmware()`、`upgradeFirmware()` 等。

### 4.3 Dashboard 关键函数
- `initDashboardSection()`：初始化 state、绑定卡片与快捷操作。
- `fetchDeviceBasicInfo()` / `fetchTopology()`：请求设备信息与拓扑。
- `hydrateDeviceDetail()` / `hydrateTopologyDetail()`：更新 UI 与 state。
- `patchMetrics()`：外部更新仪表盘状态。

### 4.4 Device 关键函数
- `initDeviceSection()`：设备页初始化入口。
- `loadListWithFastFallback()`：列表加载（含超时/失败兜底）。
- `handleSave()`：保存基础配置并刷新列表。
- `handleRowAction()`：重启/恢复出厂动作。
- `ensureBandwidthValid()` / `enforceTfcOptions()`：带宽校验与联动。

### 4.5 Layout / Notify / Auth
- `LayoutController.toggleSidebar()` / `toggleDrawer()` / `toggleTheme()`：布局控制。
- `notify.toast()` / `notify.inline()`：统一通知。
- `AuthManager.handleSubmit()`：登录校验与跳转。

---

## 5. 关键数据结构与状态变量（重点）
### 5.1 ApiClient
- `baseUrl`：由 `config.json` 组装的服务地址。
- `apiPrefix`：固定 `/api/v1`。
- `token`：可注入 Bearer Token。
- `timeout`：请求超时（默认 10s）。

### 5.2 Dashboard 状态
- `state`：
  - `deviceInfo` / `deviceTotal` / `topology` / `traffic` / `resource`：指标卡片数据结构（`title/value/desc/detail`）。
  - `topology.nodes`：拓扑节点数组（含 `id/name/type/ip/channel/bw/tfc_bw/version/mac`）。
  - `node`：节点开关状态（`type/autoAvoid/autoJoin/autoRefresh`）。
- `activeKey`：当前选中的指标卡。
- `metricKeys`：指标卡 key 列表。

### 5.3 Device 状态
- `state.list`：设备列表（规范化后数组）。
- `state.selectedId`：当前选中设备 ID。
- `state.activeAction`：高亮中的操作按钮状态。
- `state.cache`：DOM 缓存（表单、按钮、表格等）。

### 5.4 Layout 状态
- `isDrawer`：是否移动端抽屉模式。
- `isCollapsed`：侧栏折叠状态。
- `isDark`：暗色主题状态。

---

## 6. API/接口（表格化）
> 基础前缀：`http(s)://{serverip}:{port}/api/v1`，来源于 [www/config.json](../www/config.json)。

| 功能 | URL | 方法 | 入参要点 | 出参要点 |
|---|---|---|---|---|
| 登录 | `/user/login` | POST | `{ username, password }` | 期望 `token` 等认证信息（前端目前未持久化） |
| 节点列表 | `/nodes` | GET | 无 | `data.nodes` 或 `nodes` 数组 |
| 节点基础信息 | `/nodes/{id}/basicinfo` | GET | 路径参数 `id` | `data` 包含 `id/name/type/ip/channel/bw/tfc_bw/version/mac` 等 |
| 设置基础信息 | `/nodes/{id}/basicinfo` | POST | `{ name,type,ip,channel,bw,tfc_bw }` | 成功状态（结构未强约束） |
| 节点高级信息 | `/nodes/{id}/advinfo` | GET | 路径参数 `id` | `data` 高级字段（待后端对齐） |
| 设置高级信息 | `/nodes/{id}/advinfo` | POST | 高级配置字段（待对齐） | 成功状态 |
| 连接信息 | `/nodes/{id}/conninfo` | GET | 路径参数 `id` | 连接状态/链路信息 |
| 流量统计 | `/nodes/{id}/stats/traffic` | GET | 路径参数 `id` | 流量统计信息 |
| 时间同步 | `/nodes/{id}/timesync` | POST | 时间参数（按后端定义） | 成功状态 |
| 连接设备 | `/nodes/{id}/connect` | POST | 连接参数（按后端定义） | 成功状态 |
| 断开设备 | `/nodes/{id}/disconnect` | POST | 断开参数（按后端定义） | 成功状态 |
| 重启 | `/nodes/{id}/reboot` | POST | 可空 `{}` | 成功状态 |
| 恢复出厂 | `/nodes/{id}/factory` | POST | 可空 `{}` | 成功状态 |
| 固件上传 | `/nodes/{id}/firmware/upload` | POST | `FormData` | 成功状态 |
| 固件升级 | `/nodes/{id}/firmware/upgrade` | POST | `{ ... }` | 成功状态 |

---

## 7. 运行方式与环境说明
- 纯前端静态项目（原生 HTML/CSS/JS），无构建步骤。
- 本地打开：建议用静态服务器（例如 VS Code Live Server），访问 `index.html`。
- `file://` 预览时：`api-client` 会跳过 `config.json`，并允许 UI 走示例数据兜底。
- 配置后端地址：编辑 [www/config.json](../www/config.json)。

---

## 8. 注意事项/约定/已知限制
- 登录逻辑目前为模拟校验（`admin/123456`），真实认证需对接 `/user/login` 并存储 token。
- 多数模块（OTA/用户/日志/帮助/设置）为占位片段，仅框架存在。
- API 响应结构以 `resp.data` 或 `resp.nodes` 为兜底判断，后端需保持字段一致。
- 设备页在超时/失败时自动回退示例数据，避免页面空白。

---

## 9. 变更记录（模板）
| 版本 | 日期 | 变更摘要 | 作者 |
|---|---|---|---|
|  |  |  |  |

