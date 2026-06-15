# Cloudflare Workers 部署指南

本文档详细介绍如何将 Hono + React 应用部署到 Cloudflare Workers，包括配置、兼容性处理、常见问题及解决方案。

---

## 目录

1. [架构概述](#架构概述)
2. [前置要求](#前置要求)
3. [配置文件](#配置文件)
4. [Node.js 兼容性处理](#nodejs-兼容性处理)
5. [数据库抽象层](#数据库抽象层)
6. [存储抽象层](#存储抽象层)
7. [SSE 与轮询方案](#sse-与轮询方案)
8. [环境变量配置](#环境变量配置)
9. [GitHub Actions 自动部署](#github-actions-自动部署)
10. [常见问题](#常见问题)

---

## 架构概述

### 部署架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Workers                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Hono API  │  │ Static Files│  │   Workers Assets    │  │
│  │  (index.    │  │   (dist/)   │  │    (SPA routing)    │  │
│  │  worker.ts) │  │             │  │                     │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         ▼                ▼                     ▼             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  D1 Database│  │  R2 Bucket  │  │   Environment Vars  │  │
│  │  (SQLite)   │  │  (Storage)  │  │   + Secrets         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 双环境支持

项目同时支持：
- **本地开发**: Node.js + SQLite + 本地文件系统
- **生产部署**: Cloudflare Workers + D1 + R2

---

## 前置要求

### 1. Cloudflare 账号

确保你有 Cloudflare 账号，并已登录。

### 2. 安装 Wrangler CLI

```bash
npm install -g wrangler
wrangler login
```

### 3. 创建 D1 数据库

```bash
wrangler d1 create online-chat-db
```

记录返回的 `database_id`，稍后需要填入 `wrangler.toml`。

### 4. 创建 R2 存储桶

```bash
wrangler r2 bucket create online-chat-uploads
```

---

## 配置文件

### wrangler.toml

```toml
name = "online-chat"
main = "src/server/index.worker.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

# 静态资源服务配置
[assets]
directory = "./dist"
binding = "ASSETS"

# 环境变量（非敏感信息）
[vars]
BARK_API = "https://api.day.app"
STAFF_URL_BASE = "https://your-app.workers.dev/staff"

# D1 数据库绑定
[[d1_databases]]
binding = "DB"
database_name = "online-chat-db"
database_id = "your-database-id"  # 替换为你的 D1 ID

# R2 存储桶绑定
[[r2_buckets]]
binding = "BUCKET"
bucket_name = "online-chat-uploads"

# 构建命令
[build]
command = "npm run build:worker"

# 生产环境配置
[env.production]
name = "online-chat-prod"

[env.production.vars]
BARK_API = "https://api.day.app"
STAFF_URL_BASE = "https://your-app.workers.dev/staff"
```

### 关键配置说明

| 配置项 | 说明 |
|--------|------|
| `nodejs_compat` | 启用 Node.js 兼容模式 |
| `[assets]` | 配置静态资源目录和绑定名称 |
| `[[d1_databases]]` | D1 数据库绑定 |
| `[[r2_buckets]]` | R2 存储桶绑定 |

---

## Node.js 兼容性处理

### 核心问题

Cloudflare Workers 是 V8 运行时，不是 Node.js 运行时。许多 Node.js API 不可用：

| 不可用 API | 替代方案 |
|-----------|---------|
| `Buffer` | `Uint8Array` / `ArrayBuffer` |
| `process.env` | `c.env` (Hono context) |
| `require()` | 使用 `createRequire` 或 ESM `import` |
| `node:fs` | R2 存储 |
| `node:path` | URL API 或自行实现 |
| `node:sqlite` | D1 数据库 |

### 1. Buffer → Uint8Array

**问题代码**：
```typescript
// ❌ Workers 中会报错：Buffer is not defined
const buffer = Buffer.from(data);
```

**解决方案**：
```typescript
// ✅ 使用 Uint8Array
const uint8Array = new Uint8Array(data);

// ✅ 类型转换工具函数
function toUint8Array(data: Uint8Array | ArrayBuffer): Uint8Array {
  return data instanceof ArrayBuffer ? new Uint8Array(data) : data;
}

function toArrayBuffer(data: Uint8Array | ArrayBuffer): ArrayBuffer {
  return data instanceof Uint8Array
    ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
    : data;
}
```

### 2. process.env → c.env

**问题代码**：
```typescript
// ❌ Workers 中 process.env 不可用
const apiKey = process.env.API_KEY;
```

**解决方案**：
```typescript
// ✅ 通过 Hono context 获取环境变量
app.get('/api/test', (c) => {
  const apiKey = c.env.API_KEY;
  return c.json({ key: apiKey ? 'set' : 'not set' });
});

// ✅ 初始化服务时传入环境变量
export function initMyService(env: { API_KEY?: string }): void {
  _apiKey = env.API_KEY || null;
}

// 在 Workers 入口调用
initMyService({
  API_KEY: c.env.API_KEY,
});
```

### 3. require() → createRequire

**问题代码**：
```typescript
// ❌ ESM 中直接 require 会报错
const fs = require('node:fs');
```

**解决方案**：
```typescript
// ✅ 使用 createRequire 实现 ESM 中的 require
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// 现在可以使用 require
const fs = require('node:fs');
const path = require('node:path');
```

### 4. 条件性 Node.js 模块加载

```typescript
// 检测运行环境
const isNode = typeof process !== 'undefined' && process.versions?.node;

if (isNode) {
  // Node.js 特有逻辑
  const fs = require('node:fs');
} else {
  // Workers 特有逻辑（使用 R2/D1）
}
```

---

## 数据库抽象层

### 接口定义

```typescript
// src/server/shared/db.ts
export interface Database {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: unknown[]): Promise<{ changes: number; lastInsertRowid: number }>;
  get<T>(sql: string, params?: unknown[]): Promise<T | null>;
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
}
```

### D1 适配器

```typescript
import type { D1Database } from '@cloudflare/workers-types';

class D1DatabaseAdapter implements Database {
  constructor(private db: D1Database) {}

  async run(sql: string, params?: unknown[]) {
    const result = await this.db.prepare(sql).bind(...(params || [])).run();
    return {
      changes: result.meta.changes,
      lastInsertRowid: result.meta.last_row_id,
    };
  }

  async get<T>(sql: string, params?: unknown[]): Promise<T | null> {
    return await this.db.prepare(sql).bind(...(params || [])).first<T>();
  }

  async all<T>(sql: string, params?: unknown[]): Promise<T[]> {
    const result = await this.db.prepare(sql).bind(...(params || [])).all<T>();
    return result.results;
  }
}
```

### Node.js SQLite 适配器

```typescript
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

class NodeSQLiteAdapter implements Database {
  private db: import('node:sqlite').DatabaseSync;

  constructor() {
    const { DatabaseSync } = require('node:sqlite');
    this.db = new DatabaseSync('./data/todos.db');
  }

  async run(sql: string, params?: unknown[]) {
    const stmt = this.db.prepare(sql);
    const result = params ? stmt.run(...params) : stmt.run();
    return {
      changes: result.changes,
      lastInsertRowid: Number(result.lastInsertRowid),
    };
  }

  // ... 其他方法
}
```

### 初始化入口

```typescript
let db: Database | null = null;

// Node.js 环境初始化
export async function initializeNodeDb(): Promise<void> {
  if (db) return;
  db = new NodeSQLiteAdapter();
  await initializeSchema();
}

// Workers 环境初始化
export async function initializeD1Db(d1Database: D1Database): Promise<void> {
  db = new D1DatabaseAdapter(d1Database);
  await initializeSchema();
}

// 获取数据库实例
export function getDb(): Database {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}
```

---

## 存储抽象层

### 接口定义

```typescript
// src/server/shared/storage.ts
export interface Storage {
  put(key: string, data: Uint8Array | ArrayBuffer): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
}
```

### R2 适配器

```typescript
import type { R2Bucket } from '@cloudflare/workers-types';

class R2StorageAdapter implements Storage {
  constructor(private bucket: R2Bucket) {}

  async put(key: string, data: Uint8Array | ArrayBuffer): Promise<void> {
    // 关键：转换为 ArrayBuffer
    const arrayBuffer = data instanceof Uint8Array
      ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
      : data;
    await this.bucket.put(key, arrayBuffer);
  }

  async get(key: string): Promise<Uint8Array | null> {
    const object = await this.bucket.get(key);
    if (!object) return null;
    const arrayBuffer = await object.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  async delete(key: string): Promise<boolean> {
    await this.bucket.delete(key);
    return true;
  }

  async exists(key: string): Promise<boolean> {
    const object = await this.bucket.head(key);
    return object !== null;
  }
}
```

### Node.js 文件系统适配器

```typescript
import { createRequire } from 'node:module';

// 懒加载 require - 只在 Node.js 环境中创建
let _nodeRequire: typeof require | null = null;

function getNodeRequire(): typeof require {
  if (!_nodeRequire) {
    // 检查是否在 Node.js 环境且 import.meta.url 有效
    if (typeof import.meta.url === 'string' && import.meta.url.startsWith('file://')) {
      _nodeRequire = createRequire(import.meta.url);
    } else {
      throw new Error('Node.js require not available in this environment');
    }
  }
  return _nodeRequire;
}

class NodeFileSystemAdapter implements Storage {
  private uploadDir: string;

  constructor(uploadDir: string = './data/uploads') {
    this.uploadDir = uploadDir;
    // 只在 Node.js 环境中执行
    const nodeRequire = getNodeRequire();
    const { existsSync, mkdirSync } = nodeRequire('node:fs');
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
    }
  }

  async put(key: string, data: Uint8Array | ArrayBuffer): Promise<void> {
    const nodeRequire = getNodeRequire();
    const { writeFileSync } = nodeRequire('node:fs');
    const { join } = nodeRequire('node:path');

    // 关键：Node.js 需要 Buffer
    const buffer = data instanceof Uint8Array
      ? Buffer.from(data.buffer, data.byteOffset, data.byteLength)
      : Buffer.from(data);

    writeFileSync(join(this.uploadDir, key), buffer);
  }

  async get(key: string): Promise<Uint8Array | null> {
    const nodeRequire = getNodeRequire();
    const { existsSync, readFileSync } = nodeRequire('node:fs');
    const { join } = nodeRequire('node:path');

    const filepath = join(this.uploadDir, key);
    if (!existsSync(filepath)) return null;

    const buffer = readFileSync(filepath);
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  // ... 其他方法
}
```

**关键点**：
- 使用懒加载方式创建 `require`，只在适配器实例化时才调用
- 检查 `import.meta.url` 有效性，确保只在 Node.js 环境中执行
- Workers 环境不会实例化 Node.js 适配器，所以 `createRequire` 不会被调用

---

## SSE 与轮询方案

### 问题背景

Cloudflare Workers 是无状态（stateless）架构：
- 每个请求可能由不同的 Worker 实例处理
- 内存中的 `Map` 或 `Set` 无法跨实例共享
- SSE 连接无法在实例间广播消息

### 解决方案：轮询备用

```typescript
// src/client/stores/chatStore.ts
interface ChatState {
  usePolling: boolean;
  // ...
}

export const useChatStore = create<ChatState>((set, get) => ({
  usePolling: false,

  // SSE 连接
  connectSSE: () => {
    // 始终启动轮询作为备用
    get().startPolling();

    // 尝试 SSE 连接
    const eventSource = new EventSource(`/api/chat/sse/${sessionId}`);

    eventSource.onmessage = (event) => {
      // 收到 SSE 消息时，可以降低轮询频率或停止
      console.log('SSE message received');
    };

    eventSource.onerror = () => {
      // SSE 失败时，轮询继续工作
      console.log('SSE failed, polling continues');
    };
  },

  // 轮询机制
  startPolling: () => {
    set({ usePolling: true });

    const interval = setInterval(() => {
      get().checkNewMessages();
    }, 3000); // 每 3 秒轮询一次

    // 保存 interval ID 以便清理
    pollingInterval = interval;
  },

  stopPolling: () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
    set({ usePolling: false });
  },

  checkNewMessages: async () => {
    const { lastMessageId, session } = get();
    if (!session) return;

    try {
      const response = await fetch(`/api/chat/messages/${session.id}?after=${lastMessageId}`);
      const data = await response.json();

      if (data.success && data.data.length > 0) {
        // 处理新消息
        set((state) => ({
          messages: [...state.messages, ...data.data],
          lastMessageId: data.data[data.data.length - 1].id,
        }));
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  },
}));
```

### 进阶方案：Durable Objects

如果需要真正的实时推送，可以使用 Cloudflare Durable Objects（付费）：

```typescript
// Durable Objects 提供有状态的计算
export class ChatRoom implements DurableObject {
  private connections: Map<WebSocket, { sessionId: string }>;

  async fetch(request: Request) {
    const { 0: client, 1: server } = new WebSocketPair();
    this.handleConnection(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  private broadcast(message: string) {
    for (const [ws] of this.connections) {
      ws.send(message);
    }
  }
}
```

---

## 环境变量配置

### 非敏感变量（wrangler.toml）

```toml
[vars]
BARK_API = "https://api.day.app"
STAFF_URL_BASE = "https://your-app.workers.dev/staff"
```

### 敏感变量（Secrets）

使用 Wrangler CLI 设置：

```bash
# 设置敏感密钥
export https_proxy=http://127.0.0.1:7890  # 如果需要代理
wrangler secret put BARK_KEY
# 输入你的密钥值
```

### 在代码中使用

```typescript
// index.worker.ts
interface Env {
  DB: D1Database;
  BUCKET?: R2Bucket;
  // 环境变量
  BARK_KEY?: string;      // Secret
  BARK_API?: string;      // 非敏感
  STAFF_URL_BASE?: string; // 非敏感
}

// 通过 c.env 访问
app.get('/test', (c) => {
  const barkKey = c.env.BARK_KEY;
  const barkApi = c.env.BARK_API || 'https://api.day.app';
  // ...
});
```

---

## GitHub Actions 自动部署

### 工作流配置

```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloudflare Workers

on:
  push:
    branches:
      - main
      - master
  workflow_dispatch:  # 手动触发

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

### GitHub Secrets 配置

在 GitHub 仓库设置中添加以下 Secrets：

| Secret 名称 | 说明 |
|------------|------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token（需要 Workers Scripts Edit 权限） |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID |
| `BARK_KEY` | 敏感的环境变量（可选） |

### 创建 API Token

1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
2. 点击 "Create Token"
3. 选择 "Edit Cloudflare Workers" 模板
4. 或自定义权限：
   - Account - Workers Scripts - Edit
   - Account - Workers KV Storage - Edit
   - Account - D1 - Edit
   - Account - R2 Storage - Edit

---

## 常见问题

### Q1: `Buffer is not defined`

**原因**：Workers 不支持 Node.js Buffer

**解决**：使用 `Uint8Array` 或 `ArrayBuffer`

```typescript
// ❌ 错误
const buffer = Buffer.from(data);

// ✅ 正确
const uint8Array = new Uint8Array(data);
```

### Q2: SSE 消息无法广播

**原因**：Workers 是无状态的，内存 Map 无法跨实例共享

**解决**：
1. 添加轮询作为备用（推荐，免费）
2. 使用 Durable Objects（付费，真正的实时）

### Q3: 环境变量读取不到

**原因**：
1. 敏感变量需要用 `wrangler secret put` 设置
2. 非敏感变量需要在 `wrangler.toml` 的 `[vars]` 中配置

**解决**：
```bash
# 检查变量是否设置
wrangler secret list

# 设置敏感变量
wrangler secret put BARK_KEY
```

### Q4: 部署后静态资源 404

**原因**：
1. 未运行前端构建
2. `wrangler.toml` 中 `[assets]` 配置错误

**解决**：
```bash
# 构建前端
npm run build

# 检查 dist 目录
ls -la dist/

# 确保 wrangler.toml 配置正确
[assets]
directory = "./dist"
binding = "ASSETS"
```

### Q5: API Token 权限错误

**原因**：API Token 权限不足

**解决**：创建 Token 时确保包含以下权限：
- Workers Scripts - Edit
- D1 - Edit
- R2 Storage - Edit
- Account Settings - Read

### Q6: 数据库迁移问题

**原因**：D1 和 SQLite 语法有细微差异

**解决**：
1. 使用抽象层统一 API
2. Schema 初始化时使用兼容语法

```sql
-- ✅ 兼容 D1 和 SQLite
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- ❌ D1 不支持某些 SQLite 扩展
-- CREATE TABLE users (...); -- 缺少 IF NOT EXISTS
```

### Q7: `createRequire(import.meta.url)` 报错

**原因**：在 Cloudflare Workers 中 `import.meta.url` 返回 `undefined`

**错误信息**：
```
TypeError: The argument 'path' must be a file URL object...
Received 'undefined'
```

**解决**：使用懒加载方式，只在 Node.js 适配器实例化时才创建 require

```typescript
// ❌ 错误 - 模块顶层直接调用
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); // Workers 中会报错

// ✅ 正确 - 懒加载方式
let _nodeRequire: typeof require | null = null;

function getNodeRequire(): typeof require {
  if (!_nodeRequire) {
    if (typeof import.meta.url === 'string' && import.meta.url.startsWith('file://')) {
      _nodeRequire = createRequire(import.meta.url);
    } else {
      throw new Error('Node.js require not available');
    }
  }
  return _nodeRequire;
}

// 在 Node.js 适配器中使用
class NodeSQLiteAdapter {
  constructor() {
    const nodeRequire = getNodeRequire(); // 只在实例化时调用
    const { DatabaseSync } = nodeRequire('node:sqlite');
    // ...
  }
}
```

**原理**：
- Workers 调用 `initializeD1Db()` 和 `initializeR2Storage()`
- 这些函数不会实例化 Node.js 适配器
- 所以 `getNodeRequire()` 永远不会在 Workers 中执行

---

## 部署检查清单

- [ ] 已创建 D1 数据库并记录 `database_id`
- [ ] 已创建 R2 存储桶
- [ ] 已配置 `wrangler.toml`（替换 `database_id` 等）
- [ ] 已设置敏感环境变量（`wrangler secret put`）
- [ ] 已运行 `npm run build` 构建前端
- [ ] 已本地测试 `npm run dev`
- [ ] 已运行 `wrangler deploy` 测试部署
- [ ] 已配置 GitHub Actions Secrets
- [ ] 已验证生产环境功能

---

## 相关资源

- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [D1 数据库文档](https://developers.cloudflare.com/d1/)
- [R2 存储文档](https://developers.cloudflare.com/r2/)
- [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)
- [Hono 框架文档](https://hono.dev/)
