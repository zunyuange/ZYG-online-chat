---
paths: src/client/stores/**/*.ts
---

# Zustand State Management Rules

## 🏪 Store Structure

```typescript
// src/client/stores/appStore.ts
import { create } from 'zustand';
import { shallow } from 'zustand/shallow';
import { Todo, TodoStatus, CreateTodoInput } from '@shared/types';
import * as todoService from '@client/services/apiClient';

// 1. State interface
interface AppState {
  // Data state
  todos: Todo[];
  filterStatus: TodoStatus | 'all';
  searchQuery: string;

  // UI state
  isLoading: boolean;
  error: string | null;

  // Actions
  setTodos: (todos: Todo[]) => void;
  setFilterStatus: (status: TodoStatus | 'all') => void;
  setSearchQuery: (query: string) => void;
  loadTodos: () => Promise<void>;
  createTodo: (input: CreateTodoInput) => Promise<void>;
  updateTodo: (id: number, input: UpdateTodoInput) => Promise<void>;
  deleteTodo: (id: number) => Promise<void>;
}

// 2. Store creation
export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  todos: [],
  filterStatus: 'all',
  searchQuery: '',
  isLoading: false,
  error: null,

  // Actions
  setTodos: (todos) => set({ todos }),

  setFilterStatus: (filterStatus) => set({ filterStatus }),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  loadTodos: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await todoService.listTodos();
      if (res.success && res.data) {
        set({ todos: res.data, isLoading: false });
      } else {
        set({ error: res.error || 'Failed to load todos', isLoading: false });
      }
    } catch (e) {
      set({ error: 'Network error', isLoading: false });
    }
  },

  createTodo: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const res = await todoService.createTodo(input);
      if (res.success && res.data) {
        set(state => ({ todos: [...state.todos, res.data], isLoading: false }));
      } else {
        set({ error: res.error || 'Failed to create todo', isLoading: false });
      }
    } catch (e) {
      set({ error: 'Network error', isLoading: false });
    }
  },

  updateTodo: async (id, input) => {
    set({ isLoading: true, error: null });
    try {
      const res = await todoService.updateTodo(id, input);
      if (res.success && res.data) {
        set(state => ({
          todos: state.todos.map(t => t.id === id ? res.data : t),
          isLoading: false
        }));
      } else {
        set({ error: res.error || 'Failed to update todo', isLoading: false });
      }
    } catch (e) {
      set({ error: 'Network error', isLoading: false });
    }
  },

  deleteTodo: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const res = await todoService.deleteTodo(id);
      if (res.success) {
        set(state => ({
          todos: state.todos.filter(t => t.id !== id),
          isLoading: false
        }));
      } else {
        set({ error: res.error || 'Failed to delete todo', isLoading: false });
      }
    } catch (e) {
      set({ error: 'Network error', isLoading: false });
    }
  },
}));
```

## 📦 Import Rules

```typescript
// ✅ 正确的导入
import { create } from 'zustand';
import { shallow } from 'zustand/shallow';
import { Todo, CreateTodoInput } from '@shared/types';
import * as todoService from '@client/services/apiClient';

// ❌ 禁止在 store 中导入 React
import { useState } from 'react';
```

## 🎯 Selector Patterns (最小化重渲染)

### 单个值选择器

```typescript
// ✅ 只订阅一个值 - 只有这个值变化时才重渲染
const todos = useAppStore((state) => state.todos);
const filterStatus = useAppStore((state) => state.filterStatus);
```

### 多个值选择器 - 使用 shallow

```typescript
// ✅ 订阅多个值 - 使用 shallow 进行浅比较
import { shallow } from 'zustand/shallow';

const { todos, filterStatus, setFilterStatus } = useAppStore(
  (state) => ({
    todos: state.todos,
    filterStatus: state.filterStatus,
    setFilterStatus: state.setFilterStatus,
  }),
  shallow
);

// ❌ 避免 - 直接选择对象会订阅整个对象
const { todos, filterStatus } = useAppStore((state) => state);
```

### 选择器函数

```typescript
// ✅ 使用选择器函数进行派生计算
const filteredTodos = useAppStore((state) =>
  state.todos.filter(todo => {
    if (state.filterStatus !== 'all' && todo.status !== state.filterStatus) {
      return false;
    }
    if (state.searchQuery && !todo.title.includes(state.searchQuery)) {
      return false;
    }
    return true;
  })
);
```

### Actions 选择器

