---
paths: src/client/services/**/*.ts
---

# Client Service Development Rules

## 📁 File Structure

```typescript
// 1. Imports
import { Todo, CreateTodoInput, UpdateTodoInput } from '@shared/types';

// 2. Configuration constants
const API_BASE_URL = "/api";

// 3. Type definitions
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// 4. Helper functions
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// 5. Named exports
export const listTodos = async () => { ... };
export const createTodo = async (input: CreateTodoInput) => { ... };
```

## 📦 Import Rules

```typescript
// ✅ 共享类型 - 始终使用 @shared 别名
import { Todo, CreateTodoInput } from '@shared/types';

// ✅ 同目录服务 - 使用相对导入
import { mockApi } from './mockApi';

// ✅ 其他目录 - 使用 @client 别名
import { useAppStore } from '@client/stores/appStore';

// ❌ 禁止向上多级相对路径
import { Something } from '../../shared/types';
```

## 🔌 API Client Patterns

### 统一响应格式

```typescript
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

### 函数模板

```typescript
export const listTodos = async (): Promise<ApiResponse<Todo[]>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/todos`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const data = await res.json();
    return { success: true, data };
  } catch (e) {
    return handleError(e);
  }
};

export const createTodo = async (
  input: CreateTodoInput
): Promise<ApiResponse<Todo>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const data = await res.json();
    return { success: true, data };
  } catch (e) {
    return handleError(e);
  }
};
```

### 错误处理

```typescript
// ✅ 集中错误处理
const handleError = (error: unknown): ApiResponse<never> => {
  console.error('[API Error]:', error);
  const message = error instanceof Error ? error.message : 'Unknown error';
  return { success: false, error: message };
};

// ✅ Try-catch with logging
try {
  const result = await someOperation();
  return { success: true, data: result };
} catch (error) {
  console.error('Operation failed:', error);
  return handleError(error);
}
```

## 🎨 导出规范

```typescript
// ✅ 函数使用命名导出
export const listTodos = async () => { ... };
export const getTodo = async (id: string) => { ... };
export const createTodo = async (input: CreateTodoInput) => { ... };
export const updateTodo = async (id: string, input: UpdateTodoInput) => { ... };
export const deleteTodo = async (id: string) => { ... };

// ✅ 类使用命名导出（保持一致）
export class EventService {
  // ...
}

// ✅ 常量使用命名导出
export const API_CONFIG = {
  BASE_URL: '/api',
  TIMEOUT: 5000,
};
```

## ⚡ 异步模式

```typescript
// ✅ 始终使用 async/await (不使用 Promise 链)
export const createTodo = async (
  input: CreateTodoInput
): Promise<ApiResponse<Todo>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    return { success: true, data };
  } catch (e) {
    return handleError(e);
  }
};

// ❌ 避免 Promise 链
export const badExample = (): Promise<any> => {
  return fetch('/api/todos')
    .then(res => res.json())
    .then(data => {
      // ...
    });
};
```

## 🔐 Singleton 模式

```typescript
// ✅ 静态类用于无状态服务
export class EventService {
  private static listeners: Map<string, Set<Function>> = new Map();

  public static on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  public static off(event: string, callback: Function) {
    this.listeners.get(event)?.delete(callback);
  }

  public static emit(event: string, data?: any) {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }
}
```

## 📝 命名规范

| 类型   | 约定             | 示例                                         |
| ------ | ---------------- | -------------------------------------------- |
| 文件名 | camelCase.ts     | `apiClient.ts`, `todoService.ts`             |
| 函数   | camelCase        | `listTodos`, `createTodo`, `updateTodo`      |
| 类     | PascalCase       | `EventService`, `WebSocketService`           |
| 常量   | UPPER_SNAKE_CASE | `API_BASE_URL`, `MAX_RETRY_COUNT`            |
| 接口   | PascalCase       | `ApiResponse`, `TodoFilter`                  |

## 🚫 Anti-Patterns

```typescript
// ❌ 不要混合命名导出和默认导出
class Service { ... }
export default Service;
export const helper = ...;

// ✅ 使用一致的导出风格
export class Service { ... }
export const helper = ...;

// ❌ 不要在服务中直接使用 useState
const [data, setData] = useState();
// 服务应该是纯函数，不应该有 React 依赖

// ❌ 不要在服务中直接操作 DOM
document.getElementById('app')?.innerHTML = '...';
```
