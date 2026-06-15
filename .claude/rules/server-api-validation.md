---
paths: server/**/*.ts
---

# Server API Development Rules

## 🏗 Architecture Layers

### 项目结构

服务端应遵循分层架构：

- **Routes** - 定义端点，应用验证器，委托逻辑给 Services
- **Services** - 实现核心业务逻辑，与 Hono Context 解耦
- **Schemas** - 定义 Zod schemas 用于请求/响应验证
- **Utils** - 共享工具函数

示例：
```
src/server/
├── index.ts                    # 服务器入口
├── module-todos/
│   ├── routes/
│   │   └── todos-routes.ts     # Todo 路由
│   ├── services/
│   │   └── todo-service.ts     # Todo 业务逻辑
│   └── __tests__/
│       ├── todos-routes.test.ts
│       └── todo-service.test.ts
├── shared/
│   ├── db.ts                   # 数据库连接
│   └── utils.ts                # 工具函数
```

## 🛡 Validation & Type Safety

- **Schema 位置**: 模块化设计，各模块的 schemas 定义在对应的 routes 文件中
- **验证器**: 使用 `@hono/zod-validator` 的 `zValidator` 进行验证
- **类型获取**: 使用 `c.req.valid('json')` 模式获取验证后的数据
- **类型共享**: 前后端共享类型定义在 `src/shared/types.ts`

### 示例

```typescript
// server/module-todos/routes/todos-routes.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

// Schema 定义在模块内部
const createTodoSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
});

const updateTodoSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(['pending', 'in_progress', 'completed']).optional(),
});

app.post('/todos', zValidator('json', createTodoSchema), async (c) => {
  const data = c.req.valid('json');
  // data 获得完整的类型推断
});
```

## 🔒 Security Requirements

- 所有用户输入必须验证
- 文件操作需要路径验证（防止目录遍历）
- SQL 查询使用参数化（防止 SQL 注入）
- 实施适当的错误处理

## 🚥 Response & Error Handling

### 标准响应格式

```typescript
// 成功
{ success: true, data: any }

// 错误
{ success: false, error: string }
```

### HTTP 状态码

- `200` - 成功
- `400` - 验证失败或业务逻辑错误
- `404` - 资源不存在
- `500` - 服务器错误

### 工具函数

```typescript
// src/server/shared/utils.ts

export function apiResponse<T>(data: T, status = 200) {
  return Response.json({ success: true, data }, { status });
}

export function apiError(message: string, status = 500) {
  return Response.json({ success: false, error: message }, { status });
}
```

## 📝 Best Practices

### 命名规范

- 函数：camelCase
- 类/接口/Zod Schema：PascalCase
- 路由：kebab-case

### 导入规范

```typescript
// ✅ 使用路径别名
import { Todo, CreateTodoInput } from '@shared/types';
import { initializeDb } from '@server/shared/db';

// ❌ 避免相对路径
import { Todo } from '../../shared/types';
```

### 异步与日志

- 所有 I/O 使用 async/await
- API 调用必须有错误处理
- 服务端操作需要描述性日志

## 🚀 Module Pattern

每个业务模块应遵循以下结构：

```typescript
// routes/todos-routes.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { listTodos, createTodo, updateTodo, deleteTodo } from '../services/todo-service';

const app = new Hono();

app.get('/', async (c) => {
  const todos = await listTodos();
  return c.json({ success: true, data: todos });
});

app.post('/', zValidator('json', createTodoSchema), async (c) => {
  const input = c.req.valid('json');
  const todo = await createTodo(input);
  return c.json({ success: true, data: todo });
});

export default app;
```

```typescript
// services/todo-service.ts
import { sqlite } from '../../shared/db';
import type { Todo, CreateTodoInput, UpdateTodoInput } from '@shared/types';

export async function listTodos(): Promise<Todo[]> {
  const stmt = sqlite.prepare('SELECT * FROM todos ORDER BY created_at DESC');
  const rows = stmt.all() as any[];
  return rows.map(row => ({
    id: row.id,
    title: row.title,
    description: row.description || undefined,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }));
}

export async function createTodo(input: CreateTodoInput): Promise<Todo> {
  // 业务逻辑实现
}
```
