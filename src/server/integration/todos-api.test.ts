/**
 * Integration tests for Todo API endpoints
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { serve } from '@hono/node-server';
import { hc } from 'hono/client';
import app, { type AppType } from '../index';
import { sqlite } from '../shared/db';

/**
 * Type guard for success responses
 */
function isSuccess<T>(response: any): response is { success: true; data: T } {
  return response.success === true && response.data !== undefined;
}

describe('Todo API Integration Tests', () => {
  let server: ReturnType<typeof serve>;
  let client: ReturnType<typeof hc<typeof app>>;

  beforeAll(async () => {
    // Start test server
    server = serve({
      fetch: app.fetch,
      port: 3011,
    });

    // Create API client
    client = hc<AppType>('http://localhost:3011');
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(async () => {
    // Clean up database before each test
    sqlite.exec('DELETE FROM todos');
  });

  describe('GET /api/todos', () => {
    it('should return empty array when no todos exist', async () => {
      const response = await client.api.todos.$get();
      const result = await response.json();

      expect(response.status).toBe(200);
      if (isSuccess(result)) {
        expect(result.data).toEqual([]);
      }
    });

    it('should return all todos', async () => {
      // Create test todos
      const now = Date.now();
      const stmt = sqlite.prepare(`
        INSERT INTO todos (title, status, created_at, updated_at)
        VALUES (:title, :status, :created_at, :updated_at)
      `);
      stmt.run({ title: 'Todo 1', status: 'pending', created_at: now, updated_at: now });
      stmt.run({ title: 'Todo 2', status: 'completed', created_at: now, updated_at: now });

      const response = await client.api.todos.$get();
      const result = await response.json();

      expect(response.status).toBe(200);
      if (isSuccess(result)) {
        expect(result.data).toHaveLength(2);
      }
    });
  });

  describe('GET /api/todos/:id', () => {
    it('should return 404 for non-existent todo', async () => {
      const response = await client.api.todos[':id'].$get({
        param: { id: '999' },
      });

      expect(response.status).toBe(404);
    });

    it('should return todo by id', async () => {
      const now = Date.now();
      const stmt = sqlite.prepare(`
        INSERT INTO todos (title, status, created_at, updated_at)
        VALUES (:title, :status, :created_at, :updated_at)
      `);
      stmt.run({ title: 'Test Todo', status: 'pending', created_at: now, updated_at: now });

      const newTodo = sqlite.prepare('SELECT id FROM todos WHERE title = :title').get({ title: 'Test Todo' }) as { id: number };

      const response = await client.api.todos[':id'].$get({
        param: { id: newTodo.id.toString() },
      });
      const result = await response.json();

      expect(response.status).toBe(200);
      if (isSuccess(result)) {
        // @ts-expect-error - Type narrowing issue with Hono RPC response
        expect(result.data.title).toBe('Test Todo');
      }
    });
  });

  describe('POST /api/todos', () => {
    it('should create a new todo', async () => {
      const input = {
        title: 'New Todo',
        description: 'Test description',
      };

      const response = await client.api.todos.$post({
        json: input,
      });
      const result = await response.json();

      expect(response.status).toBe(201);
      if (isSuccess(result)) {
        // @ts-expect-error - Type narrowing issue with Hono RPC response
        expect(result.data.title).toBe(input.title);
        // @ts-expect-error - Type narrowing issue with Hono RPC response
        expect(result.data.description).toBe(input.description);
      }
    });

    it('should return 400 for invalid input', async () => {
      const response = await client.api.todos.$post({
        json: { title: '' },
      });

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/todos/:id', () => {
    it('should update todo', async () => {
      const now = Date.now();
      const stmt = sqlite.prepare(`
        INSERT INTO todos (title, status, created_at, updated_at)
        VALUES (:title, :status, :created_at, :updated_at)
      `);
      stmt.run({ title: 'Original Title', status: 'pending', created_at: now, updated_at: now });

      const newTodo = sqlite.prepare('SELECT id FROM todos WHERE title = :title').get({ title: 'Original Title' }) as { id: number };

      const updates = {
        title: 'Updated Title',
        status: 'completed' as const,
      };

      const response = await client.api.todos[':id'].$put({
        param: { id: newTodo.id.toString() },
        json: updates,
      });
      const result = await response.json();

      expect(response.status).toBe(200);
      if (isSuccess(result)) {
        // @ts-expect-error - Type narrowing issue with Hono RPC response
        expect(result.data.title).toBe(updates.title);
        // @ts-expect-error - Type narrowing issue with Hono RPC response
        expect(result.data.status).toBe(updates.status);
      }
    });

    it('should return 404 for non-existent todo', async () => {
      const response = await client.api.todos[':id'].$put({
        param: { id: '999' },
        json: { title: 'Updated' },
      });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/todos/:id', () => {
    it('should delete todo', async () => {
      const now = Date.now();
      const stmt = sqlite.prepare(`
        INSERT INTO todos (title, status, created_at, updated_at)
        VALUES (:title, :status, :created_at, :updated_at)
      `);
      stmt.run({ title: 'To Delete', status: 'pending', created_at: now, updated_at: now });

      const newTodo = sqlite.prepare('SELECT id FROM todos WHERE title = :title').get({ title: 'To Delete' }) as { id: number };

      const response = await client.api.todos[':id'].$delete({
        param: { id: newTodo.id.toString() },
      });
      const result = await response.json();

      expect(response.status).toBe(200);
      if (isSuccess(result)) {
        // @ts-expect-error - Type narrowing issue with Hono RPC response
        expect(result.data.id).toBe(newTodo.id);
      }
    });

    it('should return 404 for non-existent todo', async () => {
      const response = await client.api.todos[':id'].$delete({
        param: { id: '999' },
      });

      expect(response.status).toBe(404);
    });
  });
});
