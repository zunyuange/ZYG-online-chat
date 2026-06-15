/**
 * Todo service layer
 * Business logic for todo operations
 * Using database abstraction layer
 */

import type { Todo, CreateTodoInput, UpdateTodoInput, TodoStatus } from '@shared/types';
import { getDb } from '../../shared/db';

interface TodoRow {
  id: number;
  title: string;
  description: string | null;
  status: string;
  created_at: number;
  updated_at: number;
}

function rowToTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    title: row.title,
    description: row.description || undefined,
    status: row.status as TodoStatus,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * List all todos
 */
export async function listTodos(): Promise<Todo[]> {
  const db = getDb();
  const rows = await db.all<TodoRow>('SELECT * FROM todos ORDER BY created_at DESC');
  return rows.map(rowToTodo);
}

/**
 * Get a todo by ID
 */
export async function getTodo(id: number): Promise<Todo | null> {
  const db = getDb();
  const row = await db.get<TodoRow>('SELECT * FROM todos WHERE id = ?', [id]);
  return row ? rowToTodo(row) : null;
}

/**
 * Create a new todo
 */
export async function createTodo(input: CreateTodoInput): Promise<Todo> {
  const db = getDb();
  const now = Date.now();

  const result = await db.run(
    `INSERT INTO todos (title, description, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [input.title, input.description || null, 'pending', now, now]
  );

  const todo = await getTodo(result.lastInsertRowid);
  if (!todo) throw new Error('Failed to create todo');
  return todo;
}

/**
 * Update a todo
 */
export async function updateTodo(
  id: number,
  input: UpdateTodoInput
): Promise<Todo | null> {
  const db = getDb();
  const now = Date.now();

  // Build update query dynamically
  const updates: string[] = [];
  const params: unknown[] = [];

  if (input.title !== undefined) {
    updates.push('title = ?');
    params.push(input.title);
  }
  if (input.description !== undefined) {
    updates.push('description = ?');
    params.push(input.description);
  }
  if (input.status !== undefined) {
    updates.push('status = ?');
    params.push(input.status);
  }

  if (updates.length === 0) return getTodo(id);

  updates.push('updated_at = ?');
  params.push(now);
  params.push(id);

  await db.run(
    `UPDATE todos SET ${updates.join(', ')} WHERE id = ?`,
    params
  );

  return getTodo(id);
}

/**
 * Delete a todo
 */
export async function deleteTodo(id: number): Promise<boolean> {
  const db = getDb();
  const result = await db.run('DELETE FROM todos WHERE id = ?', [id]);
  return result.changes > 0;
}
