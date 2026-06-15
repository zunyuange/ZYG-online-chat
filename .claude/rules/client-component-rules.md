---
paths: src/client/components/**/*.tsx
---

# Client Component Development Rules

## 📦 Export Convention

**Always use named exports for components.** This enables:

- Better tree-shaking
- Clearer component names in React DevTools
- Easier refactoring (no default export confusion)
- Consistent auto-import behavior

```typescript
// ✅ Good - Named export
export const TodoList: React.FC<TodoListProps> = ({ todos }) => {
  // Implementation
};

// ❌ Bad - Default export
export default function TodoList() {
  return <div>...</div>;
}

// ❌ Bad - Anonymous default export
export default () => {
  return <div>...</div>;
};
```

## 📁 File Structure

组件文件应按以下顺序组织：

```typescript
// 1. Imports (React first, then types, then dependencies)
import React, { useState, useEffect } from 'react';
import { Todo, TodoStatus } from '@shared/types';
import { useAppStore } from '@client/stores/appStore';

// 2. Props interface definition
interface TodoListProps {
  todos: Todo[];
  onToggle?: (id: number) => void;
}

// 3. Local type definitions
type FilterMode = 'all' | 'active' | 'completed';

// 4. Component declaration with named export
export const TodoList: React.FC<TodoListProps> = ({ todos, onToggle }) => {
  // Implementation
};
```

## 📦 Import Rules

```typescript
// ✅ 共享类型 - 始终使用 @shared 别名
import { Todo, CreateTodoInput, TodoStatus } from '@shared/types';

// ✅ 同目录组件 - 使用相对导入和命名导入
import { TodoItem } from './TodoItem';

// ✅ 跨目录导入 - 使用 @client 别名
import { useAppStore } from '@client/stores/appStore';

// ❌ 禁止向上多级相对路径
import { Something } from '../../../services/...';
```

## 🏪 State Management with Zustand

### 核心原则

- **全局状态使用 Zustand Store** - 不使用 useState 管理共享状态
- **最小化重渲染** - 使用选择器精确订阅需要的状态
- **本地 UI 状态使用 useState** - 组件内部的临时状态

### Store 选择器模式

```typescript
// ✅ 精确选择 - 只订阅需要的字段
const todos = useAppStore((state) => state.todos);
const loadTodos = useAppStore((state) => state.loadTodos);

// ✅ 浅比较选择器 - 选择对象时使用 shallow
const { todos, isLoading, loadTodos } = useAppStore(
  (state) => ({ todos: state.todos, isLoading: state.isLoading, loadTodos: state.loadTodos }),
  shallow
);

// ❌ 避免 - 订阅整个 state（任何变化都会重渲染）
const state = useAppStore((state) => state);
```

### 组件内本地状态

```typescript
// 仅用于组件内部的临时 UI 状态
const [isEditing, setIsEditing] = useState(false);
const [editText, setEditText] = useState('');

// ✅ useRef 用于不触发渲染的值
const inputRef = useRef<HTMLInputElement>(null);
```

## 🎨 Props Interface 约定

```typescript
interface TodoListProps {
  // 必填属性在前
  todos: Todo[];

  // 可选属性
  filterStatus?: TodoStatus;

  // 回调函数放在最后
  onToggle?: (id: number) => void;
  onDelete?: (id: number) => void;
}
```

## ⚡ Effect 组织

```typescript
// 1. 初始化
useEffect(() => {
  loadTodos();
}, []);

// 2. 数据同步 (依赖 store 中的状态)
const filterStatus = useAppStore((state) => state.filterStatus);
useEffect(() => {
  if (filterStatus === 'completed') {
    // 执行过滤逻辑
  }
}, [filterStatus]);

// 3. 订阅/取消订阅
useEffect(() => {
  const subscription = someEventSource.subscribe();
  return () => subscription.unsubscribe();
}, []);
```

## 🎯 事件处理

```typescript
// 事件处理器使用 handle 前缀
const handleToggle = (id: number) => {
  onToggle?.(id);
};

const handleDelete = async (id: number) => {
  await deleteTodo(id);
  loadTodos();
};

// 类型安全
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => { ... };
```

## 📝 命名规范

| 类型       | 约定               | 示例                          |
| ---------- | ------------------ | ----------------------------- |
| 组件       | PascalCase         | `TodoList`, `TodoItem`, `TodoForm` |
| 文件名     | PascalCase.tsx     | `TodoList.tsx`                |
| Props 接口 | ComponentNameProps | `TodoListProps`               |
| 事件处理   | handle + CamelCase | `handleClick`, `handleSubmit` |

## 🚫 Anti-Patterns

```typescript
// ❌ 不要用 useState 管理应该共享的状态
const [todos, setTodos] = useState<Todo[]>([]);

// ✅ 使用 Zustand store
const todos = useAppStore(state => state.todos);

// ❌ 不要订阅整个 state
const state = useAppStore(state => state);

// ❌ 不要在 props 中内联复杂类型
const Component = ({ data }: { data: { x: number }[] }) => ...
```

## 🎨 Form 组件特殊约定

```typescript
export const TodoForm: React.FC = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const createTodo = useAppStore((state) => state.createTodo);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      await createTodo({ title, description });
      setTitle('');
      setDescription('');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Todo title..."
        data-testid="todo-title-input"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description..."
        data-testid="todo-description-input"
      />
      <button type="submit" data-testid="add-todo-button">
        Add Todo
      </button>
    </form>
  );
};
```

## data-testid 约定

**为 E2E 测试添加 data-testid 属性**:

```typescript
// ✅ 使用描述性的 testid
<button data-testid="add-todo-button">Add</button>
<input data-testid="todo-title-input" />
<div data-testid="todo-item" data-todo-id={todo.id.toString()}>

// ❌ 避免使用不稳定的属性
<button className="btn-primary">Add</button>
```
