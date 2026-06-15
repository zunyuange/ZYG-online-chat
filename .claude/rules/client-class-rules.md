---
paths: src/client/classes/**/*.ts
---

# Client Class Development Rules

## 📁 File Structure

```typescript
// 1. Imports
import { Todo, CreateTodoInput } from '@shared/types';

// 2. Re-exports (for convenience)
export { TODO_STATUSES };

// 3. Interface definitions
export interface TodoConfig { ... }

// 4. Class declaration
export class TodoManager {
  // Static members
  // Public properties
  // Private properties
  // Constructor
  // Public methods
  // Private methods
}
```

## 📦 Import Rules

```typescript
// ✅ 共享类型 - 始终使用 @shared 别名
import { Todo, TodoStatus } from '@shared/types';

// ✅ 同目录类 - 使用相对导入
import { todoUtils } from './todoUtils';

// ❌ 禁止多级相对路径
import { Something } from '../../../shared/types';

// ❌ 禁止导入 React 相关代码到类中
import { useState } from 'react';
```

## 👁 Visibility Modifiers

```typescript
export class TodoManager {
  // ✅ Public - 对外 API
  public todos: Todo[];
  public filter: TodoStatus;

  // ✅ Private - 内部实现
  private cache: Map<string, Todo> = new Map();
  private isLoading: boolean = false;

  // ❌ 不使用 protected (项目没有继承)
  // protected method() { ... }
}
```

## 🏗️ Method Organization

```typescript
export class TodoManager {
  // 1. Static cache/state
  private static instance: TodoManager | null = null;

  // 2. Constructor
  constructor(private apiClient: ApiClient) {
    // 初始化
  }

  // 3. Public API - Getters
  public getTodos(): Todo[] {
    /* ... */
  }

  // 4. Public API - Setters
  public setFilter(filter: TodoStatus) {
    /* ... */
  }

  // 5. Public API - Actions
  public async addTodo(input: CreateTodoInput): Promise<Todo> {
    /* ... */
  }

  // 6. Public API - Update/Delete
  public updateTodo(id: string, updates: Partial<Todo>): void {
    /* ... */
  }

  public deleteTodo(id: string): void {
    /* ... */
  }

  // 7. Private - Helpers
  private sortTodos(todos: Todo[]): Todo[] {
    /* ... */
  }

  private filterTodos(todos: Todo[]): Todo[] {
    /* ... */
  }
}
```

## 🔧 Static Classes (无状态工具类)

```typescript
// ✅ 静态类用于纯函数工具
export class TodoUtils {
  public static sortByDate(todos: Todo[]): Todo[] {
    // 纯函数 - 无实例状态
    return [...todos].sort((a, b) =>
      a.createdAt - b.createdAt
    );
  }

  public static filterByStatus(todos: Todo[], status: TodoStatus): Todo[] {
    return todos.filter(t => t.status === status);
  }

  public static formatDate(timestamp: number): string {
    // 格式化日期
    return new Date(timestamp).toLocaleDateString();
  }
}

export class ValidationHelper {
  public static validateTodoInput(input: CreateTodoInput): boolean {
    // 验证逻辑
    return input.title.trim().length > 0;
  }
}
```

## 📦 Constants File

```typescript
// ✅ 所有常量使用命名导出
export const MAX_TODO_TITLE_LENGTH = 200;
export const MAX_TODO_DESCRIPTION_LENGTH = 1000;

// ✅ Record 类型用于键值映射
export const TODO_STATUS_LABELS: Record<TodoStatus, string> = {
  pending: '待办',
  in_progress: '进行中',
  completed: '已完成',
};

export const TODO_COLORS: Record<TodoStatus, string> = {
  pending: '#ef4444',
  in_progress: '#f59e0b',
  completed: '#10b981',
};

// ✅ 类型导出
export interface FilterState {
  status: TodoStatus | 'all';
  searchQuery: string;
}
```

## 📝 命名规范

| 类型     | 约定             | 示例                                |
| -------- | ---------------- | ----------------------------------- |
| 文件名   | PascalCase.ts    | `TodoManager.ts`, `TodoUtils.ts`    |
| 类       | PascalCase       | `TodoManager`, `ValidationHelper`   |
| 公共属性 | camelCase        | `todos`, `filter`, `isLoading`      |
| 私有属性 | camelCase        | `cache`, `isLoading`                |
| 公共方法 | camelCase        | `addTodo()`, `updateTodo()`         |
| 私有方法 | camelCase        | `sortTodos()`, `filterTodos()`      |
| 静态属性 | UPPER_SNAKE_CASE | `MAX_TODO_TITLE_LENGTH`, `instance` |

## 🚫 Anti-Patterns

```typescript
// ❌ 不要使用 protected
protected method() { ... }

// ❌ 不要有不必要的公共属性
public data: any;

// ✅ 使用 private 封装实现细节
private cache = new Map();

// ❌ 不要在类中混用命名导出和默认导出
export class MyClass { }
export default MyClass;

// ✅ 使用命名导出
export class MyClass { }
```
