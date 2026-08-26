# Headscale Web Design

Unofficial community UI for Headscale. Not affiliated with the Headscale project.

- 产品名：Headscale Web
- 仓库 / 目录名：`headscale-web`
- 文档状态：待评审
- 目标用途：作为新会话中的实现依据
- 当前目标版本：Headscale 0.29.x（产品名不绑定版本；0.30 作为后续兼容工作，不改名）
- 前端技术栈：Vue 3 + Vite + TypeScript + Naive UI
- 架构约束：纯静态 SPA，不包含自建后端、BFF、数据库或服务端 Session
- 定位声明：Unofficial community UI for Headscale. Not affiliated with the Headscale project.

## Contents

1. [背景](#1-背景)
2. [已确认的产品决策](#2-已确认的产品决策)
3. [目标与非目标](#3-目标与非目标)
4. [总体架构](#4-总体架构)
5. [技术选型](#5-技术选型)
6. [项目目录](#6-项目目录)
7. [OpenAPI 契约管理](#7-openapi-契约管理)
8. [HTTP 客户端设计](#8-http-客户端设计)
9. [错误模型](#9-错误模型)
10. [凭据和连接状态](#10-凭据和连接状态)
11. [领域模型](#11-领域模型)
12. [Repository 接口](#12-repository-接口)
13. [Headscale 0.29 API 映射](#13-headscale-029-api-映射)
14. [页面和交互设计](#14-页面和交互设计)
15. [Query 和缓存策略](#15-query-和缓存策略)
16. [表单、确认和反馈](#16-表单确认和反馈)
17. [国际化](#17-国际化)
18. [安全设计](#18-安全设计)
19. [路由和构建路径](#19-路由和构建路径)
20. [部署方案](#20-部署方案)
21. [可访问性和响应式](#21-可访问性和响应式)
22. [测试策略](#22-测试策略)
23. [质量门禁](#23-质量门禁)
24. [实施阶段划分](#24-实施阶段划分)
25. [第一版验收标准](#25-第一版验收标准)
26. [已知限制与后续演进](#26-已知限制与后续演进)
27. [实现会话启动说明](#27-实现会话启动说明)

## 1. 背景

Headscale Web 是一个面向 Headscale 的纯前端管理页面。第一版针对 Headscale 0.29.x。页面通过用户提供的 Headscale 地址和 API Key，直接访问 Headscale `/api/v1` REST API，为用户、节点、路由和 PreAuthKey 提供统一的可视化管理能力。

## 2. 已确认的产品决策

1. 产品名为 Headscale Web；仓库、目录、npm 包和镜像名均为 `headscale-web`。浏览器标题使用 `Headscale Web`。存储键前缀为 `hs-web:v1:`。页面文案与文档使用英文产品名，不另起中文名。
2. 使用 Vue 3、Vite、TypeScript。
3. UI 组件库使用 Naive UI。
4. 仅支持 Headscale 0.29.x，不兼容 0.26～0.28，也不提前兼容尚未稳定的 0.30。
5. 第一版包含：Dashboard、用户管理、节点管理、路由管理、PreAuthKey 管理、Headscale 连接设置、Headscale 版本及健康状态。
6. 第一版不包含 ACL 管理。
7. 第一版不包含 API Key 管理、部署命令生成器、多 Headscale 实例、SSO、本地账号或 RBAC。
8. 单实例模式：任一时刻只连接一个 Headscale 实例，但允许修改 URL 和 API Key。
9. API Key 默认保存在 `sessionStorage`；用户可显式选择长期保存到 `localStorage`。
10. 支持简体中文和英文切换。
11. 数据在页面进入时加载，支持手动刷新及可配置轮询。
12. 同时支持同域子路径部署与独立域名部署。
13. API 架构采用“生成客户端 + Repository/领域服务 + Mapper”的分层方案。

## 3. 目标与非目标

### 3.1 目标

- 为 Headscale 0.29.x 提供稳定、清晰、可维护的日常管理界面。
- 所有 HTTP 调用集中管理，业务组件不得直接拼接 API URL 或 Bearer Header。
- 使用固定版本的 Headscale Swagger 契约生成协议层类型。
- 将 Headscale 原始响应转换为稳定的前端领域模型。
- 对危险操作提供确认、反馈和错误恢复。
- 在同域和跨域两种部署方式下均可运行。
- 在浏览器端尽可能降低 API Key 意外泄漏风险，同时明确纯前端架构的安全边界。

### 3.2 非目标

- 不提供服务端登录、Session、用户权限或审计日志后端。
- 不代理 Headscale 请求。
- 不支持多个 Headscale 版本的运行时适配。
- 不直接读取 Headscale 数据库或配置文件。
- 不实现 Headscale ACL/HuJSON 编辑。
- 不实现节点用户迁移；Headscale 0.29 不提供对应的管理 API。
- 不实现实时推送；在线状态通过轮询更新。
- 不声称能够在纯前端中隐藏 API Key。浏览器必须持有 API Key 才能直接调用 Headscale。

## 4. 总体架构

分层：Vue Pages / Components → Application Layer（TanStack Vue Query）→ Repository Layer → Mapper + Contract Boundary → Generated OpenAPI Client + HTTP middleware → Headscale 0.29.x `/version` 与 `/api/v1/*`。

### 4.1 状态职责

- **TanStack Vue Query**：管理 Headscale 服务端数据、缓存、请求状态、失效刷新和轮询。
- **Pinia**：只管理客户端状态，例如连接设置、凭据状态、语言、主题、刷新间隔。
- **组件本地状态**：表单、弹窗、筛选条件和仅显示一次的 PreAuthKey 明文。

禁止将用户、节点等服务端数据复制到 Pinia。

## 5. 技术选型

### 5.1 核心依赖

Vue 3、Vite、TypeScript 严格模式、Vue Router、Pinia、Naive UI、TanStack Vue Query、Vue I18n、`openapi-typescript` + `openapi-fetch`、`swagger2openapi`、Zod（仅边界校验）、VueUse 按需、Lucide Vue Next、date-fns。

### 5.2 开发和测试依赖

pnpm、Node.js 22 LTS、ESLint、Prettier、Vitest、Vue Testing Library、MSW、Playwright、`vue-tsc`。不引入 Axios。

## 6. 项目目录

根目录为 `headscale-web/`，包含 `docs/`、`public/`、`scripts/`、`specs/`、`src/api`、`src/domain`、`src/features`、`src/stores`、`src/composables`、`src/components`、`src/router`、`src/i18n`、`tests/` 以及 Docker/Caddy/Nginx 部署文件。业务组件不得绕过 Repository 直接访问 HTTP 层。

## 7. OpenAPI 契约管理

第一版协议基线为 Headscale `v0.29.3` 的 `gen/openapiv2/headscale/v1/headscale.swagger.json`，复制到 `specs/`，转 OpenAPI 3 后生成 `src/api/generated/headscale.ts`。规范与生成文件均提交 Git。生成类型只能出现在 generated/client/repositories/mappers。

## 8. HTTP 客户端设计

从 Pinia 读取 `baseUrl`、`credentialPersistence`、轮询设置。API Key 由 CredentialStore 单独管理。URL 必须是 http/https，去掉末尾 `/`，禁止携带凭据。受保护请求发送 `Authorization: Bearer` 与 `Accept: application/json`。默认超时 15 秒。GET 网络错误最多重试 1 次；写操作不自动重试。API Key 不得进入 URL、错误对象、console 或日志。

## 9. 错误模型

统一 `AppApiError`：network/timeout/unauthorized/forbidden/not-found/conflict/validation/server/cors/unsupported-version/unknown。先按 HTTP 状态分类，再解析 gRPC Gateway `{ code, message, details }`。401 清空 Query 缓存并跳转连接页，不自动删除长期 Key。

## 10. 凭据和连接状态

存储键：

```text
hs-web:v1:settings
hs-web:v1:api-key:session
hs-web:v1:api-key:local
hs-web:v1:locale
hs-web:v1:theme
```

API Key 默认 `sessionStorage`；长期保存须风险确认后写 `localStorage`。运行期间只从内存 CredentialStore 读取。“断开连接”清除内存与两种 Storage。不做前端自制加密。

连接验证顺序：`GET /version` → 检查 `0.29.x` → `GET /api/v1/health` → `GET /api/v1/user`。非 0.29.x 阻止进入。无凭据跳转 `/connect`。文案使用“连接”“断开连接”，不用“登录”“退出登录”。

## 11. 领域模型

### 11.1 SystemStatus

```ts
interface SystemStatus {
  version: string
  commit?: string
  databaseConnectivity: boolean
  apiReachable: boolean
  checkedAt: Date
}
```

`/version` 的额外字段按可选字段处理，版本字符串必须运行时校验。

### 11.2 User

```ts
interface User {
  id: string
  name: string
  displayName: string
  email: string
  provider: string
  providerId: string
  profilePictureUrl: string
  createdAt: Date
}
```

所有 uint64 ID 保持字符串，不转换为 JavaScript number。

### 11.3 Node

```ts
interface Node {
  id: string
  name: string
  givenName: string
  machineKey: string
  nodeKey: string
  discoKey: string
  ipAddresses: string[]
  user: User
  lastSeen: Date | null
  expiry: Date | null
  createdAt: Date
  registerMethod: 'auth-key' | 'cli' | 'oidc' | 'unspecified'
  online: boolean
  tags: string[]
  approvedRoutes: string[]
  availableRoutes: string[]
  subnetRoutes: string[]
  preAuthKey: PreAuthKeySummary | null
}
```

节点标签统一使用 Headscale 0.29 的 `tags` 字段。

### 11.4 RouteView

Headscale 0.29 没有独立路由列表 API，路由页面从 Node 数据派生：

```ts
interface RouteView {
  id: string // `${nodeId}:${prefix}`
  nodeId: string
  nodeName: string
  userName: string
  prefix: string
  advertised: boolean
  approved: boolean
  serving: boolean
  exitRoute: boolean
}
```

字段计算：

- `advertised`：prefix 存在于 `availableRoutes`
- `approved`：prefix 存在于 `approvedRoutes`
- `serving`：prefix 存在于 `subnetRoutes`
- `exitRoute`：prefix 为 `0.0.0.0/0` 或 `::/0`

修改路由时必须发送该节点**完整的新 approvedRoutes 集合**，而不是只发送增量。

### 11.5 PreAuthKey

```ts
interface PreAuthKey {
  id: string
  user: User | null
  keyPreview: string | null
  reusable: boolean
  ephemeral: boolean
  used: boolean
  expiration: Date | null
  createdAt: Date
  aclTags: string[]
  state: 'active' | 'used' | 'expired'
}
```

创建接口返回的完整 Key 只保存在创建成功弹窗的组件内存中。关闭弹窗后清除，不写入 Pinia、Query Cache、Storage 或日志。

## 12. Repository 接口

```ts
interface SystemRepository {
  getVersion(): Promise<VersionInfo>
  getHealth(): Promise<HealthInfo>
  validateConnection(): Promise<SystemStatus>
}

interface UsersRepository {
  list(filters?: { id?: string; name?: string; email?: string }): Promise<User[]>
  create(input: CreateUserInput): Promise<User>
  rename(userId: string, newName: string): Promise<User>
  delete(userId: string): Promise<void>
}

interface NodesRepository {
  list(filters?: { userName?: string }): Promise<Node[]>
  get(nodeId: string): Promise<Node>
  rename(nodeId: string, newName: string): Promise<Node>
  expireNow(nodeId: string): Promise<Node> // 发送 JSON 空对象 `{}`
  setExpiry(nodeId: string, expiry: Date): Promise<Node>
  disableExpiry(nodeId: string): Promise<Node>
  setTags(nodeId: string, tags: string[]): Promise<Node>
  setApprovedRoutes(nodeId: string, routes: string[]): Promise<Node>
  delete(nodeId: string): Promise<void>
}

interface PreAuthKeysRepository {
  list(): Promise<PreAuthKey[]>
  create(input: CreatePreAuthKeyInput): Promise<CreatedPreAuthKey>
  expire(id: string): Promise<void>
  delete(id: string): Promise<void>
}
```

第一版不暴露 `registerNode`、`authApprove`、`authReject`、`backfillNodeIPs` 和 `debugCreateNode`，除非后续单独立项。

## 13. Headscale 0.29 API 映射

| 页面能力 | 方法与路径 | 说明 |
|---|---|---|
| 版本 | `GET /version` | 无 API Key，用于严格版本检查 |
| 健康状态 | `GET /api/v1/health` | 返回 `databaseConnectivity` |
| 用户列表 | `GET /api/v1/user` | 可选 `id/name/email` 查询参数 |
| 创建用户 | `POST /api/v1/user` | 支持 name、displayName、email、pictureUrl |
| 重命名用户 | `POST /api/v1/user/{oldId}/rename/{newName}` | path 参数必须编码 |
| 删除用户 | `DELETE /api/v1/user/{id}` | 危险操作 |
| 节点列表 | `GET /api/v1/node` | 可选 `user=<name>` |
| 节点详情 | `GET /api/v1/node/{nodeId}` | 用于详情刷新 |
| 重命名节点 | `POST /api/v1/node/{nodeId}/rename/{newName}` | path 参数必须编码 |
| 设置节点过期 | `POST /api/v1/node/{nodeId}/expire` | JSON `{}`=立即过期；`{ expiry }`=指定时间；`{ disableExpiry: true }`=永不过期 |
| 设置标签 | `POST /api/v1/node/{nodeId}/tags` | body `{ tags: string[] }` |
| 设置审批路由 | `POST /api/v1/node/{nodeId}/approve_routes` | body `{ routes: string[] }`，发送完整集合 |
| 删除节点 | `DELETE /api/v1/node/{nodeId}` | 危险操作 |
| PreAuthKey 列表 | `GET /api/v1/preauthkey` | 只请求一次，不按用户循环请求 |
| 创建 PreAuthKey | `POST /api/v1/preauthkey` | body 使用 user ID、reusable、ephemeral、expiration、aclTags |
| 过期 PreAuthKey | `POST /api/v1/preauthkey/expire` | body 必须是 `{ id }` |
| 删除 PreAuthKey | `DELETE /api/v1/preauthkey?id={id}` | id 在 query string |

所有 path 和 query 参数通过生成客户端或 `URLSearchParams` 编码，禁止字符串裸拼接。

## 14. 页面和交互设计

### 14.1 整体布局

- 桌面端：左侧导航 + 顶部状态栏 + 主内容区。
- 移动端：折叠抽屉导航。
- 顶部显示：Headscale 地址、版本、健康状态、手动刷新、语言、主题、断开连接。
- 支持浅色、深色和跟随系统主题。
- 所有表格支持合理的移动端降级；复杂详情使用 Drawer。

导航：

```text
Dashboard
Users
Nodes
Routes
PreAuth Keys
Settings
```

### 14.2 Connection 页面

- Headscale URL 输入框。
- API Key 密码输入框及显示/隐藏按钮。
- 保存方式单选：当前会话、长期保存。
- 长期保存风险提示。
- 测试过程分步骤显示：网络、版本、数据库、授权。
- 错误提供可操作建议，不只显示原始异常。

### 14.3 Dashboard

卡片：Headscale 版本、数据库状态、用户数量、节点总数、在线节点数、离线节点数、Advertised Route 数量、Approved Route 数量、有效 PreAuthKey 数量、即将过期 PreAuthKey 数量。

列表：最近离线或长期未上线节点、即将过期节点、即将过期 PreAuthKey、有 Advertised 但未 Approved 路由的节点。

Dashboard 数据来自已有 users/nodes/preauthKeys Query，不新增重复 API 请求。

### 14.4 Users 页面

能力：表格、客户端搜索和 Provider 筛选、创建/重命名/删除用户、详情 Drawer。删除确认必须展示关联节点数量。前端不模拟级联删除。

创建用户表单：name 必填；displayName/email/pictureUrl 可选，填写时校验格式。

### 14.5 Nodes 页面

能力：表格显示在线状态、名称、用户、IP、标签、路由、注册方式、最后在线、过期时间；搜索/筛选/排序；详情 Drawer；重命名、设置标签、设置过期策略、管理路由、删除。

密钥字段默认只显示前后少量字符，不提供复制完整 machineKey/nodeKey/discoKey 的快捷按钮。

设置标签：自动标准化为 `tag:<value>`；不允许空白、重复项；提交前显示最终列表；出错时保留输入。

过期策略：立即过期、指定时间过期、禁用过期。删除和立即过期为危险操作，必须二次确认。

### 14.6 Routes 页面

路由数据由 Node 列表派生，不调用不存在的独立 routes API。

能力：按节点分组或按 route 表格显示；Advertised/Approved/Serving 三态；筛选待审批/已审批/Exit Node/普通子网；单条审批或取消；节点级审批全部 Advertised 或取消全部 Approved。

Exit Node：`0.0.0.0/0` 与 `::/0` 作为一组展示；审批其中一个时默认同时加入 IPv4 和 IPv6 默认路由。修改路由时锁定当前节点，避免并发覆盖。

### 14.7 PreAuth Keys 页面

能力：表格、筛选、创建/过期/删除。

创建表单：User 必填；Reusable/Ephemeral 默认 false；Expiration 默认 90 天；ACL Tags 可选并统一 `tag:` 前缀。

创建成功：单独弹窗显示完整 Key；提示可能只在此时完整显示；提供复制；勾选“我已保存”后才允许关闭，仍保留强制关闭入口。关闭后销毁明文。

Expire 使 Key 失效但保留记录；Delete 删除记录。均以 id 操作。

### 14.8 Settings 页面

配置项：Headscale URL、更新 API Key、凭据存储方式、自动轮询开关、轮询间隔、语言、主题、日期时间显示方式、测试连接、清除凭据并断开。

轮询间隔默认 15 秒，最小 5 秒，预设 5/10/15/30/60 秒。关闭轮询后仍保留进入加载和手动刷新。

## 15. Query 和缓存策略

Query Keys：

```ts
['system', 'version']
['system', 'health']
['users', filters]
['nodes', filters]
['node', nodeId]
['preAuthKeys']
```

默认：`staleTime` 5 秒；`gcTime` 5 分钟；`refetchOnWindowFocus` 开启但 5 秒内不重复；`refetchInterval` 由设置控制；隐藏标签页时暂停轮询。

Mutation 失效：用户写操作失效 users/nodes/preAuthKeys；节点与路由写操作失效 nodes 及对应 detail；PreAuthKey 写操作失效 preAuthKeys。

若 Mutation 返回完整资源，优先用返回值更新缓存，再后台校验刷新。轮询由 Vue Query 统一管理。

## 16. 表单、确认和反馈

- 所有写操作按钮在请求期间禁用。
- 同一资源的重复提交被阻止。
- 成功使用简短 Message。
- 可恢复错误使用 Notification，并保留表单。
- 危险操作使用 Modal 确认。
- 删除用户、删除节点要求输入资源名称确认。
- 删除 PreAuthKey 要求确认 ID 和归属用户，不要求输入完整 Key。
- 操作完成后焦点返回触发按钮或合理位置。

## 17. 国际化

使用 Vue I18n，支持 `zh-CN` 与 `en-US`。

规则：组件中不得出现直接面向用户的硬编码中文或英文；API 原始错误可作 detail，主消息必须本地化；日期/相对时间/数字使用当前 locale；默认语言优先读用户设置，其次浏览器语言，最后回退英文；Headscale 固有字段通过映射表翻译，不修改提交值。

## 18. 安全设计

### 18.1 安全边界

纯前端页面无法对浏览器隐藏 Headscale API Key。外部 SSO、Basic Auth 或 Cloudflare Access 只能限制谁能打开页面，不能改变浏览器必须持有 API Key 的事实。

### 18.2 必须实施

- 生产部署必须使用 HTTPS。
- 禁止 API Key 出现在 URL、日志、错误上报和剪贴板以外的导出功能中。
- 默认使用 sessionStorage。
- localStorage 持久化必须显式确认。
- 不加载不必要的第三方脚本、广告、在线字体和远程统计 SDK。
- 不使用 `v-html` 渲染 Headscale 数据或 API 错误。
- 对资源名称、错误文本和标签进行普通文本渲染。
- 设置严格 CSP，至少限制 `default-src 'self'`，并通过 `connect-src` 允许 Headscale 地址。
- 使用 `Referrer-Policy: no-referrer`。
- 使用 `X-Content-Type-Options: nosniff`。
- 建议使用 `frame-ancestors 'none'` 防止点击劫持。
- 所有依赖锁定版本并启用 Dependabot/Renovate。

### 18.3 CSP 与可配置 API URL

由于 Headscale URL 是运行时配置，严格静态 CSP 无法预先知道任意独立域名。部署文档提供两种模式：

1. 同域模式：`connect-src 'self'`。
2. 独立域名模式：管理员在 Nginx/Caddy CSP 中显式加入具体 Headscale Origin。

不使用 `connect-src *` 作为推荐配置。

### 18.4 外部访问保护

文档可以说明可选的 Authelia、Authentik、OAuth2 Proxy 或 Cloudflare Access，但项目本身不实现登录，也不把外部身份当作 Headscale 授权依据。

## 19. 路由和构建路径

使用：

```ts
createWebHistory(import.meta.env.BASE_URL)
```

Vite `base` 从构建变量读取：

```text
VITE_BASE_PATH=/
VITE_BASE_PATH=/admin/
```

规范化要求：必须以 `/` 开头和结尾。

生产服务器必须将未知前端路由回退到 `index.html`，但 `/api/*`、`/version` 等 Headscale 路径必须优先转发，不能被 SPA fallback 吞掉。

## 20. 部署方案

### 20.1 同域 `/admin/`

推荐拓扑：

```text
https://headscale.example.com/admin/* → 静态页面
https://headscale.example.com/api/*   → Headscale
https://headscale.example.com/version → Headscale
```

构建：

```bash
VITE_BASE_PATH=/admin/ pnpm build
```

同域部署不需要 CORS，页面中的 Headscale URL 默认使用 `window.location.origin`。

Nginx 关键逻辑示意：

```nginx
location /api/ {
    proxy_pass http://headscale:8080;
}

location = /version {
    proxy_pass http://headscale:8080;
}

location /admin/ {
    alias /usr/share/nginx/html/admin/;
    try_files $uri $uri/ /admin/index.html;
}
```

实际配置必须补齐 WebSocket/长连接等 Headscale 自身需要的代理设置；管理页面部署文档不能用一个简化片段覆盖用户现有 Headscale 官方反向代理配置。

### 20.2 独立域名

```text
https://admin.example.com → 静态页面
https://headscale.example.com → Headscale
```

Headscale 前置代理必须为管理页 Origin 响应 CORS：

```http
Access-Control-Allow-Origin: https://admin.example.com
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Vary: Origin
```

必须正确响应 OPTIONS 预检。推荐只允许明确的管理页面 Origin，不使用 `*`。

CORS 规则必须同时覆盖：

- `/version`
- `/api/v1/*`

页面不使用 Cookie 调用 Headscale，因此 fetch 的 `credentials` 保持默认 `same-origin`，跨域请求不发送浏览器 Cookie。

### 20.3 静态 Docker 镜像

多阶段构建：

1. Node 22 + pnpm 构建。
2. Caddy 或 Nginx 提供静态文件。
3. 最终镜像非 root 运行。
4. 提供 `/healthz` 静态容器健康检查。

`VITE_BASE_PATH` 是构建时参数，不是容器启动后的动态环境变量。文档必须明确这一点。

## 21. 可访问性和响应式

- 目标 WCAG 2.1 AA 基础要求。
- 所有输入有 label。
- 图标按钮有 `aria-label`。
- 颜色不作为状态的唯一表达方式。
- 支持键盘完成核心 CRUD 操作。
- Modal/Drawer 正确管理焦点。
- 在线/离线状态同时使用图标、文本和颜色。
- 表格在小屏幕下使用横向滚动或卡片视图，不隐藏关键危险操作信息。
- 尊重 `prefers-reduced-motion`。

## 22. 测试策略

### 22.1 单元测试

重点覆盖：

- URL 标准化和验证。
- API Key 存储模式迁移及清除。
- 0.29 DTO 到领域模型 Mapper。
- 日期、过期状态和在线状态计算。
- RouteView 派生逻辑。
- Exit Route IPv4/IPv6 成组逻辑。
- 错误响应解析。
- 版本范围检查，仅接受 0.29.x。
- 标签标准化。

### 22.2 Repository 集成测试

使用 MSW 按 Headscale 0.29 Swagger 构造响应，验证：

- 请求方法、路径、查询参数和 JSON body。
- Authorization 和 Content-Type Header。
- `GET /api/v1/preauthkey` 只调用一次。
- PreAuthKey expire 使用 `{ id }`。
- Delete PreAuthKey 使用 query `id`。
- 路由更新发送完整 routes 集合。
- Node 使用 `tags`，不读取旧字段。
- 401/404/409/gRPC 错误映射。

### 22.3 组件测试

- Loading、empty、error、success 状态。
- 危险确认流程。
- 创建 PreAuthKey 的一次性密钥弹窗。
- 中英文切换。
- 筛选和分页。
- 响应式导航。

### 22.4 E2E 测试

使用 Playwright + MSW/mock server，覆盖：

1. 首次连接成功。
2. 错误 API Key。
3. 非 0.29 版本被阻止。
4. sessionStorage 和 localStorage 两种启动恢复。
5. 创建、重命名和删除用户。
6. 节点重命名、标签、过期和删除。
7. 路由审批和取消审批。
8. 创建、复制、过期和删除 PreAuthKey。
9. 401 后返回连接页。
10. `/admin/` 子路径刷新业务路由仍能正常加载。

### 22.5 真实 Headscale 合约测试

CI 或发布前提供可选 Docker Compose 测试，启动固定的 `headscale/headscale:0.29.3`，创建临时 API Key，并对 Repository 的只读及隔离写操作执行 smoke test。

不能只依赖 Mock；发布前至少验证：

- version
- health
- users CRUD
- nodes list
- PreAuthKey create/list/expire/delete

节点路由和标签测试若需要真实 tailscaled，可放到扩展集成测试，不阻塞普通 PR。

## 23. 质量门禁

每个 PR 至少执行：

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm api:check
```

主分支或发布执行：

```bash
pnpm test:e2e
```

验收标准：

- TypeScript 无 `any` 逃逸；生成代码除外。
- 无组件直接调用 fetch。
- 无 API Key 日志。
- 所有写操作有成功与失败反馈。
- 所有危险操作有确认。
- 中英文文案 key 完整。
- 根路径与 `/admin/` 构建均通过。

## 24. 实施阶段划分

### 阶段 1：工程基础

- 初始化 Vue/Vite/TypeScript。
- 配置 Naive UI、Router、Pinia、Vue Query、i18n。
- 导入并生成 Headscale 0.29.3 API 类型。
- 实现 HTTP 客户端、错误模型和 CredentialStore。
- 完成 Connection 页面和路由守卫。

### 阶段 2：只读能力

- System Repository。
- Users、Nodes、PreAuthKeys Repository 和 Mapper。
- Dashboard。
- Users、Nodes、Routes、PreAuthKeys 列表及详情。
- 自动轮询和手动刷新。

### 阶段 3：写操作

- 用户创建、重命名、删除。
- 节点重命名、标签、过期、删除。
- 路由审批和取消审批。
- PreAuthKey 创建、过期、删除。
- Query 缓存失效和并发保护。

### 阶段 4：产品化

- Settings。
- 中英文完整翻译。
- 深浅色主题及响应式。
- 可访问性检查。
- Docker、Nginx、Caddy 与 CORS 文档。
- E2E 和真实 0.29.3 合约测试。

每个阶段完成后必须具备可运行、可测试的增量，不应先完成全部 UI 再接 API。

## 25. 第一版验收标准

1. 用户可连接 Headscale 0.29.x，并明确看到版本、数据库和授权检查结果。
2. 非 0.29.x 实例被明确拒绝。
3. API Key 默认存入 sessionStorage，并可经风险确认切换 localStorage。
4. 可查看并管理用户。
5. 可查看节点、在线状态、标签、过期时间和路由。
6. 可重命名、过期、删除节点并修改标签。
7. 可查看、审批和取消审批节点路由。
8. 可创建、过期和删除 PreAuthKey，创建后的完整 Key 得到一次性安全展示。
9. 所有服务端数据通过 Repository 获取，组件不直接调用 API。
10. 所有 ID 均按字符串处理。
11. 页面支持中文和英文。
12. 支持手动刷新和可配置轮询。
13. 根路径和 `/admin/` 子路径均可构建部署。
14. 独立域名部署文档包含 `/version` 和 `/api/v1/*` 的 CORS 配置。
15. 单元、Repository 集成、组件和核心 E2E 测试通过。

## 26. 已知限制与后续演进

- API Key 存在浏览器中，纯前端无法消除此风险。
- 页面只支持一个 Headscale 实例。
- Headscale 0.30 将 API v1 底层替换为新的 OpenAPI/Huma 实现并改变错误格式；升级时应作为独立项目处理，不能只修改版本判断。
- Headscale API v2 是部分 Tailscale 兼容 API，不是完整 Headscale 管理 API；第一版不使用 v2。
- ACL 管理如后续增加，建议先实现原始 HuJSON 编辑、服务端校验和 ETag/冲突保护，再评估图形化 Builder。
- 若未来需要 SSO、RBAC、隐藏 API Key、审计日志或多实例，应新增可选 BFF 产品形态，而不是在纯前端中模拟这些能力。

## 27. 实现会话启动说明

新的实现会话应首先：

1. 阅读本设计全文。
2. 确认工作目录和是否创建新 Git 仓库。
3. 从实施阶段 1 开始制定逐步实现计划。
4. 固定 Headscale 0.29.3 Swagger 契约，不从 Headscale main 分支生成客户端。
5. 使用测试驱动方式先建立 API 契约测试，再实现 Repository。
6. 不在未重新评审的情况下加入 ACL、API Key 管理、多实例或自建后端。
