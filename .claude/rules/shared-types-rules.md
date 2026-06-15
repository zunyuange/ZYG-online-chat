---
paths: src/shared/**/*.ts
---

# Shared Types Development Rules

## 🎯 Core Principle

`src/shared/` 目录中的类型必须**完全独立**，不依赖任何其他模块。这些类型在前后端之间共享。

## 📁 File Structure

```typescript
// ==========================================
// SHARED DOMAIN TYPES (Frontend + Backend)
// ==========================================

// 1. Type aliases for string literals
export type TodoStatus = 'pending' | 'in_progress' | 'completed';

// 2. Core data structures
export interface Todo { ... }
export interface CreateTodoInput { ... }
export interface UpdateTodoInput { ... }

// ==========================================
// FRONTEND SPECIFIC TYPES
// ==========================================

// 3. UI state types
export type ViewMode = 'list' | 'grid';

// 4. Helper types
export interface FilterOptions { ... }
```

## 🚫 Strict Constraints

```typescript
// ❌ 禁止任何导入
import { Something } from '../client/...';
import React from 'react';
import { z } from 'zod';

// ✅ shared/ 必须是依赖自由的
// 所有类型必须是纯 TypeScript 类型
```

## 📦 Type Organization

### 按域分类

```typescript
// ==========================================
// SHARED DOMAIN TYPES (Frontend + Backend)
// ==========================================

// 基础类型
export type TodoStatus = 'pending' | 'in_progress' | 'completed';
export type Priority = 'low' | 'medium' | 'high';

// Todo 数据结构
export interface Todo {
  id: number;
  title: string;
  description?: string;
  status: TodoStatus;
  priority?: Priority;
  createdAt: number;
  updatedAt: number;
}

// 输入类型
export interface CreateTodoInput {
  title: string;
  description?: string;
  priority?: Priority;
}

export interface UpdateTodoInput {
  title?: string;
  description?: string;
  status?: TodoStatus;
  priority?: Priority;
}

// ==========================================
// FRONTEND SPECIFIC TYPES
// ==========================================

// UI 状态
export type ViewMode = 'list' | 'grid';
export type FilterStatus = TodoStatus | 'all';

// 编辑器类型
export interface FilterOptions {
  status: FilterStatus;
  searchQuery: string;
}
```

## 📝 命名规范

| 类型     | 约定       | 示例                                        |
| -------- | ---------- | ------------------------------------------- |
| 接口     | PascalCase | `Todo`, `CreateTodoInput`, `FilterOptions`  |
| 类型别名 | PascalCase | `TodoStatus`, `Priority`, `ViewMode`        |
| 枚举     | PascalCase | `TodoStatus` (如果使用 enum)                |
| 可选属性 | `?` 后缀   | `description?: string`, `priority?: Priority` |
| 数组属性 | 复数形式   | `todos`, `tags`                             |

## 🔤 String Literal Types

```typescript
// ✅ 使用类型别名定义字符串字面量
export type TodoStatus = 'pending' | 'in_progress' | 'completed';
export type Priority = 'low' | 'medium' | 'high';
export type ViewMode = 'list' | 'grid';

// ❌ 避免使用 enum (除非确实需要)
enum TodoStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  // ...
}
```

## 🏗️ Interface Pattern

```typescript
// ✅ 接口定义顺序
export interface Todo {
  // 1. 必填标识符
  id: number;

  // 2. 必填数据
  title: string;
  status: TodoStatus;
  createdAt: number;

  // 3. 可选数据
  description?: string;
  priority?: Priority;
  updatedAt?: number;
}
```

## 📂 文件组织

```
src/shared/
├── types.ts           # 主类型文件
├── schemas.ts         # Zod 验证 schemas
└── rpc-types.ts       # RPC 类型定义（如果使用 Hono RPC）
```

## 🔄 同步规则

- **修改共享类型时**：必须同步更新前后端的类型定义
- **添加新类型时**：在文件顶部注释中标明是 SHARED 还是 FRONTEND SPECIFIC
- **删除类型时**：确认前后端都不再使用

## 🚫 Anti-Patterns

```typescript
// ❌ 不要导入任何东西
import { external } from 'external-package';

// ❌ 不要使用默认导出
export default interface Todo { ... }

// ✅ 使用命名导出
export interface Todo { ... }

// ❌ 不要在类型中使用具体实现
export interface BadExample {
  render: () => JSX.Element;  // 包含 React 类型
}
```
