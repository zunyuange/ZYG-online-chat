# CF智能多语言在线客服系统

基于 **Cloudflare Workers** 的免费多语言实时在线客服系统，采用 React + Hono 全栈架构。支持多商家独立运营、20 种界面语言、6 级智能翻译引擎链、全平台响应式适配，零成本部署全球加速。

## 📸 界面预览

### 平台首页
全新首页设计，直接域名访问时展示平台功能简介与接入指引，访客必须通过商家专属链接进入客服。

### 用户端

| PC 端 | 移动端 |
|---|---|
| ![用户端-PC](./docs/screenshots/chat-pc-conversation.png) | ![用户端-移动端](./docs/screenshots/chat-h5-conversation.png) |

### 客服端

| PC 端 | 移动端 |
|---|---|
| ![客服端-PC](./docs/screenshots/staff-pc-overview.png) | ![客服端-移动端](./docs/screenshots/staff-h5-overview.png) |

## 🚀 一键部署

[![Deploy to Cloudflare](./docs/CF一键安装图标.svg)](https://deploy.workers.cloudflare.com/?url=https://github.com/zunyuange/ZYG-online-chat)

> 部署后，在 Cloudflare 仪表盘中为 Worker 添加至少 32 字符的 `JWT_SECRET` 密钥。如果未配置，页面顶部会显示黄色提醒并建议一个随机密钥，复制粘贴到 Secrets 即可。

---

## ✨ 核心特性

### 🌐 多语言全链路支持
- **20 种界面语言** — 简体中文 / 繁体中文 / 英语 / 日语 / 韩语 / 西班牙语 / 法语 / 意大利语 / 德语 / 葡萄牙语 / 越南语 / 俄语 / 印尼语 / 泰语 / 阿拉伯语 / 希腊语 / 波兰语 / 丹麦语 / 荷兰语 / 芬兰语
- **浏览器语言自动检测** — 首次访问自动匹配，支持 URL 参数 `?lang=ja` 预设、用户手动切换
- **智能随机回复** — 支持数组类型的翻译值随机选取，增强对话自然度

### 🤖 6 级智能翻译引擎链
自动降级，无需任何 API Key，完全免费：

| 优先级 | 引擎 | 说明 |
|--------|------|------|
| ⭐ 第 0 级 | **Cloudflare Workers AI** | 内部 AI 绑定（`@cf/meta/m2m100-1.2b`），零延迟，100+ 语言 |
| 🥇 第 1 级 | **PearApi 万能翻译** | 自动检测源语言 + 精确翻译方向映射，20 种语言 |
| 🥈 第 2 级 | **SimplyTranslate AI** | 免费 RESTful API，196+ 语言，100 次/分钟 |
| 🥉 第 3 级 | **Google Translate** | 免费稳定，全球覆盖 |
| 🏅 第 4 级 | **MyMemory** | 免费后备方案，每日 1000-10000 词 |
| ⚡ 兜底 | **返回原文** | 所有引擎失败时降级，保证消息不丢失 |

- **智能语言检测** — 基于 Unicode 字符集比例阈值，自动识别中/日/韩/英等语言
- **HTML 保护** — 自动跳过含 HTML 标签的文本
- **按需翻译** — 访客/客服手动选择引擎翻译单条消息，避免配额浪费
- **客服自动翻译** — 客服端可开启自动翻译模式，消息实时翻译

### 🏢 多商家独立运营（多租户）
- **完全数据隔离** — 通过 `business_slug` 实现商家间的会话/消息/排队/统计数据隔离
- **子账号管理** — 客服账号归属到特定商家，权限独立
- **专属链接接入** — 访客只能通过商家专属链接（`?business=xxx`）进入，直接域名访问展示平台首页
- **自定义字段** — 访客端支持自定义字段（邮箱 / 电话 / 产品ID / 自定义参数）

### 💬 实时聊天
- **SSE 实时推送** + 轮询备用，支持文本 / 图片 / 视频 / 文件消息
- **文件上传** — 图片（JPG/PNG/GIF/WebP）、视频（MP4/WebM）、文件（PDF/DOC/ZIP），Cloudflare R2 存储
- **消息已读** — 已读/未读状态追踪
- **消息删除** — 支持撤回删除消息

### 📋 排队系统
- **智能排队** — 按任务优先级自动排队，实时显示排队位置
- **等待时间估算** — 基于当前排队数量估算等待时间
- **优先级管理** — 支持队列优先级排序

### 🔄 5 阶段任务流
```
需求讨论 → 需求确认 → 执行中 → 交付 → 评价
```
客服切换任务状态后，用户端实时同步展示，过程透明可控。

### 👥 客服转接
- **会话转接** — 客服之间可转接会话
- **转接历史** — 完整记录转接记录，支持拒绝原因说明

### 🌟 评价系统
- **访客评分** — 会话结束后 1-5 分评价
- **评分统计** — 评分分布统计与可视化

### 🛡️ 安全防护
- **黑名单** — 访客黑名单管理，支持按 IP / 访客 ID 封禁
- **敏感词过滤** — 违禁词检测与拦截
- **IP 限流** — 登录接口 5 次/10 分钟限制

### 🤖 AI 知识库
- **关键词匹配** — 基于知识库的关键词自动回复
- **多语言知识库** — 支持按语言分类管理
- **FAQ 管理** — 按语言分类的常见问题
- **快捷回复** — 客服常用语管理

### 📱 PWA 支持
- **离线可用** — Service Worker 缓存核心资源
- **添加到主屏幕** — 完整的 PWA 清单配置
- **推送通知** — iOS Bark 推送实时新消息通知

### 🖥️ 后台管理
- **商家管理** — 创建/编辑/删除商家
- **用户管理** — 客服账号 CRUD
- **角色权限** — RBAC 角色权限管理
- **系统设置** — 网站名称、默认语言、认证开关全局配置

### 📐 响应式设计
- **全平台适配** — PC / 平板 / 移动端完美适配
- **触摸优化** — 移动端手势交互优化

---

## 🛠️ 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 前端框架 | React | ^19.1.0 |
| 状态管理 | Zustand | ^5.0.2 |
| 后端框架 | Hono | ^4.6.16 |
| 类型验证 | Zod | ^4.2.1 |
| 图标库 | Lucide React | ^0.575.0 |
| 数据库 | Cloudflare D1 (SQLite) | — |
| 文件存储 | Cloudflare R2 | — |
| AI 翻译 | Cloudflare Workers AI (`@cf/meta/m2m100-1.2b`) | — |
| 实时通信 | Server-Sent Events (SSE) + 轮询备用 | — |
| 认证 | JWT (HMAC-SHA256) | — |
| 推送通知 | Bark | — |
| 构建工具 | Vite | ^6.2.3 |
| 部署 | Cloudflare Workers / Wrangler | ^4.69.0 |
| 测试 | Vitest + Playwright | ^4.0.16 / ^1.50.0 |
| 代码规范 | ESLint + Prettier + Husky | — |

---

## 🚀 快速开始

### 环境要求

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0

### 安装

```bash
git clone https://github.com/zunyuange/ZYG-online-chat.git
cd ZYG-online-chat
npm install
```

### 本地开发

```bash
npm run dev
```

应用将在 http://localhost:3010 启动：

| 页面 | 地址 | 说明 |
|------|------|------|
| 🏠 平台首页 | http://localhost:3010/ | 功能介绍与接入指引 |
| 💬 访客聊天 | http://localhost:3010/chat?business=xxx | 通过商家专属链接进入 |
| 🎧 客服工作台 | http://localhost:3010/staff | 客服工作台 |
| 🔑 客服登录 | http://localhost:3010/stafflogin | 客服登录页 |
| ⚙️ 管理后台 | http://localhost:3010/admin | 系统管理 |
| 🔐 管理员登录 | http://localhost:3010/adminlogin | 管理员登录 |
| 📖 接入文档 | http://localhost:3010/docs | 对接指南 |

### 构建

```bash
npm run build
npm run preview     # 预览生产构建
```

### 测试

```bash
npm test                    # 运行所有测试
npm run test:unit           # 仅单元测试
npm run test:integration    # 仅集成测试
npm run test:e2e            # E2E 测试 (Playwright)
npm run test:ui             # 可视化测试界面
npm run coverage            # 测试覆盖率
```

### 代码质量

```bash
npm run lint                # ESLint 检查
npm run format              # Prettier 格式化
npm run typecheck           # TypeScript 类型检查
npm run validate:all        # 全量验证
```

---

## ☁️ Cloudflare Workers 部署

### 前置要求

1. [Cloudflare 账号](https://dash.cloudflare.com/)
2. 安装 Wrangler CLI：`npm install -g wrangler`
3. 登录：`wrangler login`

### 创建资源

#### 1. 创建 D1 数据库

```bash
wrangler d1 create zyg-online-chat-db
```

将输出的 `database_id` 填入 `wrangler.toml`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "zyg-online-chat-db"
database_id = "你的database_id"
```

#### 2. 创建 R2 存储桶

```bash
wrangler r2 bucket create zyg-online-chat-uploads
```

#### 3. 初始化数据库表

```bash
# 使用完整初始化脚本（推荐新部署）
wrangler d1 execute zyg-online-chat-db --file=src/server/shared/db-init.sql --remote

# 或使用重置脚本（清空所有数据后重新初始化）
wrangler d1 execute zyg-online-chat-db --file=scripts/reset-db.sql --remote
```

> **数据库初始化脚本说明：**
> - `src/server/shared/db-init.sql` — 唯一数据库初始化脚本，包含完整建表 + 初始数据（默认管理员 admin/123456、默认商家），首次部署和重置数据库通用
> - `scripts/d1-migrate-*.sql` — 增量迁移脚本，用于已有数据库的列/表补充
> - **运行时自动初始化**：项目启动时 `db.ts` 会自动检测并创建缺失的表/列/索引，无需手动执行 SQL

初始化后系统包含：
- **管理员账号**：`admin` / `123456`（系统管理后台）
- **默认商家**：`business_slug = default`，商家名称「默认商家」
- **默认设置**：网站名称「CF智能多语言在线客服系统」、语言 zh-CN、启用认证

### 配置密钥

```bash
# JWT 签名密钥（必需，至少 32 字符）
wrangler secret put JWT_SECRET

# Bark 推送密钥（可选）
wrangler secret put BARK_KEY
```

### 部署

```bash
npm run deploy              # 部署到开发环境
npm run deploy:prod         # 部署到生产环境
```

---

## 📂 项目结构

```
ZYG-online-chat/
├── src/
│   ├── client/                     # React 前端
│   │   ├── App.tsx                 # 根组件（路由入口，含首页/聊天页分发逻辑）
│   │   ├── main.tsx                # React 入口
│   │   ├── components/             # UI 组件
│   │   │   ├── chat/               # 用户端聊天组件（MessageItem 等）
│   │   │   ├── staff/              # 客服端工作台组件
│   │   │   └── ui/                 # 通用 UI 组件
│   │   ├── pages/                  # 页面组件
│   │   │   ├── HomePage.tsx        # 🏠 平台首页（无 business 参数时展示）
│   │   │   ├── ChatPage.tsx        # 访客聊天页（?business=xxx 专属链接进入）
│   │   │   ├── StaffPage.tsx       # 客服工作台
│   │   │   ├── StaffLoginPage.tsx  # 客服登录
│   │   │   ├── AdminPage.tsx       # 管理后台
│   │   │   ├── AdminLoginPage.tsx  # 管理员登录
│   │   │   └── DocsPage.tsx        # 接入文档页
│   │   ├── stores/                 # Zustand 状态管理（chatStore 等）
│   │   ├── hooks/                  # 自定义 Hooks（useSiteSettings 等）
│   │   ├── services/               # API 客户端
│   │   └── context/                # React Context（I18n 国际化）
│   │
│   ├── server/                     # Hono 后端
│   │   ├── index.worker.ts         # Cloudflare Workers 入口
│   │   ├── index.node.ts           # Node.js 入口（本地开发）
│   │   ├── module-chat/            # 聊天模块（核心）
│   │   │   ├── routes/chat-routes.ts
│   │   │   └── services/
│   │   │       ├── chat-service.ts     # 会话/消息管理（含商家验证）
│   │   │       ├── sse-service.ts      # SSE 实时推送
│   │   │       ├── queue-service.ts    # 排队系统
│   │   │       ├── transfer-service.ts # 客服转接
│   │   │       └── upload-service.ts   # 文件上传
│   │   ├── module-staff/           # 客服模块
│   │   ├── module-admin/           # 管理后台模块
│   │   ├── module-auth/            # 认证模块（JWT + 限流）
│   │   ├── module-business/        # 商家/多租户模块
│   │   ├── module-robot/           # AI 知识库模块
│   │   ├── module-faq/             # FAQ 模块
│   │   ├── module-evaluation/      # 评价模块
│   │   ├── services/               # 跨模块服务
│   │   │   ├── translate-service.ts # 6 级翻译引擎链
│   │   │   └── bark-service.ts     # Bark 推送通知
│   │   └── shared/                 # 基础设施层
│   │       ├── db.ts               # 数据库抽象层
│   │       └── db-init.sql         # 数据库初始化 SQL
│   │
│   └── shared/                     # 共享类型与国际化
│       ├── types.ts                # 核心类型定义
│       ├── schemas.ts              # Zod 验证模式
│       ├── rpc-server.ts           # Hono RPC 客户端
│       └── i18n/                   # 国际化
│           └── locales/            # 20 种语言翻译文件
│
├── docs/                           # 文档
│   ├── USER_GUIDE.md               # 用户使用指南
│   ├── STAFF_GUIDE.md              # 客服操作指南
│   ├── INTERACTION.md              # 交互流程文档
│   └── CLOUDFLARE_WORKERS_DEPLOYMENT.md  # 部署详细指南
├── scripts/                        # 脚本工具
│   ├── reset-db.sql                # 数据库重置脚本
│   ├── d1-migrate-*.sql            # 数据库增量迁移脚本
│   └── validate-all.ts             # 全量验证脚本
├── public/                         # 静态资源（PWA 图标、清单等）
├── wrangler.toml                   # Cloudflare Workers 配置
├── vite.config.ts                  # Vite 构建配置
├── tsconfig.json                   # TypeScript 配置
└── package.json                    # 项目依赖
```

---

## 🔗 路径别名

| 别名 | 映射路径 | 用途 |
|------|----------|------|
| `@shared/*` | `src/shared/*` | 共享类型、模式、RPC |
| `@client/*` | `src/client/*` | 前端组件、页面、Store |
| `@server/*` | `src/server/*` | 后端服务、路由 |

---

## 🌍 访问路由说明

系统根据 URL 自动分发到不同页面：

| 访问路径 | 条件 | 展示页面 |
|----------|------|----------|
| `/` | 无 `business` 参数 | 🏠 平台首页 |
| `/` | 带 `?business=xxx` | 💬 访客聊天页 |
| `/chat` | 无 `business` 参数 | 🏠 平台首页 |
| `/chat` | 带 `?business=xxx` | 💬 访客聊天页 |
| `/staff` | — | 🎧 客服工作台 |
| `/stafflogin` | — | 🔑 客服登录 |
| `/admin` | — | ⚙️ 管理后台 |
| `/adminlogin` | — | 🔐 管理员登录 |
| `/docs` | — | 📖 接入文档 |

> **设计理念**：访客必须通过商家的专属链接（如 `https://xxx.workers.dev/chat?business=my-shop`）才能进入客服聊天。直接访问域名会展示平台首页，不会自动创建会话，杜绝配额浪费。

---

## ⚙️ 环境变量

参考 `wrangler.toml` 中的 `[vars]` 配置：

| 变量 | 说明 | 必需 |
|------|------|------|
| `JWT_SECRET` | JWT 签名密钥（至少 32 字符） | ✅ 必需 |
| `BARK_API` | Bark 推送 API 地址 | ❌ 可选 |
| `BARK_KEY` | Bark 推送密钥 | ❌ 可选 |
| `REQUIRE_AUTH` | 是否要求客服登录（`"true"` / `"false"`） | ❌ 可选 |

> **注意**：`STAFF_URL_BASE` 不再需要在配置文件中设置。系统会根据请求的 `host` 头自动构建客服端的完整 URL，自动适配自定义域名或默认 Workers 域名。

---

## 🧪 开发规范

### 模块化架构

每个后端模块遵循统一结构：

```
module-{feature}/
├── routes/         # API 路由（Hono RPC）
├── services/       # 业务逻辑层
└── __tests__/      # 单元测试
```

### 测试策略

| 类型 | 框架 | 环境 | 覆盖范围 |
|------|------|------|----------|
| 单元测试 | Vitest | jsdom / node | Services, Stores, Utils |
| 集成测试 | Vitest | node | API Endpoints |
| E2E 测试 | Playwright | Browser | User Workflows |

### Git 工作流

- 使用 Husky 预提交钩子
- 提交前自动运行 lint-staged（Prettier + ESLint）
- 禁止跳过钩子提交

---

## 📚 文档

- [用户使用指南](./docs/USER_GUIDE.md)
- [客服操作指南](./docs/STAFF_GUIDE.md)
- [交互流程文档](./docs/INTERACTION.md)
- [Cloudflare Workers 部署指南](./docs/CLOUDFLARE_WORKERS_DEPLOYMENT.md)
- [设计文档](./DESIGN.md)

---

## 📄 License

MIT