```typescript
// ✅ Actions 是稳定的引用，可以直接选择
const loadTodos = useAppStore((state) => state.loadTodos);
const createTodo = useAppStore((state) => state.createTodo);

// 使用
const handleClick = () => {
  loadTodos();
};
```

## ⚡ Performance Best Practices

### 避免不必要的订阅

```typescript
// ❌ 避免 - 订阅整个 state
const state = useAppStore((state) => state);
// 任何 state 变化都会导致重渲染

// ✅ 正确 - 只订阅需要的字段
const todos = useAppStore((state) => state.todos);
const isLoading = useAppStore((state) => state.isLoading);
```

### 使用 shallow 比较多对象

```typescript
import { shallow } from 'zustand/shallow';

// ✅ shallow 比较对象引用
const { todos, isLoading } = useAppStore(
  (state) => ({ todos: state.todos, isLoading: state.isLoading }),
  shallow
);
```

### Actions 是稳定的

```typescript
// ✅ Actions 函数引用是稳定的，不需要 useCallback
const loadTodos = useAppStore((state) => state.loadTodos);
const createTodo = useAppStore((state) => state.createTodo);

useEffect(() => {
  loadTodos();
}, [loadTodos]); // 依赖是稳定的
```

## 🏗️ Store Organization

### 单 Store vs 多 Store

```typescript
// ✅ 推荐 - 单个主 store
export const useAppStore = create<AppState>((set, get) => ({
  // 所有应用状态
}));

// 如果状态确实很大，可以按域拆分
// src/client/stores/index.ts
export { useAppStore } from './appStore';
export { useUIStore } from './uiStore';
```

### 异步 Actions

```typescript
// ✅ 异步 action 在 store 中定义
createTodo: async (input) => {
  const res = await todoService.createTodo(input);
  if (res.success && res.data) {
    set(state => ({ todos: [...state.todos, res.data] }));
  }
  return res;
},
```

## 🔄 State Updates

### 直接更新

```typescript
// ✅ 简单更新
setFilterStatus: (filterStatus) => set({ filterStatus }),
setSearchQuery: (searchQuery) => set({ searchQuery }),

// ✅ 更新多个字段
setState: (filterStatus, searchQuery) => set({ filterStatus, searchQuery }),
```

### 派生状态更新

```typescript
// ✅ 使用 get() 访问当前 state
toggleTodoStatus: (id: number) => {
  const todo = get().todos.find(t => t.id === id);
  if (todo) {
    set({
      todos: get().todos.map(t =>
        t.id === id
          ? { ...t, status: t.status === 'completed' ? 'pending' : 'completed' }
          : t
      )
    });
  }
},
```

### 数组更新

```typescript
// ✅ 添加到数组
addTodo: (todo: Todo) => set(state => ({
  todos: [...state.todos, todo]
})),

// ✅ 更新数组项
updateTodo: (id: number, updates: Partial<Todo>) => set(state => ({
  todos: state.todos.map(t =>
    t.id === id ? { ...t, ...updates } : t
  )
})),

// ✅ 删除数组项
removeTodo: (id: number) => set(state => ({
  todos: state.todos.filter(t => t.id !== id)
})),
```

## 📝 命名规范

| 类型          | 约定               | 示例                                              |
| ------------- | ------------------ | ------------------------------------------------- |
| Store Hook    | use + Name + Store | `useAppStore`, `useTodoStore`                     |
| State 属性    | camelCase          | `todos`, `filterStatus`, `isLoading`              |
| Actions       | set + 属性名       | `setTodos`, `setFilterStatus`                      |
| Async Actions | verb + Noun        | `loadTodos`, `createTodo`, `updateTodo`, `deleteTodo` |

## 🚫 Anti-Patterns

```typescript
// ❌ 不要在组件中订阅整个 state
const state = useAppStore(state => state);

// ❌ 不要在 store 中使用 React hooks
export const useAppStore = create((set, get) => {
  const [local, setLocal] = useState();  // ❌
  return { ... };
});

// ❌ 不要在组件中创建选择器数组（每次渲染都是新数组）
const [todos, setTodos] = useAppStore(state => [state.todos, state.setTodos]);

// ✅ 使用对象解构 + shallow
const { todos, setTodos } = useAppStore(
  state => ({ todos: state.todos, setTodos: state.setTodos }),
  shallow
);
```

## 📂 File Structure

```
src/client/stores/
├── appStore.ts       # 主应用状态
├── index.ts          # 统一导出
└── __tests__/
    └── appStore.test.ts
```
