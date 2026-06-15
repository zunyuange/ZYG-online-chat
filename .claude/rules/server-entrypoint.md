---
paths: server/index.ts
---

# Server Entry Point Constraints

## 🎯 Primary Purpose

`server/index.ts` 是服务端的入口文件，负责初始化服务器实例、配置全局设置和挂载路由模块。

## 🚫 Strictly Forbidden

- **禁止在此定义路由处理器** - 不要直接写 `app.post('/...', (c) => { ... })`
- **禁止直接调用 Services** - 业务逻辑应在 Service 层实现，通过 Routes 调用
- **禁止实现工具函数** - 工具函数放在 `server/utils/`

## ✅ Mandatory Practices

### 模块化路由

使用 `app.route()` 挂载路由模块：

```typescript
import { todoRoutes } from './module-todos/routes';
import { userRoutes } from './module-users/routes';

app.route('/api/todos', todoRoutes);
app.route('/api/users', userRoutes);
```

### 全局错误处理

配置全局错误处理和 404 捕获，防止堆栈跟踪泄露：

```typescript
app.notFound((c) => {
  return c.json({ success: false, error: 'Not Found' }, 404);
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ success: false, error: 'Internal Server Error' }, 500);
});
```

### 导出类型

导出 App 类型供前端 Hono RPC 使用：

```typescript
export type AppType = typeof app;
export default app;
```

## 🏗 Template Structure

```typescript
// 1. Imports
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { todoRoutes } from './module-todos/routes';

// 2. App Initialization
const app = new Hono();

// 3. Global Middleware
app.use('/*', cors());

// 4. Error Handling
app.notFound(/* ... */);
app.onError(/* ... */);

// 5. Route Mounting
app.route('/api/todos', todoRoutes);

// 6. Export
export type AppType = typeof app;
export default app;
```

## 📝 Current State

当前 `server/index.ts` 模块化架构，通过 `app.route()` 挂载各业务模块路由。
