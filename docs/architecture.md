# 项目概览（提供给 Agent / 团队）

> 添加模块、接口或公共工具时务必同步更新本文件，确保后续改动有据可循。

## 结构概览
- 入口：`www/app.html`（单页外壳），加载 `js/modules` 与 `js/pages/*`。
- 片段：`www/fragments/*.html` 由 `js/pages/app.js` 注入（哈希导航，懒加载 + 缓存）。
- 样式：`www/css`（base/utilities/components/pages 分层）。
- 配置：`www/config.json`（server IP/port），由 `js/modules/api-client.js` 读取。
- 资源：`www/assets/*` 静态文件。

## 运行流程
```
app.html
  └─ js/pages/app.js
       ├─ init LayoutController (js/modules/layout.js)
       ├─ await apiClient.init() (js/modules/api-client.js)
       ├─ lazy-load fragments per hash (dashboard/device/ota/...)
       └─ per-section init fn (e.g., devicePage.initDeviceSection)
```

## 关键模块
- `js/modules/api-client.js`：从 config.json 生成 baseUrl，统一 `/api/v1` 前缀，Token 透传，GET/POST 封装与业务接口。
- `js/modules/layout.js`：侧边栏折叠/抽屉、主题切换、用户下拉。
- `js/modules/notify.js`：统一的 Toast 与行内提示工具。
- `js/pages/device.js`：设备管理（列表、编辑、动作、带宽校验、mock 兜底），已分层为 service/state/ui。
- `js/pages/dashboard.js`：仪表盘逻辑，快捷操作已接入重启/出厂并统一使用 notify 提示。

## 数据 / API 路径
- 基础：`${config.serverip}:${config.port}/api/v1`。
- 设备相关：
  - `GET /nodes` → 列表；`GET /nodes/{id}/basicinfo`；`POST /nodes/{id}/basicinfo`。
  - `POST /nodes/{id}/reboot` | `POST /nodes/{id}/factory` 动作（已在设备页/仪表盘对接）。
  - 高级信息接口待对齐 main.js 的 ADV 方案后再补充。

## UI 约定
- 导航：哈希（`#dashboard`, `#device`, ...），片段首次加载后缓存。
- 通知：统一使用 `notify`（右上角 Toast + 行内提示容器）。
- 加载/错误：慢接口优先展示占位或 mock，避免空白；表格用占位行替代旋转器。

## 更新检查清单
- 新增/修改 API：记录路径与调用页。
- 新的公共工具：补充到“关键模块”并写明用途。
- 新片段/section：更新“结构概览”与“运行流程”中的哈希键与 init。
- 样式规范变更：在“UI 约定”注明。

## 依赖速览
- 原生 JS，无构建步骤。
- 依赖 `fetch`；`file://` 预览或接口失败时走 mock 兜底。
