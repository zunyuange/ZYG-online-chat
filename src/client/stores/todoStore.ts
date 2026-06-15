/**
 * Zustand store for Todo state management
 */

import { create } from 'zustand';
import { rpcClient } from '@shared/rpc-server';
import type { Todo, CreateTodoInput, UpdateTodoInput } from '@shared/types';

interface TodoState {
  todos: Todo[];
  loading: boolean;
  error: string | null;

  // Actions
  fetchTodos: () => Promise<void>;
  createTodo: (input: CreateTodoInput) => Promise<void>;
  updateTodo: (id: number, input: UpdateTodoInput) => Promise<void>;
  deleteTodo: (id: number) => Promise<void>;
  setError: (error: string | null) => void;
}

// Type guard for API responses
function isSuccess<T>(response: unknown): response is { success: true; data: T } {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    (response as { success: boolean }).success === true &&
    'data' in response
  );
}

export const useTodoStore = create<TodoState>((set) => ({
  todos: [],
  loading: false,
  error: null,

  fetchTodos: async () => {
    set({ loading: true, error: null });
    try {
      const response = await rpcClient.api.todos.$get();
      const result = await response.json();
      if (isSuccess<Todo[]>(result)) {
        set({ todos: result.data, loading: false });
      } else {
        set({ error: (result as { error?: string }).error || 'Failed to fetch todos', loading: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false,
      });
    }
  },

  createTodo: async (input: CreateTodoInput) => {
    set({ loading: true, error: null });
    try {
      const response = await rpcClient.api.todos.$post({
        json: input,
      });
      const result = await response.json();
      if (isSuccess<Todo>(result)) {
        set((state) => ({
          todos: [...state.todos, result.data],
          loading: false,
        }));
      } else {
        set({ error: (result as { error?: string }).error || 'Failed to create todo', loading: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false,
      });
    }
  },

  updateTodo: async (id: number, input: UpdateTodoInput) => {
    set({ loading: true, error: null });
    try {
      const response = await rpcClient.api.todos[':id'].$put({
        param: { id: id.toString() },
        json: input,
      });
      const result = await response.json();
      if (isSuccess<Todo>(result)) {
        set((state) => ({
          todos: state.todos.map((todo) =>
            todo.id === id ? result.data : todo
          ),
          loading: false,
        }));
      } else {
        set({ error: (result as { error?: string }).error || 'Failed to update todo', loading: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false,
      });
    }
  },

  deleteTodo: async (id: number) => {
    set({ loading: true, error: null });
    try {
      const response = await rpcClient.api.todos[':id'].$delete({
        param: { id: id.toString() },
      });
      const result = await response.json();
      if (result.success) {
        set((state) => ({
          todos: state.todos.filter((todo) => todo.id !== id),
          loading: false,
        }));
      } else {
        set({ error: (result as { error?: string }).error || 'Failed to delete todo', loading: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false,
      });
    }
  },

  setError: (error: string | null) => {
    set({ error });
  },
}));
